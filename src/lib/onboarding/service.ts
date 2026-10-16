// ============================================================================
// ONBOARDING SERVICE
// ----------------------------------------------------------------------------
// Every function here reads and writes Supabase. There is deliberately no
// in-memory fallback: the previous implementation kept a process-local Map,
// minted ids like `onb-1760000000000-ab12` against a uuid column so its one
// insert always failed, and swallowed the error — so a candidate could fill in
// the whole portal and have none of it survive the request. A database failure
// now surfaces as a failure.
// ============================================================================

import {
  OnboardingRecord,
  OnboardingPersonalDetails,
  OnboardingDocument,
  OnboardingPolicy,
  OnboardingGeneratedDocument,
  OnboardingActivityLog,
  EmployeeAccountProvisioning,
  EmployeeOrientationChecklist,
  ProbationMilestone,
  FullOnboardingData,
  OnboardingStatus,
  GeneratedDocumentType,
  OnboardingSalaryStructure,
} from './types';
import { GENERATED_DOCUMENT_LABELS } from './types';
import { onboardingDb, assertOk, isUuid, mapRecord, RECORD_SELECT } from './db';
import { upsertSalaryStructure } from './salary';
import { renderLettersForRecord, storeGeneratedLetters } from './letter-generation';
import { sendInvitationEmail } from './invitation-email';
import { CANDIDATE_BUCKET } from './candidate-storage';
import { carryDocumentsToEmployee } from './document-handover';
import { sealIdentityDocument, purgeStagedDocuments } from '@/lib/vault/seal-service';
import { roleForStatus, canTransition, type JoinerStatus } from '@/lib/rbac/lifecycle';
import { DEFAULT_PREJOINING_POLICIES } from './default-policies';
import { getCandidateDocumentRequirements } from './document-checklist';
import { auditOnboarding, auditLetters } from '@/lib/audit/events';
import {
  buildProbationSchedule,
  MILESTONE_DEFINITIONS,
  type MilestoneKey,
} from './probation-scheduling';

/**
 * Audit subject for an onboarding record.
 *
 * A candidate has no employee ID until provisioning mints one, so the personal
 * email is the durable join key that links pre-hire events to the rest of the
 * person's history. Once provisioned, the official employee code is carried too.
 */
function auditSubject(record: OnboardingRecord) {
  return {
    employee_id: record.employee_id || null,
    employee_email: record.personal_email,
    employee_name: record.candidate_name,
  };
}

export function generateInvitationToken(candidateName: string): string {
  const slug = candidateName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 24);

  // 10 random characters. The token is the only credential guarding a
  // candidate's PII, so it is long enough not to be guessable and the name is
  // only a readability suffix.
  const chars = 'abcdefghijkmnpqrstuvwxyz23456789';
  const bytes = new Uint8Array(10);
  globalThis.crypto.getRandomValues(bytes);
  const random = Array.from(bytes, (b) => chars[b % chars.length]).join('');

  return slug ? `${random}-${slug}` : random;
}

// ---------------------------------------------------------------------------
// Activity log
// ---------------------------------------------------------------------------

async function logActivity(
  onboardingId: string,
  actorType: 'pnc' | 'candidate' | 'system',
  action: string,
  description: string,
  metadata?: Record<string, any>
): Promise<void> {
  const { error } = await onboardingDb().from('onboarding_activity_log').insert({
    onboarding_id: onboardingId,
    actor_type: actorType,
    action,
    description,
    metadata: metadata ?? null,
  });
  // A lost log line must not fail the action it describes.
  if (error) console.error('Failed to write onboarding activity log:', error.message);
}

async function touchRecord(
  onboardingId: string,
  patch: Record<string, any>
): Promise<void> {
  const { error } = await onboardingDb()
    .from('onboarding_records')
    .update(patch)
    .eq('id', onboardingId);
  assertOk(error, 'Failed to update onboarding record');
}

/**
 * Move a record to `in_progress` the first time the candidate does anything.
 * Returns the status the record should now carry.
 */
