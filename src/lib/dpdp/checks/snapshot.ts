import type { SupabaseClient } from '@supabase/supabase-js'
import { DELETE_FLOOR_DAYS } from '../constants'
import { addDays, parseDate } from '../dates'
import { noticeChecklist, type NoticeType } from '../notices'
import { contactIsSet } from '../settings/defaults'
import { toSettings } from '../settings/queries'
import type { ComplianceSnapshot, PublishedNotice } from './runtime'

// ============================================================================
// DPDP checker: the live snapshot
// ----------------------------------------------------------------------------
// Server-only. Called by `runComplianceChecks` after its `privacy` guard, with
// the service-role client: several counts span tables the privacy roles may
// not read row by row (consent records, onboarding documents, the audit log).
// Every query selects ids, statuses, dates or a head count, never a name, an
// email or a value about a person, and only counts leave this module.
//
// A source that cannot be read (a migration not applied yet) becomes null,
// which the runtime check reports as red with a neutral reason.
// ============================================================================

type Db = SupabaseClient

const MISSING = new Set(['42P01', '42703', 'PGRST205', 'PGRST204'])

async function headCount(query: PromiseLike<{ count: number | null; error: { code?: string } | null }>): Promise<number | null> {
  const { count, error } = await query
  if (error) return null
  return count ?? 0
}

export async function loadSnapshot(db: Db, today: Date): Promise<ComplianceSnapshot> {
  const [settingsRow, notices, rules, processors, attestations] = await Promise.all([
    db.from('dpdp_settings').select('*').eq('id', 'default').maybeSingle(),
    db.from('dpdp_notices').select('notice_type, language, version, sections').eq('status', 'published'),
    db.from('dpdp_retention_rules').select('id, period_days, action'),
    db.from('dpdp_processors').select('active, dpa_status, hosting_region, next_review_date'),
    db.from('dpdp_attestations').select('code, confirmed_at, next_review_at'),
  ])

  const settings = settingsRow.error || !settingsRow.data ? null : toSettings(settingsRow.data as Record<string, unknown>)
  const contactSet = settings ? contactIsSet(settings) : false

  // Latest published version per type and language.
  const latest = new Map<string, PublishedNotice>()
  for (const n of (notices.data ?? []) as { notice_type: NoticeType; language: string; version: number; sections: Record<string, string> }[]) {
    const key = `${n.notice_type}|${n.language}`
    if ((latest.get(key)?.version ?? 0) >= n.version) continue
    const checklist = noticeChecklist(n.notice_type, n.sections ?? {}, { contactSet })
    latest.set(key, { type: n.notice_type, language: n.language, version: n.version, checklistOk: checklist.every((i) => i.ok) })
  }

  const ruleRows = (rules.data ?? []) as { id: string; period_days: number | null; action: string }[]
  const todayIso = today.toISOString().slice(0, 10)
  const processorRows = (processors.data ?? []) as { active: boolean; dpa_status: string; hosting_region: string; next_review_date: string | null }[]
  const activeProcessors = processorRows.filter((p) => p.active)

  const [lastRun, requests, candidatesWithoutAck, withdrawn, minors, exposed, incidents, auditRows, salary, bankProofs] = await Promise.all([
    lastRetentionRun(db),
    requestCounts(db, today),
    candidatesWithoutAcknowledgment(db),
    withdrawnDocumentsPastDeadline(db, today),
    minorsWithoutGuardianConsent(db),
    exposedCounts(db),
    incidentCounts(db, today),
    headCount(
      db
        .from('employee_audit_log')
        .select('id', { count: 'exact', head: true })
        .or('description.ilike.*₹*,description.match.[0-9]{12}'),
    ),
    coreSalaryValues(db),
    headCount(
      db
        .from('onboarding_documents')
        .select('id', { count: 'exact', head: true })
        .eq('document_type', 'bank_proof')
        .not('storage_reference', 'is', null),
    ),
  ])

  return {
    settings: settings && {
      contactSet,
      grievanceDays: settings.grievance_days,
      languages: settings.notice_languages,
      driveTypes: settings.drive_copy_document_types,
    },
    notices: [...latest.values()],
    ruleIds: ruleRows.map((r) => r.id),
    rulesWithoutPeriod: ruleRows.filter((r) => r.period_days === null && r.action !== 'report_only').map((r) => r.id),
    lastRetentionRunAt: lastRun,
    requests,
    candidatesWithoutAck,
    withdrawnDocumentsPastDeadline: withdrawn,
    minorsWithoutGuardianConsent: minors,
    processors: processors.error
      ? null
      : {
          active: activeProcessors.length,
          missingDpa: activeProcessors.filter((p) => !['signed', 'accepted_online', 'not_required'].includes(p.dpa_status)).length,
          missingRegion: activeProcessors.filter((p) => !p.hosting_region?.trim()).length,
          reviewOverdue: activeProcessors.filter((p) => p.next_review_date && p.next_review_date < todayIso).length,
          reviewMissing: activeProcessors.filter((p) => !p.next_review_date).length,
        },
    attestations: ((attestations.data ?? []) as { code: string; confirmed_at: string | null; next_review_at: string | null }[]).map((a) => ({
      code: a.code,
      confirmedAt: a.confirmed_at,
      nextReviewAt: a.next_review_at,
    })),
    exposed,
    incidents,
    auditDescriptionsWithValues: auditRows,
    coreSalaryValues: salary,
    coreBankProofs: bankProofs,
  }
}

