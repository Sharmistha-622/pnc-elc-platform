'use server';

import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import { logWriter } from '@/lib/logs/writer';
import { auditOffboarding, auditAccess, auditLetters } from '@/lib/audit/events';
import { revalidatePath } from 'next/cache';
import { sendEmail } from '@/lib/email/sendEmail';
import { platformConfigRefusal } from '@/lib/settings/access';
import { guard, guardResource, maySeeSalary } from '@/lib/rbac/guard';
import { FEATURE_ACCESS } from '@/lib/role-constants';
import { getCurrentEmployee } from '@/lib/forms/currentEmployee';
import {
  ExitType,
  OffboardingStatus,
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
  ResignationSource,
  ReviewDecision,
  EmployeeRetentionResponse,
  ResignationRequestStatus,
  SubmitResignationInput,
} from './types';
import { assetIntegrationService } from '@/lib/integrations/assets';
import { attendanceIntegrationService } from '@/lib/integrations/attendance';
import { leaveIntegrationService } from '@/lib/integrations/leave';
import { getEmployees } from '@/lib/employees/getEmployees';
import { endPlatformAccess } from '@/lib/rbac/endPlatformAccess';
import { applyPreExitRoleRule, lastWorkingDayOf } from '@/lib/offboarding/preExitRoles';


// ============================================================================
// DEFAULT CONFIGURATION & RECOVERY SETTINGS
// ============================================================================

let MEMORY_SETTINGS = { ...DEFAULT_OFFBOARDING_SETTINGS };

// ============================================================================
// REALISTIC SEED DATA COVERING ALL 7 REQUIRED SCENARIOS
// ============================================================================

const MEMORY_OFFBOARDING_STORE: Map<string, FullOffboardingData> = new Map();

function initSeedScenarios() {
  // In-memory store starts empty in production.
}

// ============================================================================
// AUDIT LOG HELPER
// ============================================================================

async function recordAuditLog(
  tableName: string,
  recordId: string,
  action: 'insert' | 'update' | 'delete',
  changedData: Record<string, any>,
  changedBy: string = 'pnc-user'
) {
  try {
    const supabase = logWriter();
    if (!supabase) return;
    await supabase.from('audit_log').insert({
      table_name: tableName,
      record_id: recordId,
      action,
      changed_by: null, // nullable in audit_log schema
      changed_data: {
        ...changedData,
        actor: changedBy,
        timestamp: new Date().toISOString(),
      },
    });
  } catch {
    // Audit table may not exist in local mode
  }
}

// ============================================================================
// ACCESS
// ----------------------------------------------------------------------------
// Every export below is a server action: the browser can call it directly,
// with any arguments, whichever page imported it. The `/offboarding` route
// gate does not reach them, so each one checks its caller here.
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

// ============================================================================
// CORE SERVICE LAYER METHODS
// ============================================================================

/**
 * Fetch all offboarding cases.
 */
/**
 * Audit subject for an offboarding case. Both keys are carried: the employee
 * ID links to their directory record, and the email keeps the trail resolvable
 * after that record is archived at exit.
 */
/** The employee record's email, read past RLS: the closer may not hold `general: view`. */
async function employeeEmail(employeeId: string): Promise<string | null> {
  const admin = createAdminSupabaseClient();
  if (!admin || !employeeId) return null;
  const { data } = await admin.from('employees').select('email').eq('id', employeeId).maybeSingle();
  return (data?.email as string | undefined) ?? null;
}

function auditSubject(c: { employee_id: string; employee_email: string; employee_name: string }) {
  return {
    employee_id: c.employee_id,
    employee_email: c.employee_email,
    employee_name: c.employee_name,
  };
}

export async function getAllOffboardingCases(): Promise<OffboardingCase[]> {
  const allowed = await guard('offboarding');
  if (!allowed.ok) return [];

  try {
    const supabase = await createServerSupabaseClient();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);

    const { data, error } = await supabase
      .from('offboarding_cases')
      .select('*, employees(name, email, team)')
      .order('created_at', { ascending: false })
      .abortSignal(controller.signal);

    clearTimeout(timeout);

    if (!error && data) {
      return data.map((row: any) => ({
        ...row,
        employee_name: row.employees?.name || row.employee_name,
        employee_email: row.employees?.email || row.employee_email,
      }));
    }
  } catch (err) {
    // Fallback to memory (timeout, missing table, or network error)
  }

  return Array.from(MEMORY_OFFBOARDING_STORE.values())
    .map((item) => item.caseRecord)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}

/**
 * Fetch a single offboarding case by ID with all related records.
 */
export async function getOffboardingById(id: string): Promise<FullOffboardingData | null> {
  const allowed = await guard('offboarding');
  if (!allowed.ok) return null;

  let fullData: FullOffboardingData | null = null;
  try {
    const supabase = await createServerSupabaseClient();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);

    const { data: caseRow, error: caseErr } = await supabase
      .from('offboarding_cases')
      .select('*, employees(*)')
      .eq('id', id)
      .abortSignal(controller.signal)
      .single();

    clearTimeout(timeout);

    if (!caseErr && caseRow) {
      // PnC Ops runs the exit but holds `salary: none`, and the database
      // closes `offboarding_fnf` to them. They still need to see where the
      // settlement stands and what is blocking it, so for them those columns
      // — and no amount — are read with the service-role client, past the
      // `offboarding` guard above.
      const salary = maySeeSalary(allowed.caller);
      const fnfQuery = salary
        ? supabase.from('offboarding_fnf').select('*')
        : (createAdminSupabaseClient() ?? supabase)
            .from('offboarding_fnf')
            .select(
              'id, offboarding_id, status, blocked_reasons, payable_days, leave_encashment_days, gratuity_eligible, processed_at, created_at, updated_at'
            );
      const [chkRes, assetRes, ndcRes, fnfRes, logsRes] = await Promise.all([
        supabase.from('offboarding_checklists').select('*').eq('offboarding_id', id),
        supabase.from('offboarding_asset_clearances').select('*').eq('offboarding_id', id),
        supabase.from('offboarding_ndc').select('*').eq('offboarding_id', id),
        fnfQuery.eq('offboarding_id', id).maybeSingle(),
        supabase.from('offboarding_activity_log').select('*').eq('offboarding_id', id).order('created_at', { ascending: false }),
      ]);

      const caseRecord: OffboardingCase = {
        ...caseRow,
        employee_name: caseRow.employees?.name || caseRow.employee_name,
        employee_email: caseRow.employees?.email || caseRow.employee_email,
      };

      fullData = {
        caseRecord,
        checklist: chkRes.data || [],
        assets: assetRes.data || [],
        ndc: ndcRes.data || [],
        fnf: {
          id: `fnf-${id}`,
          offboarding_id: id,
          status: 'not_started',
          payable_days: 0,
          leave_encashment_days: 0,
          gratuity_eligible: false,
          asset_recovery_amount: 0,
          other_deductions: 0,
          blocked_reasons: [],
          created_at: caseRow.created_at,
          updated_at: caseRow.updated_at,
          ...((fnfRes.data as Partial<OffboardingFnF> | null) ?? {}),
        },
        activityLogs: logsRes.data || [],
        documents: [],
      };
    }
  } catch {
    // Fallback to memory (timeout, missing table, or network error)
  }

  if (!fullData) {
    fullData = MEMORY_OFFBOARDING_STORE.get(id) || null;
  }

  if (fullData) {
    try {
      const [extAssets, extAtt, extLeave] = await Promise.all([
        assetIntegrationService.getEmployeeAssignedAssets(fullData.caseRecord.employee_id),
        attendanceIntegrationService.getEmployeeAttendanceSummary(fullData.caseRecord.employee_id),
        leaveIntegrationService.getEmployeeLeaveSummary(fullData.caseRecord.employee_id),
      ]);
      fullData.externalAssetsSummary = extAssets;
      fullData.externalAttendanceSummary = extAtt;
      fullData.externalLeaveSummary = extLeave;
    } catch (err) {
      console.warn('Could not fetch external integration summary:', err);
    }
  }

  // A copy, not the stored record: the memory store hands back the live
  // object, and redacting that in place would erase the figures for everyone.
  if (fullData && !maySeeSalary(allowed.caller)) {
    return { ...fullData, fnf: withoutSettlementFigures(fullData.fnf) };
  }

  return fullData;
}


