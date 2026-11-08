'use server';

import { randomUUID } from 'crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import { logWriter } from '@/lib/logs/writer';
import { auditOffboarding, auditAccess } from '@/lib/audit/events';
import { revalidatePath } from 'next/cache';
import { sendEmail } from '@/lib/email/sendEmail';
import { platformConfigRefusal } from '@/lib/settings/access';
import { guard, guardResource, maySeeSalary, type Guarded } from '@/lib/rbac/guard';
import { FEATURE_ACCESS } from '@/lib/role-constants';
import { getCurrentEmployee } from '@/lib/forms/currentEmployee';
import {
  OffboardingCase,
  OffboardingChecklistItem,
  OffboardingAssetItem,
  OffboardingNDCDepartment,
  OffboardingFnF,
  OffboardingActivityLog,
  ExitDocument,
  OffboardingSettings,
  DEFAULT_OFFBOARDING_SETTINGS,
  FullOffboardingData,
  InitiateOffboardingInput,
  ResignationRequest,
  ReviewDecision,
  SubmitResignationInput,
} from './types';
import {
  DOCUMENT_GENERATED,
  EXIT_TYPES,
  PERSON_SELECT,
  decideResignation,
  documentName,
  documentsFrom,
  hasOutstandingAssets,
  isClearedAsset,
  isIsoDate,
  isNdcDepartment,
  isReviewDecision,
  isUuid,
  managerIdsOf,
  ndcBlockers,
  pickAssetChanges,
  pickChecklistChanges,
  pickFnfChanges,
  pickNdcChanges,
  pickSettingsChanges,
  sortNdc,
  toCase,
  toRequest,
} from './records';
import { remindOpenExits } from './reminders';
import { assetIntegrationService } from '@/lib/integrations/assets';
import { attendanceIntegrationService } from '@/lib/integrations/attendance';
import { leaveIntegrationService } from '@/lib/integrations/leave';
import { endPlatformAccess } from '@/lib/rbac/endPlatformAccess';
import { applyPreExitRoleRule, lastWorkingDayOf } from '@/lib/offboarding/preExitRoles';

// ============================================================================
// OFFBOARDING
// ----------------------------------------------------------------------------
// Every export below is a server action: the browser can call it directly,
// with any arguments, whichever page imported it. The `/offboarding` route
// gate does not reach them, so each one checks its caller first.
//
// Everything lives in the database. Reads and writes go through the caller's
// own session, so the "offboarding roles" policies answer a second time. The
// service-role client is used only where a session is refused by design and
// the action has already decided the caller may proceed:
//   - the activity log, which only the service role writes (`logWriter`);
//   - the F&F row's status and blockers, which follow from the clearances,
//     for callers without salary access (PnC Ops), and its non-salary columns
//     when they read the case;
//   - an employee's own answer to a retention offer, which may open their
//     exit (the resignation policies let them insert, not update).
// ============================================================================

type Db = SupabaseClient;

const NOT_FOUND = 'Case not found';
const SAVE_FAILED = 'The change could not be saved. Try again.';
const REQUEST_NOT_FOUND = 'Resignation request not found';

/** The F&F columns a caller without salary access may see: status and blockers, no amount. */
const FNF_STATUS_COLUMNS =
  'id, offboarding_id, status, blocked_reasons, payable_days, leave_encashment_days, gratuity_eligible, processed_at, created_at, updated_at';

function logDbError(context: string, error: { code?: string } | null | undefined): void {
  console.error(`Offboarding: ${context}`, { code: error?.code ?? null });
}

function serviceDb(): Db | null {
  return createAdminSupabaseClient();
}

/** Who did it, from the session. Never from what the browser sends. */
function actorOf(caller: Pick<Guarded, 'email'>): string {
  return caller.email ?? 'P&C Operations';
}

// ============================================================================
// ACCESS
// ============================================================================

/**
 * The full-and-final settlement as a caller without salary access may see it.
 *
 * F&F is salary data: the net payable, the deductions taken from it and the
 * bank reference of the payment. PnC Ops runs exits and needs the clearance
 * status and blockers, but the matrix gives them `salary: none`. The remarks
 * go too, because they are where the computed figures get written down.
 * `other_deductions` is required by the type, so it is zeroed rather than
 * dropped; the only screen that shows it is the edit form, which this caller
 * cannot save (`updateFnFDetails`).
 */
function withoutSettlementFigures(fnf: OffboardingFnF): OffboardingFnF {
  return {
    ...fnf,
    other_deductions: 0,
    asset_recovery_amount: 0,
    net_payable_estimate: undefined,
    payment_reference: null,
    payment_date: null,
    remarks: null,
  };
}

/** The signed-in user's own employee id, or null. */
async function currentEmployeeId(): Promise<string | null> {
  const supabase = await createServerSupabaseClient();
  const { employee } = await getCurrentEmployee(supabase);
  return employee?.id ?? null;
}

/** The employee record's email, read past RLS: the closer may not hold `general: view`. */
async function employeeEmail(employeeId: string): Promise<string | null> {
  const admin = createAdminSupabaseClient();
  if (!admin || !employeeId) return null;
  const { data } = await admin.from('employees').select('email').eq('id', employeeId).maybeSingle();
  return (data?.email as string | undefined) ?? null;
}

/**
 * Audit subject for a case or request. Both keys are carried: the employee ID
 * links to their directory record, and the email keeps the trail resolvable
 * after that record is archived at exit.
 */
function auditSubject(c: { employee_id: string; employee_email: string; employee_name: string }) {
  return {
    employee_id: c.employee_id,
    employee_email: c.employee_email,
    employee_name: c.employee_name,
  };
}

// ============================================================================
// LOGS
// ============================================================================

async function recordAuditLog(
  tableName: string,
  recordId: string,
  action: 'insert' | 'update' | 'delete',
  changedData: Record<string, unknown>,
  changedBy: string
): Promise<void> {
  const writer = logWriter();
  if (!writer) return;
  const { error } = await writer.from('audit_log').insert({
    table_name: tableName,
    record_id: recordId,
    action,
    changed_by: null,
    changed_data: { ...changedData, actor: changedBy, timestamp: new Date().toISOString() },
  });
  if (error) logDbError('audit_log write failed', error);
}

type ActivityEntry = Omit<OffboardingActivityLog, 'id' | 'created_at'> & { id?: string };

async function appendActivity(entries: ActivityEntry[]): Promise<void> {
  const writer = logWriter();
  if (!writer || entries.length === 0) return;
  const { error } = await writer.from('offboarding_activity_log').insert(entries);
  if (error) logDbError('activity log write failed', error);
}

// ============================================================================
// READING
// ============================================================================

async function managerNames(db: Db, ids: string[]): Promise<Map<string, string>> {
  if (ids.length === 0) return new Map();
  const { data } = await db.from('employees').select('id, name').in('id', ids);
  return new Map(((data ?? []) as { id: string; name: string }[]).map((r) => [r.id, r.name]));
}

async function readSettings(db: Db): Promise<OffboardingSettings> {
  const { data, error } = await db
    .from('offboarding_settings')
    .select('*')
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  return !error && data ? { ...DEFAULT_OFFBOARDING_SETTINGS, ...data } : { ...DEFAULT_OFFBOARDING_SETTINGS };
}

/** The case row with the person's fields, without the rest of the case. */
async function readCase(db: Db, caseId: string): Promise<OffboardingCase | null> {
  if (!isUuid(caseId)) return null;
  const { data, error } = await db
    .from('offboarding_cases')
    .select(`*, employees(${PERSON_SELECT})`)
    .eq('id', caseId)
    .maybeSingle();
  if (error) {
    logDbError('case read failed', error);
    return null;
  }
  if (!data) return null;
  const managers = await managerNames(db, managerIdsOf([data]));
  return toCase(data, managers);
}

