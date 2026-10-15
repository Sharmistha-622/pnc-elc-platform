import { STALE_CLAIM_MINUTES } from '@/lib/onboarding/automation/constants'

import type { SupabaseClient } from '@supabase/supabase-js'
import type { OnboardingRunMode } from '@/lib/onboarding/automation/runMode'
import type { OnboardingStepRecord } from '@/types/onboarding'

/**
 * Run bookkeeping and per-step claims.
 *
 * Two layers, and it matters which one is load-bearing:
 *
 * - The **step claim** is the real guarantee against a double send. It is a
 *   single conditional UPDATE, so two runs racing for the same step cannot both
 *   win it.
 * - The **run row** is a soft guard and a history. Its check-then-insert is not
 *   atomic, so it narrows the window for overlapping runs but does not close
 *   it. Never rely on it alone to prevent a duplicate dispatch.
 */

/** A run still open after this long is treated as dead, not running. */
const STALE_RUN_MINUTES = 60

export type RunHandle = { id: string }

/**
 * Opens a run, unless another one is already open. Returns null when a run is
 * already in flight, in which case the caller should do nothing at all.
 */
export const beginRun = async (
  supabase: SupabaseClient,
  mode: OnboardingRunMode
): Promise<RunHandle | null> => {
  const staleBefore = new Date(
    Date.now() - STALE_RUN_MINUTES * 60_000
  ).toISOString()

  const { data: active, error: activeError } = await supabase
    .from('onboarding_runs')
    .select('id')
    .is('finished_at', null)
    .gte('started_at', staleBefore)
    .limit(1)

  if (activeError) {
    console.error('Onboarding run: could not check for an active run', activeError.message)
    return null
  }

  if (active && active.length > 0) return null

  const { data, error } = await supabase
    .from('onboarding_runs')
    .insert({ mode })
    .select('id')
    .single()

  if (error || !data) {
    console.error('Onboarding run: could not open a run', error?.message)
    return null
  }

  return { id: data.id as string }
}

export const finishRun = async (
  supabase: SupabaseClient,
  run: RunHandle,
  summary: unknown,
  error?: string
): Promise<void> => {
  const { error: updateError } = await supabase
    .from('onboarding_runs')
    .update({
      finished_at: new Date().toISOString(),
      summary: summary as Record<string, unknown>,
      error: error ?? null,
    })
    .eq('id', run.id)

  if (updateError) {
    console.error('Onboarding run: could not close the run', updateError.message)
  }
}

/**
 * Returns steps stranded by a run that died mid-dispatch. Without this they
 * would sit in `in_flight` forever and never be retried.
 */
export const releaseStaleClaims = async (
  supabase: SupabaseClient
): Promise<number> => {
  const staleBefore = new Date(
    Date.now() - STALE_CLAIM_MINUTES * 60_000
  ).toISOString()

  const { data, error } = await supabase
    .from('onboarding_steps')
    .update({ status: 'pending', claimed_at: null })
    .eq('status', 'in_flight')
    .lt('claimed_at', staleBefore)
    .select('id')

  if (error) {
    console.error('Onboarding run: could not release stale claims', error.message)
    return 0
  }

  return data?.length ?? 0
}

/**
 * Claims one step for dispatch.
 *
 * The UPDATE only matches a step still in `pending` or `failed`, so if another
 * run claimed it first this returns false and the caller must not dispatch.
 */
export const claimStep = async (
  supabase: SupabaseClient,
  step: OnboardingStepRecord
): Promise<boolean> => {
  const { data, error } = await supabase
    .from('onboarding_steps')
    .update({ status: 'in_flight', claimed_at: new Date().toISOString() })
    .eq('id', step.id)
    .in('status', ['pending', 'failed'])
    .select('id')
    .maybeSingle()

  if (error) {
    console.error('Onboarding run: could not claim step', error.message)
    return false
  }

  return Boolean(data)
}

/** Returns a claimed step to pending, for when dispatch never happened. */
export const releaseClaim = async (
  supabase: SupabaseClient,
  step: OnboardingStepRecord
): Promise<void> => {
  await supabase
    .from('onboarding_steps')
    .update({ status: 'pending', claimed_at: null })
    .eq('id', step.id)
    .eq('status', 'in_flight')
}
