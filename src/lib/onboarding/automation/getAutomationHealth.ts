import { getOrgToday, toDateKey } from '@/lib/onboarding/automation/dates'
import { createServerSupabaseClient } from '@/lib/supabase/server'

/**
 * How the automation itself has been behaving, as opposed to how any one
 * joiner is progressing. Read from the run log rather than the step table, so
 * a step that failed and was later retried still shows as having failed.
 */
export type AutomationHealth = {
  /** Successful dispatches in the last 7 days. */
  successes: number
  /** Failed dispatches in the last 7 days. */
  failures: number
  /** When the most recent run finished, if one has. */
  lastRunAt: string | null
  lastRunMode: string | null
}

const LOOKBACK_DAYS = 7

export const getAutomationHealth = async (): Promise<AutomationHealth> => {
  const supabase = await createServerSupabaseClient()

  const since = new Date(
    getOrgToday().getTime() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000
  ).toISOString()

  const [logs, runs] = await Promise.all([
    supabase
      .from('onboarding_logs')
      .select('status')
      .gte('created_at', since),
    supabase
      .from('onboarding_runs')
      .select('finished_at, mode')
      .not('finished_at', 'is', null)
      .order('finished_at', { ascending: false })
      .limit(1),
  ])

  if (logs.error) {
    console.error('Failed to read automation logs:', logs.error.message)
  }

  const rows = logs.data ?? []
  const lastRun = runs.data?.[0]

  return {
    successes: rows.filter((row) => row.status === 'success').length,
    failures: rows.filter((row) => row.status === 'error').length,
    lastRunAt: (lastRun?.finished_at as string | undefined) ?? null,
    lastRunMode: (lastRun?.mode as string | undefined) ?? null,
  }
}

/** Formats the lookback window for display, e.g. "since 08 Oct 2026". */
export const healthWindowLabel = (): string =>
  toDateKey(
    new Date(getOrgToday().getTime() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000)
  )