function emptyFnf(caseId: string, at: string): OffboardingFnF {
  return {
    id: `fnf-${caseId}`,
    offboarding_id: caseId,
    status: 'not_started',
    payable_days: 0,
    leave_encashment_days: 0,
    gratuity_eligible: false,
    asset_recovery_amount: 0,
    other_deductions: 0,
    blocked_reasons: [],
    created_at: at,
    updated_at: at,
  };
}

/** The whole case. F&F figures only for a caller who may see salary. */
async function loadCase(db: Db, caseId: string, caller: Guarded): Promise<FullOffboardingData | null> {
  const caseRecord = await readCase(db, caseId);
  if (!caseRecord) return null;

  // PnC Ops runs the exit but holds `salary: none`, and the database closes
  // `offboarding_fnf` to them. They still need to see where the settlement
  // stands and what is blocking it, so for them those columns, and no
  // amount, are read with the service-role client, past the guard.
  const fnfQuery = maySeeSalary(caller)
    ? db.from('offboarding_fnf').select('*')
    : (serviceDb() ?? db).from('offboarding_fnf').select(FNF_STATUS_COLUMNS);

  const [chkRes, assetRes, ndcRes, fnfRes, logsRes] = await Promise.all([
    db.from('offboarding_checklists').select('*').eq('offboarding_id', caseId).order('created_at'),
    db.from('offboarding_asset_clearances').select('*').eq('offboarding_id', caseId).order('created_at'),
    db.from('offboarding_ndc').select('*').eq('offboarding_id', caseId),
    fnfQuery.eq('offboarding_id', caseId).maybeSingle(),
    db.from('offboarding_activity_log').select('*').eq('offboarding_id', caseId).order('created_at', { ascending: false }),
  ]);

  const activityLogs = (logsRes.data ?? []) as OffboardingActivityLog[];
  const fnf: OffboardingFnF = {
    ...emptyFnf(caseId, caseRecord.created_at),
    ...((fnfRes.data as Partial<OffboardingFnF> | null) ?? {}),
  };
  return {
    caseRecord,
    checklist: (chkRes.data ?? []) as OffboardingChecklistItem[],
    assets: (assetRes.data ?? []) as OffboardingAssetItem[],
    ndc: sortNdc((ndcRes.data ?? []) as OffboardingNDCDepartment[]),
    fnf: maySeeSalary(caller) ? fnf : withoutSettlementFigures(fnf),
    activityLogs,
    documents: documentsFrom(activityLogs),
  };
}

export async function getAllOffboardingCases(): Promise<OffboardingCase[]> {
  const allowed = await guard('offboarding');
  if (!allowed.ok) return [];

  const db = await createServerSupabaseClient();
  const { data, error } = await db
    .from('offboarding_cases')
    .select(`*, employees(${PERSON_SELECT})`)
    .order('created_at', { ascending: false });
  if (error) {
    logDbError('case list read failed', error);
    return [];
  }
  const managers = await managerNames(db, managerIdsOf(data ?? []));
  return (data ?? []).map((row) => toCase(row, managers));
}

export async function getOffboardingById(id: string): Promise<FullOffboardingData | null> {
  const allowed = await guard('offboarding');
  if (!allowed.ok) return null;

  const db = await createServerSupabaseClient();
  const fullData = await loadCase(db, id, allowed.caller);
  if (!fullData) return null;

  try {
    const [extAssets, extAtt, extLeave] = await Promise.all([
      assetIntegrationService.getEmployeeAssignedAssets(fullData.caseRecord.employee_id),
      attendanceIntegrationService.getEmployeeAttendanceSummary(fullData.caseRecord.employee_id),
      leaveIntegrationService.getEmployeeLeaveSummary(fullData.caseRecord.employee_id),
    ]);
    fullData.externalAssetsSummary = extAssets;
    fullData.externalAttendanceSummary = extAtt;
    fullData.externalLeaveSummary = extLeave;
  } catch {
    console.warn('Offboarding: could not fetch the external integration summary');
  }
  return fullData;
}

// ============================================================================
// OPENING AN EXIT
// ============================================================================

export async function initiateOffboardingCase(
  input: InitiateOffboardingInput
): Promise<{ success: boolean; caseId?: string; error?: string }> {
  const allowed = await guard('offboarding');
  if (!allowed.ok) return { success: false, error: allowed.error };
  const db = await createServerSupabaseClient();
  return openOffboardingCase(input, db, {
    salary: maySeeSalary(allowed.caller),
    initiatedBy: actorOf(allowed.caller),
  });
}

/**
 * Opens the case: the case row, its checklist, assets, the four No Dues
 * departments and the F&F row, all saved or none.
 *
 * Not exported. Its callers have checked who is asking and pass the client to
 * write with: the caller's session, or the service-role client for an
 * employee's own answer to a retention offer.
 */