/**
 * Initiate an employee exit.
 */
export async function initiateOffboardingCase(
  input: InitiateOffboardingInput
): Promise<{ success: boolean; caseId?: string; error?: string }> {
  const allowed = await guard('offboarding');
  if (!allowed.ok) return { success: false, error: allowed.error };
  return openOffboardingCase(input);
}

/**
 * Opens the case. Not exported: the resignation flow calls this once a
 * resignation is accepted, which can follow an employee's own response to a
 * retention offer (`respondToRetention`), and that caller has already been
 * checked by the action that got here.
 */
async function openOffboardingCase(
  input: InitiateOffboardingInput
): Promise<{ success: boolean; caseId?: string; error?: string }> {
  try {
    const caseId = `off-case-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
    const nowIso = new Date().toISOString();

    const initialStatus: OffboardingStatus = input.immediate_relieving ? 'settlement_pending' : 'notice_period';
    const noticeDays = input.notice_period_days ?? 30;

    const newCase: OffboardingCase = {
      id: caseId,
      employee_id: input.employee_id,
      employee_name: input.employee_name,
      employee_email: input.employee_email,
      employee_designation: input.employee_designation,
      employee_department: input.employee_department,
      employee_type: input.employee_type,
      manager_name: input.manager_name || 'Assigned Manager',
      exit_type: input.exit_type,
      initiated_date: input.initiated_date || new Date().toISOString().split('T')[0],
      initiated_by: input.initiated_by || 'P&C Operations',
      proposed_lwd: input.proposed_lwd,
      actual_lwd: input.immediate_relieving ? input.proposed_lwd : null,
      notice_period_days: noticeDays,
      notice_period_waived: Boolean(input.notice_period_waived),
      reason: input.reason,
      reason_details: input.reason_details,
      status: initialStatus,
      immediate_relieving: Boolean(input.immediate_relieving),
      exception_notes: input.exception_notes,
      created_at: nowIso,
      updated_at: nowIso,
    };

    // Standard initial checklist
    const defaultChecklist: OffboardingChecklistItem[] = [
      {
        id: `chk-${Date.now()}-1`,
        offboarding_id: caseId,
        title: 'Knowledge Handover Documentation & Repository Transfer',
        description: 'Document active project tasks, repositories, drive assets, and runbooks.',
        category: 'knowledge_transfer',
        owner_role: 'employee',
        assigned_to_name: input.employee_name,
        status: 'pending',
        is_mandatory: true,
        due_date: input.proposed_lwd,
        created_at: nowIso,
        updated_at: nowIso,
      },
      {
        id: `chk-${Date.now()}-2`,
        offboarding_id: caseId,
        title: 'Manager Handover Acceptance & Peer Handover',
        description: 'Validate knowledge transfer completion and team reassignments.',
        category: 'knowledge_transfer',
        owner_role: 'manager',
        assigned_to_name: input.manager_name || 'Reporting Manager',
        status: 'pending',
        is_mandatory: true,
        due_date: input.proposed_lwd,
        created_at: nowIso,
        updated_at: nowIso,
      },
      {
        id: `chk-${Date.now()}-3`,
        offboarding_id: caseId,
        title: 'IT Asset & Hardware Return Inspection',
        description: 'Verify and return issued laptop, monitor, chargers, and hardware peripherals.',
        category: 'asset_return',
        owner_role: 'it_admin',
        assigned_to_name: 'IT Operations Desk',
        status: 'pending',
        is_mandatory: true,
        due_date: input.proposed_lwd,
        created_at: nowIso,
        updated_at: nowIso,
      },
      {
        id: `chk-${Date.now()}-4`,
        offboarding_id: caseId,
        title: 'Confidential Exit Interview & Feedback Form',
        description: 'Submit confidential reflections, handover feedback, and survey responses.',
        category: 'exit_interview',
        owner_role: 'employee',
        assigned_to_name: input.employee_name,
        status: 'pending',
        is_mandatory: true,
        due_date: input.proposed_lwd,
        created_at: nowIso,
        updated_at: nowIso,
      },
      {
        id: `chk-${Date.now()}-5`,
        offboarding_id: caseId,
        title: 'Expense Claims & Financial Dues Verification',
        description: 'Verify travel advances, reimbursements, or pending claims.',
        category: 'finance',
        owner_role: 'finance',
        assigned_to_name: 'Finance Desk',
        status: 'pending',
        is_mandatory: true,
        due_date: input.proposed_lwd,
        created_at: nowIso,
        updated_at: nowIso,
      },
    ];

    // Standard initial departmental NDC
    const defaultNdc: OffboardingNDCDepartment[] = [
      {
        id: `ndc-${Date.now()}-1`,
        offboarding_id: caseId,
        department: 'manager',
        department_label: 'Reporting Manager',
        status: 'pending',
        remarks: 'Handover underway.',
        created_at: nowIso,
        updated_at: nowIso,
      },
      {
        id: `ndc-${Date.now()}-2`,
        offboarding_id: caseId,
        department: 'it_admin',
        department_label: 'IT & Asset Operations',
        status: 'pending',
        remarks: 'Awaiting hardware return.',
        created_at: nowIso,
        updated_at: nowIso,
      },
      {
        id: `ndc-${Date.now()}-3`,
        offboarding_id: caseId,
        department: 'finance',
        department_label: 'Finance & Accounts',
        status: 'pending',
        remarks: 'Expense claims check in progress.',
        created_at: nowIso,
        updated_at: nowIso,
      },
      {
        id: `ndc-${Date.now()}-4`,
        offboarding_id: caseId,
        department: 'pnc',
        department_label: 'People & Culture',
        status: 'pending',
        remarks: 'Awaiting departmental sign-offs.',
        created_at: nowIso,
        updated_at: nowIso,
      },
    ];

    // Initial F&F Record
    const defaultFnf: OffboardingFnF = {
      id: `fnf-${caseId}`,
      offboarding_id: caseId,
      status: 'awaiting_clearance',
      payable_days: 0,
      leave_encashment_days: 0,
      gratuity_eligible: false,
      asset_recovery_amount: 0,
      other_deductions: 0,
      remarks: 'Computation scheduled upon clearance completion.',
      blocked_reasons: ['Department NDC clearances pending', 'Asset verification pending'],
      created_at: nowIso,
      updated_at: nowIso,
    };

    const initialActivity: OffboardingActivityLog[] = [
      {
        id: `log-${Date.now()}-init`,
        offboarding_id: caseId,
        actor_name: input.initiated_by || 'P&C Operations',
        actor_role: 'pnc',
        action: 'Exit Formally Initiated',
        description: `Exit initiated for ${input.employee_name} (${input.exit_type.replace(/_/g, ' ')}). Proposed LWD: ${input.proposed_lwd}. Notice: ${noticeDays} days.`,
        created_at: nowIso,
      },
    ];

    // Query External Integration APIs to prime clearances and F&F
    let initialAssets: OffboardingAssetItem[] = [
      {
        id: `asset-${Date.now()}-lap`,
        offboarding_id: caseId,
        asset_name: 'Company Assigned Laptop & Charger',
        asset_type: 'laptop',
        return_status: 'pending_return',
        condition: 'good',
        clearance_notes: 'Physical check at campus reception on LWD.',
        created_at: nowIso,
        updated_at: nowIso,
      },
    ];

    let extAttSummary: any = null;
    let extLeaveSummary: any = null;
    let extAssetsSummary: any = null;

    try {
      const [extAssets, extAtt, extLeave] = await Promise.all([
        assetIntegrationService.getEmployeeAssignedAssets(input.employee_id),
        attendanceIntegrationService.getEmployeeAttendanceSummary(input.employee_id),
        leaveIntegrationService.getEmployeeLeaveSummary(input.employee_id),
      ]);
      extAssetsSummary = extAssets;
      extAttSummary = extAtt;
      extLeaveSummary = extLeave;

      if (extAssets.assets.length > 0) {
        initialAssets = extAssets.assets.map((a) => ({
          id: `ast-${caseId}-${a.asset_id}`,
          offboarding_id: caseId,
          asset_name: a.asset_name,
          asset_tag: a.asset_tag,
          asset_type: a.asset_type,
          assigned_date: a.assigned_date,
          return_status: a.external_return_status === 'returned' ? 'returned' : 'pending_return',
          condition: a.external_return_status === 'damaged' ? 'damaged' : 'good',
          recovery_amount: a.estimated_recovery_amount,
          clearance_notes: `Synced from ${extAssets.source_system}. S/N: ${a.serial_number}`,
          created_at: nowIso,
          updated_at: nowIso,
        }));
      }

      defaultFnf.payable_days = extAtt.calculated_payable_days;
      defaultFnf.leave_encashment_days = extLeave.total_encashable_days;
      defaultFnf.asset_recovery_amount = extAssets.total_recovery_required;
      defaultFnf.remarks = `External systems synced: Attendance (${extAtt.calculated_payable_days} payable days), Leave (${extLeave.total_encashable_days} encashable days), Asset recovery (₹${extAssets.total_recovery_required.toLocaleString('en-IN')}).`;
    } catch {
      // Fallback
    }

    // Save to memory store
    MEMORY_OFFBOARDING_STORE.set(caseId, {
      caseRecord: newCase,
      checklist: defaultChecklist,
      assets: initialAssets,
      ndc: defaultNdc,
      fnf: defaultFnf,
      activityLogs: initialActivity,
      documents: [],
      externalAssetsSummary: extAssetsSummary,
      externalAttendanceSummary: extAttSummary,
      externalLeaveSummary: extLeaveSummary,
    });


    // Attempt persist to Supabase if tables exist
    try {
      const supabase = await createServerSupabaseClient();
      await supabase.from('offboarding_cases').insert({
        id: newCase.id,
        employee_id: newCase.employee_id,
        exit_type: newCase.exit_type,
        initiated_date: newCase.initiated_date,
        initiated_by: newCase.initiated_by,
        proposed_lwd: newCase.proposed_lwd,
        actual_lwd: newCase.actual_lwd,
        notice_period_days: newCase.notice_period_days,
        notice_period_waived: newCase.notice_period_waived,
        reason: newCase.reason,
        reason_details: newCase.reason_details,
        status: newCase.status,
        immediate_relieving: newCase.immediate_relieving,
        exception_notes: newCase.exception_notes,
      });

      await supabase.from('offboarding_checklists').insert(defaultChecklist);
      await supabase.from('offboarding_ndc').insert(defaultNdc);
      await supabase.from('offboarding_fnf').insert(defaultFnf);
      await logWriter()?.from('offboarding_activity_log').insert(initialActivity);
    } catch {
      // Table missing - memory store handles it
    }

    // The stored role ends 72 hours before the last working day. The daily
    // job applies that to every open exit; applying it here too covers an
    // exit opened inside the window (an immediate relieving), which would
    // otherwise keep its role until the job next runs.
    await applyPreExitRoleRule(
      {
        caseId,
        employeeId: newCase.employee_id,
        employeeEmail: newCase.employee_email || (await employeeEmail(newCase.employee_id)),
        employeeName: newCase.employee_name,
        lastWorkingDay: lastWorkingDayOf(newCase),
        status: newCase.status,
      },
      { now: new Date(), trigger: 'exit opened' }
    );

    // Record in global audit log
    await recordAuditLog('offboarding_cases', caseId, 'insert', {
      employee_id: input.employee_id,
      employee_name: input.employee_name,
      exit_type: input.exit_type,
      proposed_lwd: input.proposed_lwd,
    });

    // Send resignation formal acknowledgment email
    try {
      await sendEmail(
        'offboarding_resignation_ack',
        {
          subject: 'Acknowledgment of Resignation — NavGurukul Foundation',
          employee_name: input.employee_name,
          resignation_date: input.initiated_date,
          notice_period_duration: `${noticeDays} Days`,
          last_working_day: input.proposed_lwd,
          offboarding_portal_link: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/offboarding/${caseId}`,
          hr_poc_name: 'People & Culture Operations',
        },
        input.employee_email
      );
    } catch (mailErr) {
      console.warn('Could not dispatch initial resignation email:', mailErr);
    }

    revalidatePath('/offboarding');
    revalidatePath('/employees');
    await auditOffboarding.caseOpened({
      subject: auditSubject(newCase),
      actorName: newCase.initiated_by,
      entityId: caseId,
      exitType: newCase.exit_type,
      metadata: {
        proposed_lwd: newCase.proposed_lwd,
        notice_period_days: noticeDays,
        reason: newCase.reason,
      },
    });

    return { success: true, caseId };
  } catch (err: any) {
    console.error('Error initiating offboarding:', err);
    return { success: false, error: err?.message || 'Failed to initiate offboarding case' };
  }
}

