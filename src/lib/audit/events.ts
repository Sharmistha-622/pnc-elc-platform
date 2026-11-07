import { recordAuditEvent } from './service';
import type {
  AuditActorType,
  AuditEventInput,
  AuditFieldChange,
  AuditModule,
  AuditSeverity,
  AuditSubject,
} from './types';

// ============================================================================
// AUDIT EVENT CATALOGUE
// ----------------------------------------------------------------------------
// Thin, typed wrappers so every module emits the same shape. Call sites pass
// the subject (employee id and/or email) plus a short description; the module
// and action verb come from the helper, which keeps action strings consistent
// enough to filter and report on.
//
// All helpers are fire-and-forget by contract: they never throw, so a failing
// audit write can never fail the business action that triggered it.
// ============================================================================

interface BaseOptions {
  subject: AuditSubject;
  actorName?: string | null;
  actorEmail?: string | null;
  actorType?: AuditActorType;
  entityId?: string | null;
  entityType?: string | null;
  changes?: AuditFieldChange[] | null;
  metadata?: Record<string, unknown> | null;
  severity?: AuditSeverity;
  occurredAt?: string;
}

function toInput(
  module: AuditModule,
  action: string,
  description: string,
  opts: BaseOptions
): AuditEventInput {
  return {
    subject: opts.subject,
    actor: {
      actor_name: opts.actorName ?? null,
      actor_email: opts.actorEmail ?? null,
      actor_type: opts.actorType || 'pnc',
    },
    module,
    action,
    description,
    severity: opts.severity || 'info',
    entity_type: opts.entityType ?? null,
    entity_id: opts.entityId ?? null,
    changes: opts.changes ?? null,
    metadata: opts.metadata ?? null,
    occurred_at: opts.occurredAt,
  };
}

/**
 * Reasons, notes and amounts go to metadata, never the description: the
 * description is shown more widely than the values behind it (see
 * auditEventsFor in ./service).
 */
function withDetail(opts: BaseOptions, detail: Record<string, unknown>): Record<string, unknown> | null {
  const defined = Object.fromEntries(Object.entries(detail).filter(([, v]) => v !== undefined && v !== null && v !== ''));
  if (Object.keys(defined).length === 0) return opts.metadata ?? null;
  return { ...(opts.metadata ?? {}), ...defined };
}

/**
 * Record an event for a module that has no dedicated helper yet.
 * Prefer a named helper below when one exists — the action strings it produces
 * are what the audit filters and reports key on.
 */
export function auditEvent(
  module: AuditModule,
  action: string,
  description: string,
  opts: BaseOptions
) {
  return recordAuditEvent(toInput(module, action, description, opts));
}

// ----------------------------------------------------------------------------
// ONBOARDING
// ----------------------------------------------------------------------------