async function openOffboardingCase(
  input: InitiateOffboardingInput,
  db: Db,
  opts: { salary: boolean; initiatedBy: string }
): Promise<{ success: boolean; caseId?: string; error?: string }> {
  if (!isUuid(input?.employee_id)) return { success: false, error: 'Choose an employee.' };
  if (!isIsoDate(input.proposed_lwd)) return { success: false, error: 'Enter the last working day.' };
  if (!(EXIT_TYPES as readonly string[]).includes(input.exit_type)) return { success: false, error: 'Choose an exit type.' };
  if (typeof input.reason !== 'string' || input.reason.trim() === '') return { success: false, error: 'Enter a reason.' };

  const caseId = randomUUID();
  const now = new Date();
  const nowIso = now.toISOString();
  // Rows written in one statement share `now()`; distinct timestamps keep the
  // checklist and assets in the order they were written.
  const at = (i: number) => new Date(now.getTime() + i).toISOString();
  const immediate = Boolean(input.immediate_relieving);
  const noticeDays =
    typeof input.notice_period_days === 'number' && input.notice_period_days >= 0 ? Math.round(input.notice_period_days) : 30;
  const initiatedDate = isIsoDate(input.initiated_date) ? input.initiated_date : nowIso.slice(0, 10);

  const caseRow = {
    id: caseId,
    employee_id: input.employee_id,
    exit_type: input.exit_type,
    initiated_date: initiatedDate,
    initiated_by: opts.initiatedBy,
    proposed_lwd: input.proposed_lwd,
    actual_lwd: immediate ? input.proposed_lwd : null,
    notice_period_days: noticeDays,
    notice_period_waived: Boolean(input.notice_period_waived),
    reason: input.reason.slice(0, 500),
    reason_details: typeof input.reason_details === 'string' ? input.reason_details.slice(0, 4000) : null,
    status: immediate ? 'settlement_pending' : 'notice_period',
    immediate_relieving: immediate,
    exception_notes: typeof input.exception_notes === 'string' ? input.exception_notes.slice(0, 4000) : null,
  };

  const person = await readPerson(db, input.employee_id);
  const employeeName = person?.name || input.employee_name || 'Employee';

  const checklist = [
    ['Knowledge Handover Documentation & Repository Transfer', 'Document active project tasks, repositories, drive assets, and runbooks.', 'knowledge_transfer', 'employee', employeeName],
    ['Manager Handover Acceptance & Peer Handover', 'Validate knowledge transfer completion and team reassignments.', 'knowledge_transfer', 'manager', 'Reporting Manager'],
    ['IT Asset & Hardware Return Inspection', 'Verify and return issued laptop, monitor, chargers, and hardware peripherals.', 'asset_return', 'it_admin', 'IT Operations Desk'],
    ['Confidential Exit Interview & Feedback Form', 'Submit confidential reflections, handover feedback, and survey responses.', 'exit_interview', 'employee', employeeName],
    ['Expense Claims & Financial Dues Verification', 'Verify travel advances, reimbursements, or pending claims.', 'finance', 'finance', 'Finance Desk'],
  ].map(([title, description, category, owner_role, assigned_to_name], i) => ({
    offboarding_id: caseId,
    title,
    description,
    category,
    owner_role,
    assigned_to_name,
    status: 'pending',
    is_mandatory: true,
    due_date: input.proposed_lwd,
    created_at: at(i),
    updated_at: at(i),
  }));

  const ndc = [
    ['manager', 'Reporting Manager', 'Handover underway.'],
    ['it_admin', 'IT & Asset Operations', 'Awaiting hardware return.'],
    ['finance', 'Finance & Accounts', 'Expense claims check in progress.'],
    ['pnc', 'People & Culture', 'Awaiting departmental sign-offs.'],
  ].map(([department, department_label, remarks]) => ({
    offboarding_id: caseId,
    department,
    department_label,
    status: 'pending',
    remarks,
  }));

  let assets: Record<string, unknown>[] = [
    {
      offboarding_id: caseId,
      asset_name: 'Company Assigned Laptop & Charger',
      asset_type: 'laptop',
      return_status: 'pending_return',
      condition: 'good',
      clearance_notes: 'Physical check at campus reception on LWD.',
      created_at: at(0),
      updated_at: at(0),
    },
  ];
  const fnf: Record<string, unknown> = {
    offboarding_id: caseId,
    status: 'awaiting_clearance',
    payable_days: 0,
    leave_encashment_days: 0,
    gratuity_eligible: false,
    asset_recovery_amount: 0,
    other_deductions: 0,
    remarks: 'Computation scheduled upon clearance completion.',
    blocked_reasons: ['Department NDC clearances pending', 'Asset verification pending'],
  };

  // Prime the clearances and F&F from the connected systems, where they answer.
  try {
    const [extAssets, extAtt, extLeave] = await Promise.all([
      assetIntegrationService.getEmployeeAssignedAssets(input.employee_id),
      attendanceIntegrationService.getEmployeeAttendanceSummary(input.employee_id),
      leaveIntegrationService.getEmployeeLeaveSummary(input.employee_id),
    ]);
    if (extAssets?.assets?.length) {
      assets = extAssets.assets.map((a, i) => ({
        offboarding_id: caseId,
        asset_name: a.asset_name,
        asset_tag: a.asset_tag,
        asset_type: a.asset_type,
        assigned_date: a.assigned_date,
        return_status: a.external_return_status === 'returned' ? 'returned' : 'pending_return',
        condition: a.external_return_status === 'damaged' ? 'damaged' : 'good',
        recovery_amount: a.estimated_recovery_amount,
        clearance_notes: `Synced from ${extAssets.source_system}. S/N: ${a.serial_number}`,
        created_at: at(i),
        updated_at: at(i),
      }));
    }
    if (extAtt && extLeave && extAssets) {
      fnf.payable_days = extAtt.calculated_payable_days;
      fnf.leave_encashment_days = extLeave.total_encashable_days;
      fnf.asset_recovery_amount = extAssets.total_recovery_required;
      fnf.remarks = `External systems synced: Attendance (${extAtt.calculated_payable_days} payable days), Leave (${extLeave.total_encashable_days} encashable days), Asset recovery (₹${extAssets.total_recovery_required.toLocaleString('en-IN')}).`;
    }
  } catch {
    // The defaults above stand.
  }

  const { error: caseError } = await db.from('offboarding_cases').insert(caseRow);
  if (caseError) {
    logDbError('case insert failed', caseError);
    return { success: false, error: 'The exit could not be saved. Try again.' };
  }

  // The F&F row is salary data: a caller without salary access has it
  // written for them, as part of opening the exit they may open.
  const fnfDb = opts.salary ? db : serviceDb() ?? db;
  const children = await Promise.all([
    db.from('offboarding_checklists').insert(checklist),
    db.from('offboarding_ndc').insert(ndc),
    db.from('offboarding_asset_clearances').insert(assets),
    fnfDb.from('offboarding_fnf').insert(fnf),
  ]);
  const childError = children.find((r) => r.error)?.error;
  if (childError) {
    logDbError('case children insert failed', childError);
    // All or nothing: the children cascade with the case.
    await (serviceDb() ?? db).from('offboarding_cases').delete().eq('id', caseId);
    return { success: false, error: 'The exit could not be saved. Try again.' };
  }

  await appendActivity([
    {
      offboarding_id: caseId,
      actor_name: opts.initiatedBy,
      actor_role: 'pnc',
      action: 'Exit Formally Initiated',
      description: `Exit initiated for ${employeeName} (${input.exit_type.replace(/_/g, ' ')}). Proposed LWD: ${input.proposed_lwd}. Notice: ${noticeDays} days.`,
    },
  ]);

  const email = person?.email || (await employeeEmail(input.employee_id));

  // The stored role ends 72 hours before the last working day. The daily
  // job applies that to every open exit; applying it here too covers an
  // exit opened inside the window (an immediate relieving), which would
  // otherwise keep its role until the job next runs.
  await applyPreExitRoleRule(
    {
      caseId,
      employeeId: input.employee_id,
      employeeEmail: email,
      employeeName,
      lastWorkingDay: lastWorkingDayOf(caseRow),
      status: caseRow.status,
    },
    { now: new Date(), trigger: 'exit opened' }
  );

  await recordAuditLog(
    'offboarding_cases',
    caseId,
    'insert',
    { employee_id: input.employee_id, exit_type: input.exit_type, proposed_lwd: input.proposed_lwd },
    opts.initiatedBy
  );

  try {
    if (email) await sendEmail(
      'offboarding_resignation_ack',
      {
        subject: 'Acknowledgment of Resignation — NavGurukul Foundation',
        employee_name: employeeName,
        resignation_date: initiatedDate,
        notice_period_duration: `${noticeDays} Days`,
        last_working_day: input.proposed_lwd,
        offboarding_portal_link: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/offboarding/${caseId}`,
        hr_poc_name: 'People & Culture Operations',
      },
      email
    );
  } catch {
    console.warn('Offboarding: could not send the resignation acknowledgement');
  }

  await auditOffboarding.caseOpened({
    subject: { employee_id: input.employee_id, employee_email: email, employee_name: employeeName },
    actorName: opts.initiatedBy,
    entityId: caseId,
    exitType: input.exit_type,
    metadata: { proposed_lwd: input.proposed_lwd, notice_period_days: noticeDays, reason: caseRow.reason },
  });

  revalidatePath('/offboarding');
  revalidatePath('/employees');
  return { success: true, caseId };
}

async function readPerson(db: Db, employeeId: string): Promise<{ name: string | null; email: string | null } | null> {
  const { data } = await db.from('employees').select('name, email').eq('id', employeeId).maybeSingle();
  return (data as { name: string | null; email: string | null } | null) ?? null;
}

// ============================================================================
// WORKING THE EXIT
// ============================================================================

export async function updateChecklistItem(
  caseId: string,
  itemId: string,
  updates: Partial<OffboardingChecklistItem>
): Promise<{ success: boolean; error?: string }> {
  const allowed = await guard('offboarding');
  if (!allowed.ok) return { success: false, error: allowed.error };
  if (!isUuid(caseId) || !isUuid(itemId)) return { success: false, error: 'Checklist item not found' };

  const changes = pickChecklistChanges(updates);
  if (Object.keys(changes).length === 0) return { success: false, error: 'Nothing to change.' };

  const actor = actorOf(allowed.caller);
  const nowIso = new Date().toISOString();
  const patch: Record<string, unknown> = { ...changes, updated_at: nowIso };
  if (changes.status) {
    patch.completed_at = changes.status === 'completed' ? nowIso : null;
    patch.completed_by = changes.status === 'completed' ? actor : null;
  }

  const db = await createServerSupabaseClient();
  const { data, error } = await db
    .from('offboarding_checklists')
    .update(patch)
    .eq('id', itemId)
    .eq('offboarding_id', caseId)
    .select('title, status')
    .maybeSingle();
  if (error) {
    logDbError('checklist update failed', error);
    return { success: false, error: SAVE_FAILED };
  }
  if (!data) return { success: false, error: 'Checklist item not found' };

  await appendActivity([
    {
      offboarding_id: caseId,
      actor_name: actor,
      actor_role: 'pnc',
      action: 'Checklist Item Updated',
      description: `"${data.title}" marked as ${String(data.status).toUpperCase()}${changes.notes ? ` — Note: ${changes.notes}` : ''}`,
    },
  ]);
  await recordAuditLog('offboarding_checklists', itemId, 'update', { caseId, title: data.title, status: data.status }, actor);

  revalidatePath(`/offboarding/${caseId}`);
  return { success: true };
}

export async function updateAssetClearance(
  caseId: string,
  assetId: string,
  updates: Partial<OffboardingAssetItem>
): Promise<{ success: boolean; error?: string }> {
  const allowed = await guard('offboarding');
  if (!allowed.ok) return { success: false, error: allowed.error };
  if (!isUuid(caseId) || !isUuid(assetId)) return { success: false, error: 'Asset record not found' };

  const changes = pickAssetChanges(updates);
  if (Object.keys(changes).length === 0) return { success: false, error: 'Nothing to change.' };

  const actor = actorOf(allowed.caller);
  const nowIso = new Date().toISOString();
  const patch: Record<string, unknown> = { ...changes, updated_at: nowIso };
  if (changes.return_status) {
    const verified = changes.return_status === 'cleared' || changes.return_status === 'returned';
    patch.verified_at = verified ? nowIso : null;
    patch.verified_by = verified ? actor : null;
  }

  const db = await createServerSupabaseClient();
  const { data: asset, error } = await db
    .from('offboarding_asset_clearances')
    .update(patch)
    .eq('id', assetId)
    .eq('offboarding_id', caseId)
    .select('asset_name, return_status, recovery_amount, clearance_notes')
    .maybeSingle();
  if (error) {
    logDbError('asset update failed', error);
    return { success: false, error: SAVE_FAILED };
  }
  if (!asset) return { success: false, error: 'Asset record not found' };

  // The IT No Dues sign-off follows the assets: cleared once every asset is
  // back or waived, blocked while one is under recovery.
  const [{ data: allAssets }, { data: itNdc }] = await Promise.all([
    db.from('offboarding_asset_clearances').select('return_status').eq('offboarding_id', caseId),
    db.from('offboarding_ndc').select('status').eq('offboarding_id', caseId).eq('department', 'it_admin').maybeSingle(),
  ]);
  const allCleared = ((allAssets ?? []) as Pick<OffboardingAssetItem, 'return_status'>[]).every(isClearedAsset);
  if (itNdc) {
    let ndcPatch: Record<string, unknown> | null = null;
    if (allCleared && itNdc.status !== 'cleared') {
      ndcPatch = {
        status: 'cleared',
        cleared_at: nowIso,
        cleared_by: actor,
        remarks: 'All assigned assets inspected and verified cleared.',
        blocker_reason: null,
      };
    } else if (!allCleared && asset.return_status === 'under_recovery') {
      ndcPatch = { status: 'blocked', blocker_reason: `Asset recovery pending: ₹${asset.recovery_amount || 0}` };
    }
    if (ndcPatch) {
      const { error: ndcError } = await db
        .from('offboarding_ndc')
        .update({ ...ndcPatch, updated_at: nowIso })
        .eq('offboarding_id', caseId)
        .eq('department', 'it_admin');
      if (ndcError) logDbError('IT sign-off update failed', ndcError);
      else await refreshFnfBlockers(caseId);
    }
  }

  await appendActivity([
    {
      offboarding_id: caseId,
      actor_name: actor,
      actor_role: 'it_admin',
      action: 'Asset Clearance Status Changed',
      description: `Asset "${asset.asset_name}" marked as ${String(asset.return_status).toUpperCase()}${asset.clearance_notes ? ` (${asset.clearance_notes})` : ''}`,
    },
  ]);
  await recordAuditLog(
    'offboarding_asset_clearances',
    assetId,
    'update',
    { caseId, asset_name: asset.asset_name, return_status: asset.return_status },
    actor
  );

  const caseRecord = await readCase(db, caseId);
  if (caseRecord) {
    await auditOffboarding.clearanceUpdated({
      subject: auditSubject(caseRecord),
      actorName: actor,
      entityId: caseId,
      area: `Asset — ${asset.asset_name}`,
      status: asset.return_status,
      severity: asset.return_status === 'under_recovery' ? 'warning' : 'info',
      metadata: { asset_id: assetId, recovery_amount: asset.recovery_amount },
    });
  }

  revalidatePath(`/offboarding/${caseId}`);
  return { success: true };
}

/**
 * Brings the F&F row's status and blockers in line with the No Dues sign-offs:
 * once every department has cleared, F&F is ready for computation.
 *
 * With the service-role client: `offboarding_fnf` is closed to PnC Ops, who
 * clear departments, and this writes only what follows from the clearances.
 * Called only from actions that have passed the offboarding guard.
 */
async function refreshFnfBlockers(caseId: string): Promise<void> {
  const db = serviceDb();
  if (!db) return;
  const [{ data: ndc }, { data: fnf }] = await Promise.all([
    db.from('offboarding_ndc').select('department_label, status, blocker_reason').eq('offboarding_id', caseId),
    db.from('offboarding_fnf').select('status').eq('offboarding_id', caseId).maybeSingle(),
  ]);
  if (!fnf) return;
  const rows = (ndc ?? []) as Pick<OffboardingNDCDepartment, 'department_label' | 'status' | 'blocker_reason'>[];
  const blockers = ndcBlockers(rows);
  const patch: Record<string, unknown> = { blocked_reasons: blockers, updated_at: new Date().toISOString() };
  if (rows.length > 0 && blockers.length === 0 && (fnf.status === 'awaiting_clearance' || fnf.status === 'not_started')) {
    patch.status = 'computation_pending';
    patch.remarks = 'All departmental NDC sign-offs complete. Ready for F&F computation.';
  }
  const { error } = await db.from('offboarding_fnf').update(patch).eq('offboarding_id', caseId);
  if (error) logDbError('F&F blockers update failed', error);
}

export async function updateNDCDepartment(
  caseId: string,
  department: string,
  updates: Partial<OffboardingNDCDepartment>
): Promise<{ success: boolean; error?: string }> {
  const allowed = await guard('offboarding');
  if (!allowed.ok) return { success: false, error: allowed.error };
  if (!isUuid(caseId) || !isNdcDepartment(department)) return { success: false, error: 'Department NDC record not found' };

  const changes = pickNdcChanges(updates);
  if (Object.keys(changes).length === 0) return { success: false, error: 'Nothing to change.' };

  const actor = actorOf(allowed.caller);
  const nowIso = new Date().toISOString();
  const patch: Record<string, unknown> = { ...changes, updated_at: nowIso };
  if (changes.status) {
    patch.cleared_at = changes.status === 'cleared' ? nowIso : null;
    patch.cleared_by = changes.status === 'cleared' ? actor : null;
  }

  const db = await createServerSupabaseClient();
  const { data: ndc, error } = await db
    .from('offboarding_ndc')
    .update(patch)
    .eq('offboarding_id', caseId)
    .eq('department', department)
    .select('department_label, status')
    .maybeSingle();
  if (error) {
    logDbError('NDC update failed', error);
    return { success: false, error: SAVE_FAILED };
  }
  if (!ndc) return { success: false, error: 'Department NDC record not found' };

  await refreshFnfBlockers(caseId);

  await appendActivity([
    {
      offboarding_id: caseId,
      actor_name: actor,
      actor_role: 'pnc',
      action: 'NDC Clearance Updated',
      description: `${ndc.department_label} clearance marked as ${String(ndc.status).toUpperCase()}${changes.remarks ? ` — ${changes.remarks}` : ''}`,
    },
  ]);
  await recordAuditLog('offboarding_ndc', caseId, 'update', { department, status: ndc.status }, actor);

  const caseRecord = await readCase(db, caseId);
  if (caseRecord) {
    await auditOffboarding.clearanceUpdated({
      subject: auditSubject(caseRecord),
      actorName: actor,
      entityId: caseId,
      area: ndc.department_label,
      status: ndc.status,
      severity: ndc.status === 'blocked' ? 'warning' : 'info',
      metadata: { department, remarks: changes.remarks },
    });
  }

  revalidatePath(`/offboarding/${caseId}`);
  return { success: true };
}

export async function updateFnFDetails(
  caseId: string,
  updates: Partial<OffboardingFnF>
): Promise<{ success: boolean; error?: string }> {
  // Settling F&F is writing salary data, which the offboarding feature alone
  // does not grant: PnC Ops runs the exit but has `salary: none`.
  const allowed = await guardResource('salary', 'edit');
  if (!allowed.ok) return { success: false, error: allowed.error };
  if (!isUuid(caseId)) return { success: false, error: NOT_FOUND };

  const changes = pickFnfChanges(updates);
  if (Object.keys(changes).length === 0) return { success: false, error: 'Nothing to change.' };

  const actor = actorOf(allowed.caller);
  const nowIso = new Date().toISOString();
  const patch: Record<string, unknown> = { ...changes, updated_at: nowIso };
  if (changes.status === 'processed') {
    patch.processed_at = nowIso;
    patch.processed_by = actor;
  }

  const db = await createServerSupabaseClient();
  const caseRecord = await readCase(db, caseId);
  if (!caseRecord) return { success: false, error: NOT_FOUND };

  const { data: fnf, error } = await db
    .from('offboarding_fnf')
    .upsert({ offboarding_id: caseId, ...patch }, { onConflict: 'offboarding_id' })
    .select('status, payable_days, payment_reference, net_payable_estimate')
    .single();
  if (error || !fnf) {
    logDbError('F&F update failed', error);
    return { success: false, error: SAVE_FAILED };
  }

  await appendActivity([
    {
      offboarding_id: caseId,
      actor_name: actor,
      actor_role: 'finance',
      action: 'F&F Settlement Updated',
      // No payment reference here: the activity log is shown to everyone who
      // can open the case, PnC Ops included.
      description: `F&F status transitioned to ${String(fnf.status).toUpperCase()}`,
    },
  ]);
  await recordAuditLog('offboarding_fnf', caseId, 'update', { status: fnf.status, payable_days: fnf.payable_days }, actor);

  await auditOffboarding.fnfSettled({
    subject: auditSubject(caseRecord),
    actorName: actor,
    entityId: caseId,
    metadata: {
      status: fnf.status,
      payable_days: fnf.payable_days,
      payment_reference: fnf.payment_reference,
      net_payable_estimate: fnf.net_payable_estimate,
    },
  });

  revalidatePath(`/offboarding/${caseId}`);
  return { success: true };
}

export async function updateExitDates(
  caseId: string,
  proposedLwd: string,
  actualLwd?: string | null,
  reasonForAdjustment?: string
): Promise<{ success: boolean; error?: string }> {
  const allowed = await guard('offboarding');
  if (!allowed.ok) return { success: false, error: allowed.error };
  if (!isIsoDate(proposedLwd)) return { success: false, error: 'Enter the proposed last working day.' };
  if (actualLwd !== undefined && actualLwd !== null && actualLwd !== '' && !isIsoDate(actualLwd)) {
    return { success: false, error: 'Enter a valid actual last working day.' };
  }

  const db = await createServerSupabaseClient();
  const existing = await readCase(db, caseId);
  if (!existing) return { success: false, error: NOT_FOUND };

  const actor = actorOf(allowed.caller);
  const nowIso = new Date().toISOString();
  const patch: Record<string, unknown> = { proposed_lwd: proposedLwd, updated_at: nowIso };
  if (actualLwd !== undefined) patch.actual_lwd = actualLwd || null;

  const { error } = await db.from('offboarding_cases').update(patch).eq('id', caseId);
  if (error) {
    logDbError('exit dates update failed', error);
    return { success: false, error: SAVE_FAILED };
  }
  const updated = {
    ...existing,
    proposed_lwd: proposedLwd,
    actual_lwd: actualLwd === undefined ? existing.actual_lwd : actualLwd || null,
  };

  const reason = typeof reasonForAdjustment === 'string' ? reasonForAdjustment.slice(0, 1000) : undefined;
  await appendActivity([
    {
      offboarding_id: caseId,
      actor_name: actor,
      actor_role: 'pnc',
      action: 'Exit Timeline Adjusted',
      description: `Proposed LWD updated from ${existing.proposed_lwd} to ${proposedLwd}${updated.actual_lwd ? ` (Actual LWD: ${updated.actual_lwd})` : ''}${reason ? `. Reason: ${reason}` : ''}`,
    },
  ]);

  // A last working day brought forward into the 72-hour window ends the
  // stored role now. One pushed back out does not give it back: whoever can
  // grant the role restores it on the users screen.
  await applyPreExitRoleRule(
    {
      caseId,
      employeeId: existing.employee_id,
      employeeEmail: existing.employee_email || (await employeeEmail(existing.employee_id)),
      employeeName: existing.employee_name,
      lastWorkingDay: lastWorkingDayOf(updated),
      status: existing.status,
    },
    { now: new Date(), trigger: 'exit dates changed' }
  );

  await recordAuditLog(
    'offboarding_cases',
    caseId,
    'update',
    { oldProposed: existing.proposed_lwd, newProposed: proposedLwd, actualLwd: updated.actual_lwd },
    actor
  );
  await auditOffboarding.statusChanged({
    subject: auditSubject(existing),
    actorName: actor,
    entityId: caseId,
    to: existing.status,
    severity: 'notice',
    changes: [
      { field: 'proposed_lwd', label: 'Proposed Last Working Day', from: existing.proposed_lwd, to: proposedLwd },
      ...(updated.actual_lwd ? [{ field: 'actual_lwd', label: 'Actual Last Working Day', to: updated.actual_lwd }] : []),
    ],
    metadata: { reason },
  });

  revalidatePath(`/offboarding/${caseId}`);
  return { success: true };
}

/**
 * Closes the exit: the employee is marked exited, the case completed, and
 * their platform access ended. Closing an exit that is already completed
 * retries ending the access, which is what the error below asks for.
 */
export async function closeOffboardingCase(
  caseId: string,
  closedBy?: string,
  actualLwd?: string
): Promise<{ success: boolean; error?: string }> {
  const allowed = await guard('offboarding');
  if (!allowed.ok) return { success: false, error: allowed.error };
  void closedBy; // Who closed it comes from the session.
  if (actualLwd !== undefined && actualLwd !== '' && !isIsoDate(actualLwd)) {
    return { success: false, error: 'Enter a valid last working day.' };
  }

  const db = await createServerSupabaseClient();
  const existing = await loadCase(db, caseId, allowed.caller);
  if (!existing) return { success: false, error: NOT_FOUND };

  const actor = actorOf(allowed.caller);
  const settings = await readSettings(db);
  const alreadyClosed = existing.caseRecord.status === 'completed';

  if (!alreadyClosed) {
    if (existing.caseRecord.status === 'cancelled') {
      return { success: false, error: 'This exit was cancelled and cannot be closed.' };
    }
    if (hasOutstandingAssets(existing.assets) && settings.require_asset_clearance_before_closure) {
      return {
        success: false,
        error: 'Cannot close exit: Outstanding assets are pending return or recovery clearance.',
      };
    }
    if (existing.ndc.some((n) => n.status !== 'cleared') && settings.require_all_ndc_before_fnf) {
      return {
        success: false,
        error: 'Cannot close exit: Not all departments have cleared the No Dues Certificate.',
      };
    }
  }

  const nowIso = new Date().toISOString();
  const finalLwd = actualLwd || existing.caseRecord.actual_lwd || existing.caseRecord.proposed_lwd;

  if (!alreadyClosed) {
    const { error: employeeError } = await db
      .from('employees')
      .update({ status: 'exited', exit_date: finalLwd })
      .eq('id', existing.caseRecord.employee_id);
    if (employeeError) {
      logDbError('employee exit update failed', employeeError);
      return { success: false, error: 'Could not mark the employee as exited. Try again.' };
    }

    const { error: caseError } = await db
      .from('offboarding_cases')
      .update({
        status: 'completed',
        actual_lwd: finalLwd,
        exit_closed_at: nowIso,
        exit_closed_by: actor,
        updated_at: nowIso,
      })
      .eq('id', caseId);
    if (caseError) {
      logDbError('case close update failed', caseError);
      return { success: false, error: 'The employee is marked exited, but the case could not be closed. Try again.' };
    }

    const entries: ActivityEntry[] = [
      {
        offboarding_id: caseId,
        actor_name: actor,
        actor_role: 'pnc',
        action: 'Exit Case Officially Closed',
        description: `Formal exit closure finalized. Employee records updated to Exited (Official LWD: ${finalLwd}). Relieving documentation issued.`,
      },
    ];
    if (!existing.documents.some((d) => d.document_type === 'experience_letter')) {
      entries.push({
        offboarding_id: caseId,
        actor_name: actor,
        actor_role: 'pnc',
        action: DOCUMENT_GENERATED,
        description: `Generated ${documentName('experience_letter', existing.caseRecord.employee_name)}.`,
        metadata: {
          document_type: 'experience_letter',
          document_name: documentName('experience_letter', existing.caseRecord.employee_name),
        },
      });
    }
    await appendActivity(entries);

    await recordAuditLog(
      'offboarding_cases',
      caseId,
      'update',
      { action: 'close_exit', status: 'completed', actual_lwd: finalLwd },
      actor
    );
    await auditOffboarding.statusChanged({
      subject: auditSubject(existing.caseRecord),
      actorName: actor,
      entityId: caseId,
      to: 'completed',
      severity: 'critical',
      metadata: { actual_lwd: finalLwd },
    });
  }

  // Exit ends the person's platform access: their stored role goes, the
  // account is marked ended, and its sessions cannot be renewed. The
  // revocation is recorded once that has succeeded.
  const email = existing.caseRecord.employee_email || (await employeeEmail(existing.caseRecord.employee_id));
  const ended = await endPlatformAccess(email, { endedBy: actor, now: new Date(nowIso) });
  if (!ended.ok) {
    return {
      success: false,
      error: `The exit is recorded, but platform access could not be ended: ${ended.error} Close the exit again to retry.`,
    };
  }
  await auditAccess.revoked({
    subject: auditSubject(existing.caseRecord),
    actorName: actor,
    entityId: caseId,
    system: 'ELC platform',
    metadata: { account_found: ended.userId !== null },
  });

  if (!alreadyClosed) {
    try {
      await sendEmail(
        'offboarding_relieving_experience_letter',
        {
          subject: 'Relieving Documents & Service Certificate — NavGurukul Foundation',
          employee_name: existing.caseRecord.employee_name,
          job_title: existing.caseRecord.employee_designation,
          last_working_day: finalLwd,
          document_download_link: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/offboarding/${caseId}?tab=documents`,
          finance_poc_email: 'finance@navgurukul.org',
        },
        existing.caseRecord.employee_email
      );
    } catch {
      console.warn('Offboarding: could not send the relieving letter');
    }
  }

  revalidatePath('/offboarding');
  revalidatePath(`/offboarding/${caseId}`);
  revalidatePath('/employees');
  return { success: true };
}

