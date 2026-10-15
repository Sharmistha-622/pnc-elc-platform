import type {
  EmployeeType,
  OnboardingChannel,
  OnboardingStepStatus,
} from '@/types/onboarding'

/**
 * The onboarding pipeline, ported from the Google Apps Script automation.
 *
 * Every offset is relative to the employee's date of joining (DOJ). These values
 * are the operational contract P&C has been running on — change them here and
 * the whole system (scheduling, dashboard, digests) follows.
 */

/** The six induction tasks, in the order the induction form presents them. */
export const INDUCTION_TASKS = [
  { key: 'org_values', label: 'Org Values' },
  { key: 'process_principle', label: 'Process Principle' },
  { key: 'alumni_conversations', label: 'Alumni Conversations' },
  { key: 'org_verticals', label: 'Org Verticals' },
  { key: 'ai_fluency', label: 'AI Fluency' },
  { key: 'campus_visit', label: 'Campus Visit' },
] as const

/** Induction tasks are due at the two-week mark, a day before the reminder. */
export const INDUCTION_TASK_DUE_OFFSET_DAYS = 14

/** Terminal value of the legacy Notion "Last Completed Step" dropdown. */
export const ONBOARDING_COMPLETED_STEP = 'onboarding_completed'

/** Day on which an employee is considered onboarded regardless of step state. */
export const ONBOARDED_AFTER_DAYS = 15

/** Slack introductions are pointless long after the fact; the script capped it. */
export const SLACK_INTRO_MAX_AGE_DAYS = 30

/**
 * How late a step may be dispatched.
 *
 * Without this the first live run would fire every historical step for every
 * journey at once — a joiner three months in would receive their day-one mail.
 * Anything past the cap expires unsent.
 */
export const MAX_LATE_DAYS = 5

/**
 * How many dispatch attempts a step gets before it stops being retried.
 * A permanently failing step should raise an alert, not retry nightly forever.
 */
export const MAX_ATTEMPTS = 3

/**
 * How long a claim may be held before it is treated as abandoned. A run that
 * dies mid-dispatch would otherwise strand its steps in `in_flight`.
 */
export const STALE_CLAIM_MINUTES = 30

/** Employee statuses that halt every automation for that person. */
export const DROPPED_EMPLOYEE_STATUSES = [
  'resigned',
  'terminated',
  'dropped',
  'inactive',
  'left',
  'exited',
  'exit',
]

export type StepAnchor = 'doj' | 'doj_plus_14_friday'

export type StepDefinition = {
  key: string
  label: string
  channel: OnboardingChannel
  /** Days relative to DOJ. Ignored when `anchor` is not 'doj'. */
  offsetDays: number
  anchor?: StepAnchor
  /** Months relative to DOJ, for post-onboarding milestones. */
  offsetMonths?: number
  /** Calendar events only. */
  hour?: number
  durationMinutes?: number
  /** Batched calls group every joiner on the same date into one invite. */
  isBatched?: boolean
  /** Manager/buddy calls search real free/busy time instead of a fixed hour. */
  usesDynamicSlot?: boolean
  /** Skipped for apprentice/contract workers. */
  skipForContractOrApprentice?: boolean
  /** Skipped unless the employee is induction-eligible. */
  requiresInductionEligible?: boolean
  /** Warm onboarding is not run for Sama staff. */
  skipForSama?: boolean
  /** Held back until all six induction tasks are complete. */
  requiresAllTasks?: boolean
  /** Only dispatched for these employee types. */
  onlyForEmployeeTypes?: EmployeeType[]
  /**
   * Days before `scheduled_for` that the step is dispatched.
   *
   * Calendar invites go out the day before the session, as the legacy script
   * did — booking an 09:00 warm onboarding at 08:00 the same morning gives
   * nobody time to see it.
   */
  leadDays?: number
  /**
   * Steps this one makes unnecessary once it is sent. The merge email contains
   * the credential, pre-joining and access content, so sending it must retire
   * all three rather than mail the joiner the same thing again.
   */
  supersedes?: string[]
  /** Dispatched only by a person pressing a button, never by the schedule. */
  isManualOnly?: boolean
  /** Contact that must be present, else the step cannot be dispatched. */
  requiresContact?:
    | 'officialEmail'
    | 'personalEmail'
    | 'managerEmail'
    | 'buddyEmail'
  /** Post-onboarding steps are tracked but excluded from progress counters. */
  excludeFromProgress?: boolean
  /**
   * Never auto-sent. The legacy script created these as Gmail *drafts* for a
   * human to review, because they carry account credentials. Here the step is
   * surfaced to P&C to send by hand, so no secret is ever stored by this app.
   */
  requiresManualReview?: boolean
}

