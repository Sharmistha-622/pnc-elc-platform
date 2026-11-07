'use server'

import { guard } from '@/lib/rbac/guard'
import { createAdminSupabaseClient } from '@/lib/supabase/admin'
import { evaluateAll, scoreOf, type Score } from './evaluate'
import { loadSnapshot } from './snapshot'
import { readStaticReport } from './static-results'
import type { CheckOutcome, CheckResult, OverallStatus } from './types'

export interface ComplianceRun {
  ranAt: string
  staticGeneratedAt: string | null
  results: CheckResult[]
  score: Score
}

const STORED: Record<OverallStatus, string> = { green: 'pass', amber: 'warn', red: 'fail', ci: 'ci', not_run: 'not_run' }

/**
 * Runs the compliance checks: the build's static and db results, plus the
 * runtime and attestation checks against live settings and counts. Readable
 * by every `privacy` role (configuration and counts only). Records each
 * check's status and when it last passed in dpdp_check_results.
 */
export async function runComplianceChecks(): Promise<{ success: true; run: ComplianceRun } | { success: false; error: string }> {
  const allowed = await guard('privacy')
  if (!allowed.ok) return { success: false, error: allowed.error }

  const admin = createAdminSupabaseClient()
  if (!admin) return { success: false, error: 'The checker needs the service-role key on the server.' }

  const now = new Date()
  const [snapshot, staticReport, previous] = await Promise.all([
    loadSnapshot(admin, now),
    readStaticReport(),
    admin.from('dpdp_check_results').select('check_id, last_passed_at'),
  ])
  const lastPassed: Record<string, string | null> = Object.fromEntries(
    ((previous.data ?? []) as { check_id: string; last_passed_at: string | null }[]).map((r) => [r.check_id, r.last_passed_at]),
  )

  const results = evaluateAll(snapshot, now, staticReport, lastPassed).map((r) =>
    r.status === 'green' ? { ...r, lastPassedAt: now.toISOString() } : r,
  )

  // Counts only: the outcomes' details and counts, never data about a person.
  await admin.from('dpdp_check_results').upsert(
    results.map((r) => ({
      check_id: r.id,
      status: STORED[r.status],
      detail: Object.fromEntries(
        Object.entries(r.outcomes).flatMap(([mode, o]) =>
          !o || o === 'ci' ? [] : [[mode, (o as CheckOutcome).status], ...Object.entries((o as CheckOutcome).counts ?? {}).map(([k, v]) => [`${mode}.${k}`, v])],
        ),
      ),
      last_run_at: now.toISOString(),
      last_passed_at: r.lastPassedAt ?? null,
    })),
    { onConflict: 'check_id' },
  )

  return {
    success: true,
    run: { ranAt: now.toISOString(), staticGeneratedAt: staticReport?.generatedAt ?? null, results, score: scoreOf(results) },
  }
}