function advanceOnCandidateAction(status: OnboardingStatus): OnboardingStatus | null {
  return status === 'draft' || status === 'invited' ? 'in_progress' : null;
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

export async function getAllOnboardingRecords(): Promise<OnboardingRecord[]> {
  const { data, error } = await onboardingDb()
    .from('onboarding_records')
    .select(RECORD_SELECT)
    .order('created_at', { ascending: false });

  assertOk(error, 'Failed to load onboarding records');
  return (data ?? []).map(mapRecord);
}

async function loadChildren(ids: string[]) {
  const db = onboardingDb();
  const [pers, emp, docs, pols, genDocs, logs, prov, salary] = await Promise.all([
    db.from('onboarding_personal_details').select('*').in('onboarding_id', ids),
    db.from('onboarding_employment_details').select('*').in('onboarding_id', ids),
    db.from('onboarding_documents').select('*').in('onboarding_id', ids).order('sort_order'),
    db.from('onboarding_policies').select('*').in('onboarding_id', ids).order('created_at'),
    db.from('onboarding_documents_generated').select('*').in('onboarding_id', ids).order('sort_order'),
    db
      .from('onboarding_activity_log')
      .select('*')
      .in('onboarding_id', ids)
      .order('created_at', { ascending: false }),
    db.from('employee_account_provisioning').select('*').in('onboarding_id', ids),
    db.from('salary_structures').select('*').in('onboarding_id', ids),
  ]);

  const byId = <T extends { onboarding_id: string }>(rows: T[] | null) => {
    const map = new Map<string, T[]>();
    for (const row of rows ?? []) {
      const list = map.get(row.onboarding_id) ?? [];
      list.push(row);
      map.set(row.onboarding_id, list);
    }
    return map;
  };

  return {
    personal: byId(pers.data as any[]),
    employment: byId(emp.data as any[]),
    documents: byId(docs.data as any[]),
    policies: byId(pols.data as any[]),
    generated: byId(genDocs.data as any[]),
    logs: byId(logs.data as any[]),
    provisioning: byId(prov.data as any[]),
    salary: byId(salary.data as any[]),
  };
}

/** Numeric columns arrive as strings from PostgREST; the UI needs numbers. */
function toSalaryStructure(row: any): OnboardingSalaryStructure | null {
  if (!row) return null;
  return {
    basic_monthly: Number(row.basic_monthly),
    hra_monthly: Number(row.hra_monthly),
    special_allowance_monthly: Number(row.special_allowance_monthly),
    other_allowance_monthly: Number(row.other_allowance_monthly),
    employer_pf_monthly: Number(row.employer_pf_monthly),
    gratuity_monthly: Number(row.gratuity_monthly),
    gross_monthly: Number(row.gross_monthly),
    ctc_monthly: Number(row.ctc_monthly),
    ctc_annual: Number(row.ctc_annual),
  };
}

function assemble(
  record: OnboardingRecord,
  children: Awaited<ReturnType<typeof loadChildren>>
): FullOnboardingData {
  const id = record.id;
  return {
    record,
    personalDetails: children.personal.get(id)?.[0] as OnboardingPersonalDetails | undefined,
    employmentDetails: children.employment.get(id)?.[0] as any,
    documents: (children.documents.get(id) ?? []) as OnboardingDocument[],
    policies: (children.policies.get(id) ?? []) as OnboardingPolicy[],
    generatedDocuments: (children.generated.get(id) ?? []) as OnboardingGeneratedDocument[],
    activityLogs: (children.logs.get(id) ?? []) as OnboardingActivityLog[],
    provisioning: (children.provisioning.get(id)?.[0] ?? null) as EmployeeAccountProvisioning | null,
    salaryStructure: toSalaryStructure(children.salary.get(id)?.[0]),
  };
}

export async function getOnboardingById(idOrToken: string): Promise<FullOnboardingData | null> {
  const db = onboardingDb();

  // `idOrToken` is a uuid from the dashboard and an invitation token from the
  // portal. Querying a uuid column with a token raises a type error rather than
  // returning nothing, so the shape decides which column to try.
  let row: any = null;
  if (isUuid(idOrToken)) {
    const res = await db.from('onboarding_records').select(RECORD_SELECT).eq('id', idOrToken).maybeSingle();
    assertOk(res.error, 'Failed to load onboarding record');
    row = res.data;
  }
  if (!row) {
    const res = await db
      .from('onboarding_records')
      .select(RECORD_SELECT)
      .eq('invitation_token', idOrToken)
      .maybeSingle();
    assertOk(res.error, 'Failed to load onboarding record by token');
    row = res.data;
  }
  if (!row) return null;

  const record = mapRecord(row);
  const children = await loadChildren([record.id]);
  return assemble(record, children);
}

export async function getOnboardingByToken(token: string): Promise<FullOnboardingData | null> {
  return getOnboardingById(token);
}

export async function getAllFullOnboardingData(): Promise<FullOnboardingData[]> {
  const records = await getAllOnboardingRecords();
  if (records.length === 0) return [];

  // One batched round trip per child table, rather than a query per record.
  const children = await loadChildren(records.map((r) => r.id));
  return records.map((r) => assemble(r, children));
}

// ---------------------------------------------------------------------------
// Creation
// ---------------------------------------------------------------------------

export async function createOnboardingRecord(
  payload: Omit<
    OnboardingRecord,
    'id' | 'status' | 'progress_percentage' | 'invitation_token' | 'created_at' | 'updated_at'
  >,
  /**
   * Letters P&C edited by hand on the create screen, replacing what the
   * template would have produced. Previously these were written to
   * `candidate_letters` and then never shown to anyone — the portal rendered
   * its own hardcoded letter instead.
   */
  customLetters?: Partial<Record<GeneratedDocumentType, string>>
): Promise<FullOnboardingData> {
  const db = onboardingDb();
  const token = generateInvitationToken(payload.candidate_name);

  const { data: inserted, error } = await db
    .from('onboarding_records')
    .insert({
      candidate_name: payload.candidate_name,
      personal_email: payload.personal_email,
      phone: payload.phone ?? null,
      designation: payload.designation,
      department: payload.department ?? null,
      team_id: payload.team_id ?? null,
      manager_id: payload.manager_id ?? null,
      buddy_id: payload.buddy_id ?? null,
      manager_name: payload.manager_name ?? null,
      buddy_name: payload.buddy_name ?? null,
      location: payload.location ?? null,
      employee_type_id: payload.employee_type_id ?? null,
      joining_date: payload.joining_date,
      probation_period: payload.probation_period ?? null,
      notice_period: payload.notice_period ?? null,
      ctc: payload.ctc ?? null,
      ctc_amount: payload.ctc_amount ?? null,
      ctc_frequency: payload.ctc_frequency ?? null,
      is_alumni: payload.is_alumni ?? false,
      role_responsibilities: payload.role_responsibilities ?? null,
      status: 'draft',
      progress_percentage: 0,
      invitation_token: token,
      created_by: payload.created_by ?? 'P&C Team',
    })
    .select('id')
    .single();

  // The id is now generated by the database. The previous implementation minted
  // `onb-<timestamp>-<rand>` against a uuid column, so every insert failed.
  assertOk(error, 'Failed to create onboarding record');
  const id = (inserted as { id: string }).id;

  // Policies the candidate acknowledges before joining.
  const policies = DEFAULT_PREJOINING_POLICIES.map((p) => ({ ...p, onboarding_id: id }));
  const { error: polError } = await db.from('onboarding_policies').insert(policies);
  if (polError) console.error('Failed to seed onboarding policies:', polError.message);

  // The document checklist, from `document_types` rather than a hardcoded list,
  // so P&C can change what is collected without a deploy.
  const requirements = await getCandidateDocumentRequirements();
  const { error: docError } = await db.from('onboarding_documents').insert(
    requirements.map((r) => ({
      onboarding_id: id,
      document_type: r.label,
      document_type_key: r.key,
      file_name: '',
      status: 'pending',
      is_required: r.required,
      sort_order: r.sortOrder,
    }))
  );
  if (docError) console.error('Failed to seed onboarding documents:', docError.message);

  const record = (await getOnboardingById(id))!.record;

  // Salary structure and letters, in that order: the letters quote the annexure.
  await regenerateCandidateDocuments(record, payload.created_by, customLetters);

  await logActivity(
    id,
    'pnc',
    'Onboarding Draft Created',
    `P&C created initial onboarding record for ${record.candidate_name} (${record.designation}).`
  );

  await auditOnboarding.created({
    subject: auditSubject(record),
    actorName: record.created_by,
    entityId: id,
    designation: record.designation,
    metadata: {
      joining_date: record.joining_date,
      employee_type: record.employee_type_name,
      manager: record.manager_name,
      team: record.team_name || record.department,
    },
  });

  return (await getOnboardingById(id))!;
}

/**
 * Derive the salary annexure, then render every letter from the template
 * library against it.
 *
 * Safe to re-run: signed documents are preserved.
 */
export async function regenerateCandidateDocuments(
  record: OnboardingRecord,
  createdBy?: string,
  customLetters?: Partial<Record<GeneratedDocumentType, string>>
): Promise<void> {
  const employeeTypeCode = await employeeTypeCodeFor(record.employee_type_id);

  const salary = await upsertSalaryStructure(record.id, {
    ctcAmount: record.ctc_amount ?? null,
    ctcFrequency: record.ctc_frequency ?? null,
    employeeTypeCode,
    effectiveFrom: record.joining_date,
    createdBy,
  });

  const rendered = await renderLettersForRecord({ record, salary });
  const letters = rendered.map((letter) => {
    const override = customLetters?.[letter.documentType];
    return override
      ? { ...letter, content: override, templateName: `${letter.templateName} (edited)` }
      : letter;
  });
  await storeGeneratedLetters(record.id, letters, record, createdBy);
}

async function employeeTypeCodeFor(employeeTypeId?: string | null): Promise<string | null> {
  if (!employeeTypeId) return null;
  const { data } = await onboardingDb()
    .from('employee_types')
    .select('code')
    .eq('id', employeeTypeId)
    .maybeSingle();
  return (data as { code: string } | null)?.code ?? null;
}

// ---------------------------------------------------------------------------
// Invitation
// ---------------------------------------------------------------------------

export async function sendOnboardingInvitation(id: string): Promise<FullOnboardingData | null> {
  const data = await getOnboardingById(id);
  if (!data) return null;

  // Send first, record second. A record marked `invited` when nothing was sent
  // is worse than one still marked `draft`: it tells P&C the candidate has the
  // link when they do not.
  const result = await sendInvitationEmail(data.record);

  if (!result.sent) {
    await logActivity(
      id,
      'system',
      'Invitation Email Failed',
      `Could not send the onboarding invitation to ${data.record.personal_email}: ${result.error}`,
      { error: result.error }
    );
    throw new Error(result.error || 'The invitation email could not be sent.');
  }

  const now = new Date().toISOString();
  await touchRecord(id, { status: 'invited', invited_at: now });

  await logActivity(
    id,
    'pnc',
    'Invitation Sent to Candidate',
    `Onboarding invitation emailed to ${data.record.personal_email}.`
  );

  await auditOnboarding.invitationSent({
    subject: auditSubject(data.record),
    actorType: 'system',
    entityId: id,
    to: data.record.personal_email,
  });

  return getOnboardingById(id);
}

// ---------------------------------------------------------------------------
// Portal visits
// ---------------------------------------------------------------------------

export async function recordPortalVisit(
  tokenOrId: string,
  metadata?: { ip?: string; userAgent?: string }
): Promise<FullOnboardingData | null> {
  const data = await getOnboardingById(tokenOrId);
  if (!data) return null;

  const { record } = data;
  const now = new Date().toISOString();
  const isFirstVisit = !record.first_visited_at;

  if (isFirstVisit) {
    await touchRecord(record.id, {
      first_visited_at: now,
      last_visited_at: now,
      visit_count: 1,
      ...(record.status === 'invited' ? { status: 'in_progress' } : {}),
    });
    await logActivity(
      record.id,
      'candidate',
      'Candidate Portal First Accessed',
      `Candidate opened the onboarding portal for the first time (${record.personal_email}).`,
      metadata
    );
    await auditOnboarding.portalVisited({
      subject: auditSubject(record),
      actorType: 'candidate',
      actorName: record.candidate_name,
      actorEmail: record.personal_email,
      entityId: record.id,
      visitCount: 1,
      metadata,
    });
  } else {
    // Only log a repeat visit once a minute, so a re-render is not a visit.
    const last = record.last_visited_at ? new Date(record.last_visited_at).getTime() : 0;
    if (Date.now() - last > 60_000) {
      const visitCount = (record.visit_count || 1) + 1;
      await touchRecord(record.id, { last_visited_at: now, visit_count: visitCount });
      await logActivity(
        record.id,
        'candidate',
        'Candidate Portal Accessed',
        `Candidate visited the onboarding portal (visit #${visitCount}).`,
        metadata
      );
      await auditOnboarding.portalVisited({
        subject: auditSubject(record),
        actorType: 'candidate',
        actorName: record.candidate_name,
        actorEmail: record.personal_email,
        entityId: record.id,
        visitCount,
        metadata,
      });
    }
  }

  return getOnboardingById(record.id);
}

// ---------------------------------------------------------------------------
// Candidate-side updates
// ---------------------------------------------------------------------------

export async function updatePersonalDetails(
  id: string,
  details: Omit<OnboardingPersonalDetails, 'id' | 'onboarding_id'>
): Promise<FullOnboardingData | null> {
  const data = await getOnboardingById(id);
  if (!data) return null;

  const { error } = await onboardingDb()
    .from('onboarding_personal_details')
    .upsert({ ...details, onboarding_id: id, updated_at: new Date().toISOString() }, {
      onConflict: 'onboarding_id',
    });
  assertOk(error, 'Failed to save personal details');

  const next = advanceOnCandidateAction(data.record.status);
  if (next) await touchRecord(id, { status: next });

  await logActivity(
    id,
    'candidate',
    'Personal Information Updated',
    'Candidate submitted personal and emergency contact information.'
  );

  return refreshProgress(id);
}

export async function confirmEmploymentDetails(
  id: string,
  confirmed: boolean,
  correctionRequested: boolean,
  correctionNotes?: string
): Promise<FullOnboardingData | null> {
  const data = await getOnboardingById(id);
  if (!data) return null;
  const { record } = data;
  const now = new Date().toISOString();

  const { error } = await onboardingDb()
    .from('onboarding_employment_details')
    .upsert(
      {
        onboarding_id: id,
        designation: record.designation,
        department: record.department ?? null,
        team_id: record.team_id ?? null,
        manager_id: record.manager_id ?? null,
        buddy_id: record.buddy_id ?? null,
        manager_name: record.manager_name ?? null,
        buddy_name: record.buddy_name ?? null,
        location: record.location ?? null,
        joining_date: record.joining_date,
        employee_type_id: record.employee_type_id ?? null,
        probation_period: record.probation_period ?? null,
        notice_period: record.notice_period ?? null,
        ctc: record.ctc ?? null,
        ctc_amount: record.ctc_amount ?? null,
        ctc_frequency: record.ctc_frequency ?? null,
        is_alumni: record.is_alumni,
        role_responsibilities: record.role_responsibilities ?? null,
        candidate_confirmed: confirmed,
        candidate_confirmed_at: confirmed ? now : null,
        correction_requested: correctionRequested,
        correction_notes: correctionNotes ?? null,
        updated_at: now,
      },
      { onConflict: 'onboarding_id' }
    );
  assertOk(error, 'Failed to save employment confirmation');

  const next = advanceOnCandidateAction(record.status);
  if (next) await touchRecord(id, { status: next });

  await logActivity(
    id,
    'candidate',
    confirmed ? 'Employment Information Confirmed' : 'Employment Correction Requested',
    confirmed
      ? 'Candidate confirmed the proposed employment terms and responsibilities.'
      : `Candidate requested a correction: "${correctionNotes ?? ''}"`
  );

  const opts = {
    subject: auditSubject(record),
    actorType: 'candidate' as const,
    actorName: record.candidate_name,
    actorEmail: record.personal_email,
    entityId: id,
  };
  if (confirmed) await auditOnboarding.detailsConfirmed(opts);
  else if (correctionRequested) await auditOnboarding.correctionRequested({ ...opts, notes: correctionNotes });

  return refreshProgress(id);
}

/**
 * Record a document the candidate uploaded.
 *
 * The file itself is written to private storage by the caller; this records
 * where it landed. `storageReference` is an object path, never a public URL.
 */
export async function uploadCandidateDocument(
  id: string,
  docType: string,
  fileName: string,
  fileSize: string,
  storageReference?: string,
  mimeType?: string
): Promise<FullOnboardingData | null> {
  const data = await getOnboardingById(id);
  if (!data) return null;

  const now = new Date().toISOString();
  const existing = data.documents.find((d) => d.document_type === docType);

  const { error } = await onboardingDb()
    .from('onboarding_documents')
    .upsert(
      {
        ...(existing?.id ? { id: existing.id } : {}),
        onboarding_id: id,
        document_type: docType,
        document_type_key: existing?.document_type_key ?? null,
        file_name: fileName,
        file_size: fileSize,
        storage_reference: storageReference ?? null,
        storage_bucket: storageReference ? CANDIDATE_BUCKET : null,
        mime_type: mimeType ?? null,
        status: 'uploaded',
        // A re-upload answers whatever the reviewer objected to, so the old
        // rejection reason must not stay on the row.
        rejection_reason: null,
        verified_at: null,
        verified_by: null,
        uploaded_at: now,
        is_required: existing?.is_required ?? false,
        sort_order: existing?.sort_order ?? 0,
      },
      { onConflict: 'onboarding_id,document_type' }
    );
  assertOk(error, 'Failed to record document upload');

  const next = advanceOnCandidateAction(data.record.status);
  if (next) await touchRecord(id, { status: next });

  await logActivity(id, 'candidate', 'Document Uploaded', `Candidate uploaded ${docType} (${fileName}).`);

  return refreshProgress(id);
}

export async function togglePolicyStatus(
  id: string,
  policyType: string,
  status: 'not_started' | 'completed'
): Promise<FullOnboardingData | null> {
  const data = await getOnboardingById(id);
  if (!data) return null;

  const policy = data.policies.find((p) => p.policy_type === policyType);
  if (!policy) return data;

  const { error } = await onboardingDb()
    .from('onboarding_policies')
    .update({ status, completed_at: status === 'completed' ? new Date().toISOString() : null })
    .eq('id', policy.id);
  assertOk(error, 'Failed to update policy status');

  const next = advanceOnCandidateAction(data.record.status);
  if (next) await touchRecord(id, { status: next });

  await logActivity(
    id,
    'candidate',
    status === 'completed' ? 'Policy Marked as Read' : 'Policy Reset',
    `Candidate ${status === 'completed' ? 'completed' : 'reset'} policy: ${policy.title}.`
  );

  return refreshProgress(id);
}

export async function signGeneratedDocument(
  id: string,
  docType: GeneratedDocumentType,
  signerName: string,
  signatureDataUrl?: string,
  signatureMetadata?: {
    ip_address?: string;
    user_agent?: string;
    timestamp?: string;
    method?: string;
    auth_token?: string;
  }
): Promise<FullOnboardingData | null> {
  const data = await getOnboardingById(id);
  if (!data) return null;

  const doc = data.generatedDocuments.find((d) => d.document_type === docType);
  if (!doc) return data;
  if (doc.status === 'signed') return data;

  const now = new Date().toISOString();
  const { error } = await onboardingDb()
    .from('onboarding_documents_generated')
    .update({
      status: 'signed',
      signed_at: now,
      signed_by: signerName,
      // Both of these had nowhere to be stored before, so every signature the
      // portal captured was discarded.
      signature_data_url: signatureDataUrl ?? null,
      signature_metadata: signatureMetadata ?? null,
    })
    .eq('id', doc.id);
  assertOk(error, 'Failed to record signature');

  const next = advanceOnCandidateAction(data.record.status);
  if (next) await touchRecord(id, { status: next });

  const label = GENERATED_DOCUMENT_LABELS[docType];
  await logActivity(id, 'candidate', `${label} Signed`, `${signerName} signed the ${label.toLowerCase()}.`);

  await auditLetters.signed({
    subject: auditSubject(data.record),
    actorType: 'candidate',
    actorName: signerName,
    actorEmail: data.record.personal_email,
    entityId: doc.id,
    letterType: label,
    metadata: signatureMetadata as Record<string, unknown> | undefined,
  });

  return refreshProgress(id);
}

export async function submitCandidateOnboarding(id: string): Promise<FullOnboardingData | null> {
  const data = await getOnboardingById(id);
  if (!data) return null;

  const now = new Date().toISOString();
  await touchRecord(id, { status: 'submitted', submitted_at: now, progress_percentage: 100 });

  await logActivity(
    id,
    'candidate',
    'Onboarding Submitted to P&C',
    'Candidate submitted their details, documents, policy confirmations and signed letters.'
  );

  await auditOnboarding.detailsSubmitted({
    subject: auditSubject(data.record),
    actorType: 'candidate',
    actorName: data.record.candidate_name,
    actorEmail: data.record.personal_email,
    entityId: id,
    severity: 'notice',
  });

  return getOnboardingById(id);
}

// ---------------------------------------------------------------------------
// P&C review
// ---------------------------------------------------------------------------

export async function verifyOrRejectDocument(
  id: string,
  documentId: string,
  status: 'verified' | 'rejected',
  rejectionReason?: string,
  reviewerName: string = 'P&C Reviewer',
  /**
   * The number PnC Ops read off the document. It is passed straight to the
   * vault and never written to core, which keeps only the last four
   * characters. Optional: a document can be verified without one.
   */
  documentNumber?: string | null
): Promise<FullOnboardingData | null> {
  const data = await getOnboardingById(id);
  if (!data) return null;

  const doc = data.documents.find((d) => d.id === documentId);
  if (!doc) return data;

  const { error } = await onboardingDb()
    .from('onboarding_documents')
    .update({
      status,
      rejection_reason: status === 'rejected' ? rejectionReason ?? null : null,
      verified_at: new Date().toISOString(),
      verified_by: reviewerName,
    })
    .eq('id', documentId);
  assertOk(error, 'Failed to record document review');

  await logActivity(
    id,
    'pnc',
    status === 'verified' ? 'Document Verified' : 'Document Rejected',
    status === 'verified'
      ? `P&C verified ${doc.document_type}.`
      : `P&C rejected ${doc.document_type}: "${rejectionReason ?? ''}"`
  );

  await auditOnboarding.documentReviewed({
    subject: auditSubject(data.record),
    actorName: reviewerName,
    entityId: documentId,
    documentType: doc.document_type,
    status,
    reason: status === 'rejected' ? rejectionReason : undefined,
  });

  // Approval is what moves the document out of core. Doing it here rather than
  // on a schedule means the staging window closes the moment a human says the
  // document is good, which is the point of the whole arrangement.
  if (status === 'verified') {
    const outcome = await sealIdentityDocument(documentId, {
      verifiedBy: reviewerName,
      documentNumber,
    });

    if (outcome.ok && !outcome.skipped) {
      await logActivity(
        id,
        'system',
        'Document Secured in Vault',
        `${doc.document_type} moved to the vault and removed from core` +
          (outcome.numberLast4 ? `; number ending ${outcome.numberLast4} recorded.` : '.')
      );
    } else if (!outcome.ok) {
      // The document is verified but still in core. Say so loudly: silence
      // here is an exposure nobody is watching.
      await logActivity(
        id,
        'system',
        'Document Could Not Be Secured',
        `${doc.document_type} is verified but still in core: ${outcome.error}. It will be retried.`,
        { seal_error: outcome.error }
      );
    }
  }

  return refreshProgress(id);
}

/**
 * Withdraw a joiner: declined, offer pulled, or a Day 1 no-show.
 *
 * The record is kept, never deleted, so no confirmation trigger can fire for
 * someone who never joined. Their role goes to none and scheduled steps stop.
 *
 * Their uploaded documents are deliberately NOT purged here. Nothing will ever
 * seal them — there is no verification coming — so they show up in
 * `exposed_records` as orphaned, and a person decides what happens to them.
 * See open decision #6.
 */
export async function withdrawJoiner(
  id: string,
  reason: string,
  actorName: string = 'P&C'
): Promise<FullOnboardingData | null> {
  const data = await getOnboardingById(id);
  if (!data) return null;

  const current = (data.record.joiner_status as JoinerStatus | undefined) ?? 'offer_pending';
  if (current === 'withdrawn') return data;
  if (!canTransition(current, 'withdrawn')) {
    throw new Error(`Cannot withdraw from ${current}.`);
  }

  await touchRecord(id, { joiner_status: 'withdrawn' });

  await logActivity(
    id,
    'pnc',
    'Joiner Withdrawn',
    `${data.record.candidate_name} was withdrawn: ${reason}. Scheduled steps stop and access is off.`,
    { from_status: current, reason }
  );

  const stillStaged = data.documents.filter(
    (d) => d.storage_reference && d.seal_state !== 'sealed'
  );
  if (stillStaged.length > 0) {
    await logActivity(
      id,
      'system',
      'Documents Left Unsealed',
      `${stillStaged.length} document(s) remain in core with no verification coming. ` +
        'They are listed as orphaned exposures until someone decides whether to keep them.'
    );
  }

  await auditOnboarding.statusChanged({
    subject: auditSubject(data.record),
    entityId: id,
    from: current,
    to: 'withdrawn',
    note: reason,
    severity: 'notice',
  });

  return getOnboardingById(id);
}

/**
 * Delete a withdrawn joiner's staged documents.
 *
 * Separate from withdrawal on purpose: withdrawing is a workflow step, and
 * deleting someone's identity documents is a decision. The caller has made it.
 */
export async function purgeWithdrawnDocuments(
  id: string,
  reason: string,
  actorName: string = 'P&C'
): Promise<FullOnboardingData | null> {
  const data = await getOnboardingById(id);
  if (!data) return null;

  if (data.record.joiner_status !== 'withdrawn') {
    throw new Error('Only a withdrawn joiner\'s documents can be purged this way.');
  }

  const result = await purgeStagedDocuments(id, { purgedBy: actorName, reason });

  await logActivity(
    id,
    'pnc',
    'Staged Documents Purged',
    `${result.purged} unsealed document(s) deleted from core: ${reason}.` +
      (result.errors.length > 0 ? ` Failed: ${result.errors.join('; ')}` : ''),
    { purged: result.purged, errors: result.errors }
  );

  return getOnboardingById(id);
}

/** Retry a seal that failed, for the exposure list to act on. */
export async function retrySealDocument(
  id: string,
  documentId: string,
  reviewerName: string = 'P&C Reviewer'
): Promise<FullOnboardingData | null> {
  const outcome = await sealIdentityDocument(documentId, { verifiedBy: reviewerName });
  await logActivity(
    id,
    'system',
    outcome.ok ? 'Document Secured in Vault' : 'Document Could Not Be Secured',
    outcome.ok
      ? 'A previously failed seal completed; the document is out of core.'
      : `Retry failed: ${'error' in outcome ? outcome.error : 'unknown'}`
  );
  return getOnboardingById(id);
}

export async function updateOnboardingStatus(
  id: string,
  status: OnboardingStatus,
  reviewerNote?: string
): Promise<FullOnboardingData | null> {
  const data = await getOnboardingById(id);
  if (!data) return null;

  const previousStatus = data.record.status;
  const now = new Date().toISOString();

  await touchRecord(id, {
    status,
    ...(status === 'approved' ? { approved_at: now } : {}),
    ...(status === 'completed' ? { completed_at: now } : {}),
  });

  await logActivity(
    id,
    'pnc',
    `Status Changed to ${status.replace(/_/g, ' ').toUpperCase()}`,
    reviewerNote || `P&C moved the onboarding to ${status}.`
  );

  await auditOnboarding.statusChanged({
    subject: auditSubject(data.record),
    entityId: id,
    from: previousStatus,
    to: status,
    note: reviewerNote,
    severity: status === 'approved' || status === 'completed' ? 'notice' : 'info',
  });

  return getOnboardingById(id);
}

// ---------------------------------------------------------------------------
// Progress
// ---------------------------------------------------------------------------

/**
 * Recompute the progress bar from what is actually on the record and store it.
 *
 * Required documents are weighted by how many there are rather than by a fixed
 * "at least three uploaded" test, so adding a document type to the checklist
 * changes the bar instead of being invisible.
 */
async function refreshProgress(id: string): Promise<FullOnboardingData | null> {
  const data = await getOnboardingById(id);
  if (!data) return null;

  const checkpoints: number[] = [];

  const p = data.personalDetails;
  checkpoints.push(p?.full_name && p?.current_address && p?.emergency_contact_name ? 1 : 0);

  const required = data.documents.filter((d) => d.is_required);
  const pool = required.length > 0 ? required : data.documents;
  const done = pool.filter((d) => d.status === 'uploaded' || d.status === 'verified').length;
  checkpoints.push(pool.length === 0 ? 1 : done / pool.length);

  checkpoints.push(data.employmentDetails?.candidate_confirmed ? 1 : 0);

  const policiesDone = data.policies.filter((x) => x.status === 'completed').length;
  checkpoints.push(data.policies.length === 0 ? 1 : policiesDone / data.policies.length);

  // The annexure is informational; only the letters that need a signature count.
  const signable = data.generatedDocuments.filter((d) => d.document_type !== 'annexure');
  const signed = signable.filter((d) => d.status === 'signed').length;
  checkpoints.push(signable.length === 0 ? 1 : signed / signable.length);

  const percentage = Math.round((checkpoints.reduce((a, b) => a + b, 0) / checkpoints.length) * 100);

  if (percentage !== data.record.progress_percentage) {
    await touchRecord(id, { progress_percentage: percentage });
    data.record.progress_percentage = percentage;
  }
  return data;
}

// ---------------------------------------------------------------------------
// Provisioning — candidate becomes employee
// ---------------------------------------------------------------------------

function officialEmailFor(name: string): string {
  const parts = name.trim().toLowerCase().split(/\s+/);
  const first = parts[0] || 'employee';
  const last = parts.slice(1).join('') || 'ng';
  return `${first}.${last}@navgurukul.org`.replace(/[^a-z0-9.@]/g, '');
}

/** Sequential within a year, so two people provisioned together cannot collide. */
async function nextEmployeeCode(): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `NG-${year}-`;
  const { data } = await onboardingDb()
    .from('employee_account_provisioning')
    .select('employee_id_code')
    .like('employee_id_code', `${prefix}%`)
    .order('employee_id_code', { ascending: false })
    .limit(1);

  const last = (data as { employee_id_code: string }[] | null)?.[0]?.employee_id_code;
  const lastNumber = last ? parseInt(last.slice(prefix.length), 10) : 0;
  const next = Number.isFinite(lastNumber) ? lastNumber + 1 : 1;
  return `${prefix}${String(next).padStart(4, '0')}`;
}

