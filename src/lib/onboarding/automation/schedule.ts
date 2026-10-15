import {
  INDUCTION_TASKS,
  INDUCTION_TASK_DUE_OFFSET_DAYS,
  ONBOARDING_COMPLETED_STEP,
  ONBOARDED_AFTER_DAYS,
  PIPELINE_ORDER,
  STEP_DEFINITIONS,
  type StepDefinition,
} from '@/lib/onboarding/automation/constants'
import { addDays, addMonths, diffInDays, nextOrSameFriday, parseDateOnly, toDateKey } from '@/lib/onboarding/automation/dates'
import {
  isContractOrApprentice,
  isDroppedStatus,
  isInductionEligible,
  isSamaEmployee,
} from '@/lib/onboarding/automation/eligibility'

import type {
  JourneyContext,
  OnboardingStage,
  OnboardingStepStatus,
  PlannedStep,
} from '@/types/onboarding'

/**
 * The scheduling engine: turns one employee into a dated list of onboarding
 * steps. Pure — it touches no database and no clock beyond the `today` it is
 * handed, so the whole pipeline can be reasoned about and tested directly.
 */

/** The date the step's content is *for* — an event date for calendar steps. */
export const resolveStepDate = (
  definition: StepDefinition,
  joiningDate: Date
): Date => {
  if (definition.anchor === 'doj_plus_14_friday') {
    return nextOrSameFriday(addDays(joiningDate, definition.offsetDays))
  }

  if (definition.offsetMonths) {
    return addMonths(joiningDate, definition.offsetMonths)
  }

  return addDays(joiningDate, definition.offsetDays)
}

/**
 * The date the step is acted on, which is the event date minus any lead time.
 * Calendar invites go out the day before the session.
 */
export const resolveDispatchDate = (
  definition: StepDefinition,
  joiningDate: Date
): Date => addDays(resolveStepDate(definition, joiningDate), -(definition.leadDays ?? 0))

/**
 * How the joiner was entered, which decides whether they get the normal
 * three-mail run-up or the single merge mail.
 */
export type EntryPath = 'normal' | 'merge' | 'post_doj'

/**
 * Someone entered the day before they join cannot receive a credential mail
 * two days before. Legacy collapsed that case into one merge mail, and skipped
 * the run-up entirely for anyone entered after their joining date.
 */
export const resolveEntryPath = (
  joiningDate: Date,
  entryDate: Date
): EntryPath => {
  const daysUntilJoining = diffInDays(entryDate, joiningDate)
  if (daysUntilJoining < 0) return 'post_doj'
  if (daysUntilJoining <= 1) return 'merge'
  return 'normal'
}

/** Steps the run-up consists of, retired by the merge and post-DOJ paths. */
const RUN_UP_STEPS = ['credential_email', 'pre_joining_email', 'access_email']

type Eligibility = { status: OnboardingStepStatus; skipReason?: string }

/**
 * Decides whether a step should ever run for this employee.
 *
 * A missing contact (no manager assigned yet, official email not issued) is
 * deliberately *not* a skip — the step stays pending and surfaces as an
 * attention flag, exactly as the spreadsheet version did, so P&C can fill the
 * gap and the step still goes out.
 */
export const evaluateStepEligibility = (
  definition: StepDefinition,
  context: JourneyContext
): Eligibility => {
  if (isDroppedStatus(context.employeeStatus)) {
    return { status: 'skipped', skipReason: 'Employee has exited' }
  }

  if (
    definition.skipForContractOrApprentice &&
    isContractOrApprentice(context.employeeType, context.department)
  ) {
    return { status: 'skipped', skipReason: 'Apprentice or contract worker' }
  }

  if (
    definition.requiresInductionEligible &&
    !isInductionEligible(context.employeeType, context.department)
  ) {
    return { status: 'skipped', skipReason: 'Not induction eligible' }
  }

  if (
    definition.skipForSama &&
    isSamaEmployee(context.officialEmail, context.personalEmail)
  ) {
    return { status: 'skipped', skipReason: 'Sama employee' }
  }

  if (
    definition.onlyForEmployeeTypes &&
    !definition.onlyForEmployeeTypes.includes(context.employeeType)
  ) {
    return { status: 'skipped', skipReason: 'Not applicable to employee type' }
  }

  return { status: 'pending' }
}

