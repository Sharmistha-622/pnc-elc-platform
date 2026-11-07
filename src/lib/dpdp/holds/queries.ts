import { guard, passes } from '@/lib/rbac/guard'
import { createAdminSupabaseClient } from '@/lib/supabase/admin'

// ============================================================================
// Legal holds: reads for the holds page (`privacyCases` only)
// ----------------------------------------------------------------------------
// Names people, so it checks privacyCases itself before using the service
// role. Platform Admin and Exec View see the hold count only (holdSummary).
// ============================================================================

export interface HoldRow {
  id: string
  subject_type: 'employee' | 'candidate' | 'record'
  subject_ref: string | null
  record_table: string | null
  record_id: string | null
  reason: string
  review_date: string
  placed_by: string
  placed_at: string
  released_at: string | null
  released_by: string | null
  release_reason: string | null
  /** The person's name, or the table and id for a record hold. */
  subject_label: string
}

export interface PersonOption {
  id: string
  label: string
}

export interface HoldsPageData {
  active: HoldRow[]
  released: HoldRow[]
  employees: PersonOption[]
  candidates: PersonOption[]
}

export async function getHoldsPageData(): Promise<HoldsPageData | null> {
  const allowed = await guard('privacyCases')
  if (!allowed.ok) return null
  const admin = createAdminSupabaseClient()
  if (!admin) return null

  const [holds, employees, candidates] = await Promise.all([
    admin.from('dpdp_legal_holds').select('*').order('placed_at', { ascending: false }).limit(300),
    admin.from('employees').select('id, name, status').order('name'),
    admin.from('onboarding_records').select('id, candidate_name, joiner_status').order('candidate_name'),
  ])
  const empRows = (employees.data ?? []) as { id: string; name: string | null; status: string | null }[]
  const candRows = (candidates.data ?? []) as { id: string; candidate_name: string | null; joiner_status: string | null }[]
  const empName = new Map(empRows.map((e) => [e.id, e.name ?? 'Unnamed employee']))
  const candName = new Map(candRows.map((c) => [c.id, c.candidate_name ?? 'Unnamed candidate']))

  const rows = ((holds.data ?? []) as Omit<HoldRow, 'subject_label'>[]).map<HoldRow>((h) => ({
    ...h,
    subject_label:
      h.subject_type === 'employee'
        ? (empName.get(h.subject_ref ?? '') ?? 'Employee (no longer on record)')
        : h.subject_type === 'candidate'
          ? (candName.get(h.subject_ref ?? '') ?? 'Candidate (no longer on record)')
          : `${h.record_table} · ${h.record_id}`,
  }))

  return {
    active: rows.filter((r) => !r.released_at),
    released: rows.filter((r) => r.released_at).slice(0, 50),
    employees: empRows.map((e) => ({ id: e.id, label: `${e.name ?? 'Unnamed'}${e.status === 'exited' ? ' (exited)' : ''}` })),
    candidates: candRows.map((c) => ({ id: c.id, label: `${c.candidate_name ?? 'Unnamed'}${c.joiner_status ? ` (${c.joiner_status.replace(/_/g, ' ')})` : ''}` })),
  }
}

export interface RetentionStatus {
  lastRun: { started_at: string; finished_at: string | null; mode: string; status: string; counts: Record<string, unknown> } | null
  /** Null when the caller may not see holds. */
  holds: { active: number; reviewOverdue: number } | null
}

/**
 * The latest retention run (counts only, every privacy role) and, for
 * privacyCases roles, how many holds are active.
 */
export async function getRetentionStatus(today: string): Promise<RetentionStatus | null> {
  const allowed = await guard('privacy')
  if (!allowed.ok) return null
  const admin = createAdminSupabaseClient()
  if (!admin) return null
  const { data: runs } = await admin
    .from('retention_runs')
    .select('started_at, finished_at, mode, status, counts')
    .order('started_at', { ascending: false })
    .limit(1)
  const lastRun = ((runs ?? [])[0] as RetentionStatus['lastRun']) ?? null

  if (!passes(allowed.caller, 'privacyCases')) return { lastRun, holds: null }
  const { data: active } = await admin.from('dpdp_legal_holds').select('review_date').is('released_at', null)
  const list = (active ?? []) as { review_date: string }[]
  return { lastRun, holds: { active: list.length, reviewOverdue: list.filter((h) => h.review_date < today).length } }
}