/**
 * Create (or update) the `employees` row for a provisioned candidate.
 *
 * This is the candidate-to-employee boundary. It previously did not exist:
 * provisioning wrote an activity log reading "Employee Record Linked … in the
 * central NG workforce directory" and inserted nothing, so a completed
 * onboarding produced no employee at all.
 */
async function linkEmployeeRecord(
  data: FullOnboardingData,
  officialEmail: string
): Promise<string | null> {
  const db = onboardingDb();
  const { record } = data;

  // `employees.employee_type` is a Postgres enum; a code outside it would fail
  // the insert at the worst possible moment, so an unknown one falls back
  // rather than blocking the person from being created at all.
  const EMPLOYEE_TYPE_ENUM = [
    'apprentice_nontech',
    'apprentice_tech',
    'intern',
    'fte',
    'ftc',
    'contractor',
    'part_time',
    'fellow',
  ];
  const rawCode = await employeeTypeCodeFor(record.employee_type_id);
  const employeeTypeCode = rawCode && EMPLOYEE_TYPE_ENUM.includes(rawCode) ? rawCode : 'fte';
  if (rawCode && rawCode !== employeeTypeCode) {
    console.warn(`Unknown employee type code "${rawCode}"; recorded as fte.`);
  }

  // Re-provisioning must not create a second person.
  const { data: existing } = await db
    .from('employees')
    .select('id')
    .eq('email', officialEmail)
    .maybeSingle();

  const payload = {
    name: record.candidate_name,
    email: officialEmail,
    employee_type: employeeTypeCode,
    employee_type_id: record.employee_type_id ?? null,
    joining_date: record.joining_date,
    team: record.team_name ?? record.department ?? null,
    team_id: record.team_id ?? null,
    manager_id: record.manager_id ?? null,
    status: 'active',
  };

  let employeeId = (existing as { id: string } | null)?.id ?? null;

  if (employeeId) {
    const { error } = await db.from('employees').update(payload).eq('id', employeeId);
    assertOk(error, 'Failed to update the employee record');
  } else {
    const { data: created, error } = await db.from('employees').insert(payload).select('id').single();
    assertOk(error, 'Failed to create the employee record');
    employeeId = (created as { id: string }).id;
  }

  // Carry the personal details across so the employee profile is not empty on
  // day one, and so the candidate never retypes what they already gave us.
  if (data.personalDetails) {
    const pd = data.personalDetails;
    const nameParts = (pd.full_name || record.candidate_name).trim().split(/\s+/);

    const { error } = await db.from('employee_profiles').upsert(
      {
        employee_id: employeeId,
        // Some people have one name; last_name is simply empty rather than a
        // repeat of the first.
        first_name: nameParts[0] ?? '',
        last_name: nameParts.slice(1).join(' '),
        personal_email: pd.personal_email ?? record.personal_email,
        official_email: officialEmail,
        contact_number: pd.phone ?? record.phone ?? null,
        date_of_birth: pd.date_of_birth ?? null,
        gender: pd.gender ?? null,
        blood_group: pd.blood_group ?? null,
        profile_photo_url: pd.profile_photo_url ?? null,
        permanent_address: pd.permanent_address ?? null,
        // "Mailing" here is the address they currently live at.
        mailing_address: pd.current_address ?? null,
        mailing_address_same: !pd.current_address || pd.current_address === pd.permanent_address,
        emergency_contact_name: pd.emergency_contact_name ?? null,
        emergency_contact_number: pd.emergency_contact_phone ?? null,
        emergency_contact_relation: pd.emergency_contact_relation ?? null,
      },
      { onConflict: 'employee_id' }
    );
    if (error) console.error('Failed to carry personal details to the employee profile:', error.message);
  }

  // The salary structure follows the person, so payroll and later appraisals
  // read the same figures the candidate was offered.
  const { error: salaryError } = await db
    .from('salary_structures')
    .update({ employee_id: employeeId })
    .eq('onboarding_id', record.id);
  if (salaryError) console.error('Failed to attach salary structure to employee:', salaryError.message);

  // The verified dossier becomes the employee's documents. Only verified ones
  // cross: the in-house audit is what makes an upload part of the record.
  if (employeeId) {
    const handover = await carryDocumentsToEmployee(data.documents, {
      id: employeeId,
      name: record.candidate_name,
    });
    await logActivity(
      record.id,
      'system',
      'Documents Carried to Employee Record',
      `${handover.carried} verified document(s) attached to the employee record` +
        (handover.copiedToDrive > 0 ? `, ${handover.copiedToDrive} copied to Drive` : '') +
        (handover.skipped.length > 0 ? `. Not carried: ${handover.skipped.join(', ')}` : '.'),
      { carried: handover.carried, copied_to_drive: handover.copiedToDrive, skipped: handover.skipped }
    );
  }

  // Point the onboarding record at the employee it produced.
  await touchRecord(record.id, { employee_id: employeeId });

  return employeeId;
}

