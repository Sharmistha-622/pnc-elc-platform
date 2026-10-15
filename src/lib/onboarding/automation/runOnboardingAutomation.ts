import { dispatchStep, type DispatchOutcome } from '@/lib/onboarding/automation/channels'
import {
  MAX_LATE_DAYS,
  STEP_DEFINITION_BY_KEY,
} from '@/lib/onboarding/automation/constants'
import { getOrgToday } from '@/lib/onboarding/automation/dates'
import { loadJourneys, type LoadedJourney } from '@/lib/onboarding/automation/loadJourneys'
import { getDueSteps } from '@/lib/onboarding/automation/progress'
import { deriveStage } from '@/lib/onboarding/automation/schedule'
import { sendRunSummary } from '@/lib/onboarding/automation/alerts'
import {
  beginRun,
  claimStep,
  finishRun,
  releaseClaim,
  releaseStaleClaims,
} from '@/lib/onboarding/automation/runLock'
import {
  canDispatch,
  canWriteState,
  getRunMode,
  type OnboardingRunMode,
} from '@/lib/onboarding/automation/runMode'
import { syncJourneys } from '@/lib/onboarding/automation/syncJourneys'

import type { SupabaseClient } from '@supabase/supabase-js'
import type { OnboardingStepRecord } from '@/types/onboarding'

/**
 * The daily onboarding run — the equivalent of the Apps Script `masterCronJob`.
 *
 * Order matters: journeys are synced before stages are refreshed, and stages
 * before anything is dispatched, so a joiner added this morning still gets their
 * day-zero mail on the same run.
 *
 * Every stage is isolated: one employee's failure is logged and the run
 * continues, rather than taking the whole cohort down with it.
 */

export type PlannedDispatch = {
  employee: string
  step: string
  channel: string
  scheduledFor: string
}

export type RunSummary = {
  mode: OnboardingRunMode
  /** True when the run did nothing because the mode is `off`. */
  skipped: boolean
  journeysCreated: number
  journeysRescheduled: number
  stepsSent: number
  stepsSkipped: number
  stepsDeferred: number
  stepsFailed: number
  /** Too far past their date to send; marked skipped instead. */
  stepsExpired: number
  /** Failed too many times to keep retrying. */
  stepsExhausted: number
  staleClaimsReleased: number
  /** What a dry run would have dispatched. Empty in every other mode. */
  plannedDispatches: PlannedDispatch[]
  errors: string[]
}

type LogEntry = {
  journeyId: string | null
  onboardingRecordId?: string | null
  employeeName: string
  module: string
  action: string
  status: 'success' | 'error' | 'skipped'
  error?: string
}

const writeLogs = async (supabase: SupabaseClient, entries: LogEntry[]) => {
  if (entries.length === 0) return

  const { error } = await supabase.from('onboarding_logs').insert(
    entries.map((entry) => ({
      journey_id: entry.journeyId,
      employee_name: entry.employeeName,
      module: entry.module,
      action: entry.action,
      status: entry.status,
      error: entry.error ?? null,
    }))
  )

  if (error) console.error('Onboarding run: failed to write logs', error.message)

  // Mirror into the candidate record's activity log so the onboarding hub shows
  // automation events in the same timeline as the human ones.
  const activityRows = entries
    .filter((entry) => entry.onboardingRecordId)
    .map((entry) => ({
      onboarding_id: entry.onboardingRecordId,
      actor_type: 'system' as const,
      action: entry.module,
      description: `${entry.action} — ${entry.status}${
        entry.error ? `: ${entry.error}` : ''
      }`,
      metadata: { journey_id: entry.journeyId, status: entry.status },
    }))

  if (activityRows.length > 0) {
    const { error: activityError } = await supabase
      .from('onboarding_activity_log')
      .insert(activityRows)

    if (activityError) {
      console.error(
        'Onboarding run: failed to write activity log',
        activityError.message
      )
    }
  }
}

/**
 * Credential delivery is tracked in two places: this module's `credential_email`
 * step, and the candidate pipeline's
 * `employee_account_provisioning.credentials_delivery_status`. Whichever records
 * it first wins, so a credential mail sent from the hub is never sent again here.
 */
