import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createAdminSupabaseClient } from '@/lib/supabase/admin'
import { guard } from '@/lib/rbac/guard'
import { normaliseOptionalFields } from '../optional-fields'
import { RETENTION_DEFAULTS } from '../retention-defaults'
import { DEFAULT_DPDP_SETTINGS } from './defaults'
import type {
  Attestation,
  CheckResultRow,
  ConsentPurpose,
  DpdpSettings,
  DpdpSettingsBundle,
  NoticeVersion,
  Processor,
  RetentionRule,
} from './types'

// ============================================================================
// DPDP & Privacy: reads
// ----------------------------------------------------------------------------
// Server-only. Each read checks `privacy` itself, then reads with the session
// client, so RLS applies as well. The one exception is the acknowledgment
// count, which is a count over consent records the privacy roles cannot read
// row by row; it is read past RLS after the guard, and only counts leave.
// ============================================================================

/** Normalises a settings row read from the database. */
export function toSettings(row: Record<string, unknown> | null): DpdpSettings {
  if (!row) return DEFAULT_DPDP_SETTINGS
  const merged = { ...DEFAULT_DPDP_SETTINGS, ...row } as DpdpSettings
  return { ...merged, optional_fields: normaliseOptionalFields(row.optional_fields) }
}

/** The settings row, or the seeded defaults when it cannot be read. */
export async function readDpdpSettings(): Promise<DpdpSettings> {
  const supabase = await createServerSupabaseClient()
  const { data } = await supabase.from('dpdp_settings').select('*').eq('id', 'default').maybeSingle()
  return toSettings(data as Record<string, unknown> | null)
}

/** Everything the DPDP & Privacy tab shows. Null when the caller lacks `privacy`. */
export async function getDpdpSettingsBundle(): Promise<DpdpSettingsBundle | null> {
  const allowed = await guard('privacy')
  if (!allowed.ok) return null

  const supabase = await createServerSupabaseClient()
  const [settings, rules, notices, purposes, processors, attestations, results] = await Promise.all([
    supabase.from('dpdp_settings').select('*').eq('id', 'default').maybeSingle(),
    supabase.from('dpdp_retention_rules').select('*').order('id'),
    supabase.from('dpdp_notices').select('*').order('notice_type').order('language').order('version', { ascending: false }),
    supabase.from('dpdp_consent_purposes').select('*').order('sort_order'),
    supabase.from('dpdp_processors').select('*').order('name'),
    supabase.from('dpdp_attestations').select('*').order('sort_order'),
    supabase.from('dpdp_check_results').select('*').order('check_id'),
  ])

  const ruleRows = (rules.data as RetentionRule[] | null) ?? []
  return {
    settings: toSettings(settings.data as Record<string, unknown> | null),
    // Before the migration is applied, show the seeded rules read-only.
    rules: ruleRows.length > 0 ? ruleRows : RETENTION_DEFAULTS.map(defaultRule),
    notices: (notices.data as NoticeVersion[] | null) ?? [],
    purposes: (purposes.data as ConsentPurpose[] | null) ?? [],
    processors: (processors.data as Processor[] | null) ?? [],
    attestations: (attestations.data as Attestation[] | null) ?? [],
    checkResults: (results.data as CheckResultRow[] | null) ?? [],
    acknowledgments: await acknowledgmentCounts(),
  }
}

function defaultRule(r: (typeof RETENTION_DEFAULTS)[number]): RetentionRule {
  return {
    id: r.id,
    label: r.label,
    clock_start: r.clockStart,
    period_days: r.periodDays,
    consent_period_days: r.consentPeriodDays,
    action: r.action,
    floor_days: r.floorDays,
    statutory_ref: r.ref,
    note: r.note,
    counsel_to_confirm: true,
    updated_at: null,
    updated_by: null,
  }
}

/**
 * How many acknowledgments each published notice version has: counts only,
 * never who. Called after the `privacy` guard above.
 */
async function acknowledgmentCounts(): Promise<DpdpSettingsBundle['acknowledgments']> {
  const admin = createAdminSupabaseClient()
  if (!admin) return []
  const { data, error } = await admin
    .from('consent_records')
    .select('notice_type, notice_language, notice_version')
    .eq('record_type', 'acknowledgment')
  if (error || !data) return []
  const counts = new Map<string, { notice_type: string; language: string; version: number; count: number }>()
  for (const row of data as { notice_type: string; notice_language: string; notice_version: number }[]) {
    const key = `${row.notice_type}|${row.notice_language}|${row.notice_version}`
    const entry = counts.get(key) ?? { notice_type: row.notice_type, language: row.notice_language, version: row.notice_version, count: 0 }
    entry.count++
    counts.set(key, entry)
  }
  return [...counts.values()]
}
