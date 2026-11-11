// ============================================================================
// Document classes
// ----------------------------------------------------------------------------
// Which document types carry a government identifier or a bank account. These
// never leave the platform for Google Drive (`copyToDrive`), whatever the
// Drive setting says, and the database refuses them in
// `dpdp_settings.drive_copy_document_types` (202611071010_dpdp_settings.sql).
// Keep the two lists in step.
// ============================================================================

export const IDENTITY_DOCUMENT_TYPES = [
  'aadhaar',
  'pan',
  'passport',
  'address_proof',
  'voter_id',
  'driving_licence',
] as const

export const BANK_DOCUMENT_TYPES = ['bank_proof'] as const

const NEVER_TO_DRIVE = new Set<string>([...IDENTITY_DOCUMENT_TYPES, ...BANK_DOCUMENT_TYPES])

/** True for a type that carries an ID number or a bank account. */
export function isIdentityOrBankDocument(type: string | null | undefined): boolean {
  return !!type && NEVER_TO_DRIVE.has(type.trim().toLowerCase())
}

/**
 * The types PnC may choose to copy to Drive: every candidate type that is
 * neither identity nor bank. None is chosen by default (decided 2026-11-11):
 * documents stay on the platform, so erasure and retention reach every copy.
 */
export const DRIVE_COPYABLE_TYPES = [
  'resume',
  'photo',
  'education_certificate',
  'prev_experience_letter',
  'prev_relieving_letter',
  'reference_details',
] as const

/**
 * Whether a verified document may be copied to the employee's Drive folder:
 * it must be on the allow-list from settings, and it must never be an
 * identity or bank document.
 */
export function mayCopyToDrive(type: string | null | undefined, allowed: readonly string[]): boolean {
  if (!type || isIdentityOrBankDocument(type)) return false
  return allowed.map((t) => t.toLowerCase()).includes(type.trim().toLowerCase())
}