export async function provisionOfficialAccount(id: string): Promise<FullOnboardingData | null> {
  const data = await getOnboardingById(id);
  if (!data) return null;

  // Documents must be audited before someone becomes an employee. This is the
  // human check the process depends on, so it is enforced rather than assumed.
  const unverified = data.documents.filter((d) => d.is_required && d.status !== 'verified');
  if (unverified.length > 0) {
    throw new Error(
      `Cannot provision: ${unverified.length} required document(s) are not yet verified — ` +
        unverified.map((d) => d.document_type).join(', ')
    );
  }

  const now = new Date().toISOString();
  const officialEmail = officialEmailFor(data.record.candidate_name);
  const employeeCode = await nextEmployeeCode();

  const employeeId = await linkEmployeeRecord(data, officialEmail);

  const { error } = await onboardingDb()
    .from('employee_account_provisioning')
    .upsert(
      {
        onboarding_id: id,
        employee_id: employeeId,
        official_email: officialEmail,
        employee_id_code: employeeCode,
        status: 'active',
        // Credentials are sent by a person, because this application never
        // stores an account password. Nothing here claims otherwise.
        credentials_delivery_status: 'pending',
        provisioned_at: now,
      },
      { onConflict: 'onboarding_id' }
    );
  assertOk(error, 'Failed to record account provisioning');

  await touchRecord(id, { status: 'completed', completed_at: now });

  await logActivity(
    id,
    'system',
    'Official Account Provisioned',
    `Allocated ${officialEmail} (${employeeCode}). Credentials are sent by P&C separately.`
  );
  await logActivity(
    id,
    'system',
    'Employee Record Created',
    `${data.record.candidate_name} now exists in the employee directory as ${officialEmail}.`,
    { employee_id: employeeId }
  );

  await auditOnboarding.accountProvisioned({
    subject: { ...auditSubject(data.record), employee_id: employeeCode },
    actorType: 'system',
    entityId: id,
    officialEmail,
    employeeCode,
  });

  const refreshed = await getOnboardingById(id);
  if (refreshed) await autoScheduleProbationCheckins(refreshed);
  return getOnboardingById(id);
}

