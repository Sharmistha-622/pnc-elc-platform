import { onboardingDb } from '@/lib/onboarding/db'
import { toSettings } from './settings/queries'
import type { OptionalFieldSettings } from './optional-fields'

// ============================================================================
// What the candidate portal needs from the DPDP settings
// ----------------------------------------------------------------------------
// The portal has no session, so it reads past RLS with the onboarding
// service-role client, and only after the token route has found the record.
// It returns a fixed subset: the published business contact (s. 8(9)), the
// response periods, the Board link and the collection rules. No other
// setting leaves the server.
// ============================================================================

export interface PortalPrivacySettings {
  optional_fields: OptionalFieldSettings
  contact: { name: string; role: string; email: string; phone: string }
  grievance_days: number
  board_complaint_url: string
  request_identifier: string
  notice_languages: string[]
  invitation_validity_days: number
}

export async function getPortalPrivacySettings(): Promise<PortalPrivacySettings> {
  let row: Record<string, unknown> | null = null
  try {
    const { data } = await onboardingDb().from('dpdp_settings').select('*').eq('id', 'default').maybeSingle()
    row = (data as Record<string, unknown> | null) ?? null
  } catch {
    row = null
  }
  const s = toSettings(row)
  return {
    optional_fields: s.optional_fields,
    contact: { name: s.contact_name, role: s.contact_role, email: s.contact_email, phone: s.contact_phone },
    grievance_days: s.grievance_days,
    board_complaint_url: s.board_complaint_url,
    request_identifier: s.request_identifier,
    notice_languages: s.notice_languages,
    invitation_validity_days: s.invitation_validity_days,
  }
}

/**
 * Document types that may be copied to an employee's Drive folder: the
 * Data collection setting, which can never hold an identity or bank type.
 */
export async function getDriveCopyTypes(): Promise<string[]> {
  try {
    const { data } = await onboardingDb().from('dpdp_settings').select('drive_copy_document_types').eq('id', 'default').maybeSingle()
    return toSettings((data as Record<string, unknown> | null) ?? null).drive_copy_document_types
  } catch {
    return toSettings(null).drive_copy_document_types
  }
}

export interface PortalNoticeState {
  /** The latest published candidate notice, one per language offered. */
  versions: { id: string; language: string; version: number; title: string; sections: Record<string, string> }[]
  /** The newest version this candidate has acknowledged, if any. */
  acknowledgedVersion: number | null
  /** True when nothing is published, or the latest version is acknowledged. */
  acknowledged: boolean
  purposes: { code: string; label: string; description: string }[]
  /** Purpose codes with a live consent. */
  consents: string[]
}

/** The candidate's notice, acknowledgment and consents, for the portal. */
export async function getPortalNoticeState(onboardingId: string, languages: string[]): Promise<PortalNoticeState> {
  const { latestPublishedNotices, listRecords, purposesFor } = await import('./consent/service')
  const principal = { type: 'candidate' as const, ref: onboardingId }
  const [notices, records, purposes] = await Promise.all([
    latestPublishedNotices('candidate'),
    listRecords(principal),
    purposesFor('candidate'),
  ])
  const versions = notices
    .filter((n) => languages.includes(n.language))
    .map((n) => ({ id: n.id, language: n.language, version: n.version, title: n.title, sections: n.sections }))
  const newest = notices.length ? Math.max(...notices.map((n) => n.version)) : null
  const acks = records.filter((r) => r.record_type === 'acknowledgment' && r.notice_type === 'candidate')
  const acknowledgedVersion = acks.length ? Math.max(...acks.map((r) => r.notice_version ?? 0)) : null
  return {
    versions,
    acknowledgedVersion,
    acknowledged: newest === null || (acknowledgedVersion ?? 0) >= newest,
    purposes: purposes.map((p) => ({ code: p.code, label: p.label, description: p.description })),
    consents: records.filter((r) => r.record_type === 'consent' && !r.withdrawn_at && r.purpose_code).map((r) => r.purpose_code as string),
  }
}