/**
 * Update a checklist item status or details.
 */
export async function updateChecklistItem(
  caseId: string,
  itemId: string,
  updates: Partial<OffboardingChecklistItem>
): Promise<{ success: boolean; error?: string }> {
  const allowed = await guard('offboarding');
  if (!allowed.ok) return { success: false, error: allowed.error };

  const existing = MEMORY_OFFBOARDING_STORE.get(caseId);
  if (!existing) return { success: false, error: 'Case not found' };

  const itemIndex = existing.checklist.findIndex((c) => c.id === itemId);
  if (itemIndex === -1) return { success: false, error: 'Checklist item not found' };

  const nowIso = new Date().toISOString();
  const oldItem = existing.checklist[itemIndex];
  const updatedItem: OffboardingChecklistItem = {
    ...oldItem,
    ...updates,
    updated_at: nowIso,
    completed_at: updates.status === 'completed' ? nowIso : updates.status ? null : oldItem.completed_at,
  };

  existing.checklist[itemIndex] = updatedItem;

  // Add activity log
  existing.activityLogs.unshift({
    id: `log-${Date.now()}-chk`,
    offboarding_id: caseId,
    actor_name: updates.completed_by || 'P&C Operations',
    actor_role: 'pnc',
    action: 'Checklist Item Updated',
    description: `"${updatedItem.title}" marked as ${updatedItem.status.toUpperCase()}${updates.notes ? ` — Note: ${updates.notes}` : ''}`,
    created_at: nowIso,
  });

  // DB Sync
  try {
    const supabase = await createServerSupabaseClient();
    await supabase.from('offboarding_checklists').update(updates).eq('id', itemId);
  } catch {
    // fallback
  }

  await recordAuditLog('offboarding_checklists', itemId, 'update', {
    caseId,
    title: updatedItem.title,
    status: updatedItem.status,
  });

  revalidatePath(`/offboarding/${caseId}`);
  return { success: true };
}

/**
 * Update an asset clearance status.
 */
