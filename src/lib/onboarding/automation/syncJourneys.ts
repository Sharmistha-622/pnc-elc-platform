import {
  getOrgToday,
  parseDateOnly,
  toDateKey,
} from '@/lib/onboarding/automation/dates'
import { planSteps, planTasks } from '@/lib/onboarding/automation/schedule'

import type { SupabaseClient } from '@supabase/supabase-js'
import type { EmployeeType, JourneyContext } from '@/types/onboarding'

/**
 * Creates and refreshes onboarding journeys.
 *
 * Two sources, in priority order:
 *
 * 1. `onboarding_records` — the candidate pipeline. This is the primary source:
 *    a record carries the joining date, manager, buddy and personal email well
 *    before an `employees` row exists, which matters because the automation's
 *    first step fires two days before joining.
 * 2. `employees` — the fallback, for staff who joined without going through
 *    candidate intake. Anyone already covered by a record is skipped so the two
 *    sources can't produce duplicate journeys for one person.
 */

/** How far back to pick up joiners with no journey yet. */
const BACKFILL_WINDOW_DAYS = 45

/**
 * Candidate statuses the automation acts on. Anything earlier is still being
 * decided, and sending a joiner their credentials before approval would be
 * worse than sending them late.
 */
const AUTOMATABLE_RECORD_STATUSES = [
  'approved',
  'account_provisioning',
  'completed',
]

export type SyncSummary = {
  journeysCreated: number
  journeysRescheduled: number
  stepsCreated: number
}

type ProvisioningRow = {
  official_email: string | null
  credentials_delivery_status: string | null
}

type RecordRow = {
  id: string
  employee_id: string | null
  candidate_name: string
  designation: string | null
  personal_email: string | null
  department: string | null
  joining_date: string
  status: string
  manager_id: string | null
  buddy_id: string | null
  employee_types: { name: string } | { name: string }[] | null
  employee_account_provisioning: ProvisioningRow | ProvisioningRow[] | null
}

type EmployeeRow = {
  id: string
  name: string
  employee_type: EmployeeType
  joining_date: string
  status: string
  team: string | null
  manager_id: string | null
  employee_profiles:
    | { official_email: string | null; personal_email: string | null }
    | { official_email: string | null; personal_email: string | null }[]
    | null
}

/** Supabase returns an embedded one-to-one as an object or a single-item array. */
const first = <T,>(value: T | T[] | null | undefined): T | undefined =>
  Array.isArray(value) ? value[0] : value ?? undefined

/**
 * `employee_types.name` is seeded with the same identifiers as the
 * `employee_type` enum, so the lookup maps straight across.
 */
const toEmployeeType = (name: string | undefined): EmployeeType => {
  const known: EmployeeType[] = [
    'apprentice_nontech',
    'apprentice_tech',
    'intern',
    'fte',
    'ftc',
    'contractor',
  ]
  return known.includes(name as EmployeeType) ? (name as EmployeeType) : 'fte'
}

/** Official addresses of everyone who could be a manager or buddy. */
const buildStaffEmailMap = async (
  supabase: SupabaseClient
): Promise<Map<string, string | null>> => {
  const { data, error } = await supabase
    .from('employees')
    .select('id, employee_profiles ( official_email )')

  if (error) {
    console.error('Onboarding sync: failed to load staff emails', error.message)
    return new Map()
  }

  return new Map(
    (data ?? []).map((row) => {
      const profile = first(
        (row as { employee_profiles: unknown }).employee_profiles as
          | { official_email: string | null }
          | { official_email: string | null }[]
          | null
      )
      return [(row as { id: string }).id, profile?.official_email ?? null]
    })
  )
}