/**
 * Generates an exit document (No Dues Certificate or Experience Letter). The
 * document is rendered on demand; generating it is recorded in the activity
 * log, which is what the documents tab is read from.
 */
export async function generateExitDocument(
  caseId: string,
  docType: 'ndc' | 'experience_letter' | 'relieving_letter'
): Promise<{ success: boolean; document?: ExitDocument; error?: string }> {
  const allowed = await guard('offboarding');
  if (!allowed.ok) return { success: false, error: allowed.error };
  if (docType !== 'ndc' && docType !== 'experience_letter' && docType !== 'relieving_letter') {
    return { success: false, error: 'Unknown document type' };
  }

  const db = await createServerSupabaseClient();
  const caseRecord = await readCase(db, caseId);
  if (!caseRecord) return { success: false, error: NOT_FOUND };

  const actor = actorOf(allowed.caller);
  const name = documentName(docType, caseRecord.employee_name);
  const id = randomUUID();
  const generatedAt = new Date().toISOString();
  await appendActivity([
    {
      id,
      offboarding_id: caseId,
      actor_name: actor,
      actor_role: 'pnc',
      action: DOCUMENT_GENERATED,
      description: `Generated ${name}.`,
      metadata: { document_type: docType, document_name: name },
    },
  ]);

  revalidatePath(`/offboarding/${caseId}`);
  return {
    success: true,
    document: { id, offboarding_id: caseId, document_type: docType, document_name: name, status: 'generated', generated_at: generatedAt },
  };
}

