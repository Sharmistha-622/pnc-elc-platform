import {
  INDUCTION_TASKS,
  MAX_ATTEMPTS,
  MAX_LATE_DAYS,
  STEP_DEFINITION_BY_KEY,
  STEP_DEFINITIONS,
} from '@/lib/onboarding/automation/constants'
import { diffInDays, parseDateOnly } from '@/lib/onboarding/automation/dates'

import type {
  ChannelProgress,
  JourneyContext,
  OnboardingChannel,
  OnboardingStepRecord,
  OnboardingTaskRecord,
} from '@/types/onboarding'

/**
 * Derives the dashboard's per-channel counters and attention flags from raw step
 * rows — the equivalent of the spreadsheet's `buildDashboardData()`.
 */

/** A step counts as resolved once it is sent or deliberately skipped. */
const isResolved = (status: OnboardingStepRecord['status']): boolean =>
  status === 'sent' || status === 'skipped'

export const deriveChannelProgress = (
  steps: OnboardingStepRecord[],
  channel: OnboardingChannel
): ChannelProgress => {
  const relevant = steps.filter((step) => {
    const definition = STEP_DEFINITION_BY_KEY[step.stepKey]
    return (
      step.channel === channel && definition && !definition.excludeFromProgress
    )
  })

  const completedLabels: string[] = []
  const pendingLabels: string[] = []

  for (const step of relevant) {
    const label = STEP_DEFINITION_BY_KEY[step.stepKey]?.label ?? step.stepKey
    if (isResolved(step.status)) completedLabels.push(label)
    else pendingLabels.push(label)
  }

  return {
    completed: completedLabels.length,
    total: relevant.length,
    completedLabels,
    pendingLabels,
  }
}

export const deriveTaskProgress = (
  tasks: OnboardingTaskRecord[]
): ChannelProgress => {
  const labelFor = (key: string) =>
    INDUCTION_TASKS.find((task) => task.key === key)?.label ?? key

  const completedLabels = tasks
    .filter((task) => task.isCompleted)
    .map((task) => labelFor(task.taskKey))

  const pendingLabels = tasks
    .filter((task) => !task.isCompleted)
    .map((task) => labelFor(task.taskKey))

  return {
    completed: completedLabels.length,
    total: tasks.length || INDUCTION_TASKS.length,
    completedLabels,
    pendingLabels,
  }
}

/**
 * The "Needs Attention" reasons.
 *
 * None of these apply once a journey is complete: a missing buddy or an overdue
 * task is not actionable for someone who has finished onboarding, so completed
 * employees never appear in the attention queue.
 */
export const deriveAttentionReasons = (
  context: JourneyContext,
  steps: OnboardingStepRecord[],
  tasks: OnboardingTaskRecord[],
  today: Date
): string[] => {
  if (context.isCompleted) return []

  const reasons: string[] = []
  const joiningDate = parseDateOnly(context.joiningDate)
  if (!joiningDate) return ['Invalid joining date']

  const daysUntilJoining = diffInDays(today, joiningDate)
  const hasJoined = daysUntilJoining <= 0

  // Only flag a missing official address once the employee is at or near their
  // DOJ — pre-boarding joiners simply haven't reached the step where IT issues
  // it, so flagging them earlier is a false positive.
  if (!context.officialEmail && daysUntilJoining <= 2) {
    reasons.push('Official email missing')
  }

  if (hasJoined && !context.managerEmail) {
    reasons.push('Manager missing')
  }

  if (hasJoined && !context.buddyEmail) {
    reasons.push('Buddy missing — assign one before the Buddy Connect')
  }

  // The introduction is written by a person, so a missing one blocks a step
  // that no amount of retrying will fix.
  const introStep = steps.find((step) => step.stepKey === 'slack_intro')
  if (introStep && introStep.status === 'pending') {
    reasons.push(
      context.slackIntroText
        ? 'Slack introduction pending'
        : 'Slack introduction not written yet'
    )
  }

  const failedSteps = steps.filter((step) => step.status === 'failed')
  if (failedSteps.length > 0) {
    const labels = failedSteps
      .map((step) => STEP_DEFINITION_BY_KEY[step.stepKey]?.label ?? step.stepKey)
      .join(', ')
    reasons.push(`Automation failed: ${labels}`)
  }

  const awaitingManualSend = steps.filter((step) => {
    const definition = STEP_DEFINITION_BY_KEY[step.stepKey]
    if (!definition?.requiresManualReview || step.status !== 'pending') {
      return false
    }
    const scheduled = parseDateOnly(step.scheduledFor)
    return scheduled ? diffInDays(scheduled, today) >= 0 : false
  })

  for (const step of awaitingManualSend) {
    const label = STEP_DEFINITION_BY_KEY[step.stepKey]?.label ?? step.stepKey
    reasons.push(`${label} ready to send manually`)
  }

  const overdueSteps = steps.filter((step) => {
    if (step.status !== 'pending') return false
    const definition = STEP_DEFINITION_BY_KEY[step.stepKey]
    if (definition?.requiresManualReview) return false // already reported above
    const scheduled = parseDateOnly(step.scheduledFor)
    return scheduled ? diffInDays(scheduled, today) > 0 : false
  })

  if (overdueSteps.length > 0) {
    reasons.push(`${overdueSteps.length} step(s) overdue`)
  }

  const overdueTasks = tasks.filter((task) => {
    if (task.isCompleted || !task.dueDate) return false
    const due = parseDateOnly(task.dueDate)
    return due ? diffInDays(due, today) > 0 : false
  })

  if (overdueTasks.length > 0) {
    reasons.push(`${overdueTasks.length} induction task(s) overdue`)
  }

  return reasons
}

export type DueStepTriage = {
  /** Due now and still within the late window. */
  due: OnboardingStepRecord[]
  /** Too far past their date to be worth sending. */
  expired: OnboardingStepRecord[]
  /** Due, but they have failed too many times to keep retrying. */
  exhausted: OnboardingStepRecord[]
}

/**
 * Sorts the steps of one journey into what should be sent now, what has gone
 * stale, and what has failed too often.
 *
 * The late window is the important one. Every step carries a date, and without
 * a ceiling the first run after any pause would dispatch a joiner's entire
 * history at once — a day-one welcome arriving in month three. A step more than
 * MAX_LATE_DAYS past its date is better skipped than sent wrong.
 */
export const getDueSteps = (
  steps: OnboardingStepRecord[],
  today: Date
): DueStepTriage => {
  const triage: DueStepTriage = { due: [], expired: [], exhausted: [] }

  for (const step of steps) {
    if (step.status !== 'pending' && step.status !== 'failed') continue

    // Post-meeting mails are sent by a person pressing a button, so the
    // scheduler must never pick them up — nor expire them for being late.
    if (STEP_DEFINITION_BY_KEY[step.stepKey]?.isManualOnly) continue

    const scheduled = parseDateOnly(step.scheduledFor)
    if (!scheduled) continue

    const daysLate = diffInDays(scheduled, today)
    if (daysLate < 0) continue // not due yet

    if (daysLate > MAX_LATE_DAYS) {
      triage.expired.push(step)
      continue
    }

    if (step.attempts >= MAX_ATTEMPTS) {
      triage.exhausted.push(step)
      continue
    }

    triage.due.push(step)
  }

  return triage
}

export const getAllStepDefinitions = () => STEP_DEFINITIONS
