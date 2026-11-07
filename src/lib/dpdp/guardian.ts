import { onboardingDb } from '@/lib/onboarding/db'
import { GUARDIAN_STATUSES, type GuardianStatus } from './children'

export { GUARDIAN_HOLD_MESSAGE } from './children'

// ============================================================================
// Guardian consent: the portal side
// ----------------------------------------------------------------------------
// Server-only, for the token route and the upload route, which have found the
// record from its token first. Reads and sets onboarding_records.
// guardian_consent_status with the onboarding service-role client.
// ============================================================================

export async function guardianStatusOf(onboardingId: string): Promise<GuardianStatus> {
  const { data, error } = await onboardingDb()
    .from('onboarding_records')
    .select('guardian_consent_status')
    .eq('id', onboardingId)
    .maybeSingle()
  // Fail closed: an unreadable status refuses the action rather than letting it through.
  if (error) throw new Error('Could not check the age on this record.')
  const status = (data as { guardian_consent_status?: string } | null)?.guardian_consent_status
  if (!status) return 'not_checked'
  return (GUARDIAN_STATUSES as readonly string[]).includes(status) ? (status as GuardianStatus) : 'not_checked'
}

export async function setGuardianStatus(onboardingId: string, status: GuardianStatus): Promise<void> {
  const { error } = await onboardingDb().from('onboarding_records').update({ guardian_consent_status: status }).eq('id', onboardingId)
  if (error) throw new Error('Could not record the age check.')
}