/** The "send reminders" button. The scheduled run is `reminders.ts`, behind the cron secret. */
export async function sendOffboardingReminders(): Promise<{
  success: boolean;
  remindersSent: number;
  details: string[];
}> {
  const allowed = await guard('offboarding');
  if (!allowed.ok) return { success: false, remindersSent: 0, details: [allowed.error] };
  const db = await createServerSupabaseClient();
  const result = await remindOpenExits(db);
  return { success: result.success, remindersSent: result.remindersSent, details: result.details };
}

// ============================================================================
// SETTINGS
// ============================================================================

export async function getOffboardingSettings(): Promise<OffboardingSettings> {
  // Read by the Offboarding tab of /manage/settings as well as by the exit
  // screens, so either feature admits. The policy holds nothing sensitive;
  // a refused caller gets the built-in defaults.
  const allowed = await guard([...FEATURE_ACCESS.offboarding, ...FEATURE_ACCESS.platformConfig]);
  if (!allowed.ok) return { ...DEFAULT_OFFBOARDING_SETTINGS };
  return readSettings(await createServerSupabaseClient());
}

export async function updateOffboardingSettings(
  settings: Partial<OffboardingSettings>
): Promise<{ success: boolean; error?: string }> {
  // This is the Offboarding tab of /manage/settings, which PnC Admin reaches
  // read-only, so it answers to the same guard as the writes in
  // settings/service.ts.
  const refused = await platformConfigRefusal();
  if (refused) return refused;

  const changes = pickSettingsChanges(settings);
  if (Object.keys(changes).length === 0) return { success: false, error: 'Nothing to change.' };

  const db = await createServerSupabaseClient();
  const { data: current, error: readError } = await db
    .from('offboarding_settings')
    .select('id')
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (readError) {
    logDbError('settings read failed', readError);
    return { success: false, error: SAVE_FAILED };
  }

  const row = { ...changes, updated_at: new Date().toISOString() };
  // One row holds the policy: update it, or create it the first time.
  const { error } = current
    ? await db.from('offboarding_settings').update(row).eq('id', current.id)
    : await db.from('offboarding_settings').insert({ ...DEFAULT_OFFBOARDING_SETTINGS, ...row });
  if (error) {
    logDbError('settings write failed', error);
    return { success: false, error: SAVE_FAILED };
  }

  await recordAuditLog('offboarding_settings', 'singleton', 'update', changes, 'Platform settings');
  revalidatePath('/manage/settings/offboarding');
  return { success: true };
}

