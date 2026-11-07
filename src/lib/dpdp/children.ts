import { CHILD_AGE_YEARS } from './constants'
import { ageOn, parseDate } from './dates'

// ============================================================================
// Children: the age check (pure)
// ----------------------------------------------------------------------------
// A child is anyone under 18 (DPDP Act s. 2(f); CHILD_AGE_YEARS, locked).
// Their data is processed only with a guardian's verifiable consent (s. 9(1);
// Rules r. 10). The portal's token route calls this on the server with the
// date of birth the joiner gives, before it stores anything else.
// ============================================================================

export const GUARDIAN_STATUSES = ['not_checked', 'not_required', 'required', 'given'] as const
export type GuardianStatus = (typeof GUARDIAN_STATUSES)[number]

/** What the portal tells a joiner under 18. */
export const GUARDIAN_HOLD_MESSAGE =
  'You are under 18, so we need the consent of your parent or guardian before we take any more of your details. ' +
  'Our People & Culture team will contact you and your parent or guardian. You can still read the privacy notice and contact us.'

/** How a guardian is verified (Rules r. 10; the Children setting). */
export const GUARDIAN_METHODS = {
  document_check: 'Identity document of the parent or guardian checked',
  employee_attestation: 'Attested by a verified employee who is the parent or guardian',
} as const
export type GuardianMethodKey = keyof typeof GUARDIAN_METHODS

/** True when the person is under 18 on `today`. Unknown dates are not treated as adult. */
export function isChild(dateOfBirth: string | null | undefined, today: Date): boolean | null {
  const dob = parseDate(dateOfBirth ?? null)
  if (!dob) return null
  return ageOn(dob, today) < CHILD_AGE_YEARS.value
}

/**
 * The status after a date of birth is given. Once a guardian's consent is
 * needed, only PnC moves the record on: a joiner cannot clear it by
 * entering another date.
 */
export function guardianStatusFor(current: GuardianStatus, dateOfBirth: string, today: Date): GuardianStatus {
  if (current === 'required' || current === 'given') return current
  const child = isChild(dateOfBirth, today)
  if (child === null) return current
  return child ? 'required' : 'not_required'
}

/** Whether the portal takes anything beyond the notice and rights requests. */
export function guardianBlocks(status: GuardianStatus | null | undefined): boolean {
  return status === 'required'
}
