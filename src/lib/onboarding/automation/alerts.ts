import { postSlackMessage } from '@/lib/onboarding/automation/channels/slack'
import { STEP_DEFINITION_BY_KEY } from '@/lib/onboarding/automation/constants'
import {
  addDays,
  diffInDays,
  formatDisplayDate,
  getOrgToday,
  parseDateOnly,
  toDateKey,
} from '@/lib/onboarding/automation/dates'
import { loadJourneys } from '@/lib/onboarding/automation/loadJourneys'
import { deriveAttentionReasons } from '@/lib/onboarding/automation/progress'
import { canDispatch, getRunMode } from '@/lib/onboarding/automation/runMode'

import type { SupabaseClient } from '@supabase/supabase-js'
import type { RunSummary } from '@/lib/onboarding/automation/runOnboardingAutomation'

/**
 * Operational alerts for People & Culture, ported from `alerting.js`.
 *
 * These are about the automation, not to the joiner: what ran, what is about to
 * run, and what needs a human before it does. They are the reason P&C can trust
 * a system that acts on their behalf overnight.
 */

const alertChannel = (): string | null =>
  process.env.ONBOARDING_ALERT_SLACK_CHANNEL?.trim() || null

/**
 * Sends an alert, unless the mode says not to.
 *
 * A dry run logs instead of posting: the point of a shadow run is to compare
 * what *would* happen without filling the channel with noise.
 */
const deliver = async (text: string): Promise<boolean> => {
  const mode = getRunMode()

  if (!canDispatch(mode)) {
    console.info(`[onboarding alert — ${mode}, not sent]\n${text}`)
    return false
  }

  const channel = alertChannel()
  if (!channel) {
    console.warn('Onboarding: ONBOARDING_ALERT_SLACK_CHANNEL is not set.')
    return false
  }

  return postSlackMessage(channel, text)
}

const bullets = (lines: string[]): string =>
  lines.length > 0 ? lines.map((line) => `• ${line}`).join('\n') : '• None'

/**
 * What the run actually did, plus anything that needs P&C.
 *
 * Failures are batched into this one message rather than sent individually —
 * the legacy script's digest behaviour. Ten failures should be one alert.
 */
export const sendRunSummary = async (summary: RunSummary): Promise<void> => {
  if (summary.skipped) return

  const today = formatDisplayDate(toDateKey(getOrgToday()))

  const counts = [
    `Sent: *${summary.stepsSent}*`,
    `Skipped: *${summary.stepsSkipped}*`,
    `Waiting: *${summary.stepsDeferred}*`,
    `Failed: *${summary.stepsFailed}*`,
  ].join('   ')

  let message = `*Onboarding run — ${today}*  _(${summary.mode})_\n${counts}\n`

  if (summary.stepsExpired > 0) {
    message += `\n⏰ *${summary.stepsExpired}* step(s) expired unsent for being more than five days late.\n`
  }

  if (summary.errors.length > 0) {
    message += `\n⚠️ *Needs attention*\n${bullets(summary.errors)}\n`
  }

  if (summary.plannedDispatches.length > 0) {
    message += `\n🧪 *Would have sent*\n${bullets(
      summary.plannedDispatches.map(
        (planned) => `${planned.employee} — ${planned.step}`
      )
    )}\n`
  }

  await deliver(message)
}

/** What the automation will do tomorrow, so nothing arrives as a surprise. */
export const sendTomorrowPreview = async (
  supabase: SupabaseClient
): Promise<void> => {
  const tomorrow = addDays(getOrgToday(), 1)
  const tomorrowKey = toDateKey(tomorrow)

  const journeys = await loadJourneys(supabase)
  const expected: string[] = []

  for (const journey of journeys) {
    if (journey.context.isCompleted) continue

    for (const step of journey.steps) {
      if (step.status !== 'pending') continue
      if (step.scheduledFor !== tomorrowKey) continue
      if (STEP_DEFINITION_BY_KEY[step.stepKey]?.isManualOnly) continue

      expected.push(
        `${journey.context.employeeName} — ${
          STEP_DEFINITION_BY_KEY[step.stepKey]?.label ?? step.stepKey
        }`
      )
    }
  }

  if (expected.length === 0) return

  await deliver(
    `*Tomorrow — ${formatDisplayDate(tomorrowKey)}*\n` +
      `The automation expects to run these:\n${bullets(expected)}`
  )
}

/**
 * Joiners arriving in the next two days whose record is missing something the
 * automation needs. Sent while there is still time to fix it.
 */
export const sendPreflightValidation = async (
  supabase: SupabaseClient
): Promise<void> => {
  const today = getOrgToday()
  const journeys = await loadJourneys(supabase)
  const problems: string[] = []

  for (const journey of journeys) {
    const { context } = journey
    if (context.isCompleted) continue

    const joiningDate = parseDateOnly(context.joiningDate)
    if (!joiningDate) continue

    const daysUntilJoining = diffInDays(today, joiningDate)
    if (daysUntilJoining < 0 || daysUntilJoining > 2) continue

    const missing: string[] = []
    if (!context.officialEmail) missing.push('official email')
    if (!context.managerEmail) missing.push('manager')
    if (!context.buddyEmail) missing.push('buddy')
    if (!context.slackIntroText) missing.push('Slack introduction')

    if (missing.length > 0) {
      problems.push(
        `*${context.employeeName}* (joins ${formatDisplayDate(
          context.joiningDate
        )}) — missing ${missing.join(', ')}`
      )
    }
  }

  if (problems.length === 0) return

  await deliver(
    `⚠️ *Pre-flight check*\n` +
      `These joiners arrive within two days and their record is incomplete. ` +
      `Filling these in now avoids a failed or half-finished onboarding:\n${bullets(
        problems
      )}`
  )
}

/**
 * Everything currently flagged as needing a human, regardless of whether it
 * came from today's run. The daily nudge.
 */
export const sendAttentionDigest = async (
  supabase: SupabaseClient
): Promise<void> => {
  const today = getOrgToday()
  const journeys = await loadJourneys(supabase)
  const lines: string[] = []

  for (const journey of journeys) {
    const reasons = deriveAttentionReasons(
      journey.context,
      journey.steps,
      journey.tasks,
      today
    )

    if (reasons.length > 0) {
      lines.push(`*${journey.context.employeeName}* — ${reasons.join('; ')}`)
    }
  }

  if (lines.length === 0) return

  await deliver(`🚨 *Onboarding needs attention*\n${bullets(lines)}`)
}