// ============================================================================
// RESIGNATIONS
// ============================================================================

async function readRequest(db: Db, id: string): Promise<ResignationRequest | null> {
  if (!isUuid(id)) return null;
  const { data, error } = await db
    .from('resignation_requests')
    .select(`*, employees(${PERSON_SELECT})`)
    .eq('id', id)
    .maybeSingle();
  if (error) {
    logDbError('resignation read failed', error);
    return null;
  }
  if (!data) return null;
  return toRequest(data, await managerNames(db, managerIdsOf([data])));
}

/** What opening the exit for an accepted resignation needs. */
function exitInputFor(req: ResignationRequest): InitiateOffboardingInput {
  return {
    employee_id: req.employee_id,
    employee_name: req.employee_name,
    employee_email: req.employee_email,
    employee_designation: req.employee_designation,
    employee_department: req.employee_department,
    employee_type: req.employee_designation,
    manager_name: req.manager_name ?? undefined,
    exit_type: 'resignation',
    initiated_date: req.resignation_date,
    initiated_by: '',
    proposed_lwd: req.proposed_lwd,
    notice_period_days: req.notice_period_days,
    reason: req.reason,
    reason_details: req.reason_details ?? undefined,
  };
}

export async function getAllResignationRequests(): Promise<ResignationRequest[]> {
  const allowed = await guard('offboarding');
  if (!allowed.ok) return [];

  const db = await createServerSupabaseClient();
  const { data, error } = await db
    .from('resignation_requests')
    .select(`*, employees(${PERSON_SELECT})`)
    .order('created_at', { ascending: false });
  if (error) {
    logDbError('resignation list read failed', error);
    return [];
  }
  const managers = await managerNames(db, managerIdsOf(data ?? []));
  return (data ?? []).map((row) => toRequest(row, managers));
}