export async function updateAssetClearance(
  caseId: string,
  assetId: string,
  updates: Partial<OffboardingAssetItem>
): Promise<{ success: boolean; error?: string }> {
  const allowed = await guard('offboarding');
  if (!allowed.ok) return { success: false, error: allowed.error };

  const existing = MEMORY_OFFBOARDING_STORE.get(caseId);
  if (!existing) return { success: false, error: 'Case not found' };

  const assetIndex = existing.assets.findIndex((a) => a.id === assetId);
  if (assetIndex === -1) return { success: false, error: 'Asset record not found' };

  const nowIso = new Date().toISOString();
  const updatedAsset: OffboardingAssetItem = {
    ...existing.assets[assetIndex],
    ...updates,
    updated_at: nowIso,
    verified_at: updates.return_status === 'cleared' || updates.return_status === 'returned' ? nowIso : existing.assets[assetIndex].verified_at,
  };

  existing.assets[assetIndex] = updatedAsset;

  // Update IT NDC status automatically if all assets cleared
  const allAssetsCleared = existing.assets.every(
    (a) => a.return_status === 'cleared' || a.return_status === 'returned' || a.return_status === 'waived'
  );

  const itNdc = existing.ndc.find((n) => n.department === 'it_admin');
  if (itNdc) {
    if (allAssetsCleared && itNdc.status !== 'cleared') {
      itNdc.status = 'cleared';
      itNdc.cleared_at = nowIso;
      itNdc.cleared_by = updates.verified_by || 'IT Admin Desk';
      itNdc.remarks = 'All assigned assets inspected and verified cleared.';
      itNdc.blocker_reason = null;
    } else if (!allAssetsCleared && updatedAsset.return_status === 'under_recovery') {
      itNdc.status = 'blocked';
      itNdc.blocker_reason = `Asset recovery pending: ₹${updatedAsset.recovery_amount || 0}`;
    }
  }

  // Add activity log
  existing.activityLogs.unshift({
    id: `log-${Date.now()}-asset`,
    offboarding_id: caseId,
    actor_name: updates.verified_by || 'IT Asset Desk',
    actor_role: 'it_admin',
    action: 'Asset Clearance Status Changed',
    description: `Asset "${updatedAsset.asset_name}" marked as ${updatedAsset.return_status.toUpperCase()}${updatedAsset.clearance_notes ? ` (${updatedAsset.clearance_notes})` : ''}`,
    created_at: nowIso,
  });

  try {
    const supabase = await createServerSupabaseClient();
    await supabase.from('offboarding_asset_clearances').update(updates).eq('id', assetId);
  } catch {
    // fallback
  }

  await recordAuditLog('offboarding_asset_clearances', assetId, 'update', {
    caseId,
    asset_name: updatedAsset.asset_name,
    return_status: updatedAsset.return_status,
  });

  await auditOffboarding.clearanceUpdated({
    subject: auditSubject(existing.caseRecord),
    actorName: updates.verified_by || 'IT Asset Desk',
    entityId: caseId,
    area: `Asset — ${updatedAsset.asset_name}`,
    status: updatedAsset.return_status,
    severity: updatedAsset.return_status === 'under_recovery' ? 'warning' : 'info',
    metadata: { asset_id: assetId, recovery_amount: updatedAsset.recovery_amount },
  });

  revalidatePath(`/offboarding/${caseId}`);
  return { success: true };
}

/**
 * Update Departmental NDC (No Dues Certificate) Sign-off.
 */
export async function updateNDCDepartment(
  caseId: string,
  department: string,
  updates: Partial<OffboardingNDCDepartment>
): Promise<{ success: boolean; error?: string }> {
  const allowed = await guard('offboarding');
  if (!allowed.ok) return { success: false, error: allowed.error };

  const existing = MEMORY_OFFBOARDING_STORE.get(caseId);
  if (!existing) return { success: false, error: 'Case not found' };

  const ndcIndex = existing.ndc.findIndex((n) => n.department === department);
  if (ndcIndex === -1) return { success: false, error: 'Department NDC record not found' };

  const nowIso = new Date().toISOString();
  const updatedNdc: OffboardingNDCDepartment = {
    ...existing.ndc[ndcIndex],
    ...updates,
    updated_at: nowIso,
    cleared_at: updates.status === 'cleared' ? nowIso : updates.status ? null : existing.ndc[ndcIndex].cleared_at,
  };

  existing.ndc[ndcIndex] = updatedNdc;

  // Add activity log
  existing.activityLogs.unshift({
    id: `log-${Date.now()}-ndc`,
    offboarding_id: caseId,
    actor_name: updates.cleared_by || 'Department Authority',
    actor_role: 'pnc',
    action: 'NDC Clearance Updated',
    description: `${updatedNdc.department_label} clearance marked as ${updatedNdc.status.toUpperCase()}${updates.remarks ? ` — ${updates.remarks}` : ''}`,
    created_at: nowIso,
  });

  // Check if all NDC departments are cleared
  const allNdcCleared = existing.ndc.every((n) => n.status === 'cleared');
  if (allNdcCleared) {
    if (existing.fnf.status === 'awaiting_clearance' || existing.fnf.status === 'not_started') {
      existing.fnf.status = 'computation_pending';
      existing.fnf.blocked_reasons = [];
      existing.fnf.remarks = 'All departmental NDC sign-offs complete. Ready for F&F computation.';
    }
  } else {
    const blockers = existing.ndc
      .filter((n) => n.status !== 'cleared')
      .map((n) => `${n.department_label}: ${n.blocker_reason || n.status}`);
    existing.fnf.blocked_reasons = blockers;
  }

  try {
    const supabase = await createServerSupabaseClient();
    await supabase.from('offboarding_ndc').update(updates).eq('offboarding_id', caseId).eq('department', department);
  } catch {
    // fallback
  }

  await recordAuditLog('offboarding_ndc', caseId, 'update', {
    department,
    status: updatedNdc.status,
  });

  await auditOffboarding.clearanceUpdated({
    subject: auditSubject(existing.caseRecord),
    actorName: updates.cleared_by || 'Department Authority',
    entityId: caseId,
    area: updatedNdc.department_label,
    status: updatedNdc.status,
    severity: updatedNdc.status === 'blocked' ? 'warning' : 'info',
    metadata: { department, remarks: updates.remarks },
  });

  revalidatePath(`/offboarding/${caseId}`);
  return { success: true };
}

/**
 * Update Full & Final (F&F) Settlement Computation & Payment Details.
 */
export async function updateFnFDetails(
  caseId: string,
  updates: Partial<OffboardingFnF>
): Promise<{ success: boolean; error?: string }> {
  // Settling F&F is writing salary data, which the offboarding feature alone
  // does not grant: PnC Ops runs the exit but has `salary: none`.
  const allowed = await guardResource('salary', 'edit');
  if (!allowed.ok) return { success: false, error: allowed.error };

  const existing = MEMORY_OFFBOARDING_STORE.get(caseId);
  if (!existing) return { success: false, error: 'Case not found' };

  const nowIso = new Date().toISOString();
  const updatedFnf: OffboardingFnF = {
    ...existing.fnf,
    ...updates,
    updated_at: nowIso,
    processed_at: updates.status === 'processed' ? nowIso : existing.fnf.processed_at,
  };

  existing.fnf = updatedFnf;

  existing.activityLogs.unshift({
    id: `log-${Date.now()}-fnf`,
    offboarding_id: caseId,
    actor_name: updates.processed_by || 'Finance Lead',
    actor_role: 'finance',
    action: 'F&F Settlement Updated',
    // No payment reference here: the activity log is shown to everyone who
    // can open the case, PnC Ops included.
    description: `F&F status transitioned to ${updatedFnf.status.toUpperCase()}`,
    created_at: nowIso,
  });

  try {
    const supabase = await createServerSupabaseClient();
    await supabase.from('offboarding_fnf').update(updates).eq('offboarding_id', caseId);
  } catch {
    // fallback
  }

  await recordAuditLog('offboarding_fnf', caseId, 'update', {
    status: updatedFnf.status,
    payable_days: updatedFnf.payable_days,
  });

  await auditOffboarding.fnfSettled({
    subject: auditSubject(existing.caseRecord),
    actorName: updates.processed_by || 'Finance Lead',
    entityId: caseId,
    metadata: {
      status: updatedFnf.status,
      payable_days: updatedFnf.payable_days,
      payment_reference: updatedFnf.payment_reference,
      net_payable_estimate: updatedFnf.net_payable_estimate,
    },
  });

  revalidatePath(`/offboarding/${caseId}`);
  return { success: true };
}