// ---------------------------------------------------------------------------
// Provisioning details, orientation and probation
// ---------------------------------------------------------------------------

async function ensureProvisioning(data: FullOnboardingData): Promise<EmployeeAccountProvisioning> {
  if (data.provisioning) return data.provisioning;

  const { data: created, error } = await onboardingDb()
    .from('employee_account_provisioning')
    .upsert(
      {
        onboarding_id: data.record.id,
        official_email: officialEmailFor(data.record.candidate_name),
        employee_id_code: await nextEmployeeCode(),
        status: 'pending',
        credentials_delivery_status: 'pending',
      },
      { onConflict: 'onboarding_id' }
    )
    .select('*')
    .single();
  assertOk(error, 'Failed to create provisioning record');
  return created as EmployeeAccountProvisioning;
}

export async function updateOrientationChecklist(
  id: string,
  checklist: Partial<EmployeeOrientationChecklist>
): Promise<FullOnboardingData | null> {
  const data = await getOnboardingById(id);
  if (!data) return null;

  const provisioning = await ensureProvisioning(data);
  const previous = provisioning.orientation_checklist;

  const merged: EmployeeOrientationChecklist = {
    welcome_email_sent: false,
    it_assets_assigned: false,
    slack_access_granted: false,
    buddy_introduced: false,
    manager_1on1_done: false,
    pnc_induction_done: false,
    posh_training_completed: false,
    ...(previous || {}),
    ...checklist,
  };

  const { error } = await onboardingDb()
    .from('employee_account_provisioning')
    .update({ orientation_checklist: merged })
    .eq('onboarding_id', id);
  assertOk(error, 'Failed to save orientation checklist');

  await logActivity(
    id,
    'pnc',
    'Orientation Checklist Updated',
    `P&C updated orientation items for ${data.record.candidate_name}.`
  );

  const flags = [
    'welcome_email_sent',
    'it_assets_assigned',
    'slack_access_granted',
    'buddy_introduced',
    'manager_1on1_done',
    'pnc_induction_done',
    'posh_training_completed',
  ] as const;

  await auditOnboarding.orientationUpdated({
    subject: auditSubject(data.record),
    entityId: id,
    completed: flags.filter((f) => merged[f]).length,
    total: flags.length,
    changes: flags
      .filter((f) => f in checklist && checklist[f] !== previous?.[f])
      .map((f) => ({
        field: f,
        label: f.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
        from: previous?.[f] ?? false,
        to: checklist[f],
      })),
  });

  return getOnboardingById(id);
}

