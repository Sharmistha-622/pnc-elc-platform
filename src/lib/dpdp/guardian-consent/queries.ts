import { guard } from '@/lib/rbac/guard'
import { createAdminSupabaseClient } from '@/lib/supabase/admin'
import { readDpdpSettings } from '../settings/queries'
import type { GuardianMethod } from '../settings/types'

// Joiners waiting for a guardian's consent: for privacyCases only.

export interface WaitingJoiner {
  id: string
  candidate_name: string
  designation: string | null
  joining_date: string | null
  updated_at: string
}

export async function getGuardianQueue(): Promise<{ waiting: WaitingJoiner[]; methods: GuardianMethod[]; given: number } | null> {
  const allowed = await guard('privacyCases')
  if (!allowed.ok) return null
  const db = createAdminSupabaseClient()
  if (!db) return null
  const [waiting, given, settings] = await Promise.all([
    db
      .from('onboarding_records')
      .select('id, candidate_name, designation, joining_date, updated_at')
      .eq('guardian_consent_status', 'required')
      .order('updated_at', { ascending: true }),
    db.from('onboarding_records').select('id', { count: 'exact', head: true }).eq('guardian_consent_status', 'given'),
    readDpdpSettings(),
  ])
  return { waiting: (waiting.data as WaitingJoiner[] | null) ?? [], methods: settings.guardian_methods, given: given.count ?? 0 }
}