export const STEP_DEFINITIONS: StepDefinition[] = [
  // ---------- Email ----------
  {
    key: 'credential_email',
    label: 'Credential Email',
    channel: 'email',
    offsetDays: -2,
    requiresContact: 'personalEmail',
    requiresManualReview: true,
  },
  {
    key: 'pre_joining_email',
    label: 'Pre Joining Email',
    channel: 'email',
    offsetDays: -1,
    requiresContact: 'personalEmail',
    // The access mail repeats this content, so the legacy script marked it
    // SKIPPED once pre-joining went out.
    supersedes: ['access_email'],
  },
  {
    key: 'access_email',
    label: 'Access Email',
    channel: 'email',
    offsetDays: 0,
    requiresContact: 'officialEmail',
  },
  {
    key: 'onboarding_tasks_email',
    label: 'Onboarding Tasks Email',
    channel: 'email',
    offsetDays: 1,
    requiresInductionEligible: true,
    requiresContact: 'officialEmail',
  },
  {
    key: 'week1_followup_email',
    label: 'Week 1 Follow Up',
    channel: 'email',
    offsetDays: 7,
    requiresInductionEligible: true,
    requiresContact: 'officialEmail',
  },
  {
    key: 'week2_followup_email',
    label: 'Week 2 Follow Up',
    channel: 'email',
    offsetDays: 14,
    requiresInductionEligible: true,
    requiresContact: 'officialEmail',
  },
  {
    // Sent instead of credential + pre-joining + access when someone is entered
    // with a day or less to go: three mails in two days reads as a mistake.
    // Carries credentials, so a human sends it.
    key: 'merge_email',
    label: 'Merge Email (urgent joiner)',
    channel: 'email',
    offsetDays: 0,
    requiresContact: 'personalEmail',
    requiresManualReview: true,
    supersedes: ['credential_email', 'pre_joining_email', 'access_email'],
  },
  {
    key: 'tech_resources_email',
    label: 'Technical Onboarding Resources',
    channel: 'email',
    offsetDays: 0,
    isManualOnly: true,
    requiresContact: 'officialEmail',
    excludeFromProgress: true,
  },
  {
    key: 'tech_reminder_email',
    label: 'Missed Technical Call Reminder',
    channel: 'email',
    offsetDays: 0,
    isManualOnly: true,
    requiresContact: 'officialEmail',
    excludeFromProgress: true,
  },
  {
    key: 'milestone_email',
    label: 'Milestone Email',
    channel: 'email',
    offsetDays: 0,
    offsetMonths: 3,
    onlyForEmployeeTypes: ['intern', 'fte'],
    requiresContact: 'officialEmail',
    excludeFromProgress: true,
  },

  // ---------- Slack ----------
  {
    key: 'slack_channel',
    label: 'Create Slack Channel',
    channel: 'slack',
    // Legacy created the channel on the joining date. See decision #2.
    offsetDays: 0,
    requiresInductionEligible: true,
  },
  {
    // The P&C-written introduction, posted to the team channel rather than the
    // joiner's own. Pointless long after the fact, so it expires at 30 days.
    key: 'slack_intro',
    label: 'Slack Introduction',
    channel: 'slack',
    offsetDays: 0,
    requiresInductionEligible: true,
  },
  {
    key: 'slack_welcome',
    label: 'Slack Welcome',
    channel: 'slack',
    offsetDays: 0,
    requiresInductionEligible: true,
  },
  {
    key: 'slack_week1',
    label: 'Slack Week 1',
    channel: 'slack',
    offsetDays: 7,
    requiresInductionEligible: true,
  },
  {
    key: 'slack_week2',
    label: 'Slack Week 2',
    channel: 'slack',
    offsetDays: 14,
    requiresInductionEligible: true,
  },
  {
    key: 'slack_congratulations',
    label: 'Congratulations',
    channel: 'slack',
    offsetDays: 14,
    requiresInductionEligible: true,
    requiresAllTasks: true,
  },
  {
    key: 'slack_reminder',
    label: 'Week 3 Reminder',
    channel: 'slack',
    offsetDays: 15,
    requiresInductionEligible: true,
  },

  // ---------- Calendar ----------
  {
    key: 'warm_onboarding',
    leadDays: 1,
    label: 'Warm Onboarding',
    channel: 'calendar',
    offsetDays: 0,
    hour: 9,
    durationMinutes: 60,
    isBatched: true,
    skipForContractOrApprentice: true,
    skipForSama: true,
    requiresContact: 'personalEmail',
  },
  {
    key: 'manager_connect',
    leadDays: 1,
    label: 'Manager Connect',
    channel: 'calendar',
    offsetDays: 0,
    hour: 11,
    durationMinutes: 30,
    usesDynamicSlot: true,
    skipForContractOrApprentice: true,
    requiresContact: 'managerEmail',
  },
  {
    key: 'technical_onboarding',
    leadDays: 1,
    label: 'Technical Onboarding',
    channel: 'calendar',
    offsetDays: 0,
    hour: 14,
    durationMinutes: 60,
    isBatched: true,
    skipForContractOrApprentice: true,
    requiresContact: 'officialEmail',
  },
  {
    key: 'buddy_connect',
    leadDays: 1,
    label: 'Buddy Connect',
    channel: 'calendar',
    offsetDays: 1,
    hour: 11,
    durationMinutes: 45,
    usesDynamicSlot: true,
    skipForContractOrApprentice: true,
    requiresContact: 'buddyEmail',
  },
  {
    key: 'pnc_checkin',
    leadDays: 1,
    label: 'P&C Check-in',
    channel: 'calendar',
    offsetDays: 14,
    anchor: 'doj_plus_14_friday',
    hour: 12,
    durationMinutes: 45,
    isBatched: true,
    skipForContractOrApprentice: true,
    requiresContact: 'officialEmail',
  },
]

