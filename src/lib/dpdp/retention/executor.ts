import type { SupabaseClient } from '@supabase/supabase-js'
import type { RetentionMode } from '../types'
import { logCutoff, planRetention, summarise, type PlannedAction, type RuleCounts } from './planner'
import {
  LOG_TABLES,
  closedPrivacyRecords,
  exitedEmployees,
  loadHolds,
  loadRules,
  vaultInstructions,
  withdrawnDocuments,
  type VaultInstruction,
} from './sources'

// ============================================================================
// Retention: the executor
// ----------------------------------------------------------------------------
// Server-only, run by the daily job with the service role. It plans every
// candidate (planner.ts) and then, in live mode only:
//   - deletes withdrawn joiners' staged files (the rows stay, marked purged);
//   - deletes closed rights requests and incidents, and revoked nominations;
//   - purges log tables and spent consent records through dpdp_purge_rows(),
//     which applies the 1-year floor and legal holds in the database.
// Exited people's records, Drive folders and the vault are out of its reach:
// it counts what is due and records instructions. Dry-run deletes nothing.
//
// The report holds counts, rule ids and table names only: no person.
// ============================================================================

type Db = SupabaseClient

export type RunCounts = RuleCounts & { errors: number }

export interface RetentionReport {
  mode: RetentionMode
  status: 'ok' | 'partial'
  counts: Record<string, RunCounts>
  instructions: {
    /** Exited people due under each rule that runs from exit: erased by hand. */
    manual: { rule: string; people: number }[]
    /** Exited people past the letters rule: their Drive folder is reviewed by hand. */
    drive: { folders_due: number }
    vault: VaultInstruction[]
  }
}

export interface ExecutorDeps {
  /** Deletes the named staged files of one withdrawn joiner. */
  purgeDocuments: (onboardingId: string, documentIds: string[], reason: string) => Promise<{ purged: number; errors: string[] }>
}

const LOG_DATE_COLUMN: Record<string, string> = { settings_change_log: 'changed_at', retention_runs: 'started_at' }
const PURGE_REASON = 'Retention rule: withdrawn joiners\' documents'

function blank(): RunCounts {
  return { due: 0, deleted: 0, anonymised: 0, reported: 0, held: 0, under_floor: 0, not_due: 0, errors: 0 }
}

export async function runRetention(db: Db, mode: RetentionMode, today: Date, deps: ExecutorDeps): Promise<RetentionReport> {
  const [rules, holds] = await Promise.all([loadRules(db), loadHolds(db)])
  const candidates = [...(await withdrawnDocuments(db)), ...(await closedPrivacyRecords(db)), ...(await exitedEmployees(db))]
  const plan = planRetention(candidates, rules, holds, today)

  const counts: Record<string, RunCounts> = {}
  for (const [rule, c] of Object.entries(summarise(plan))) counts[rule] = { ...c, errors: 0 }
  const at = (rule: string) => (counts[rule] ??= blank())
  const due = plan.filter((p) => p.reason === 'due')

  if (mode === 'live') {
    await deleteWithdrawnDocuments(due, deps, at('withdrawn_joiner_documents'))
    await deleteRows(db, 'privacy_requests', due.filter((p) => p.candidate.kind === 'privacy_request'), at('privacy_records'))
    await deleteRows(db, 'privacy_nominations', due.filter((p) => p.candidate.kind === 'privacy_nomination'), at('privacy_records'))
    await deleteRows(db, 'privacy_incidents', due.filter((p) => p.candidate.kind === 'privacy_incident'), at('privacy_records'))
  }

  const logRule = rules.find((r) => r.id === 'logs')
  const logBefore = logCutoff(logRule?.period_days ?? null, today)
  if (logBefore) {
    for (const table of LOG_TABLES) {
      await purgeByDate(db, mode, table, LOG_DATE_COLUMN[table] ?? 'created_at', logBefore, at('logs'))
    }
  }
  const privacyRule = rules.find((r) => r.id === 'privacy_records')
  const consentBefore = logCutoff(privacyRule?.period_days ?? null, today)
  if (consentBefore) await purgeConsents(db, mode, consentBefore, at('privacy_records'))

  const exitedDue = (rule: string) => due.filter((p) => p.candidate.kind === 'exited_employee' && p.candidate.ruleId === rule).length
  const manualRules = [...new Set(due.filter((p) => p.candidate.kind === 'exited_employee').map((p) => p.candidate.ruleId))].sort()

  const errors = Object.values(counts).reduce((n, c) => n + c.errors, 0)
  return {
    mode,
    status: errors > 0 ? 'partial' : 'ok',
    counts,
    instructions: {
      manual: manualRules.map((rule) => ({ rule, people: exitedDue(rule) })),
      drive: { folders_due: exitedDue('letters') },
      vault: vaultInstructions(rules),
    },
  }
}

async function deleteWithdrawnDocuments(due: PlannedAction[], deps: ExecutorDeps, c: RunCounts): Promise<void> {
  const byJoiner = new Map<string, string[]>()
  for (const p of due) {
    if (p.candidate.kind !== 'withdrawn_documents' || p.outcome !== 'delete' || !p.candidate.subject) continue
    const ref = p.candidate.subject.ref
    byJoiner.set(ref, [...(byJoiner.get(ref) ?? []), p.candidate.id])
  }
  for (const [onboardingId, ids] of byJoiner) {
    try {
      const result = await deps.purgeDocuments(onboardingId, ids, PURGE_REASON)
      c.deleted += result.purged
      c.errors += result.errors.length
    } catch {
      c.errors += ids.length
    }
  }
}

async function deleteRows(db: Db, table: string, due: PlannedAction[], c: RunCounts): Promise<void> {
  const ids = due.filter((p) => p.outcome === 'delete').map((p) => p.candidate.id)
  if (ids.length === 0) return
  const { data, error } = await db.from(table).delete().in('id', ids).select('id')
  if (error) c.errors += ids.length
  else c.deleted += (data ?? []).length
}

/** Deletes through dpdp_purge_rows(), which keeps the floor and skips held people. */
async function purgeLive(db: Db, table: string, before: Date, c: RunCounts): Promise<void> {
  const { data, error } = await db.rpc('dpdp_purge_rows', { p_table: table, p_before: before.toISOString() })
  if (error) {
    c.errors += 1
    return
  }
  c.deleted += Number(data ?? 0)
  c.due += Number(data ?? 0)
}

async function purgeByDate(db: Db, mode: RetentionMode, table: string, column: string, before: Date, c: RunCounts): Promise<void> {
  if (mode === 'live') return purgeLive(db, table, before, c)
  const { count, error } = await db.from(table).select('*', { count: 'exact', head: true }).lt(column, before.toISOString())
  if (error) c.errors += 1
  else c.due += count ?? 0
}

async function purgeConsents(db: Db, mode: RetentionMode, before: Date, c: RunCounts): Promise<void> {
  if (mode === 'live') return purgeLive(db, 'consent_records', before, c)
  const iso = before.toISOString()
  const [acks, withdrawn] = await Promise.all([
    db.from('consent_records').select('*', { count: 'exact', head: true }).eq('record_type', 'acknowledgment').lt('given_at', iso),
    db.from('consent_records').select('*', { count: 'exact', head: true }).neq('record_type', 'acknowledgment').lt('withdrawn_at', iso),
  ])
  if (acks.error || withdrawn.error) c.errors += 1
  else c.due += (acks.count ?? 0) + (withdrawn.count ?? 0)
}