/**
 * Steps at or before the journey's `last_completed_step` were already handled
 * elsewhere (manually, or by the legacy script before migration), so they are
 * never re-sent.
 */
export const isHandledBeforeImport = (
  stepKey: string,
  lastCompletedStep: string | null
): boolean => {
  if (!lastCompletedStep) return false
  if (lastCompletedStep === ONBOARDING_COMPLETED_STEP) return true

  const completedIndex = PIPELINE_ORDER.indexOf(lastCompletedStep)
  const stepIndex = PIPELINE_ORDER.indexOf(stepKey)

  if (completedIndex < 0 || stepIndex < 0) return false
  return stepIndex <= completedIndex
}

/**
 * Builds the full dated step plan for one employee.
 *
 * `entryDate` is when the joiner was entered into the system — the journey's
 * creation date, not today — so re-planning an existing journey never changes
 * which entry path it took.
 */
export const planSteps = (
  context: JourneyContext,
  entryDate?: Date
): PlannedStep[] => {
  const joiningDate = parseDateOnly(context.joiningDate)
  if (!joiningDate) return []

  const entry = entryDate
    ? resolveEntryPath(joiningDate, entryDate)
    : 'normal'

  return STEP_DEFINITIONS.map((definition) => {
    const scheduledFor = toDateKey(
      resolveDispatchDate(definition, joiningDate)
    )

    if (isHandledBeforeImport(definition.key, context.lastCompletedStep)) {
      return {
        stepKey: definition.key,
        channel: definition.channel,
        scheduledFor,
        status: 'skipped' as const,
        skipReason: 'Completed before import',
      }
    }

    // Entry path first: it retires whole groups of steps regardless of the
    // employee's eligibility for them.
    if (entry === 'post_doj' && RUN_UP_STEPS.includes(definition.key)) {
      return {
        stepKey: definition.key,
        channel: definition.channel,
        scheduledFor,
        status: 'skipped' as const,
        skipReason: 'Entered after the joining date',
      }
    }

    if (entry === 'merge' && RUN_UP_STEPS.includes(definition.key)) {
      return {
        stepKey: definition.key,
        channel: definition.channel,
        scheduledFor,
        status: 'skipped' as const,
        skipReason: 'Covered by the merge email',
      }
    }

    if (definition.key === 'merge_email' && entry !== 'merge') {
      return {
        stepKey: definition.key,
        channel: definition.channel,
        scheduledFor,
        status: 'skipped' as const,
        skipReason:
          entry === 'post_doj'
            ? 'Entered after the joining date'
            : 'Not an urgent joiner',
      }
    }

    const { status, skipReason } = evaluateStepEligibility(definition, context)

    return {
      stepKey: definition.key,
      channel: definition.channel,
      scheduledFor,
      status,
      skipReason,
    }
  })
}

/** The six induction tasks, dated from the employee's joining date. */
export const planTasks = (context: JourneyContext) => {
  const joiningDate = parseDateOnly(context.joiningDate)
  if (!joiningDate) return []

  const dueDate = toDateKey(
    addDays(joiningDate, INDUCTION_TASK_DUE_OFFSET_DAYS)
  )

  return INDUCTION_TASKS.map((task) => ({
    taskKey: task.key,
    dueDate,
  }))
}

/**
 * The stage machine: Pre-boarding before the DOJ, Onboarding In Progress through
 * day 14, Onboarded from day 15 — or immediately, once the journey is flagged
 * complete.
 */
export const deriveStage = (
  context: Pick<JourneyContext, 'joiningDate' | 'lastCompletedStep' | 'isCompleted'>,
  today: Date
): OnboardingStage => {
  if (
    context.isCompleted ||
    context.lastCompletedStep === ONBOARDING_COMPLETED_STEP
  ) {
    return 'onboarded'
  }

  const joiningDate = parseDateOnly(context.joiningDate)
  if (!joiningDate) return 'pre_boarding'

  const daysSinceJoining = diffInDays(joiningDate, today)

  if (daysSinceJoining >= ONBOARDED_AFTER_DAYS) return 'onboarded'
  if (daysSinceJoining < 0) return 'pre_boarding'
  return 'onboarding_in_progress'
}