export const syncJourneys = async (
  supabase: SupabaseClient
): Promise<SyncSummary> => {
  const today = getOrgToday()
  const earliest = toDateKey(
    new Date(today.getTime() - BACKFILL_WINDOW_DAYS * 24 * 60 * 60 * 1000)
  )

  const summary: SyncSummary = {
    journeysCreated: 0,
    journeysRescheduled: 0,
    stepsCreated: 0,
  }

  const { data: journeyRows, error: journeysError } = await supabase
    .from('onboarding_journeys')
    .select(
      'id, employee_id, onboarding_record_id, joining_date, last_completed_step, is_completed, created_at'
    )

  if (journeysError) {
    console.error('Onboarding sync: failed to load journeys', journeysError.message)
    return summary
  }

  const journeys = journeyRows ?? []
  const byRecordId = new Map(
    journeys
      .filter((row) => row.onboarding_record_id)
      .map((row) => [row.onboarding_record_id as string, row])
  )
  const byEmployeeId = new Map(
    journeys
      .filter((row) => row.employee_id)
      .map((row) => [row.employee_id as string, row])
  )

  const staffEmails = await buildStaffEmailMap(supabase)

  // ---------- 1. Candidate records ----------
  const { data: recordRows, error: recordsError } = await supabase
    .from('onboarding_records')
    .select(
      `id, employee_id, candidate_name, designation, personal_email, department, joining_date, status,
       manager_id, buddy_id,
       employee_types ( name ),
       employee_account_provisioning ( official_email, credentials_delivery_status )`
    )
    .in('status', AUTOMATABLE_RECORD_STATUSES)
    .gte('joining_date', earliest)

  if (recordsError) {
    console.error('Onboarding sync: failed to load records', recordsError.message)
  }

  const records = (recordRows ?? []) as unknown as RecordRow[]
  const employeeIdsCoveredByRecord = new Set(
    records.map((record) => record.employee_id).filter(Boolean) as string[]
  )

  for (const record of records) {
    const provisioning = first(record.employee_account_provisioning)

    const context = {
      employeeId: record.employee_id,
      onboardingRecordId: record.id,
      candidateName: record.candidate_name,
      designation: record.designation,
      employeeType: toEmployeeType(first(record.employee_types)?.name),
      department: record.department,
      joiningDate: record.joining_date,
      officialEmail: provisioning?.official_email ?? null,
      personalEmail: record.personal_email,
      managerEmail: record.manager_id
        ? staffEmails.get(record.manager_id) ?? null
        : null,
      buddyEmail: record.buddy_id
        ? staffEmails.get(record.buddy_id) ?? null
        : null,
      employeeStatus: 'active',
    }

    const existing = byRecordId.get(record.id)
    const written = await upsertJourney(supabase, context, existing)

    if (written === 'created') summary.journeysCreated += 1
    else if (written === 'rescheduled') summary.journeysRescheduled += 1
  }

  // ---------- 2. Employees without a candidate record ----------
  const { data: employeeRows, error: employeesError } = await supabase
    .from('employees')
    .select(
      'id, name, employee_type, joining_date, status, team, manager_id, employee_profiles ( official_email, personal_email )'
    )
    .gte('joining_date', earliest)

  if (employeesError) {
    console.error('Onboarding sync: failed to load employees', employeesError.message)
    return summary
  }

  for (const employee of (employeeRows ?? []) as unknown as EmployeeRow[]) {
    if (employee.status === 'exited') continue
    if (employeeIdsCoveredByRecord.has(employee.id)) continue

    const profile = first(employee.employee_profiles)

    const context = {
      employeeId: employee.id,
      onboardingRecordId: null,
      candidateName: employee.name,
      designation: null,
      employeeType: employee.employee_type,
      department: employee.team,
      joiningDate: employee.joining_date,
      officialEmail: profile?.official_email ?? null,
      personalEmail: profile?.personal_email ?? null,
      managerEmail: employee.manager_id
        ? staffEmails.get(employee.manager_id) ?? null
        : null,
      buddyEmail: null,
      employeeStatus: employee.status,
    }

    const existing = byEmployeeId.get(employee.id)
    const written = await upsertJourney(supabase, context, existing)

    if (written === 'created') summary.journeysCreated += 1
    else if (written === 'rescheduled') summary.journeysRescheduled += 1
  }

  return summary
}

type SyncInput = {
  designation: string | null
  employeeId: string | null
  onboardingRecordId: string | null
  candidateName: string
  employeeType: EmployeeType
  department: string | null
  joiningDate: string
  officialEmail: string | null
  personalEmail: string | null
  managerEmail: string | null
  buddyEmail: string | null
  employeeStatus: string
}

type ExistingJourney = {
  id: string
  joining_date: string
  last_completed_step: string | null
  is_completed: boolean
  created_at: string
}

/**
 * Inserts a journey, or refreshes the fields that move (contacts, employee link)
 * and re-plans the steps when the joining date has changed.
 */
