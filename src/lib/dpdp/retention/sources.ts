import type { SupabaseClient } from '@supabase/supabase-js'
import { INVENTORY } from '../inventory'
import type { RetentionRuleId } from '../types'
import type { LegalHold, PlannerRule, RetentionCandidate } from './planner'

// ============================================================================
// Retention: where the candidates come from
// ----------------------------------------------------------------------------
// Server-only. Reads, with the service role, the records each rule covers in
// core and turns them into planner candidates. Nothing here deletes.
//
// Logs and consent records are not listed row by row: dpdp_purge_rows()
// deletes them by date in the database, with the floor and holds applied
// there. The vault and Drive are out of the job's reach; they become
// instructions (rule, tables and period only).
// ============================================================================

type Db = SupabaseClient

/** Log tables purged by date through dpdp_purge_rows() under the logs rule. */
export const LOG_TABLES = [
  'employee_audit_log',
  'audit_log',
  'settings_change_log',
  'roles_history',
  'review_events',
  'onboarding_activity_log',
  'offboarding_activity_log',
  'email_delivery_logs',
  'retention_runs',
] as const

/** Rules that run from exit, counted for exited people and erased by hand. */
export const EXIT_RULES: RetentionRuleId[] = ['letters', 'employment_records', 'dependant_nominee']

export async function loadRules(db: Db): Promise<PlannerRule[]> {
  const { data, error } = await db.from('dpdp_retention_rules').select('id, period_days, consent_period_days, action')
  if (error) throw new Error('Could not read the retention rules.')
  return ((data ?? []) as PlannerRule[]).map((r) => ({
    id: r.id,
    period_days: r.period_days === null ? null : Number(r.period_days),
    consent_period_days: r.consent_period_days === null ? null : Number(r.consent_period_days),
    action: r.action,
  }))
}

export async function loadHolds(db: Db): Promise<LegalHold[]> {
  const { data, error } = await db
    .from('dpdp_legal_holds')
    .select('subject_type, subject_ref, record_table, record_id, released_at')
    .is('released_at', null)
  if (error) throw new Error('Could not read the legal holds.')
  return (data ?? []) as LegalHold[]
}

type DocRow = {
  id: string
  onboarding_id: string
  uploaded_at: string | null
  created_at: string
  onboarding_records: { withdrawn_at: string | null; updated_at: string } | { withdrawn_at: string | null; updated_at: string }[] | null
}

/** Withdrawn joiners' documents still in core. */
export async function withdrawnDocuments(db: Db): Promise<RetentionCandidate[]> {
  const { data, error } = await db
    .from('onboarding_documents')
    .select('id, onboarding_id, uploaded_at, created_at, onboarding_records!inner(withdrawn_at, updated_at)')
    .eq('onboarding_records.joiner_status', 'withdrawn')
    .neq('seal_state', 'sealed')
    .not('storage_reference', 'is', null)
    .is('purged_at', null)
  if (error) throw new Error('Could not read withdrawn joiners\' documents.')
  return ((data ?? []) as unknown as DocRow[]).map((d) => {
    const rec = Array.isArray(d.onboarding_records) ? d.onboarding_records[0] : d.onboarding_records
    return {
      kind: 'withdrawn_documents',
      id: d.id,
      ruleId: 'withdrawn_joiner_documents',
      clockStart: rec?.withdrawn_at ?? rec?.updated_at ?? null,
      processedAt: d.uploaded_at ?? d.created_at,
      subject: { type: 'candidate', ref: d.onboarding_id },
      record: { table: 'onboarding_documents', id: d.id },
    }
  })
}

const STAFF_PRINCIPALS = new Set(['employee', 'contractor', 'volunteer', 'former_employee'])

function subjectOf(principalType: string, ref: string | null): RetentionCandidate['subject'] {
  if (!ref) return undefined
  if (principalType === 'candidate') return { type: 'candidate', ref }
  return STAFF_PRINCIPALS.has(principalType) ? { type: 'employee', ref } : undefined
}