const reconcileCredentialDelivery = async (
  supabase: SupabaseClient,
  journeys: LoadedJourney[]
): Promise<void> => {
  const recordIds = journeys
    .map((journey) => journey.context.onboardingRecordId)
    .filter((id): id is string => Boolean(id))

  if (recordIds.length === 0) return

  const { data, error } = await supabase
    .from('employee_account_provisioning')
    .select('onboarding_id, credentials_delivery_status')
    .in('onboarding_id', recordIds)

  if (error) {
    console.error('Onboarding run: failed to read provisioning', error.message)
    return
  }

  const deliveredRecordIds = new Set(
    (data ?? [])
      .filter((row) => row.credentials_delivery_status === 'sent')
      .map((row) => row.onboarding_id as string)
  )

  if (deliveredRecordIds.size === 0) return

  for (const journey of journeys) {
    const recordId = journey.context.onboardingRecordId
    if (!recordId || !deliveredRecordIds.has(recordId)) continue

    const credentialStep = journey.steps.find(
      (step) => step.stepKey === 'credential_email' && step.status === 'pending'
    )
    if (!credentialStep) continue

    await supabase
      .from('onboarding_steps')
      .update({
        status: 'sent',
        completed_at: new Date().toISOString(),
        skip_reason: 'Credentials delivered via the onboarding hub',
        updated_at: new Date().toISOString(),
      })
      .eq('id', credentialStep.id)

    credentialStep.status = 'sent'
  }
}

/** Applies a dispatch outcome back onto the step row. */
const persistOutcome = async (
  supabase: SupabaseClient,
  step: OnboardingStepRecord,
  outcome: DispatchOutcome
) => {
  const now = new Date().toISOString()

  const patch: Record<string, unknown> = { updated_at: now, claimed_at: null }

  switch (outcome.status) {
    case 'sent':
      patch.status = 'sent'
      patch.completed_at = now
      patch.external_ref = outcome.externalRef ?? null
      patch.last_error = null
      patch.skip_reason = null
      patch.attempts = step.attempts + 1
      if (outcome.meta) patch.dispatch_meta = outcome.meta
      break
    case 'skipped':
      patch.status = 'skipped'
      patch.completed_at = now
      patch.skip_reason = outcome.reason
      break
    case 'deferred':
      // Stays pending and is retried on the next run; the reason is kept so the
      // dashboard can explain what the step is waiting for.
      patch.status = 'pending'
      patch.skip_reason = outcome.reason
      break
    case 'failed':
      patch.status = 'failed'
      patch.last_error = outcome.error
      patch.attempts = step.attempts + 1
      break
  }

  const { error } = await supabase
    .from('onboarding_steps')
    .update(patch)
    .eq('id', step.id)

  if (error) {
    console.error('Onboarding run: failed to persist step outcome', error.message)
  }
}

/** Refreshes stage and the terminal completion flag for every journey. */
/**
 * Retires the steps a sent step makes unnecessary.
 *
 * The merge email contains the credential, pre-joining and access content, and
 * the pre-joining mail repeats what the access mail would say. Sending one has
 * to close the others, or the joiner receives the same thing twice.
 */
const applySupersession = async (
  supabase: SupabaseClient,
  journeyId: string,
  stepKey: string
): Promise<void> => {
  const superseded = STEP_DEFINITION_BY_KEY[stepKey]?.supersedes
  if (!superseded || superseded.length === 0) return

  const { error } = await supabase
    .from('onboarding_steps')
    .update({
      status: 'skipped',
      completed_at: new Date().toISOString(),
      skip_reason: `Covered by ${STEP_DEFINITION_BY_KEY[stepKey]?.label ?? stepKey}`,
      updated_at: new Date().toISOString(),
    })
    .eq('journey_id', journeyId)
    .in('step_key', superseded)
    .eq('status', 'pending')

  if (error) {
    console.error('Onboarding run: failed to apply supersession', error.message)
  }
}

const refreshStages = async (
  supabase: SupabaseClient,
  journeys: LoadedJourney[]
) => {
  const today = getOrgToday()

  for (const journey of journeys) {
    const stage = deriveStage(journey.context, today)

    // Complete once every step that counts towards progress has resolved and
    // all induction tasks are done. Post-onboarding steps (the 3-month
    // milestone) are excluded, and still dispatch afterwards.
    const trackedSteps = journey.steps.filter(
      (step) => !STEP_DEFINITION_BY_KEY[step.stepKey]?.excludeFromProgress
    )

    const allStepsResolved =
      trackedSteps.length > 0 &&
      trackedSteps.every(
        (step) => step.status === 'sent' || step.status === 'skipped'
      )

    const allTasksDone =
      journey.tasks.length > 0 && journey.tasks.every((task) => task.isCompleted)

    const isCompleted =
      journey.context.isCompleted || (allStepsResolved && allTasksDone)

    // Skip the write when nothing changed — otherwise every employee costs a
    // row update on every run, for nothing.
    if (
      stage === journey.context.stage &&
      isCompleted === journey.context.isCompleted
    ) {
      continue
    }

    await supabase
      .from('onboarding_journeys')
      .update({
        stage,
        is_completed: isCompleted,
        updated_at: new Date().toISOString(),
      })
      .eq('id', journey.context.journeyId)
  }
}