/**
 * Update Proposed or Actual Last Working Day.
 */
export async function updateExitDates(
  caseId: string,
  proposedLwd: string,
  actualLwd?: string | null,
  reasonForAdjustment?: string
): Promise<{ success: boolean; error?: string }> {
  const allowed = await guard('offboarding');
  if (!allowed.ok) return { success: false, error: allowed.error };

  const existing = MEMORY_OFFBOARDING_STORE.get(caseId);
  if (!existing) return { success: false, error: 'Case not found' };

  const oldProposed = existing.caseRecord.proposed_lwd;
  existing.caseRecord.proposed_lwd = proposedLwd;
  if (actualLwd !== undefined) {
    existing.caseRecord.actual_lwd = actualLwd;
  }
  existing.caseRecord.updated_at = new Date().toISOString();

  existing.activityLogs.unshift({
    id: `log-${Date.now()}-lwd`,
    offboarding_id: caseId,
    actor_name: 'P&C Operations',
    actor_role: 'pnc',
    action: 'Exit Timeline Adjusted',
    description: `Proposed LWD updated from ${oldProposed} to ${proposedLwd}${actualLwd ? ` (Actual LWD: ${actualLwd})` : ''}${reasonForAdjustment ? `. Reason: ${reasonForAdjustment}` : ''}`,
    created_at: new Date().toISOString(),
  });

  try {
    const supabase = await createServerSupabaseClient();
    await supabase
      .from('offboarding_cases')
      .update({ proposed_lwd: proposedLwd, actual_lwd: actualLwd, updated_at: existing.caseRecord.updated_at })
      .eq('id', caseId);
  } catch {
    // fallback
  }

  // A last working day brought forward into the 72-hour window ends the
  // stored role now. One pushed back out does not give it back: whoever can
  // grant the role restores it on the users screen.
  await applyPreExitRoleRule(
    {
      caseId,
      employeeId: existing.caseRecord.employee_id,
      employeeEmail: existing.caseRecord.employee_email || (await employeeEmail(existing.caseRecord.employee_id)),
      employeeName: existing.caseRecord.employee_name,
      lastWorkingDay: lastWorkingDayOf(existing.caseRecord),
      status: existing.caseRecord.status,
    },
    { now: new Date(), trigger: 'exit dates changed' }
  );

  await recordAuditLog('offboarding_cases', caseId, 'update', {
    oldProposed,
    newProposed: proposedLwd,
    actualLwd,
  });

  await auditOffboarding.statusChanged({
    subject: auditSubject(existing.caseRecord),
    entityId: caseId,
    to: existing.caseRecord.status,
    severity: 'notice',
    changes: [
      { field: 'proposed_lwd', label: 'Proposed Last Working Day', from: oldProposed, to: proposedLwd },
      ...(actualLwd ? [{ field: 'actual_lwd', label: 'Actual Last Working Day', to: actualLwd }] : []),
    ],
    metadata: { reason: reasonForAdjustment },
  });

  revalidatePath(`/offboarding/${caseId}`);
  return { success: true };
}

/**
 * Formally Close Exit and officially mark employee as Exited.
 */
export async function closeOffboardingCase(
  caseId: string,
  closedBy: string = 'P&C Operations Lead',
  actualLwd?: string
): Promise<{ success: boolean; error?: string }> {
  const allowed = await guard('offboarding');
  if (!allowed.ok) return { success: false, error: allowed.error };

  // A case started on another server instance is only in the database.
  const existing = MEMORY_OFFBOARDING_STORE.get(caseId) ?? (await getOffboardingById(caseId));
  if (!existing) return { success: false, error: 'Case not found' };

  // Verification checks: ensure asset and NDC clearances are fulfilled
  const hasUnclearedAssets = existing.assets.some(
    (a) => a.return_status === 'pending_return' || a.return_status === 'under_recovery'
  );
  if (hasUnclearedAssets && MEMORY_SETTINGS.require_asset_clearance_before_closure) {
    return {
      success: false,
      error: 'Cannot close exit: Outstanding assets are pending return or recovery clearance.',
    };
  }

  const hasPendingNdc = existing.ndc.some((n) => n.status !== 'cleared');
  if (hasPendingNdc && MEMORY_SETTINGS.require_all_ndc_before_fnf) {
    return {
      success: false,
      error: 'Cannot close exit: Not all departments have cleared the No Dues Certificate.',
    };
  }

  const nowIso = new Date().toISOString();
  const finalLwd = actualLwd || existing.caseRecord.actual_lwd || existing.caseRecord.proposed_lwd;

  existing.caseRecord.status = 'completed';
  existing.caseRecord.actual_lwd = finalLwd;
  existing.caseRecord.exit_closed_at = nowIso;
  existing.caseRecord.exit_closed_by = closedBy;
  existing.caseRecord.updated_at = nowIso;

  // Add activity log
  existing.activityLogs.unshift({
    id: `log-${Date.now()}-close`,
    offboarding_id: caseId,
    actor_name: closedBy,
    actor_role: 'pnc',
    action: 'Exit Case Officially Closed',
    description: `Formal exit closure finalized. Employee records updated to Exited (Official LWD: ${finalLwd}). Relieving documentation issued.`,
    created_at: nowIso,
  });

  // Ensure documents are created
  if (!existing.documents.some((d) => d.document_type === 'experience_letter')) {
    existing.documents.push({
      id: `doc-${Date.now()}-exp`,
      offboarding_id: caseId,
      document_type: 'experience_letter',
      document_name: `Relieving & Experience Certificate — ${existing.caseRecord.employee_name}.pdf`,
      status: 'generated',
      generated_at: nowIso,
    });
  }

  // Update employee record in employees table: status = 'exited', exit_date = finalLwd
  try {
    const supabase = await createServerSupabaseClient();
    const { error: employeeError } = await supabase
      .from('employees')
      .update({
        status: 'exited',
        exit_date: finalLwd,
      })
      .eq('id', existing.caseRecord.employee_id);
    if (employeeError) {
      return { success: false, error: 'Could not mark the employee as exited. Try again.' };
    }

    // Also update offboarding case table in DB
    await supabase
      .from('offboarding_cases')
      .update({
        status: 'completed',
        actual_lwd: finalLwd,
        exit_closed_at: nowIso,
        exit_closed_by: closedBy,
        updated_at: nowIso,
      })
      .eq('id', caseId);
  } catch {
    // fallback
  }

  await recordAuditLog('offboarding_cases', caseId, 'update', {
    action: 'close_exit',
    status: 'completed',
    actual_lwd: finalLwd,
    closedBy,
  });

  await auditOffboarding.statusChanged({
    subject: auditSubject(existing.caseRecord),
    actorName: closedBy,
    entityId: caseId,
    to: 'completed',
    severity: 'critical',
    metadata: { actual_lwd: finalLwd },
  });

  // Exit ends the person's platform access: their stored role goes, the
  // account is marked ended, and its sessions cannot be renewed. The
  // revocation is recorded once that has succeeded.
  const email = existing.caseRecord.employee_email || (await employeeEmail(existing.caseRecord.employee_id));
  const ended = await endPlatformAccess(email, { endedBy: allowed.caller.email ?? closedBy, now: new Date(nowIso) });
  if (!ended.ok) {
    return {
      success: false,
      error: `The exit is recorded, but platform access could not be ended: ${ended.error} Close the exit again to retry.`,
    };
  }
  await auditAccess.revoked({
    subject: auditSubject(existing.caseRecord),
    actorName: closedBy,
    entityId: caseId,
    system: 'ELC platform',
    metadata: { account_found: ended.userId !== null },
  });

  // Send formal relieving & experience letter email
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
  } catch (mailErr) {
    console.warn('Could not dispatch final relieving email:', mailErr);
  }

  revalidatePath('/offboarding');
  revalidatePath(`/offboarding/${caseId}`);
  revalidatePath('/employees');
  return { success: true };
}

