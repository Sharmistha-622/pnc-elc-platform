import type { SupabaseClient } from '@supabase/supabase-js'
import { createAdminSupabaseClient } from '@/lib/supabase/admin'
import type { PrincipalType } from '../types'
import type { PrivacyNoticeType } from '../notices'
import type { ConsentPurpose, NoticeVersion } from '../settings/types'

// ============================================================================
// Notices and consent: the ledger
// ----------------------------------------------------------------------------
// Server-only. Writes consent_records with the service role, which sessions
// cannot write. Every caller has already established who the principal is:
// the portal from the invitation token, My Privacy from the session
// (`current employee`), never from the request body.
// ============================================================================

export interface Principal {
  type: PrincipalType
  /** onboarding_records.id for a candidate; employees.id for staff. */
  ref: string
}

export type Channel = 'portal' | 'app' | 'email' | 'paper' | 'in_person'

export interface ConsentRow {
  id: string
  record_type: 'acknowledgment' | 'consent' | 'guardian'
  purpose_code: string | null
  notice_type: string | null
  notice_language: string | null
  notice_version: number | null
  given_at: string
  withdrawn_at: string | null
  channel: Channel
}

export type ConsentResult = { ok: true } | { ok: false; error: string }

function db(): SupabaseClient {
  const client = createAdminSupabaseClient()
  if (!client) throw new Error('Consent records need the service-role key on the server.')
  return client
}

/** The latest published version of a notice type, one per language. */
export async function latestPublishedNotices(type: PrivacyNoticeType): Promise<NoticeVersion[]> {
  const { data, error } = await db()
    .from('dpdp_notices')
    .select('*')
    .eq('notice_type', type)
    .eq('status', 'published')
    .order('version', { ascending: false })
  if (error || !data) return []
  const byLanguage = new Map<string, NoticeVersion>()
  for (const n of data as NoticeVersion[]) if (!byLanguage.has(n.language)) byLanguage.set(n.language, n)
  return [...byLanguage.values()]
}

/** A principal's records, newest first. */
export async function listRecords(principal: Principal): Promise<ConsentRow[]> {
  const { data, error } = await db()
    .from('consent_records')
    .select('id, record_type, purpose_code, notice_type, notice_language, notice_version, given_at, withdrawn_at, channel')
    .eq('principal_type', principal.type)
    .eq('principal_ref', principal.ref)
    .order('given_at', { ascending: false })
  return error || !data ? [] : (data as ConsentRow[])
}

/**
 * Whether the principal has acknowledged the latest published version of a
 * notice type (in any language). True when nothing is published yet.
 */
export async function hasAcknowledgedLatest(principal: Principal, type: PrivacyNoticeType): Promise<boolean> {
  const latest = await latestPublishedNotices(type)
  if (latest.length === 0) return true
  const newest = Math.max(...latest.map((n) => n.version))
  const records = await listRecords(principal)
  return records.some((r) => r.record_type === 'acknowledgment' && r.notice_type === type && (r.notice_version ?? 0) >= newest)
}

/** Records that the principal read this published notice version. */
export async function recordAcknowledgment(
  principal: Principal,
  noticeId: string,
  expectedType: PrivacyNoticeType,
  channel: Channel,
  recordedBy: string | null = null,
): Promise<ConsentResult> {
  if (!/^[0-9a-f-]{36}$/i.test(noticeId)) return { ok: false, error: 'Unknown notice.' }
  const { data: notice } = await db().from('dpdp_notices').select('*').eq('id', noticeId).maybeSingle()
  if (!notice || notice.status !== 'published' || notice.notice_type !== expectedType) {
    return { ok: false, error: 'That notice is not available.' }
  }
  const { error } = await db().from('consent_records').insert({
    principal_type: principal.type,
    principal_ref: principal.ref,
    record_type: 'acknowledgment',
    notice_type: notice.notice_type,
    notice_language: notice.language,
    notice_version: notice.version,
    channel,
    recorded_by: recordedBy,
  })
  return error ? { ok: false, error: 'Could not record that you read the notice.' } : { ok: true }
}

/** The optional consent purposes offered to this kind of principal. */
export async function purposesFor(type: PrincipalType): Promise<ConsentPurpose[]> {
  const { data, error } = await db()
    .from('dpdp_consent_purposes')
    .select('*')
    .eq('active', true)
    .eq('lawful_basis', 'consent')
    .contains('principal_types', [type])
    .order('sort_order')
  return error || !data ? [] : (data as ConsentPurpose[])
}

/**
 * Gives or withdraws consent for one purpose. Giving records the notice
 * version the person had in front of them; withdrawing stamps the live record.
 */
export async function setConsent(
  principal: Principal,
  purposeCode: string,
  give: boolean,
  channel: Channel,
  notice: { type: string; language: string; version: number } | null,
): Promise<ConsentResult> {
  const purposes = await purposesFor(principal.type)
  if (!purposes.some((p) => p.code === purposeCode)) return { ok: false, error: 'That choice is not offered.' }

  const live = (await listRecords(principal)).find((r) => r.record_type === 'consent' && r.purpose_code === purposeCode && !r.withdrawn_at)
  if (give) {
    if (live) return { ok: true }
    const { error } = await db().from('consent_records').insert({
      principal_type: principal.type,
      principal_ref: principal.ref,
      record_type: 'consent',
      purpose_code: purposeCode,
      notice_type: notice?.type ?? null,
      notice_language: notice?.language ?? null,
      notice_version: notice?.version ?? null,
      channel,
    })
    return error ? { ok: false, error: 'Could not record your choice.' } : { ok: true }
  }
  if (!live) return { ok: true }
  return withdrawRecord(principal, live.id)
}

/** Withdraws one live consent record of this principal. One action, as easy as giving it. */
export async function withdrawRecord(principal: Principal, recordId: string): Promise<ConsentResult> {
  if (!/^[0-9a-f-]{36}$/i.test(recordId)) return { ok: false, error: 'Unknown consent.' }
  const { data, error } = await db()
    .from('consent_records')
    .update({ withdrawn_at: new Date().toISOString() })
    .eq('id', recordId)
    .eq('principal_type', principal.type)
    .eq('principal_ref', principal.ref)
    .eq('record_type', 'consent')
    .is('withdrawn_at', null)
    .select('id')
  if (error) return { ok: false, error: 'Could not withdraw your consent.' }
  return data && data.length > 0 ? { ok: true } : { ok: false, error: 'That consent is not active.' }
}