type DueItem = { journey: LoadedJourney; step: OnboardingStepRecord }

/**
 * Groups batched calendar sessions so every joiner on a given date shares one
 * invite, exactly as the spreadsheet version did.
 */
const groupBatches = (items: DueItem[]) => {
  const batched = new Map<string, DueItem[]>()
  const individual: DueItem[] = []

  for (const item of items) {
    const definition = STEP_DEFINITION_BY_KEY[item.step.stepKey]
    if (definition?.isBatched) {
      const key = `${item.step.stepKey}|${item.step.scheduledFor}`
      const group = batched.get(key) ?? []
      group.push(item)
      batched.set(key, group)
    } else {
      individual.push(item)
    }
  }

  return { batched, individual }
}

export const runOnboardingAutomation = async (
  supabase: SupabaseClient
): Promise<RunSummary> => {
  const mode = getRunMode()

  const summary: RunSummary = {
    mode,
    skipped: false,
    journeysCreated: 0,
    journeysRescheduled: 0,
    stepsSent: 0,
    stepsSkipped: 0,
    stepsDeferred: 0,
    stepsFailed: 0,
    stepsExpired: 0,
    stepsExhausted: 0,
    staleClaimsReleased: 0,
    plannedDispatches: [],
    errors: [],
  }

  // The automation contacts real new joiners, so it stays off until someone
  // deliberately turns it on.
  if (mode === 'off') {
    summary.skipped = true
    return summary
  }

  const run = await beginRun(supabase, mode)
  if (!run) {
    summary.skipped = true
    summary.errors.push('Another onboarding run is already in progress')
    return summary
  }

  const logs: LogEntry[] = []

  try {
    if (canWriteState(mode)) {
      summary.staleClaimsReleased = await releaseStaleClaims(supabase)
    }

    // Journey bookkeeping contacts nobody, so it runs in every active mode —
    // a dry run needs journeys to exist before it can project anything.
    try {
      const syncSummary = await syncJourneys(supabase)
      summary.journeysCreated = syncSummary.journeysCreated
      summary.journeysRescheduled = syncSummary.journeysRescheduled
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      summary.errors.push(`sync: ${message}`)
      logs.push({
        journeyId: null,
        employeeName: 'System',
        module: 'sync',
        action: 'Sync journeys',
        status: 'error',
        error: message,
      })
    }

    const journeys = await loadJourneys(supabase)
    const today = getOrgToday()

    if (canWriteState(mode)) {
      try {
        await reconcileCredentialDelivery(supabase, journeys)
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        summary.errors.push(`credentials: ${message}`)
      }

      try {
        await refreshStages(supabase, journeys)
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        summary.errors.push(`stages: ${message}`)
      }
    }

    // Triage every journey into what is due, what has gone stale, and what has
    // failed too often to keep retrying.
    const due: DueItem[] = []
    const expired: DueItem[] = []
    const exhausted: DueItem[] = []

    for (const journey of journeys) {
      const triage = getDueSteps(journey.steps, today)

      const keep = (step: OnboardingStepRecord) => {
        const definition = STEP_DEFINITION_BY_KEY[step.stepKey]
        if (!definition) return false
        // A finished journey only still runs its post-onboarding steps.
        if (journey.context.isCompleted && !definition.excludeFromProgress) {
          return false
        }
        return true
      }

      for (const step of triage.due) {
        if (keep(step)) due.push({ journey, step })
      }
      for (const step of triage.expired) {
        if (keep(step)) expired.push({ journey, step })
      }
      for (const step of triage.exhausted) {
        if (keep(step)) exhausted.push({ journey, step })
      }
    }

    // Expiring a step is a write, so a dry run only reports it.
    if (canWriteState(mode)) {
      for (const item of expired) {
        await persistOutcome(supabase, item.step, {
          status: 'skipped',
          reason: `Expired — more than ${MAX_LATE_DAYS} days late`,
        })
        summary.stepsExpired += 1
        logs.push({
          journeyId: item.journey.context.journeyId,
          onboardingRecordId: item.journey.context.onboardingRecordId,
          employeeName: item.journey.context.employeeName,
          module: item.step.channel,
          action: STEP_DEFINITION_BY_KEY[item.step.stepKey]?.label ?? item.step.stepKey,
          status: 'skipped',
          error: `Expired — more than ${MAX_LATE_DAYS} days late`,
        })
      }
    } else {
      summary.stepsExpired = expired.length
    }

    for (const item of exhausted) {
      summary.stepsExhausted += 1
      const action =
        STEP_DEFINITION_BY_KEY[item.step.stepKey]?.label ?? item.step.stepKey
      summary.errors.push(
        `${item.journey.context.employeeName} — ${action}: gave up after ${item.step.attempts} attempts`
      )
    }

    // A dry run stops here: it reports what it would have dispatched and
    // changes no step.
    if (!canDispatch(mode)) {
      summary.plannedDispatches = due.map((item) => ({
        employee: item.journey.context.employeeName,
        step: STEP_DEFINITION_BY_KEY[item.step.stepKey]?.label ?? item.step.stepKey,
        channel: item.step.channel,
        scheduledFor: item.step.scheduledFor,
      }))

      logs.push({
        journeyId: null,
        employeeName: 'System',
        module: 'runner',
        action: `Dry run — ${summary.plannedDispatches.length} step(s) would be dispatched`,
        status: 'success',
      })

      await writeLogs(supabase, logs)
      await finishRun(supabase, run, summary)
      await sendRunSummary(summary)
      return summary
    }

    const applyOutcome = async (item: DueItem, outcome: DispatchOutcome) => {
      await persistOutcome(supabase, item.step, outcome)

      const definition = STEP_DEFINITION_BY_KEY[item.step.stepKey]
      const action = definition?.label ?? item.step.stepKey

      const entry = {
        journeyId: item.journey.context.journeyId,
        onboardingRecordId: item.journey.context.onboardingRecordId,
        employeeName: item.journey.context.employeeName,
        module: item.step.channel,
        action,
      }

      switch (outcome.status) {
        case 'sent':
          summary.stepsSent += 1
          logs.push({ ...entry, status: 'success' })
          break
        case 'skipped':
          summary.stepsSkipped += 1
          logs.push({ ...entry, status: 'skipped', error: outcome.reason })
          break
        case 'deferred':
          summary.stepsDeferred += 1
          break
        case 'failed':
          summary.stepsFailed += 1
          summary.errors.push(
            `${item.journey.context.employeeName} — ${action}: ${outcome.error}`
          )
          logs.push({ ...entry, status: 'error', error: outcome.error })
          break
      }
    }

    const { batched, individual } = groupBatches(due)

    for (const item of individual) {
      const definition = STEP_DEFINITION_BY_KEY[item.step.stepKey]
      if (!definition) continue

      // Claim before dispatching. If another run already took it, skip — this
      // is what stops a retried or overlapping cron sending twice.
      if (!(await claimStep(supabase, item.step))) continue

      try {
        const outcome = await dispatchStep({
          definition,
          context: item.journey.context,
          step: item.step,
          tasks: item.journey.tasks,
          siblingSteps: item.journey.steps,
        })

        await applyOutcome(item, outcome)

        if (outcome.status === 'sent') {
          await applySupersession(
            supabase,
            item.journey.context.journeyId,
            item.step.stepKey
          )
        }

        // A newly created Slack channel has to be remembered before the welcome
        // message can be posted to it.
        if (
          item.step.stepKey === 'slack_channel' &&
          outcome.status === 'sent' &&
          outcome.externalRef
        ) {
          await supabase
            .from('onboarding_journeys')
            .update({ slack_channel_id: outcome.externalRef })
            .eq('id', item.journey.context.journeyId)
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        await applyOutcome(item, { status: 'failed', error: message })
      }
    }

    for (const group of batched.values()) {
      // Claim every member first: one invite resolves the whole cohort, so a
      // step we could not claim must be left out of this batch entirely.
      const claimed: DueItem[] = []
      for (const item of group) {
        if (await claimStep(supabase, item.step)) claimed.push(item)
      }

      if (claimed.length === 0) continue

      const [primary, ...mates] = claimed
      const definition = STEP_DEFINITION_BY_KEY[primary.step.stepKey]

      if (!definition) {
        for (const item of claimed) await releaseClaim(supabase, item.step)
        continue
      }

      try {
        const outcome = await dispatchStep({
          definition,
          context: primary.journey.context,
          step: primary.step,
          tasks: primary.journey.tasks,
          siblingSteps: primary.journey.steps,
          batchMates: mates.map((item) => item.journey.context),
        })

        for (const item of claimed) {
          await applyOutcome(item, outcome)
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        for (const item of claimed) {
          await applyOutcome(item, { status: 'failed', error: message })
        }
      }
    }

    logs.push({
      journeyId: null,
      employeeName: 'System',
      module: 'runner',
      action: `Run complete — ${summary.stepsSent} sent, ${summary.stepsFailed} failed`,
      status: summary.stepsFailed > 0 ? 'error' : 'success',
    })

    await writeLogs(supabase, logs)
    await finishRun(supabase, run, summary)
    await sendRunSummary(summary)

    return summary
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    summary.errors.push(`run: ${message}`)

    // Always close the run, or the next one will see it as still in flight.
    await writeLogs(supabase, logs)
    await finishRun(supabase, run, summary, message)

    return summary
  }
}
