import { createServerSupabaseClient } from '@/lib/supabase/server'
import type { PrivacyContactDetails } from '@/components/shared/privacy/privacy-contact'

export interface DpdpPublic {
  contact: PrivacyContactDetails
  grievanceDays: number
  boardUrl: string
  requestIdentifier: string
  periods: { access: number; correction: number; erasure: number; nomination: number; grievance: number }
}

/** The contact and periods every staff member sees (the dpdp_public_settings view). */
export async function getDpdpPublic(): Promise<DpdpPublic> {
  const supabase = await createServerSupabaseClient()
  const { data: s } = await supabase.from('dpdp_public_settings').select('*').maybeSingle()
  return {
    contact: { name: s?.contact_name ?? '', role: s?.contact_role ?? '', email: s?.contact_email ?? '', phone: s?.contact_phone ?? '' },
    grievanceDays: Number(s?.grievance_days) || 30,
    boardUrl: s?.board_complaint_url ?? '',
    requestIdentifier: s?.request_identifier ?? 'Your work email, or your employee ID',
    periods: {
      access: Number(s?.access_days) || 30,
      correction: Number(s?.correction_days) || 15,
      erasure: Number(s?.erasure_days) || 30,
      nomination: Number(s?.nomination_days) || 15,
      grievance: Number(s?.grievance_days) || 30,
    },
  }
}