/** The latest retention run's start, null if none, undefined if runs cannot be read. */
async function lastRetentionRun(db: Db): Promise<string | null | undefined> {
  const { data, error } = await db.from('retention_runs').select('started_at').order('started_at', { ascending: false }).limit(1)
  if (error) return undefined
  return (data?.[0]?.started_at as string | undefined) ?? null
}

async function requestCounts(db: Db, today: Date): Promise<ComplianceSnapshot['requests']> {
  const { data, error } = await db.from('privacy_requests').select('received_at, due_at, escalated_at, status').neq('status', 'closed')
  if (error) return null
  const rows = (data ?? []) as { received_at: string; due_at: string; escalated_at: string | null; status: string }[]
  let overdue = 0
  let pastEscalation = 0
  for (const r of rows) {
    const received = parseDate(r.received_at)
    const due = parseDate(r.due_at)
    if (!received || !due) continue
    if (due < today) overdue++
    const escalateAt = new Date(received.getTime() + 0.8 * (due.getTime() - received.getTime()))
    if (escalateAt <= today && !r.escalated_at) pastEscalation++
  }
  return { open: rows.length, overdue, pastEscalationNotEscalated: pastEscalation }
}

async function candidatesWithoutAcknowledgment(db: Db): Promise<number | null> {
  const [details, acks] = await Promise.all([
    db.from('onboarding_personal_details').select('onboarding_id'),
    db.from('consent_records').select('principal_ref').eq('record_type', 'acknowledgment').eq('principal_type', 'candidate'),
  ])
  if (details.error || acks.error) return null
  const acknowledged = new Set(((acks.data ?? []) as { principal_ref: string }[]).map((a) => a.principal_ref))
  return ((details.data ?? []) as { onboarding_id: string }[]).filter((d) => !acknowledged.has(d.onboarding_id)).length
}

/**
 * Withdrawn joiners' documents still in core after both their period (from
 * the rule) and the 1-year floor have passed.
 */
