// ============================================================================
// Review cycles — shared types and labels
// ----------------------------------------------------------------------------
// A review cycle is one confirmation or one appraisal for one person. It
// carries the employee's self-reflection, the peers they nominate, their
// manager's review, the meeting, the manager's decision and PnC's close. See
// supabase/migrations/202610261000_review_cycles.sql for the tables and
// docs/review-cycles.md for the flow.
// ============================================================================

export type ReviewKind = 'confirmation' | 'appraisal'

export type ReviewStage =
  | 'self_review'
  | 'in_review'
  | 'ready_for_meeting'
  | 'meeting_scheduled'
  | 'decision_recorded'
  | 'closed'
  | 'cancelled'

export type ParticipantRole = 'self' | 'peer' | 'manager'

export type ParticipantStatus = 'nominated' | 'invited' | 'submitted' | 'cancelled'

export type ConfirmationDecision = 'confirm' | 'extend_probation' | 'not_confirmed'
export type AppraisalDecision = 'exceeds' | 'meets' | 'needs_improvement' | 'below'
export type ReviewDecision = ConfirmationDecision | AppraisalDecision

export type ReviewCycleSettings = {
  automation_enabled: boolean
  confirmation_lead_days: number
  appraisal_lead_days: number
  self_due_days: number
  peer_due_days: number
  manager_due_days: number
  reminder_interval_hours: number
  reminders_before_escalation: number
  meeting_ready_peer_ratio: number
  auto_schedule_meeting: boolean
  meeting_duration_minutes: number
  meeting_lead_working_days: number
  pnc_notification_email: string | null
  updated_at?: string
}

/** Used when the settings row cannot be read, and as the seeded values. */
export const DEFAULT_REVIEW_CYCLE_SETTINGS: ReviewCycleSettings = {
  automation_enabled: true,
  confirmation_lead_days: 7,
  appraisal_lead_days: 14,
  self_due_days: 5,
  peer_due_days: 7,
  manager_due_days: 7,
  reminder_interval_hours: 24,
  reminders_before_escalation: 2,
  meeting_ready_peer_ratio: 0.6,
  auto_schedule_meeting: true,
  meeting_duration_minutes: 30,
  meeting_lead_working_days: 2,
  pnc_notification_email: null,
}

export type CycleRow = {
  id: string
  kind: ReviewKind
  employee_id: string
  manager_id: string | null
  period_key: string
  period_label: string | null
  due_date: string | null
  confirmation_id: string | null
  appraisal_id: string | null
  stage: ReviewStage
  opened_by: string
  self_submitted_at: string | null
  manager_submitted_at: string | null
  ready_at: string | null
  pnc_ready_notified_at: string | null
  meeting_start: string | null
  meeting_end: string | null
  meeting_scheduled_at: string | null
  meeting_scheduled_by: string | null
  closed_at: string | null
  cancelled_reason: string | null
  created_at: string
  updated_at: string
}

export type ParticipantRow = {
  id: string
  cycle_id: string
  role: ParticipantRole
  employee_id: string
  form_request_id: string | null
  status: ParticipantStatus
  nominated_by: string | null
  invited_at: string | null
  due_at: string | null
  submitted_at: string | null
  reminder_count: number
  last_reminded_at: string | null
  last_reminded_by: string | null
  escalated_at: string | null
  created_at: string
}

export type DecisionRow = {
  cycle_id: string
  decision: ReviewDecision
  extend_until: string | null
  note: string | null
  decided_by: string | null
  decided_at: string
  pnc_outcome: 'accepted' | 'returned' | null
  pnc_note: string | null
  pnc_reviewed_by: string | null
  pnc_reviewed_at: string | null
}

export const STAGE_LABELS: Record<ReviewStage, string> = {
  self_review: 'Self-review',
  in_review: 'Collecting reviews',
  ready_for_meeting: 'Ready for meeting',
  meeting_scheduled: 'Meeting scheduled',
  decision_recorded: 'Decision with PnC',
  closed: 'Closed',
  cancelled: 'Cancelled',
}

export const ROLE_LABELS: Record<ParticipantRole, string> = {
  self: 'Self-reflection',
  peer: 'Peer review',
  manager: 'Manager review',
}

export const KIND_LABELS: Record<ReviewKind, string> = {
  confirmation: 'Confirmation',
  appraisal: 'Appraisal',
}

export const DECISIONS: Record<ReviewKind, { value: ReviewDecision; label: string }[]> = {
  confirmation: [
    { value: 'confirm', label: 'Confirm' },
    { value: 'extend_probation', label: 'Extend probation' },
    { value: 'not_confirmed', label: 'Do not confirm' },
  ],
  appraisal: [
    { value: 'exceeds', label: 'Exceeds expectations' },
    { value: 'meets', label: 'Meets expectations' },
    { value: 'needs_improvement', label: 'Needs improvement' },
    { value: 'below', label: 'Below expectations' },
  ],
}

export function decisionLabel(value: string | null | undefined): string {
  if (!value) return '—'
  for (const list of Object.values(DECISIONS)) {
    const found = list.find((d) => d.value === value)
    if (found) return found.label
  }
  return value
}

/** Stages in which a cycle is still running: reminders apply, forms are open. */
export const OPEN_STAGES: ReviewStage[] = ['self_review', 'in_review', 'ready_for_meeting', 'meeting_scheduled']