/**
 * Generate an Exit Document (NDC or Experience Letter).
 */
export async function generateExitDocument(
  caseId: string,
  docType: 'ndc' | 'experience_letter' | 'relieving_letter'
): Promise<{ success: boolean; document?: ExitDocument; error?: string }> {
  const allowed = await guard('offboarding');
  if (!allowed.ok) return { success: false, error: allowed.error };

  const existing = MEMORY_OFFBOARDING_STORE.get(caseId);
  if (!existing) return { success: false, error: 'Case not found' };

  const nowIso = new Date().toISOString();
  const docName =
    docType === 'ndc'
      ? `No Dues Certificate — ${existing.caseRecord.employee_name}.pdf`
      : `Relieving & Experience Certificate — ${existing.caseRecord.employee_name}.pdf`;

  const newDoc: ExitDocument = {
    id: `doc-${Date.now()}-${docType}`,
    offboarding_id: caseId,
    document_type: docType,
    document_name: docName,
    status: 'generated',
    generated_at: nowIso,
  };

  const docIdx = existing.documents.findIndex((d) => d.document_type === docType);
  if (docIdx >= 0) {
    existing.documents[docIdx] = newDoc;
  } else {
    existing.documents.push(newDoc);
  }

  existing.activityLogs.unshift({
    id: `log-${Date.now()}-doc`,
    offboarding_id: caseId,
    actor_name: 'P&C Operations',
    actor_role: 'pnc',
    action: 'Exit Document Generated',
    description: `Generated ${docName}.`,
    created_at: nowIso,
  });

  revalidatePath(`/offboarding/${caseId}`);
  return { success: true, document: newDoc };
}

/**
 * Send Automated Reminders for pending offboarding actions.
 */
