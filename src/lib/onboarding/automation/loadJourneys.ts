import { getOrgToday } from '@/lib/onboarding/automation/dates'
import { deriveStage } from '@/lib/onboarding/automation/schedule'

import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  EmployeeType,
  JourneyContext,
  OnboardingStepRecord,
  OnboardingTaskRecord,
} from '@/types/onboarding'

/**
 * Loads onboarding journeys with their steps and tasks, and maps the database's
 * snake_case rows onto the camelCase shapes the engine and UI work with.
 *
 * Takes the Supabase client as an argument so the same loader serves the
 * dashboard (session client, RLS applies) and the cron runner (service-role
 * client, no session available).
 */

export type LoadedJourney = {
  context: JourneyContext
  steps: OnboardingStepRecord[]
  tasks: OnboardingTaskRecord[]
}

type JourneyRow = {
  id: string
  employee_id: string | null
  onboarding_record_id: string | null
  candidate_name: string | null
  designation: string | null
  slack_intro_text: string | null
  missed_tech_call: boolean | null
  official_email: string | null
  personal_email: string | null
  joining_date: string
  stage: JourneyContext['stage']
  department: string | null
  manager_email: string | null
  buddy_email: string | null
  slack_channel_id: string | null
  last_completed_step: string | null
  is_completed: boolean
  employees: {
    name: string
    employee_type: EmployeeType
    status: string
    employee_profiles: {
      official_email: string | null
      personal_email: string | null
    } | null
  } | null
}

type StepRow = {
  id: string
  journey_id: string
  step_key: string
  channel: OnboardingStepRecord['channel']
  scheduled_for: string
  status: OnboardingStepRecord['status']
  completed_at: string | null
  external_ref: string | null
  attempts: number
  last_error: string | null
  skip_reason: string | null
  dispatch_meta: Record<string, unknown> | null
}

type TaskRow = {
  id: string
  journey_id: string
  task_key: string
  is_completed: boolean
  completed_at: string | null
  due_date: string | null
}

const JOURNEY_SELECT = `
  id,
  employee_id,
  onboarding_record_id,
  candidate_name,
  designation,
  slack_intro_text,
  missed_tech_call,
  official_email,
  personal_email,
  joining_date,
  stage,
  department,
  manager_email,
  buddy_email,
  slack_channel_id,
  last_completed_step,
  is_completed,
  employees (
    name,
    employee_type,
    status,
    employee_profiles ( official_email, personal_email )
  )
`

const toContext = (row: JourneyRow): JourneyContext => {
  const employee = row.employees
  // Supabase returns an embedded one-to-one as an object, but a stale schema
  // cache can hand back a single-element array — normalise both.
  const profile = Array.isArray(employee?.employee_profiles)
    ? employee?.employee_profiles[0]
    : employee?.employee_profiles

  // The journey's own columns are the source of truth: they are refreshed on
  // every sync and are populated for candidates who have no employees row yet.
  // The employee join is the fallback for journeys written before that.
  return {
    journeyId: row.id,
    employeeId: row.employee_id,
    onboardingRecordId: row.onboarding_record_id,
    employeeName: row.candidate_name ?? employee?.name ?? 'Unknown',
    employeeType: employee?.employee_type ?? 'fte',
    department: row.department,
    joiningDate: row.joining_date,
    stage: row.stage,
    officialEmail: row.official_email ?? profile?.official_email ?? null,
    personalEmail: row.personal_email ?? profile?.personal_email ?? null,
    managerEmail: row.manager_email,
    buddyEmail: row.buddy_email,
    slackChannelId: row.slack_channel_id,
    designation: row.designation,
    slackIntroText: row.slack_intro_text,
    missedTechCall: row.missed_tech_call ?? false,
    lastCompletedStep: row.last_completed_step,
    isCompleted: row.is_completed,
    employeeStatus: employee?.status ?? 'active',
  }
}

const toStepRecord = (row: StepRow): OnboardingStepRecord => ({
  id: row.id,
  journeyId: row.journey_id,
  stepKey: row.step_key,
  channel: row.channel,
  scheduledFor: row.scheduled_for,
  status: row.status,
  completedAt: row.completed_at,
  externalRef: row.external_ref,
  attempts: row.attempts,
  lastError: row.last_error,
  skipReason: row.skip_reason,
  dispatchMeta: row.dispatch_meta,
})

const toTaskRecord = (row: TaskRow): OnboardingTaskRecord => ({
  id: row.id,
  journeyId: row.journey_id,
  taskKey: row.task_key,
  isCompleted: row.is_completed,
  completedAt: row.completed_at,
  dueDate: row.due_date,
})

const groupBy = <T extends { journeyId: string }>(
  items: T[]
): Record<string, T[]> => {
  const grouped: Record<string, T[]> = {}
  for (const item of items) {
    ;(grouped[item.journeyId] ??= []).push(item)
  }
  return grouped
}

export const loadJourneys = async (
  supabase: SupabaseClient
): Promise<LoadedJourney[]> => {
  const [journeysResult, stepsResult, tasksResult] = await Promise.all([
    supabase.from('onboarding_journeys').select(JOURNEY_SELECT),
    supabase.from('onboarding_steps').select('*'),
    supabase.from('onboarding_tasks').select('*'),
  ])

  if (journeysResult.error) {
    console.error('Error loading onboarding journeys:', journeysResult.error.message)
    return []
  }
  if (stepsResult.error) {
    console.error('Error loading onboarding steps:', stepsResult.error.message)
    return []
  }
  if (tasksResult.error) {
    console.error('Error loading onboarding tasks:', tasksResult.error.message)
    return []
  }

  const stepsByJourney = groupBy(
    ((stepsResult.data ?? []) as StepRow[]).map(toStepRecord)
  )
  const tasksByJourney = groupBy(
    ((tasksResult.data ?? []) as TaskRow[]).map(toTaskRecord)
  )

  return ((journeysResult.data ?? []) as unknown as JourneyRow[]).map((row) => {
    const context = toContext(row)
    return {
      context,
      steps: stepsByJourney[context.journeyId] ?? [],
      tasks: tasksByJourney[context.journeyId] ?? [],
    }
  })
}

/** Current stage for a loaded journey, recomputed against today's date. */
export const stageFor = (journey: LoadedJourney, today = getOrgToday()) =>
  deriveStage(journey.context, today)
