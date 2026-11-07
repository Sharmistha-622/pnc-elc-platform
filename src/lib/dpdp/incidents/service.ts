import { guard } from '@/lib/rbac/guard'
import { createAdminSupabaseClient } from '@/lib/supabase/admin'
import { readSettings } from '../requests/service'
import { BREACH_TEMPLATE_TYPES, type BreachTemplateType } from '../notices'
import { draftValues, renderDraft, type Draft } from './drafts'
import type { IncidentRow } from './types'

// ============================================================================
// Incidents: reads for the incident pages (`privacyCases` only)
// ----------------------------------------------------------------------------
// Each read checks privacyCases before using the service role.
// ============================================================================

export async function listIncidents(): Promise<IncidentRow[] | null> {
  const allowed = await guard('privacyCases')
  if (!allowed.ok) return null
  const admin = createAdminSupabaseClient()
  if (!admin) return null
  const { data } = await admin.from('privacy_incidents').select('*').order('detected_at', { ascending: false }).limit(300)
  return (data as IncidentRow[] | null) ?? []
}

export interface IncidentDetail {
  incident: IncidentRow
  /** One draft per breach template; null where no template is published. */
  drafts: Record<BreachTemplateType, Draft | null>
}

export async function getIncidentDetail(id: string): Promise<IncidentDetail | null> {
  const allowed = await guard('privacyCases')
  if (!allowed.ok) return null
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null
  const admin = createAdminSupabaseClient()
  if (!admin) return null
  const { data } = await admin.from('privacy_incidents').select('*').eq('id', id).maybeSingle()
  if (!data) return null
  const incident = data as IncidentRow

  const [settings, { data: notices }] = await Promise.all([
    readSettings(),
    admin
      .from('dpdp_notices')
      .select('notice_type, version, sections')
      .in('notice_type', [...BREACH_TEMPLATE_TYPES])
      .eq('language', 'en')
      .eq('status', 'published'),
  ])
  const latest = new Map<string, { version: number; body: string }>()
  for (const n of (notices ?? []) as { notice_type: string; version: number; sections: Record<string, string> | null }[]) {
    const prev = latest.get(n.notice_type)
    if (!prev || n.version > prev.version) latest.set(n.notice_type, { version: n.version, body: n.sections?.body ?? '' })
  }
  const values = draftValues(incident, {
    name: settings.contact_name,
    role: settings.contact_role,
    email: settings.contact_email,
    phone: settings.contact_phone,
  })
  const drafts = Object.fromEntries(
    BREACH_TEMPLATE_TYPES.map((t) => {
      const tpl = latest.get(t)
      return [t, tpl ? renderDraft(t, tpl.body, values) : null]
    }),
  ) as Record<BreachTemplateType, Draft | null>
  return { incident, drafts }
}

/** Open incidents and those past a deadline with no report: counts for the daily job. */
export async function incidentDeadlineCounts(
  db: NonNullable<ReturnType<typeof createAdminSupabaseClient>>,
  now: Date,
): Promise<{ open: number; deadline_missed: number } | null> {
  const { data, error } = await db
    .from('privacy_incidents')
    .select('status, certin_due_at, certin_reported_at, board_report_due_at, board_report_at')
    .neq('status', 'closed')
  if (error) return null
  const rows = (data ?? []) as Pick<IncidentRow, 'certin_due_at' | 'certin_reported_at' | 'board_report_due_at' | 'board_report_at'>[]
  const late = (due: string | null, done: string | null) => !!due && !done && new Date(due) < now
  return {
    open: rows.length,
    deadline_missed: rows.filter((r) => late(r.certin_due_at, r.certin_reported_at) || late(r.board_report_due_at, r.board_report_at)).length,
  }
}