export const STEP_DEFINITION_BY_KEY: Record<string, StepDefinition> =
  Object.fromEntries(STEP_DEFINITIONS.map((step) => [step.key, step]))

/**
 * Canonical pipeline order, used to resume a part-finished onboarding: setting a
 * journey's `last_completed_step` marks every step at or before it as handled.
 */
export const PIPELINE_ORDER: string[] = [
  'credential_email',
  'pre_joining_email',
  'slack_channel',
  'access_email',
  'slack_welcome',
  'warm_onboarding',
  'technical_onboarding',
  'manager_connect',
  'buddy_connect',
  'onboarding_tasks_email',
  'week1_followup_email',
  'slack_week1',
  'week2_followup_email',
  'slack_week2',
  'slack_congratulations',
]

export const CHANNEL_LABELS: Record<OnboardingChannel, string> = {
  email: 'Emails',
  slack: 'Slack',
  calendar: 'Calls',
  task: 'Tasks',
}

export const STEP_STATUS_LABELS: Record<OnboardingStepStatus, string> = {
  pending: 'Pending',
  in_flight: 'Sending',
  sent: 'Done',
  skipped: 'Skipped',
  failed: 'Failed',
}

/**
 * Human labels for the employee_type enum, used both for display and for the
 * keyword-based eligibility rules ported from the script.
 *
 * `ftc` deliberately maps to "fixed term employee" rather than anything
 * containing "contract": the legacy keyword list treated any "contract" string
 * as a vendor and skipped their induction, but this schema groups `ftc` with
 * `fte` for appraisals, i.e. they are staff. Only `contractor` is a contract
 * worker here.
 */
export const EMPLOYEE_TYPE_LABELS: Record<EmployeeType, string> = {
  fte: 'Full Time Employee',
  ftc: 'Fixed Term Employee',
  intern: 'Intern',
  apprentice_tech: 'Apprentice (Tech)',
  apprentice_nontech: 'Apprentice (Non-Tech)',
  contractor: 'Contract',
}