export async function sendOffboardingReminders(): Promise<{
  success: boolean;
  remindersSent: number;
  details: string[];
}> {
  // The "send reminders" button on the offboarding screen. The scheduled run
  // does not come through here: it has no session to guard, so it lives in
  // `reminders.ts`, which only the cron route imports.
  const allowed = await guard('offboarding');
  if (!allowed.ok) return { success: false, remindersSent: 0, details: [allowed.error] };

  const cases = Array.from(MEMORY_OFFBOARDING_STORE.values()).filter(
    (c) => c.caseRecord.status === 'notice_period' || c.caseRecord.status === 'clearance_in_progress'
  );

  let remindersSent = 0;
  const details: string[] = [];

  for (const c of cases) {
    const pendingNdcDepts = c.ndc.filter((n) => n.status !== 'cleared').map((n) => n.department_label);
    const pendingChecklist = c.checklist.filter((i) => i.status !== 'completed' && i.status !== 'waived');

    if (pendingNdcDepts.length > 0 || pendingChecklist.length > 0) {
      try {
        const mailResult = await sendEmail(
          'offboarding_clearance_reminder',
          {
            subject: `Action Required: Clearance Checkpoints for ${c.caseRecord.employee_name} (LWD: ${c.caseRecord.proposed_lwd})`,
            employee_name: c.caseRecord.employee_name,
            last_working_day: c.caseRecord.proposed_lwd,
            pending_departments: pendingNdcDepts.join(', ') || 'Pending Checkpoints',
            clearance_link: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/offboarding/${c.caseRecord.id}`,
          },
          c.caseRecord.employee_email
        );

        if (mailResult.success) {
          remindersSent++;
          details.push(`Reminder sent to ${c.caseRecord.employee_name} for ${pendingNdcDepts.length} pending clearances.`);

          c.activityLogs.unshift({
            id: `log-${Date.now()}-rem`,
            offboarding_id: c.caseRecord.id,
            actor_name: 'Automated Reminder Engine',
            actor_role: 'system',
            action: 'Automated Clearance Reminder Dispatched',
            description: `Sent reminder for pending departments: ${pendingNdcDepts.join(', ')}.`,
            created_at: new Date().toISOString(),
          });
        }
      } catch (err: any) {
        console.error('Failed to send reminder for case:', c.caseRecord.id, err);
      }
    }
  }

  return { success: true, remindersSent, details };
}

/**
 * Get configurable offboarding policy settings.
 */
export async function getOffboardingSettings(): Promise<OffboardingSettings> {
  // Read by the Offboarding tab of /manage/settings as well as by the exit
  // screens, so either feature admits. The policy holds nothing sensitive;
  // a refused caller gets the built-in defaults.
  const allowed = await guard([...FEATURE_ACCESS.offboarding, ...FEATURE_ACCESS.platformConfig]);
  if (!allowed.ok) return { ...DEFAULT_OFFBOARDING_SETTINGS };

  try {
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase.from('offboarding_settings').select('*').limit(1).single();
    if (!error && data) {
      MEMORY_SETTINGS = { ...DEFAULT_OFFBOARDING_SETTINGS, ...data };
      return MEMORY_SETTINGS;
    }
  } catch {
    // fallback
  }

  return MEMORY_SETTINGS;
}

/**
 * Update offboarding policy settings.
 */
export async function updateOffboardingSettings(
  settings: Partial<OffboardingSettings>
): Promise<{ success: boolean; error?: string }> {
  // This is the Offboarding tab of /manage/settings, which PnC Admin reaches
  // read-only, so it answers to the same guard as the writes in
  // settings/service.ts.
  const refused = await platformConfigRefusal();
  if (refused) return refused;

  MEMORY_SETTINGS = { ...MEMORY_SETTINGS, ...settings, updated_at: new Date().toISOString() };

  try {
    const supabase = await createServerSupabaseClient();
    await supabase.from('offboarding_settings').upsert({
      ...MEMORY_SETTINGS,
      updated_at: new Date().toISOString(),
    });
  } catch {
    // fallback
  }

  await recordAuditLog('offboarding_settings', 'singleton', 'update', settings);
  revalidatePath('/manage/settings/offboarding');
  return { success: true };
}

// ============================================================================
// STAGE 1: RESIGNATION REQUESTS & DECISION WORKFLOW ENGINE
// ============================================================================

const MEMORY_RESIGNATION_STORE: Map<string, ResignationRequest> = new Map();

function initResignationSeedScenarios() {
  // In-memory store starts empty in production.
}

/**
 * Fetch all resignation requests.
 * Uses a fast timeout to avoid hanging when the resignation_requests table
 * doesn't exist in the remote database.
 */
export async function getAllResignationRequests(): Promise<ResignationRequest[]> {
  const allowed = await guard('offboarding');
  if (!allowed.ok) return [];

  initResignationSeedScenarios();
  initSeedScenarios();

  try {
    const supabase = await createServerSupabaseClient();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);

    const { data, error } = await supabase
      .from('resignation_requests')
      .select('*, employees(name, email, team)')
      .order('created_at', { ascending: false })
      .abortSignal(controller.signal);

    clearTimeout(timeout);

    if (!error && data) {
      return data.map((row: any) => ({
        ...row,
        employee_name: row.employees?.name || row.employee_name,
        employee_email: row.employees?.email || row.employee_email,
      }));
    }
  } catch {
    // Fallback to memory (timeout, missing table, or network error)
  }

  return Array.from(MEMORY_RESIGNATION_STORE.values()).sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
}

/**
 * Fetch a single resignation request by ID.
 */
export async function getResignationRequestById(id: string): Promise<ResignationRequest | null> {
  const allowed = await guard('offboarding');
  if (!allowed.ok) return null;

  initResignationSeedScenarios();

  try {
    const supabase = await createServerSupabaseClient();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);

    const { data, error } = await supabase
      .from('resignation_requests')
      .select('*, employees(*)')
      .eq('id', id)
      .abortSignal(controller.signal)
      .single();

    clearTimeout(timeout);

    if (!error && data) {
      return {
        ...data,
        employee_name: data.employees?.name || data.employee_name,
        employee_email: data.employees?.email || data.employee_email,
      };
    }
  } catch {
    // Fallback (timeout, missing table, or network error)
  }

  return MEMORY_RESIGNATION_STORE.get(id) || null;
}

/**
 * Submit a Resignation Request (Entry Points: Platform, Ingested Email, or P&C Manual Entry).
 * Does NOT create an Offboarding Case!
 */
export async function submitResignationRequest(
  input: SubmitResignationInput
): Promise<{ success: boolean; request?: ResignationRequest; error?: string }> {
  // P&C log resignations for anyone, from any channel. Anyone else may only
  // resign themselves, through the platform: an email or P&C entry is not
  // theirs to file, and a P&C entry is accepted on P&C's behalf the moment
  // it is created.
  const allowed = await guard('offboarding');
  if (!allowed.ok) {
    const self = await guard('self');
    const ownId = self.ok ? await currentEmployeeId() : null;
    if (!ownId || ownId !== input.employee_id || input.source !== 'platform') {
      return { success: false, error: allowed.error };
    }
  }

  initResignationSeedScenarios();

  try {
    const allEmployees = await getEmployees();
    const emp = allEmployees.find((e) => e.id === input.employee_id);

    const nowIso = new Date().toISOString();
    const requestId = `res-req-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;

    const newRequest: ResignationRequest = {
      id: requestId,
      employee_id: input.employee_id,
      employee_name: emp?.name || 'NavGurukul Member',
      employee_email: emp?.email || 'member@navgurukul.org',
      employee_designation: emp?.employee_type || 'Team Member',
      employee_department: emp?.team || 'Operations',
      manager_name: 'Reporting Manager',
      source: input.source,
      resignation_date: input.resignation_date || nowIso.split('T')[0],
      proposed_lwd: input.proposed_lwd,
      notice_period_days: input.notice_period_days || 30,
      reason: input.reason,
      reason_details: input.reason_details,
      employee_comments: input.employee_comments,
      email_subject: input.email_subject,
      email_sender: input.email_sender,
      email_body: input.email_body,
      email_received_at: input.source === 'email' ? nowIso : null,
      manager_decision: 'pending',
      pnc_decision: input.source === 'pnc' ? 'accepted' : 'pending',
      pnc_decision_at: input.source === 'pnc' ? nowIso : null,
      pnc_decision_by: input.source === 'pnc' ? 'P&C Operations Partner' : null,
      employee_retention_response: 'pending',
      status: input.source === 'pnc' ? 'manager_pending' : 'submitted',
      created_at: nowIso,
      updated_at: nowIso,
    };

    MEMORY_RESIGNATION_STORE.set(requestId, newRequest);

    // Attempt persist to Supabase
    try {
      const supabase = await createServerSupabaseClient();
      await supabase.from('resignation_requests').insert({
        id: newRequest.id,
        employee_id: newRequest.employee_id,
        source: newRequest.source,
        resignation_date: newRequest.resignation_date,
        proposed_lwd: newRequest.proposed_lwd,
        notice_period_days: newRequest.notice_period_days,
        reason: newRequest.reason,
        reason_details: newRequest.reason_details,
        employee_comments: newRequest.employee_comments,
        email_subject: newRequest.email_subject,
        email_sender: newRequest.email_sender,
        email_body: newRequest.email_body,
        email_received_at: newRequest.email_received_at,
        manager_decision: newRequest.manager_decision,
        pnc_decision: newRequest.pnc_decision,
        status: newRequest.status,
      });
    } catch {
      // Memory fallback handles it
    }

    // Global audit trail
    await recordAuditLog('resignation_requests', requestId, 'insert', {
      source: input.source,
      employee_id: input.employee_id,
      employee_name: newRequest.employee_name,
      proposed_lwd: input.proposed_lwd,
    });

    // Notify Manager + P&C of new submission
    try {
      await sendEmail(
        'offboarding_resignation_ack',
        {
          subject: `Resignation Request Received: ${newRequest.employee_name} (${input.source.toUpperCase()})`,
          employee_name: newRequest.employee_name,
          resignation_date: newRequest.resignation_date,
          notice_period_duration: `${newRequest.notice_period_days} Days`,
          last_working_day: newRequest.proposed_lwd,
          offboarding_portal_link: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/offboarding?tab=resignations`,
          hr_poc_name: 'People & Culture Review Board',
        },
        newRequest.employee_email
      );
    } catch (mailErr) {
      console.warn('Could not dispatch resignation notification email:', mailErr);
    }

    await auditOffboarding.resignationReceived({
      subject: auditSubject(newRequest),
      actorType: newRequest.source === 'platform' ? 'employee' : 'pnc',
      actorName: newRequest.employee_name,
      entityId: newRequest.id,
      channel: newRequest.source,
      lastWorkingDay: newRequest.proposed_lwd,
      metadata: {
        reason: newRequest.reason,
        notice_period_days: newRequest.notice_period_days,
      },
    });

    revalidatePath('/offboarding');
    return { success: true, request: newRequest };
  } catch (err: any) {
    console.error('Error submitting resignation request:', err);
    return { success: false, error: err?.message || 'Failed to submit resignation request' };
  }
}

/**
 * Record Manager or P&C Decision on a Resignation Request.
 * Decisions: 'accepted' | 'retention_proposed' | 'on_hold'.
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

  initResignationSeedScenarios();
  const req = MEMORY_RESIGNATION_STORE.get(requestId);
  if (!req) return { success: false, error: 'Resignation request not found' };

  const nowIso = new Date().toISOString();
  const formatYMD = (d: Date) => d.toISOString().split('T')[0];

  // Update specific reviewer decision
  if (reviewerRole === 'manager') {
    req.manager_decision = decision;
    req.manager_decision_at = nowIso;
    req.manager_decision_by = 'Reporting Manager';
    req.manager_notes = notes || null;
  } else {
    req.pnc_decision = decision;
    req.pnc_decision_at = nowIso;
    req.pnc_decision_by = 'P&C Operations';
    req.pnc_notes = notes || null;
  }

  // Lifecycle state evaluation
  if (decision === 'on_hold' || req.manager_decision === 'on_hold' || req.pnc_decision === 'on_hold') {
    const days = holdDays || MEMORY_SETTINGS.standard_hold_period_days || 7;
    const holdDate = new Date();
    holdDate.setDate(holdDate.getDate() + days);
    req.hold_until_date = formatYMD(holdDate);
    req.status = 'on_hold';
    req.retention_notes = notes ? `Hold Reason: ${notes}` : `7-day retention discussion window initiated.`;
  } else if (req.manager_decision === 'accepted' && req.pnc_decision === 'accepted') {
    // BOTH ACCEPTED -> Transition to Resignation Accepted & Activate Offboarding Case!
    req.status = 'resignation_accepted';

    // Activate the downstream offboarding case
    const initRes = await openOffboardingCase({
      employee_id: req.employee_id,
      employee_name: req.employee_name,
      employee_email: req.employee_email,
      employee_designation: req.employee_designation,
      employee_department: req.employee_department,
      employee_type: 'Full-Time Employee',
      manager_name: req.manager_name || 'Reporting Manager',
      exit_type: 'resignation',
      initiated_date: req.resignation_date,
      initiated_by: `Approved by Manager & P&C (Request ${req.id})`,
      proposed_lwd: req.proposed_lwd,
      notice_period_days: req.notice_period_days,
      reason: req.reason,
      reason_details: req.reason_details || undefined,
    });

    if (initRes.success && initRes.caseId) {
      req.offboarding_case_id = initRes.caseId;
    }
  } else if (req.manager_decision === 'retention_proposed' && req.pnc_decision === 'retention_proposed') {
    // BOTH PROPOSE RETENTION -> Surface retention proposal to employee
    req.status = 'withdrawal_proposed';
    req.retention_notes = notes || 'Management proposes retention dialogue and resignation withdrawal.';
  } else if (
    (req.manager_decision === 'accepted' && req.pnc_decision === 'retention_proposed') ||
    (req.manager_decision === 'retention_proposed' && req.pnc_decision === 'accepted')
  ) {
    // DISAGREEMENT -> Decision Pending / P&C Resolution
    req.status = 'decision_pending';
    req.retention_notes = `Disagreement between Manager (${req.manager_decision}) and P&C (${req.pnc_decision}). Resolution required.`;
  } else if (req.manager_decision === 'accepted' && req.pnc_decision === 'pending') {
    req.status = 'pnc_pending';
  } else if (req.pnc_decision === 'accepted' && req.manager_decision === 'pending') {
    req.status = 'manager_pending';
  } else if (req.manager_decision === 'retention_proposed' || req.pnc_decision === 'retention_proposed') {
    req.status = 'withdrawal_proposed';
    req.retention_notes = notes || 'Retention proposed. Awaiting employee feedback.';
  }

  req.updated_at = nowIso;
  MEMORY_RESIGNATION_STORE.set(requestId, req);

  // Update Supabase if available
  try {
    const supabase = await createServerSupabaseClient();
    await supabase.from('resignation_requests').update({
      manager_decision: req.manager_decision,
      manager_decision_at: req.manager_decision_at,
      manager_decision_by: req.manager_decision_by,
      manager_notes: req.manager_notes,
      pnc_decision: req.pnc_decision,
      pnc_decision_at: req.pnc_decision_at,
      pnc_decision_by: req.pnc_decision_by,
      pnc_notes: req.pnc_notes,
      hold_until_date: req.hold_until_date,
      retention_notes: req.retention_notes,
      status: req.status,
      offboarding_case_id: req.offboarding_case_id,
      updated_at: nowIso,
    }).eq('id', requestId);
  } catch {
    // fallback
  }

  await recordAuditLog('resignation_requests', requestId, 'update', {
    reviewerRole,
    decision,
    newStatus: req.status,
    notes,
  });

  await auditOffboarding.statusChanged({
    subject: auditSubject(req),
    actorType: reviewerRole === 'manager' ? 'manager' : 'pnc',
    actorName: reviewerRole === 'manager' ? req.manager_decision_by : req.pnc_decision_by,
    entityId: requestId,
    to: req.status,
    severity: 'notice',
    changes: [
      {
        field: `${reviewerRole}_decision`,
        label: reviewerRole === 'manager' ? 'Manager Decision' : 'P&C Decision',
        to: decision,
      },
    ],
    metadata: { notes, hold_until: req.hold_until_date },
  });

  revalidatePath('/offboarding');
  return { success: true, request: req };
}

/**
 * Handle Employee Response to Retention Proposal:
 * - 'accepted_withdrawal': Employee agrees to stay! Resignation closed. Employee remains Active. No offboarding case created!
 * - 'declined_withdrawal': Employee still wants to leave! Resignation accepted -> Offboarding case created.
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

  initResignationSeedScenarios();
  const req = MEMORY_RESIGNATION_STORE.get(requestId);
  if (!req) return { success: false, error: 'Resignation request not found' };
  if (!allowed.ok && req.employee_id !== ownId) return { success: false, error: allowed.error };

  const nowIso = new Date().toISOString();
  req.employee_retention_response = response;
  req.employee_response_at = nowIso;
  req.employee_response_notes = notes || null;
  req.updated_at = nowIso;

  if (response === 'accepted_withdrawal') {
    // Employee stays! Resignation closed. Employee remains active.
    req.status = 'withdrawn_by_employee';
    req.retention_notes = notes ? `Withdrawal Accepted: ${notes}` : 'Employee agreed to retention proposal and withdrew resignation.';
  } else {
    // Employee declines retention -> Proceed to Exit Initiated!
    req.status = 'resignation_accepted';

    const initRes = await openOffboardingCase({
      employee_id: req.employee_id,
      employee_name: req.employee_name,
      employee_email: req.employee_email,
      employee_designation: req.employee_designation,
      employee_department: req.employee_department,
      employee_type: 'Full-Time Employee',
      manager_name: req.manager_name || 'Reporting Manager',
      exit_type: 'resignation',
      initiated_date: req.resignation_date,
      initiated_by: `Employee Declined Retention (Request ${req.id})`,
      proposed_lwd: req.proposed_lwd,
      notice_period_days: req.notice_period_days,
      reason: req.reason,
      reason_details: req.reason_details || undefined,
    });

    if (initRes.success && initRes.caseId) {
      req.offboarding_case_id = initRes.caseId;
    }
  }

  MEMORY_RESIGNATION_STORE.set(requestId, req);

  // Update Supabase if available
  try {
    const supabase = await createServerSupabaseClient();
    await supabase.from('resignation_requests').update({
      employee_retention_response: req.employee_retention_response,
      employee_response_at: req.employee_response_at,
      employee_response_notes: req.employee_response_notes,
      status: req.status,
      offboarding_case_id: req.offboarding_case_id,
      retention_notes: req.retention_notes,
      updated_at: nowIso,
    }).eq('id', requestId);
  } catch {
    // fallback
  }

  await recordAuditLog('resignation_requests', requestId, 'update', {
    employee_response: response,
    newStatus: req.status,
    notes,
  });

  revalidatePath('/offboarding');
  return { success: true, request: req };
}

/**
 * Resolve Disagreement between Manager and P&C (by Authorized P&C Role).
 */
export async function resolveDisagreement(
  requestId: string,
  resolvedDecision: 'accepted' | 'retention_proposed',
  notes?: string
): Promise<{ success: boolean; request?: ResignationRequest; error?: string }> {
  const allowed = await guard('offboarding');
  if (!allowed.ok) return { success: false, error: allowed.error };

  initResignationSeedScenarios();
  const req = MEMORY_RESIGNATION_STORE.get(requestId);
  if (!req) return { success: false, error: 'Resignation request not found' };

  const nowIso = new Date().toISOString();
  req.updated_at = nowIso;
  req.retention_notes = notes || `Disagreement formally resolved by P&C Authority to: ${resolvedDecision.toUpperCase()}`;

  if (resolvedDecision === 'accepted') {
    req.manager_decision = 'accepted';
    req.pnc_decision = 'accepted';
    req.status = 'resignation_accepted';

    const initRes = await openOffboardingCase({
      employee_id: req.employee_id,
      employee_name: req.employee_name,
      employee_email: req.employee_email,
      employee_designation: req.employee_designation,
      employee_department: req.employee_department,
      employee_type: 'Full-Time Employee',
      manager_name: req.manager_name || 'Reporting Manager',
      exit_type: 'resignation',
      initiated_date: req.resignation_date,
      initiated_by: `P&C Disagreement Resolution (Request ${req.id})`,
      proposed_lwd: req.proposed_lwd,
      notice_period_days: req.notice_period_days,
      reason: req.reason,
      reason_details: req.reason_details || undefined,
    });

    if (initRes.success && initRes.caseId) {
      req.offboarding_case_id = initRes.caseId;
    }
  } else {
    req.status = 'withdrawal_proposed';
  }

  MEMORY_RESIGNATION_STORE.set(requestId, req);

  // Update Supabase if available
  try {
    const supabase = await createServerSupabaseClient();
    await supabase.from('resignation_requests').update({
      manager_decision: req.manager_decision,
      pnc_decision: req.pnc_decision,
      status: req.status,
      offboarding_case_id: req.offboarding_case_id,
      retention_notes: req.retention_notes,
      updated_at: nowIso,
    }).eq('id', requestId);
  } catch {
    // fallback
  }

  await recordAuditLog('resignation_requests', requestId, 'update', {
    resolvedDecision,
    newStatus: req.status,
    notes,
  });

  revalidatePath('/offboarding');
  return { success: true, request: req };
}