export async function updateProbationMilestone(
  id: string,
  milestoneKey: MilestoneKey,
  milestoneData: Partial<ProbationMilestone>
): Promise<FullOnboardingData | null> {
  const data = await getOnboardingById(id);
  if (!data) return null;

  const provisioning = await ensureProvisioning(data);
  const milestones = provisioning.probation_milestones || {};
  const previous = milestones[milestoneKey];
  const label = MILESTONE_DEFINITIONS[milestoneKey].label;

  // A human touching the date takes the slot out of the auto-scheduler's hands,
  // so a later provisioning save will not move it back.
  const dateMoved =
    (milestoneData.due_date !== undefined && milestoneData.due_date !== previous?.due_date) ||
    (milestoneData.starts_at !== undefined && milestoneData.starts_at !== previous?.starts_at);

  const updated = {
    ...milestones,
    [milestoneKey]: {
      status: 'pending' as const,
      ...(previous || {}),
      ...milestoneData,
      ...(dateMoved ? { rescheduled: true, auto_scheduled: false } : {}),
    },
  };

  const { error } = await onboardingDb()
    .from('employee_account_provisioning')
    .update({ probation_milestones: updated })
    .eq('onboarding_id', id);
  assertOk(error, 'Failed to save probation milestone');

  await logActivity(
    id,
    'pnc',
    `Probation Milestone Updated (${label})`,
    `Status: ${milestoneData.status || 'updated'}. ${milestoneData.notes || ''}`.trim()
  );

  await auditOnboarding.milestoneUpdated({
    subject: auditSubject(data.record),
    entityId: `${id}:${milestoneKey}`,
    milestone: label,
    status: milestoneData.status || previous?.status || 'updated',
    notes: milestoneData.notes,
    changes: [
      ...(milestoneData.status && milestoneData.status !== previous?.status
        ? [{ field: 'status', label: 'Status', from: previous?.status, to: milestoneData.status }]
        : []),
      ...(dateMoved
        ? [{ field: 'due_date', label: 'Scheduled For', from: previous?.due_date, to: milestoneData.due_date }]
        : []),
    ],
  });

  return getOnboardingById(id);
}