export const auditOnboarding = {
  created: (o: BaseOptions & { designation?: string }) =>
    auditEvent(
      'onboarding',
      'onboarding.record.created',
      `Onboarding record created${o.designation ? ` for the role of ${o.designation}` : ''}.`,
      { ...o, entityType: 'onboarding' }
    ),

  invitationSent: (o: BaseOptions & { to?: string }) =>
    auditEvent(
      'onboarding',
      'onboarding.invitation.sent',
      `Candidate portal invitation dispatched${o.to ? ` to ${o.to}` : ''}.`,
      { ...o, entityType: 'onboarding', actorType: o.actorType || 'system' }
    ),

  portalVisited: (o: BaseOptions & { visitCount?: number }) =>
    auditEvent(
      'onboarding',
      'onboarding.portal.visited',
      `Candidate opened the onboarding portal${o.visitCount ? ` (visit #${o.visitCount})` : ''}.`,
      { ...o, entityType: 'onboarding', actorType: o.actorType || 'candidate' }
    ),

  detailsSubmitted: (o: BaseOptions) =>
    auditEvent('onboarding', 'onboarding.details.submitted', 'Candidate submitted their onboarding dossier.', {
      ...o,
      entityType: 'onboarding',
      actorType: o.actorType || 'candidate',
    }),

  detailsConfirmed: (o: BaseOptions) =>
    auditEvent(
      'onboarding',
      'onboarding.employment_details.confirmed',
      'Candidate confirmed their employment terms.',
      { ...o, entityType: 'onboarding', actorType: o.actorType || 'candidate' }
    ),

  correctionRequested: (o: BaseOptions & { notes?: string }) =>
    auditEvent(
      'onboarding',
      'onboarding.employment_details.correction_requested',
      'Candidate requested a correction to their employment terms.',
      { ...o, metadata: withDetail(o, { notes: o.notes }), entityType: 'onboarding', actorType: o.actorType || 'candidate', severity: 'notice' }
    ),

  statusChanged: (o: BaseOptions & { from?: string; to: string; note?: string }) =>
    auditEvent(
      'onboarding',
      'onboarding.status.changed',
      `Onboarding status changed${o.from ? ` from ${o.from}` : ''} to ${o.to}.`,
      {
        ...o,
        metadata: withDetail(o, { note: o.note }),
        entityType: 'onboarding',
        changes: o.changes || [{ field: 'status', label: 'Onboarding Status', from: o.from, to: o.to }],
      }
    ),

  documentReviewed: (o: BaseOptions & { documentType: string; status: string; reason?: string }) =>
    auditEvent(
      'onboarding',
      `onboarding.document.${o.status}`,
      `${o.documentType} marked ${o.status}.`,
      {
        ...o,
        metadata: withDetail(o, { reason: o.reason }),
        entityType: 'onboarding_document',
        severity: o.status === 'rejected' ? 'notice' : 'info',
      }
    ),

  accountProvisioned: (o: BaseOptions & { officialEmail: string; employeeCode: string }) =>
    auditEvent(
      'onboarding',
      'onboarding.account.provisioned',
      `Official account provisioned: ${o.officialEmail} (Employee ID ${o.employeeCode}).`,
      {
        ...o,
        entityType: 'onboarding',
        severity: 'notice',
        metadata: { ...(o.metadata || {}), official_email: o.officialEmail, employee_code: o.employeeCode },
      }
    ),

  orientationUpdated: (o: BaseOptions & { completed: number; total: number }) =>
    auditEvent(
      'onboarding',
      'onboarding.orientation.updated',
      `Orientation checklist updated — ${o.completed} of ${o.total} items complete.`,
      { ...o, entityType: 'onboarding' }
    ),

  milestoneScheduled: (o: BaseOptions & { milestone: string; dueDate: string; reviewer?: string }) =>
    auditEvent(
      'onboarding',
      'onboarding.milestone.scheduled',
      `${o.milestone} auto-scheduled for ${o.dueDate}${o.reviewer ? ` with ${o.reviewer}` : ''}.`,
      { ...o, entityType: 'probation_milestone', actorType: o.actorType || 'system' }
    ),

  milestoneUpdated: (o: BaseOptions & { milestone: string; status: string; notes?: string }) =>
    auditEvent(
      'onboarding',
      'onboarding.milestone.updated',
      `${o.milestone} marked ${o.status}.`,
      { ...o, metadata: withDetail(o, { notes: o.notes }), entityType: 'probation_milestone' }
    ),
};

// ----------------------------------------------------------------------------
// EMPLOYEE DIRECTORY
// ----------------------------------------------------------------------------

export const auditEmployee = {
  created: (o: BaseOptions) =>
    auditEvent('employee', 'employee.record.created', 'Employee directory record created.', {
      ...o,
      entityType: 'employee',
      severity: 'notice',
    }),

  updated: (o: BaseOptions & { summary?: string }) =>
    auditEvent(
      'employee',
      'employee.record.updated',
      o.summary || 'Employee directory record updated.',
      { ...o, entityType: 'employee' }
    ),

  profileUpdated: (o: BaseOptions & { summary?: string }) =>
    auditEvent('employee', 'employee.profile.updated', o.summary || 'Employee profile updated.', {
      ...o,
      entityType: 'employee_profile',
    }),

  roleChanged: (o: BaseOptions & { from?: string; to: string }) =>
    auditEvent('employee', 'employee.role.changed', `Role changed${o.from ? ` from ${o.from}` : ''} to ${o.to}.`, {
      ...o,
      entityType: 'employee',
      severity: 'notice',
      changes: o.changes || [{ field: 'role', label: 'Role', from: o.from, to: o.to }],
    }),

  statusChanged: (o: BaseOptions & { from?: string; to: string }) =>
    auditEvent(
      'employee',
      'employee.status.changed',
      `Employment status changed${o.from ? ` from ${o.from}` : ''} to ${o.to}.`,
      {
        ...o,
        entityType: 'employee',
        severity: 'notice',
        changes: o.changes || [{ field: 'status', label: 'Status', from: o.from, to: o.to }],
      }
    ),
};

// ----------------------------------------------------------------------------
// APPRAISAL
// ----------------------------------------------------------------------------

export const auditAppraisal = {
  cycleStarted: (o: BaseOptions & { cycle: string }) =>
    auditEvent('appraisal', 'appraisal.cycle.started', `Included in appraisal cycle ${o.cycle}.`, {
      ...o,
      entityType: 'appraisal_cycle',
    }),

  selfReviewSubmitted: (o: BaseOptions) =>
    auditEvent('appraisal', 'appraisal.self_review.submitted', 'Self-review submitted.', {
      ...o,
      entityType: 'appraisal',
      actorType: o.actorType || 'employee',
    }),

  managerReviewSubmitted: (o: BaseOptions & { rating?: string }) =>
    auditEvent(
      'appraisal',
      'appraisal.manager_review.submitted',
      `Manager review submitted${o.rating ? ` with rating ${o.rating}` : ''}.`,
      { ...o, entityType: 'appraisal', actorType: o.actorType || 'manager' }
    ),

  ratingFinalized: (o: BaseOptions & { rating: string }) =>
    auditEvent('appraisal', 'appraisal.rating.finalized', `Final appraisal rating recorded: ${o.rating}.`, {
      ...o,
      entityType: 'appraisal',
      severity: 'notice',
    }),

  letterIssued: (o: BaseOptions & { letterType?: string }) =>
    auditEvent(
      'appraisal',
      'appraisal.letter.issued',
      `${o.letterType || 'Appraisal letter'} issued to the employee.`,
      { ...o, entityType: 'letter', severity: 'notice' }
    ),
};

// ----------------------------------------------------------------------------
// CONFIRMATION
// ----------------------------------------------------------------------------

export const auditConfirmation = {
  initiated: (o: BaseOptions & { dueDate?: string }) =>
    auditEvent(
      'confirmation',
      'confirmation.initiated',
      `Confirmation review initiated${o.dueDate ? `, due ${o.dueDate}` : ''}.`,
      { ...o, entityType: 'confirmation' }
    ),

  managerDecision: (o: BaseOptions & { decision: string; notes?: string }) =>
    auditEvent(
      'confirmation',
      'confirmation.manager_decision.recorded',
      `Manager recorded confirmation decision: ${o.decision}.`,
      { ...o, metadata: withDetail(o, { notes: o.notes }), entityType: 'confirmation', actorType: o.actorType || 'manager', severity: 'notice' }
    ),

  approved: (o: BaseOptions) =>
    auditEvent('confirmation', 'confirmation.approved', 'Employment confirmed.', {
      ...o,
      entityType: 'confirmation',
      severity: 'notice',
    }),

  extended: (o: BaseOptions & { until?: string; reason?: string }) =>
    auditEvent(
      'confirmation',
      'confirmation.extended',
      `Probation extended${o.until ? ` until ${o.until}` : ''}.`,
      { ...o, metadata: withDetail(o, { reason: o.reason }), entityType: 'confirmation', severity: 'warning' }
    ),
};

// ----------------------------------------------------------------------------
// PEER FEEDBACK
// ----------------------------------------------------------------------------

export const auditPeerFeedback = {
  requested: (o: BaseOptions & { reviewerCount?: number }) =>
    auditEvent(
      'peer_feedback',
      'peer_feedback.requested',
      `Peer feedback requested${o.reviewerCount ? ` from ${o.reviewerCount} reviewers` : ''}.`,
      { ...o, entityType: 'peer_feedback' }
    ),

  reminded: (o: BaseOptions & { reviewer?: string }) =>
    auditEvent(
      'peer_feedback',
      'peer_feedback.reminder_sent',
      `Peer feedback reminder sent${o.reviewer ? ` to ${o.reviewer}` : ''}.`,
      { ...o, entityType: 'peer_feedback', actorType: o.actorType || 'system' }
    ),

  submitted: (o: BaseOptions & { reviewer?: string }) =>
    auditEvent(
      'peer_feedback',
      'peer_feedback.submitted',
      `Peer feedback submitted${o.reviewer ? ` by ${o.reviewer}` : ''}.`,
      { ...o, entityType: 'peer_feedback' }
    ),

  redFlagRaised: (o: BaseOptions & { keyword?: string }) =>
    auditEvent(
      'peer_feedback',
      'peer_feedback.red_flag.raised',
      `Peer feedback flagged for review${o.keyword ? ` (matched "${o.keyword}")` : ''}.`,
      { ...o, entityType: 'peer_feedback', severity: 'warning' }
    ),
};

// ----------------------------------------------------------------------------
// OFFBOARDING
// ----------------------------------------------------------------------------

export const auditOffboarding = {
  resignationReceived: (o: BaseOptions & { channel?: string; lastWorkingDay?: string }) =>
    auditEvent(
      'offboarding',
      'offboarding.resignation.received',
      `Resignation received${o.channel ? ` via ${o.channel}` : ''}${
        o.lastWorkingDay ? `, proposed last working day ${o.lastWorkingDay}` : '.'
      }`,
      { ...o, entityType: 'offboarding_case', severity: 'notice' }
    ),

  caseOpened: (o: BaseOptions & { exitType?: string }) =>
    auditEvent(
      'offboarding',
      'offboarding.case.opened',
      `Offboarding case opened${o.exitType ? ` (${o.exitType})` : ''}.`,
      { ...o, entityType: 'offboarding_case', severity: 'notice' }
    ),

  statusChanged: (o: BaseOptions & { from?: string; to: string }) =>
    auditEvent(
      'offboarding',
      'offboarding.status.changed',
      `Offboarding status changed${o.from ? ` from ${o.from}` : ''} to ${o.to}.`,
      {
        ...o,
        entityType: 'offboarding_case',
        changes: o.changes || [{ field: 'status', label: 'Case Status', from: o.from, to: o.to }],
      }
    ),

  clearanceUpdated: (o: BaseOptions & { area: string; status: string }) =>
    auditEvent('offboarding', 'offboarding.clearance.updated', `${o.area} clearance marked ${o.status}.`, {
      ...o,
      entityType: 'offboarding_clearance',
    }),

  exitInterviewCompleted: (o: BaseOptions) =>
    auditEvent('offboarding', 'offboarding.exit_interview.completed', 'Exit interview completed.', {
      ...o,
      entityType: 'offboarding_case',
    }),

  fnfSettled: (o: BaseOptions & { amount?: number }) =>
    auditEvent(
      'offboarding',
      'offboarding.fnf.settled',
      'Full & final settlement recorded.',
      { ...o, metadata: withDetail(o, { amount: o.amount }), entityType: 'offboarding_fnf', severity: 'notice' }
    ),

  accessRevoked: (o: BaseOptions & { system?: string }) =>
    auditEvent(
      'offboarding',
      'offboarding.access.revoked',
      `Access revoked${o.system ? ` for ${o.system}` : ''}.`,
      { ...o, entityType: 'offboarding_case', severity: 'warning' }
    ),
};

// ----------------------------------------------------------------------------
// LETTERS & DOCUMENTS
// ----------------------------------------------------------------------------

export const auditLetters = {
  generated: (o: BaseOptions & { letterType: string }) =>
    auditEvent('letters', 'letter.generated', `${o.letterType} generated.`, {
      ...o,
      entityType: 'letter',
    }),

  sent: (o: BaseOptions & { letterType: string; to?: string }) =>
    auditEvent(
      'letters',
      'letter.sent',
      `${o.letterType} sent${o.to ? ` to ${o.to}` : ''}.`,
      { ...o, entityType: 'letter', severity: 'notice' }
    ),

  signed: (o: BaseOptions & { letterType: string }) =>
    auditEvent('letters', 'letter.signed', `${o.letterType} signed by the recipient.`, {
      ...o,
      entityType: 'letter',
      actorType: o.actorType || 'candidate',
      severity: 'notice',
    }),

  downloaded: (o: BaseOptions & { letterType: string }) =>
    auditEvent('letters', 'letter.downloaded', `${o.letterType} downloaded.`, {
      ...o,
      entityType: 'letter',
    }),
};

// ----------------------------------------------------------------------------
// ACCESS & ACCOUNTS
// ----------------------------------------------------------------------------

export const auditAccess = {
  granted: (o: BaseOptions & { system: string }) =>
    auditEvent('access', 'access.granted', `${o.system} access granted.`, {
      ...o,
      entityType: 'access',
      severity: 'notice',
    }),

  revoked: (o: BaseOptions & { system: string }) =>
    auditEvent('access', 'access.revoked', `${o.system} access revoked.`, {
      ...o,
      entityType: 'access',
      severity: 'warning',
    }),

  roleAssigned: (o: BaseOptions & { role: string }) =>
    auditEvent('access', 'access.role.assigned', `Platform role "${o.role}" assigned.`, {
      ...o,
      entityType: 'user',
      severity: 'notice',
    }),

  roleRemoved: (o: BaseOptions & { role: string }) =>
    auditEvent('access', 'access.role.removed', `Platform role "${o.role}" removed.`, {
      ...o,
      entityType: 'user',
      severity: 'warning',
    }),
};

// ----------------------------------------------------------------------------
// DATA MANAGEMENT
// ----------------------------------------------------------------------------

export const auditDataManagement = {
  imported: (o: BaseOptions & { source?: string }) =>
    auditEvent(
      'data_management',
      'data.record.imported',
      `Employee record imported${o.source ? ` from ${o.source}` : ''}.`,
      { ...o, entityType: 'import', actorType: o.actorType || 'system' }
    ),

  rolledBack: (o: BaseOptions & { reason?: string }) =>
    auditEvent(
      'data_management',
      'data.record.rolled_back',
      'Employee record rolled back to an earlier version.',
      { ...o, metadata: withDetail(o, { reason: o.reason }), entityType: 'rollback', severity: 'warning' }
    ),

  bulkUpdated: (o: BaseOptions & { summary?: string }) =>
    auditEvent(
      'data_management',
      'data.record.bulk_updated',
      o.summary || 'Employee record changed by a bulk operation.',
      { ...o, entityType: 'bulk_update', severity: 'notice' }
    ),
};