const upsertJourney = async (
  supabase: SupabaseClient,
  input: SyncInput,
  existing: ExistingJourney | undefined
): Promise<'created' | 'rescheduled' | 'unchanged'> => {
  const patch = {
    employee_id: input.employeeId,
    onboarding_record_id: input.onboardingRecordId,
    candidate_name: input.candidateName,
    designation: input.designation,
    joining_date: input.joiningDate,
    department: input.department,
    manager_email: input.managerEmail,
    buddy_email: input.buddyEmail,
    official_email: input.officialEmail,
    personal_email: input.personalEmail,
    updated_at: new Date().toISOString(),
  }

  if (existing) {
    const { error } = await supabase
      .from('onboarding_journeys')
      .update(patch)
      .eq('id', existing.id)

    if (error) {
      console.error('Onboarding sync: failed to update journey', error.message)
      return 'unchanged'
    }

    // Steps are only re-dated when the joining date actually moved.
    if (existing.joining_date === input.joiningDate) return 'unchanged'

    // Re-planning uses the journey's original creation date, so a joiner who
    // was entered late keeps the merge path even when their date later moves.
    await writeSteps(
      supabase,
      existing.id,
      input,
      {
        lastCompletedStep: existing.last_completed_step,
        isCompleted: existing.is_completed,
      },
      parseDateOnly(existing.created_at) ?? getOrgToday()
    )

    return 'rescheduled'
  }

  const { data: inserted, error } = await supabase
    .from('onboarding_journeys')
    .insert(patch)
    .select('id')
    .single()

  if (error || !inserted) {
    console.error('Onboarding sync: failed to create journey', error?.message)
    return 'unchanged'
  }

  await writeSteps(
    supabase,
    inserted.id as string,
    input,
    { lastCompletedStep: null, isCompleted: false },
    getOrgToday()
  )

  return 'created'
}

/**
 * Writes the planned steps and induction tasks.
 *
 * Only `pending` steps are re-dated: once something has been sent or skipped,
 * moving the joining date must not resurrect it.
 */
const writeSteps = async (
  supabase: SupabaseClient,
  journeyId: string,
  input: SyncInput,
  state: { lastCompletedStep: string | null; isCompleted: boolean },
  entryDate: Date
): Promise<void> => {
  const context: JourneyContext = {
    journeyId,
    employeeId: input.employeeId,
    onboardingRecordId: input.onboardingRecordId,
    employeeName: input.candidateName,
    employeeType: input.employeeType,
    department: input.department,
    joiningDate: input.joiningDate,
    stage: 'pre_boarding',
    officialEmail: input.officialEmail,
    personalEmail: input.personalEmail,
    managerEmail: input.managerEmail,
    buddyEmail: input.buddyEmail,
    slackChannelId: null,
    designation: input.designation,
    slackIntroText: null,
    missedTechCall: false,
    lastCompletedStep: state.lastCompletedStep,
    isCompleted: state.isCompleted,
    employeeStatus: input.employeeStatus,
  }

  const planned = planSteps(context, entryDate)
  if (planned.length === 0) return

  const { data: existingSteps } = await supabase
    .from('onboarding_steps')
    .select('step_key, status')
    .eq('journey_id', journeyId)

  const locked = new Set(
    (existingSteps ?? [])
      .filter((row) => row.status !== 'pending')
      .map((row) => row.step_key as string)
  )

  const rows = planned
    .filter((step) => !locked.has(step.stepKey))
    .map((step) => ({
      journey_id: journeyId,
      step_key: step.stepKey,
      channel: step.channel,
      scheduled_for: step.scheduledFor,
      status: step.status,
      skip_reason: step.skipReason ?? null,
      updated_at: new Date().toISOString(),
    }))

  if (rows.length > 0) {
    const { error } = await supabase
      .from('onboarding_steps')
      .upsert(rows, { onConflict: 'journey_id,step_key' })

    if (error) {
      console.error('Onboarding sync: failed to upsert steps', error.message)
    }
  }

  const taskRows = planTasks(context).map((task) => ({
    journey_id: journeyId,
    task_key: task.taskKey,
    due_date: task.dueDate,
  }))

  if (taskRows.length > 0) {
    const { error } = await supabase
      .from('onboarding_tasks')
      .upsert(taskRows, {
        onConflict: 'journey_id,task_key',
        ignoreDuplicates: true,
      })

    if (error) {
      console.error('Onboarding sync: failed to upsert tasks', error.message)
    }
  }
}
