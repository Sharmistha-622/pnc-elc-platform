/**
 * Shared types for the onboarding automation module.
 *
 * Mirrors the enums declared in
 * `supabase/migrations/202610140900_create_onboarding_tables.sql`.
 */

export type OnboardingStage =
  | 'pre_boarding'
  | 'onboarding_in_progress'
  | 'onboarded'

export type OnboardingChannel = 'email' | 'slack' | 'calendar' | 'task'

export type OnboardingStepStatus =
  | 'pending'
  /** Claimed by a run and currently being dispatched. */
  | 'in_flight'
  | 'sent'
  | 'skipped'
  | 'failed'

export type EmployeeType =
  | 'apprentice_nontech'
  | 'apprentice_tech'
  | 'intern'
  | 'fte'
  | 'ftc'
  | 'contractor'

/**
 * Everything the scheduling engine and the channel adapters need about one
 * person. Assembled from `employees`, `employee_profiles` and
 * `onboarding_journeys` so the engine itself never touches Supabase.
 */
export type JourneyContext = {
  journeyId: string
  /** Null for staff who joined before the candidate pipeline existed. */
  employeeId: string | null
  /** Null for staff onboarded without going through candidate intake. */
  onboardingRecordId: string | null
  employeeName: string
  employeeType: EmployeeType
  department: string | null
  joiningDate: string
  stage: OnboardingStage
  officialEmail: string | null
  personalEmail: string | null
  managerEmail: string | null
  buddyEmail: string | null
  slackChannelId: string | null
  /** Job title, announced in the Slack welcome. */
  designation: string | null
  /** P&C-written introduction posted to the team channel. */
  slackIntroText: string | null
  /** Set by P&C when the joiner missed their technical onboarding call. */
  missedTechCall: boolean
  lastCompletedStep: string | null
  isCompleted: boolean
  employeeStatus: string
}

export type OnboardingStepRecord = {
  id: string
  journeyId: string
  stepKey: string
  channel: OnboardingChannel
  scheduledFor: string
  status: OnboardingStepStatus
  completedAt: string | null
  externalRef: string | null
  attempts: number
  lastError: string | null
  skipReason: string | null
  /** Facts recorded by the dispatch itself, e.g. the slot a call landed on. */
  dispatchMeta: Record<string, unknown> | null
}

export type OnboardingTaskRecord = {
  id: string
  journeyId: string
  taskKey: string
  isCompleted: boolean
  completedAt: string | null
  dueDate: string | null
}

/** A planned step, before it has been persisted to `onboarding_steps`. */
export type PlannedStep = {
  stepKey: string
  channel: OnboardingChannel
  scheduledFor: string
  status: OnboardingStepStatus
  skipReason?: string
}

/** Per-channel progress, rendered as "3/6 | Credential Email, ..." in the UI. */
export type ChannelProgress = {
  completed: number
  total: number
  completedLabels: string[]
  pendingLabels: string[]
}

/** One row of the onboarding dashboard table. */
export type OnboardingDashboardRow = {
  journeyId: string
  employeeId: string | null
  onboardingRecordId: string | null
  employeeName: string
  employeeType: EmployeeType
  joiningDate: string
  stage: OnboardingStage
  email: string | null
  emailProgress: ChannelProgress
  calendarProgress: ChannelProgress
  slackProgress: ChannelProgress
  taskProgress: ChannelProgress
  needsAttention: boolean
  attentionReasons: string[]
  managerEmail: string | null
  buddyEmail: string | null
  slackIntroText: string | null
  missedTechCall: boolean
  /** Steps a human must send by hand, surfaced with a "mark as sent" action. */
  manualSteps: { id: string; label: string; scheduledFor: string }[]
  tasks: { id: string; label: string; isCompleted: boolean }[]
}