/**
 * Place (or refresh) the 30- and 60-day check-ins and record each newly-booked
 * slot. Idempotent: completed and human-rescheduled milestones are left alone.
 */
async function autoScheduleProbationCheckins(data: FullOnboardingData): Promise<void> {
  if (!data.provisioning) return;

  const schedule = await buildProbationSchedule({
    joiningDate: data.record.joining_date,
    managerName: data.record.manager_name,
    // The manager's official mailbox is their calendar id.
    managerEmail: data.record.manager_name
      ? `${data.record.manager_name.trim().toLowerCase().replace(/\s+/g, '.')}@navgurukul.org`
      : null,
    existing: data.provisioning.probation_milestones,
  });

  const { error } = await onboardingDb()
    .from('employee_account_provisioning')
    .update({ probation_milestones: { day_30: schedule.day_30, day_60: schedule.day_60 } })
    .eq('onboarding_id', data.record.id);
  assertOk(error, 'Failed to save probation schedule');

  for (const key of schedule.newlyScheduled) {
    const milestone = schedule[key];
    const def = MILESTONE_DEFINITIONS[key];
    const when = milestone.starts_at
      ? new Date(milestone.starts_at).toLocaleString('en-IN', {
          weekday: 'short',
          day: 'numeric',
          month: 'short',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        })
      : milestone.due_date || 'TBC';

    await logActivity(
      data.record.id,
      'system',
      `${def.label} Auto-Scheduled`,
      `${def.label} booked with ${milestone.reviewer_name} for ${when}. ${milestone.scheduling_note || ''}`.trim()
    );

    await auditOnboarding.milestoneScheduled({
      subject: auditSubject(data.record),
      actorType: 'system',
      entityId: `${data.record.id}:${key}`,
      milestone: def.label,
      dueDate: when,
      reviewer: milestone.reviewer_name,
      metadata: {
        starts_at: milestone.starts_at,
        ends_at: milestone.ends_at,
        scheduling_note: milestone.scheduling_note,
        auto_scheduled: true,
      },
    });
  }
}