async function withdrawnDocumentsPastDeadline(db: Db, today: Date): Promise<number | null> {
  const [rule, docs] = await Promise.all([
    db.from('dpdp_retention_rules').select('period_days').eq('id', 'withdrawn_joiner_documents').maybeSingle(),
    db
      .from('onboarding_documents')
      .select('uploaded_at, created_at, onboarding_records!inner(joiner_status, withdrawn_at, updated_at)')
      .not('storage_reference', 'is', null)
      .is('purged_at', null)
      .eq('onboarding_records.joiner_status', 'withdrawn'),
  ])
  if (docs.error) {
    if (!MISSING.has(docs.error.code ?? '')) return null
    // Before the retention migration adds withdrawn_at, use the record's last update.
    const fallback = await db
      .from('onboarding_documents')
      .select('uploaded_at, created_at, onboarding_records!inner(joiner_status, updated_at)')
      .not('storage_reference', 'is', null)
      .is('purged_at', null)
      .eq('onboarding_records.joiner_status', 'withdrawn')
    if (fallback.error) return null
    return countPast(fallback.data as unknown as DocRow[], Number(rule.data?.period_days ?? 90), today)
  }
  return countPast(docs.data as unknown as DocRow[], Number(rule.data?.period_days ?? 90), today)
}

type DocRow = {
  uploaded_at: string | null
  created_at: string
  onboarding_records: { withdrawn_at?: string | null; updated_at: string } | { withdrawn_at?: string | null; updated_at: string }[]
}

function countPast(rows: DocRow[], periodDays: number, today: Date): number {
  return rows.filter((d) => {
    const rec = Array.isArray(d.onboarding_records) ? d.onboarding_records[0] : d.onboarding_records
    const withdrawn = parseDate(rec?.withdrawn_at ?? rec?.updated_at)
    const processed = parseDate(d.uploaded_at ?? d.created_at)
    if (!withdrawn || !processed) return false
    const due = new Date(Math.max(addDays(withdrawn, periodDays).getTime(), addDays(processed, DELETE_FLOOR_DAYS.value).getTime()))
    return due < today
  }).length
}

async function minorsWithoutGuardianConsent(db: Db): Promise<number | null> {
  // Held in the portal is fine; submitted or further without consent is not.
  return headCount(
    db
      .from('onboarding_records')
      .select('id', { count: 'exact', head: true })
      .eq('guardian_consent_status', 'required')
      .in('status', ['submitted', 'under_review', 'approved', 'account_provisioning', 'completed']),
  )
}

async function exposedCounts(db: Db): Promise<ComplianceSnapshot['exposed']> {
  const { data, error } = await db.from('exposed_records').select('kind, overdue').eq('overdue', true)
  if (error) return null
  const rows = (data ?? []) as { kind: string }[]
  const n = (kind: string) => rows.filter((r) => r.kind === kind).length
  return { identity: n('identity_document'), feedback: n('feedback'), formAnswer: n('form_answer'), decisionNote: n('decision_note') }
}

async function incidentCounts(db: Db, today: Date): Promise<ComplianceSnapshot['incidents']> {
  const { data, error } = await db.from('privacy_incidents').select('status, certin_due_at, certin_reported_at, board_report_due_at, board_report_at')
  if (error) return null
  const rows = (data ?? []) as { status: string; certin_due_at: string | null; certin_reported_at: string | null; board_report_due_at: string | null; board_report_at: string | null }[]
  const late = (due: string | null, done: string | null) => {
    const d = parseDate(due)
    return !!d && !done && d < today
  }
  return {
    open: rows.filter((r) => r.status !== 'closed').length,
    deadlineMissed: rows.filter((r) => late(r.certin_due_at, r.certin_reported_at) || late(r.board_report_due_at, r.board_report_at)).length,
  }
}

/** Rows of `table` (with `column` set, when given). Null when the table or column does not exist. */
async function countRows(db: Db, table: string, column?: string): Promise<number | null> {
  const base = db.from(table).select('id', { count: 'exact', head: true })
  const { count, error } = column ? await base.not(column, 'is', null) : await base
  return error ? null : (count ?? 0)
}

/** Salary figures still in core; null once the core columns no longer exist. */
async function coreSalaryValues(db: Db): Promise<number | null> {
  const counts = [
    await countRows(db, 'onboarding_records', 'ctc'),
    await countRows(db, 'onboarding_employment_details', 'ctc'),
    await countRows(db, 'salary_structures'),
    await countRows(db, 'offboarding_fnf', 'net_payable_estimate'),
  ]
  const known = counts.filter((c): c is number => c !== null)
  return known.length ? known.reduce((a, b) => a + b, 0) : null
}