/** Closed rights requests and incidents, and revoked nominations, under the privacy-records rule. */
export async function closedPrivacyRecords(db: Db): Promise<RetentionCandidate[]> {
  const [requests, nominations, incidents] = await Promise.all([
    db.from('privacy_requests').select('id, principal_type, principal_ref, closed_at, updated_at').eq('status', 'closed'),
    db.from('privacy_nominations').select('id, principal_type, principal_ref, revoked_at').not('revoked_at', 'is', null),
    db.from('privacy_incidents').select('id, closed_at, updated_at').eq('status', 'closed'),
  ])
  if (requests.error || nominations.error || incidents.error) throw new Error('Could not read the privacy records.')
  type Req = { id: string; principal_type: string; principal_ref: string | null; closed_at: string | null; updated_at: string }
  type Nom = { id: string; principal_type: string; principal_ref: string; revoked_at: string }
  type Inc = { id: string; closed_at: string | null; updated_at: string }
  return [
    ...((requests.data ?? []) as Req[]).map<RetentionCandidate>((r) => ({
      kind: 'privacy_request',
      id: r.id,
      ruleId: 'privacy_records',
      clockStart: r.closed_at,
      processedAt: r.updated_at,
      subject: subjectOf(r.principal_type, r.principal_ref),
      record: { table: 'privacy_requests', id: r.id },
    })),
    ...((nominations.data ?? []) as Nom[]).map<RetentionCandidate>((n) => ({
      kind: 'privacy_nomination',
      id: n.id,
      ruleId: 'privacy_records',
      clockStart: n.revoked_at,
      processedAt: n.revoked_at,
      subject: subjectOf(n.principal_type, n.principal_ref),
      record: { table: 'privacy_nominations', id: n.id },
    })),
    ...((incidents.data ?? []) as Inc[]).map<RetentionCandidate>((i) => ({
      kind: 'privacy_incident',
      id: i.id,
      ruleId: 'privacy_records',
      clockStart: i.closed_at,
      processedAt: i.updated_at,
      record: { table: 'privacy_incidents', id: i.id },
    })),
  ]
}

/**
 * Exited people, once per rule that runs from exit. Their records span many
 * tables, Drive and the vault, so the job counts them and PnC erases by hand.
 */
export async function exitedEmployees(db: Db): Promise<RetentionCandidate[]> {
  const { data, error } = await db.from('employees').select('id, exit_date, updated_at').eq('status', 'exited').not('exit_date', 'is', null)
  if (error) throw new Error('Could not read exited employees.')
  type Row = { id: string; exit_date: string; updated_at: string | null }
  return ((data ?? []) as Row[]).flatMap((e) =>
    EXIT_RULES.map<RetentionCandidate>((ruleId) => ({
      kind: 'exited_employee',
      id: e.id,
      ruleId,
      clockStart: e.exit_date,
      processedAt: e.updated_at ?? e.exit_date,
      subject: { type: 'employee', ref: e.id },
    })),
  )
}

export interface VaultInstruction {
  rule: RetentionRuleId
  tables: string[]
  period_days: number | null
  action: string
}

/** What the vault owner applies by hand: per rule, the vault tables it covers and its period. */
export function vaultInstructions(rules: PlannerRule[]): VaultInstruction[] {
  const byRule = new Map<RetentionRuleId, string[]>()
  for (const t of INVENTORY) {
    if (t.store !== 'vault' || !t.retention) continue
    byRule.set(t.retention, [...(byRule.get(t.retention) ?? []), t.table])
  }
  return [...byRule.entries()]
    .map(([rule, tables]) => {
      const r = rules.find((x) => x.id === rule)
      return { rule, tables: tables.sort(), period_days: r?.period_days ?? null, action: r?.action ?? 'report_only' }
    })
    .sort((a, b) => a.rule.localeCompare(b.rule))
}
