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