export async function getResignationRequestById(id: string): Promise<ResignationRequest | null> {
  const allowed = await guard('offboarding');
  if (!allowed.ok) return null;
  return readRequest(await createServerSupabaseClient(), id);
}

/**
 * Submits a resignation (from the platform, an email or PnC's own entry).
 * It does not open an exit: that waits for the manager and PnC.
 */
export async function submitResignationRequest(
  input: SubmitResignationInput
): Promise<{ success: boolean; request?: ResignationRequest; error?: string }> {
  // P&C log resignations for anyone, from any channel. Anyone else may only
  // resign themselves, through the platform: an email or P&C entry is not
  // theirs to file, and a P&C entry is accepted on P&C's behalf the moment
  // it is created.
  const allowed = await guard('offboarding');
  let actor: string;
  if (allowed.ok) {
    actor = actorOf(allowed.caller);
  } else {
    const self = await guard('self');
    const ownId = self.ok ? await currentEmployeeId() : null;
    if (!self.ok || !ownId || ownId !== input?.employee_id || input.source !== 'platform') {
      return { success: false, error: allowed.error };
    }
    actor = actorOf(self.caller);
  }

  if (!isUuid(input?.employee_id)) return { success: false, error: 'Choose an employee.' };
  if (input.source !== 'platform' && input.source !== 'email' && input.source !== 'pnc') {
    return { success: false, error: 'Unknown source.' };
  }
  if (!isIsoDate(input.proposed_lwd)) return { success: false, error: 'Enter the last working day.' };
  if (typeof input.reason !== 'string' || input.reason.trim() === '') return { success: false, error: 'Enter a reason.' };

  const nowIso = new Date().toISOString();
  const byPnc = input.source === 'pnc';
  const clip = (v: unknown, max = 4000) => (typeof v === 'string' ? v.slice(0, max) : null);

  const db = await createServerSupabaseClient();
  const { data, error } = await db
    .from('resignation_requests')
    .insert({
      employee_id: input.employee_id,
      source: input.source,
      resignation_date: isIsoDate(input.resignation_date) ? input.resignation_date : nowIso.slice(0, 10),
      proposed_lwd: input.proposed_lwd,
      notice_period_days:
        typeof input.notice_period_days === 'number' && input.notice_period_days >= 0 ? Math.round(input.notice_period_days) : 30,
      reason: input.reason.slice(0, 500),
      reason_details: clip(input.reason_details),
      employee_comments: clip(input.employee_comments),
      email_subject: clip(input.email_subject, 500),
      email_sender: clip(input.email_sender, 320),
      email_body: clip(input.email_body, 20000),
      email_received_at: input.source === 'email' ? nowIso : null,
      manager_decision: 'pending',
      pnc_decision: byPnc ? 'accepted' : 'pending',
      pnc_decision_at: byPnc ? nowIso : null,
      pnc_decision_by: byPnc ? actor : null,
      status: byPnc ? 'manager_pending' : 'submitted',
    })
    .select(`*, employees(${PERSON_SELECT})`)
    .single();
  if (error || !data) {
    logDbError('resignation insert failed', error);
    return { success: false, error: 'The resignation could not be saved. Try again.' };
  }
  const request = toRequest(data, await managerNames(db, managerIdsOf([data])));

  await recordAuditLog(
    'resignation_requests',
    request.id,
    'insert',
    { source: input.source, employee_id: input.employee_id, proposed_lwd: input.proposed_lwd },
    actor
  );

  try {
    if (request.employee_email) await sendEmail(
      'offboarding_resignation_ack',
      {
        subject: `Resignation Request Received: ${request.employee_name} (${input.source.toUpperCase()})`,
        employee_name: request.employee_name,
        resignation_date: request.resignation_date,
        notice_period_duration: `${request.notice_period_days} Days`,
        last_working_day: request.proposed_lwd,
        offboarding_portal_link: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/offboarding?tab=resignations`,
        hr_poc_name: 'People & Culture Review Board',
      },
      request.employee_email
    );
  } catch {
    console.warn('Offboarding: could not send the resignation notification');
  }

  await auditOffboarding.resignationReceived({
    subject: auditSubject(request),
    actorType: request.source === 'platform' ? 'employee' : 'pnc',
    actorName: request.source === 'platform' ? request.employee_name : actor,
    entityId: request.id,
    channel: request.source,
    lastWorkingDay: request.proposed_lwd,
    metadata: { reason: request.reason, notice_period_days: request.notice_period_days },
  });

  revalidatePath('/offboarding');
  return { success: true, request };
}

/**
 * Records the manager's or PnC's decision on a resignation. PnC records the
 * manager's too: managers do not use this screen. Both accepting opens the
 * exit; if it cannot be opened, the decision is not saved, so it can be
 * made again.
 */
export async function submitReviewDecision(
  requestId: string,
  reviewerRole: 'manager' | 'pnc',
  decision: ReviewDecision,
  notes?: string,
  holdDays?: number
): Promise<{ success: boolean; request?: ResignationRequest; error?: string }> {
  const allowed = await guard('offboarding');
  if (!allowed.ok) return { success: false, error: allowed.error };
  if (reviewerRole !== 'manager' && reviewerRole !== 'pnc') return { success: false, error: 'Unknown reviewer.' };
  if (!isReviewDecision(decision)) return { success: false, error: 'Unknown decision.' };

  const db = await createServerSupabaseClient();
  const req = await readRequest(db, requestId);
  if (!req) return { success: false, error: REQUEST_NOT_FOUND };
  if (req.status === 'resignation_accepted' || req.status === 'withdrawn_by_employee' || req.status === 'cancelled') {
    return { success: false, error: 'This resignation has already been decided.' };
  }

  const actor = actorOf(allowed.caller);
  const settings = await readSettings(db);
  const safeNotes = typeof notes === 'string' ? notes.slice(0, 4000) : null;
  const { patch, opensExit } = decideResignation(req, {
    reviewerRole,
    decision,
    notes: safeNotes,
    holdDays: typeof holdDays === 'number' ? holdDays : null,
    defaultHoldDays: settings.standard_hold_period_days || 7,
    actor: reviewerRole === 'manager' ? `Reporting Manager (recorded by ${actor})` : actor,
    now: new Date(),
  });

  let offboardingCaseId: string | null = req.offboarding_case_id ?? null;
  if (opensExit) {
    const opened = await openOffboardingCase(exitInputFor(req), db, {
      salary: maySeeSalary(allowed.caller),
      initiatedBy: `Approved by Manager & P&C (${actor})`,
    });
    if (!opened.success || !opened.caseId) {
      return { success: false, error: opened.error ?? 'The exit could not be opened. Try again.' };
    }
    offboardingCaseId = opened.caseId;
  }

  const { error } = await db
    .from('resignation_requests')
    .update({ ...patch, offboarding_case_id: offboardingCaseId, updated_at: new Date().toISOString() })
    .eq('id', req.id);
  if (error) {
    logDbError('resignation decision update failed', error);
    return { success: false, error: SAVE_FAILED };
  }
  const updated: ResignationRequest = { ...req, ...patch, offboarding_case_id: offboardingCaseId };

  await recordAuditLog(
    'resignation_requests',
    req.id,
    'update',
    { reviewerRole, decision, newStatus: updated.status, notes: safeNotes },
    actor
  );
  await auditOffboarding.statusChanged({
    subject: auditSubject(updated),
    actorType: reviewerRole === 'manager' ? 'manager' : 'pnc',
    actorName: reviewerRole === 'manager' ? updated.manager_decision_by : updated.pnc_decision_by,
    entityId: req.id,
    to: updated.status,
    severity: 'notice',
    changes: [
      {
        field: `${reviewerRole}_decision`,
        label: reviewerRole === 'manager' ? 'Manager Decision' : 'P&C Decision',
        to: decision,
      },
    ],
    metadata: { notes: safeNotes, hold_until: updated.hold_until_date },
  });

  revalidatePath('/offboarding');
  return { success: true, request: updated };
}

/**
 * The employee's answer to a retention offer: staying closes the resignation;
 * declining opens the exit. Only while an offer is open.
 */
export async function respondToRetention(
  requestId: string,
  response: 'accepted_withdrawal' | 'declined_withdrawal',
  notes?: string
): Promise<{ success: boolean; request?: ResignationRequest; error?: string }> {
  // The retention offer is answered by the employee it was made to, or by
  // P&C recording that answer for them. Nobody else.
  const allowed = await guard('offboarding');
  const self = allowed.ok ? null : await guard('self');
  const ownId = self?.ok ? await currentEmployeeId() : null;
  if (!allowed.ok && !ownId) return { success: false, error: allowed.error };
  if (response !== 'accepted_withdrawal' && response !== 'declined_withdrawal') {
    return { success: false, error: 'Unknown response.' };
  }

  const session = await createServerSupabaseClient();
  const req = await readRequest(session, requestId);
  if (!req) return { success: false, error: REQUEST_NOT_FOUND };
  if (!allowed.ok && req.employee_id !== ownId) return { success: false, error: allowed.error };
  if (req.status !== 'withdrawal_proposed') {
    return { success: false, error: 'There is no retention offer to answer on this resignation.' };
  }

  // The employee's own session may read their resignation but not change it,
  // and opening their exit writes offboarding tables they cannot reach: both
  // go through the service-role client, now that the request is theirs and
  // an offer is open.
  const db = allowed.ok ? session : serviceDb();
  if (!db) return { success: false, error: 'Responses are unavailable: no service-role key.' };
  const actor = allowed.ok ? actorOf(allowed.caller) : req.employee_name;

  const nowIso = new Date().toISOString();
  const safeNotes = typeof notes === 'string' ? notes.slice(0, 4000) : null;
  const patch: Partial<ResignationRequest> = {
    employee_retention_response: response,
    employee_response_at: nowIso,
    employee_response_notes: safeNotes,
  };

  let offboardingCaseId: string | null = req.offboarding_case_id ?? null;
  if (response === 'accepted_withdrawal') {
    patch.status = 'withdrawn_by_employee';
    patch.retention_notes = safeNotes
      ? `Withdrawal Accepted: ${safeNotes}`
      : 'Employee agreed to retention proposal and withdrew resignation.';
  } else {
    patch.status = 'resignation_accepted';
    const opened = await openOffboardingCase(exitInputFor(req), db, {
      salary: allowed.ok ? maySeeSalary(allowed.caller) : true,
      initiatedBy: `Employee declined retention (${actor})`,
    });
    if (!opened.success || !opened.caseId) {
      return { success: false, error: opened.error ?? 'The exit could not be opened. Try again.' };
    }
    offboardingCaseId = opened.caseId;
  }

  const { error } = await db
    .from('resignation_requests')
    .update({ ...patch, offboarding_case_id: offboardingCaseId, updated_at: nowIso })
    .eq('id', req.id);
  if (error) {
    logDbError('retention response update failed', error);
    return { success: false, error: SAVE_FAILED };
  }
  const updated: ResignationRequest = { ...req, ...patch, offboarding_case_id: offboardingCaseId };

  await recordAuditLog(
    'resignation_requests',
    req.id,
    'update',
    { employee_response: response, newStatus: updated.status, notes: safeNotes },
    actor
  );

  revalidatePath('/offboarding');
  return { success: true, request: updated };
}

/** PnC resolves a disagreement between the manager's decision and their own. */
export async function resolveDisagreement(
  requestId: string,
  resolvedDecision: 'accepted' | 'retention_proposed',
  notes?: string
): Promise<{ success: boolean; request?: ResignationRequest; error?: string }> {
  const allowed = await guard('offboarding');
  if (!allowed.ok) return { success: false, error: allowed.error };
  if (resolvedDecision !== 'accepted' && resolvedDecision !== 'retention_proposed') {
    return { success: false, error: 'Unknown decision.' };
  }

  const db = await createServerSupabaseClient();
  const req = await readRequest(db, requestId);
  if (!req) return { success: false, error: REQUEST_NOT_FOUND };
  if (req.status !== 'decision_pending') return { success: false, error: 'There is no disagreement to resolve.' };

  const actor = actorOf(allowed.caller);
  const safeNotes = typeof notes === 'string' ? notes.slice(0, 4000) : null;
  const patch: Partial<ResignationRequest> = {
    retention_notes: safeNotes || `Disagreement formally resolved by P&C Authority to: ${resolvedDecision.toUpperCase()}`,
  };

  let offboardingCaseId: string | null = req.offboarding_case_id ?? null;
  if (resolvedDecision === 'accepted') {
    patch.manager_decision = 'accepted';
    patch.pnc_decision = 'accepted';
    patch.status = 'resignation_accepted';
    const opened = await openOffboardingCase(exitInputFor(req), db, {
      salary: maySeeSalary(allowed.caller),
      initiatedBy: `P&C disagreement resolution (${actor})`,
    });
    if (!opened.success || !opened.caseId) {
      return { success: false, error: opened.error ?? 'The exit could not be opened. Try again.' };
    }
    offboardingCaseId = opened.caseId;
  } else {
    patch.status = 'withdrawal_proposed';
  }

  const { error } = await db
    .from('resignation_requests')
    .update({ ...patch, offboarding_case_id: offboardingCaseId, updated_at: new Date().toISOString() })
    .eq('id', req.id);
  if (error) {
    logDbError('disagreement resolution update failed', error);
    return { success: false, error: SAVE_FAILED };
  }
  const updated: ResignationRequest = { ...req, ...patch, offboarding_case_id: offboardingCaseId };

  await recordAuditLog(
    'resignation_requests',
    req.id,
    'update',
    { resolvedDecision, newStatus: updated.status, notes: safeNotes },
    actor
  );

  revalidatePath('/offboarding');
  return { success: true, request: updated };
}