/** Exposed so callers can re-run scheduling without a provisioning save. */
export async function scheduleProbationCheckins(id: string): Promise<FullOnboardingData | null> {
  const data = await getOnboardingById(id);
  if (!data?.provisioning) return data;
  await autoScheduleProbationCheckins(data);
  return getOnboardingById(id);
}

/**
 * Save the official email and employee code for a joiner.
 *
 * IT hardware is deliberately NOT part of this payload. Laptops and other
 * assets are requested and allocated in the external Asset Management System,
 * which is the source of truth; ELC reads that allocation over the integration
 * boundary and never records it locally.
 */
export async function updateProvisioningDetails(
  id: string,
  details: { official_email?: string; employee_id_code?: string }
): Promise<FullOnboardingData | null> {
  const data = await getOnboardingById(id);
  if (!data) return null;

  const provisioning = await ensureProvisioning(data);
  const previousEmail = provisioning.official_email;
  const previousCode = provisioning.employee_id_code;

  const officialEmail = details.official_email || previousEmail;
  const employeeCode = details.employee_id_code || previousCode;

  const { error } = await onboardingDb()
    .from('employee_account_provisioning')
    .update({ official_email: officialEmail, employee_id_code: employeeCode })
    .eq('onboarding_id', id);
  assertOk(error, 'Failed to save provisioning details');

  // Keep the employee directory in step when the official address changes.
  if (provisioning.employee_id && officialEmail !== previousEmail) {
    const { error: empError } = await onboardingDb()
      .from('employees')
      .update({ email: officialEmail })
      .eq('id', provisioning.employee_id);
    if (empError) console.error('Failed to update employee email:', empError.message);
  }

  await logActivity(
    id,
    'pnc',
    'Employee Account Provisioning Updated',
    `Official email: ${officialEmail}, Employee ID: ${employeeCode}`
  );

  await auditOnboarding.accountProvisioned({
    subject: { ...auditSubject(data.record), employee_id: employeeCode },
    entityId: id,
    officialEmail,
    employeeCode,
    changes: [
      ...(previousEmail !== officialEmail
        ? [{ field: 'official_email', label: 'Official Email', from: previousEmail, to: officialEmail }]
        : []),
      ...(previousCode !== employeeCode
        ? [{ field: 'employee_id_code', label: 'Employee ID', from: previousCode, to: employeeCode }]
        : []),
    ],
  });

  const refreshed = await getOnboardingById(id);
  if (refreshed) await autoScheduleProbationCheckins(refreshed);
  return getOnboardingById(id);
}
