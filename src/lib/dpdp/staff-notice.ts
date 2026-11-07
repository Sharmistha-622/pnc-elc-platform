import { createServerSupabaseClient } from '@/lib/supabase/server'
import type { PrivacyContactDetails } from '@/components/shared/privacy/privacy-contact'

// ============================================================================
// What the dashboard shell shows every staff member: the privacy contact, and
// whether a newer notice version than the one they acknowledged is published.
// Read with the session: the public settings view, published notices and the
// person's own consent records are all readable by staff, RLS deciding.
// ============================================================================

export interface StaffPrivacyShell {
  contact: PrivacyContactDetails
  grievanceDays: number
  /** The notice to read, when a newer version is published than the one acknowledged. */
  pendingNotice: { version: number; title: string } | null
}

const EMPTY: StaffPrivacyShell = {
  contact: { name: '', role: '', email: '', phone: '' },
  grievanceDays: 30,
  pendingNotice: null,
}

export async function staffPrivacyShell(email: string | null | undefined): Promise<StaffPrivacyShell> {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: s } = await supabase.from('dpdp_public_settings').select('*').maybeSingle()
    const base: StaffPrivacyShell = s
      ? {
          contact: { name: s.contact_name ?? '', role: s.contact_role ?? '', email: s.contact_email ?? '', phone: s.contact_phone ?? '' },
          grievanceDays: Number(s.grievance_days) || 30,
          pendingNotice: null,
        }
      : EMPTY
    if (!email) return base

    const { data: me } = await supabase.from('employees').select('id, employee_type').ilike('email', email).eq('status', 'active').limit(1).maybeSingle()
    if (!me) return base
    const type = me.employee_type === 'contractor' ? 'contractor_volunteer' : 'employee'

    const { data: latest } = await supabase
      .from('dpdp_notices')
      .select('version, title')
      .eq('notice_type', type)
      .eq('status', 'published')
      .order('version', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (!latest) return base

    const { data: acks } = await supabase
      .from('consent_records')
      .select('notice_version')
      .eq('record_type', 'acknowledgment')
      .eq('notice_type', type)
      .eq('principal_ref', me.id)
      .gte('notice_version', latest.version)
      .limit(1)
    return { ...base, pendingNotice: acks && acks.length > 0 ? null : { version: latest.version, title: latest.title } }
  } catch {
    return EMPTY
  }
}
