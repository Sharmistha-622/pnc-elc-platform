import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createAdminSupabaseClient } from '@/lib/supabase/admin'
import { guard } from '@/lib/rbac/guard'
import { staffPrincipal } from './consent/principal'
import { latestPublishedNotices, listRecords, purposesFor, type ConsentRow } from './consent/service'
import { listForPrincipal } from './requests/service'
import type { PrivacyRequestRow } from './requests/types'
import type { NoticeVersion, Processor } from './settings/types'
import { maskDocumentNumber } from '@/lib/vault/sealing'

// ============================================================================
// My Privacy: everything the page shows, for the signed-in person only.
// ----------------------------------------------------------------------------
// The access summary of DPDP Act s. 11: the person's core data, what the vault
// holds about them (by type, masked), their notice and consents, the
// processors their data is shared with, and their requests. Their own core
// rows are read with the session (RLS: own record); their onboarding
// documents, closed to sessions, are read with the service role for their
// own record only, and only type, seal state and the last four characters
// leave.
// ============================================================================

export interface MyPrivacyData {
  hasRecord: boolean
  noticeType: 'employee' | 'contractor_volunteer'
  person: { label: string; value: string }[]
  vault: { label: string; detail: string }[]
  notices: NoticeVersion[]
  acknowledgedVersion: number | null
  purposes: { code: string; label: string; description: string }[]
  records: ConsentRow[]
  processors: Pick<Processor, 'code' | 'name' | 'purpose' | 'hosting_region' | 'data_categories'>[]
  requests: PrivacyRequestRow[]
  nominee: { name: string; relation: string } | null
}

/** An ID number as its last four characters only. */
const masked = (v: unknown) => {
  const last4 = typeof v === 'string' ? maskDocumentNumber(v) : null
  return last4 ? `•••• ${last4}` : '—'
}

export async function getMyPrivacyData(): Promise<MyPrivacyData | null> {
  const allowed = await guard('myPrivacy')
  if (!allowed.ok) return null
  const principal = await staffPrincipal(allowed.caller)
  const supabase = await createServerSupabaseClient()
  const [processorsRes] = await Promise.all([
    supabase.from('dpdp_processors').select('code, name, purpose, hosting_region, data_categories').eq('active', true).order('name'),
  ])
  const processors = (processorsRes.data as MyPrivacyData['processors'] | null) ?? []
  const noticeType = principal?.type === 'contractor' ? 'contractor_volunteer' : 'employee'
  const notices = await latestPublishedNotices(noticeType)

  if (!principal) {
    return { hasRecord: false, noticeType, person: [], vault: [], notices, acknowledgedVersion: null, purposes: [], records: [], processors, requests: [], nominee: null }
  }

  const [{ data: me }, { data: profile }, records, purposes, requests] = await Promise.all([
    supabase.from('employees').select('name, email, team, joining_date, confirmation_date, employee_type, employee_code').eq('id', principal.ref).maybeSingle(),
    supabase.from('employee_profiles').select('contact_number, personal_email, permanent_address, mailing_address, emergency_contact_name, emergency_contact_number, date_of_birth, blood_group, id_proof_number, address_proof_number').eq('employee_id', principal.ref).maybeSingle(),
    listRecords(principal),
    purposesFor(principal.type),
    listForPrincipal({ type: principal.type === 'contractor' ? 'contractor' : 'employee', ref: principal.ref }),
  ])

  const person = [
    { label: 'Name', value: me?.name ?? '—' },
    { label: 'Work email', value: me?.email ?? '—' },
    { label: 'Employee code', value: me?.employee_code ?? '—' },
    { label: 'Team', value: me?.team ?? '—' },
    { label: 'Joined', value: me?.joining_date ?? '—' },
    { label: 'Phone', value: profile?.contact_number ?? '—' },
    { label: 'Personal email', value: profile?.personal_email ?? '—' },
    { label: 'Permanent address', value: profile?.permanent_address ?? '—' },
    { label: 'Date of birth', value: profile?.date_of_birth ?? '—' },
    { label: 'Emergency contact', value: profile?.emergency_contact_name ? `${profile.emergency_contact_name}${profile.emergency_contact_number ? `, ${profile.emergency_contact_number}` : ''}` : '—' },
    { label: 'ID proof number', value: masked(profile?.id_proof_number) },
    { label: 'Address proof number', value: masked(profile?.address_proof_number) },
  ]

  // What the vault holds about them: by type, never the value.
  const vault: MyPrivacyData['vault'] = [
    { label: 'Bank details', detail: 'Held in the vault if you have given them; shown to you as masked values only.' },
    { label: 'Salary and payslips', detail: 'Held in the vault; you receive them as letters and payslips.' },
    { label: 'Written review feedback', detail: 'Moved into the vault when each review closes; peers stay anonymous.' },
  ]
  const admin = createAdminSupabaseClient()
  if (admin) {
    const { data: onboarding } = await admin.from('onboarding_records').select('id').eq('employee_id', principal.ref).limit(1).maybeSingle()
    if (onboarding) {
      const { data: docs } = await admin
        .from('onboarding_documents')
        .select('document_type, seal_state, document_number_last4')
        .eq('onboarding_id', onboarding.id)
      for (const d of (docs ?? []) as { document_type: string; seal_state: string | null; document_number_last4: string | null }[]) {
        vault.unshift({
          label: d.document_type,
          detail: d.seal_state === 'sealed'
            ? `In the vault${d.document_number_last4 ? `; number ending ${d.document_number_last4}` : ''}`
            : 'With People & Culture for verification; moves into the vault once verified',
        })
      }
    }
  }

  const acks = records.filter((r) => r.record_type === 'acknowledgment' && r.notice_type === noticeType)
  const { data: nominee } = admin
    ? await admin.from('privacy_nominations').select('nominee_name, nominee_relation').eq('principal_ref', principal.ref).is('revoked_at', null).maybeSingle()
    : { data: null }

  return {
    hasRecord: true,
    noticeType,
    person,
    vault,
    notices,
    acknowledgedVersion: acks.length ? Math.max(...acks.map((a) => a.notice_version ?? 0)) : null,
    purposes: purposes.map((p) => ({ code: p.code, label: p.label, description: p.description })),
    records,
    processors,
    requests,
    nominee: nominee ? { name: nominee.nominee_name as string, relation: nominee.nominee_relation as string } : null,
  }
}
