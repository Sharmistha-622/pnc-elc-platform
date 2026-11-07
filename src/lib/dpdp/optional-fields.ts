// ============================================================================
// Optional personal fields: which the portal collects, and whether they are
// required. Set in Settings → DPDP & Privacy → Data collection
// (`dpdp_settings.optional_fields`). No field has a prefilled value: the
// portal starts every personal field empty (DPDP Act s. 6(1), s. 8(3)).
// ============================================================================

export const OPTIONAL_FIELD_KEYS = [
  'preferred_name',
  'gender',
  'blood_group',
  'current_address',
  'emergency_contact_email',
  'profile_photo',
] as const
export type OptionalFieldKey = (typeof OPTIONAL_FIELD_KEYS)[number]

export const OPTIONAL_FIELD_LABELS: Record<OptionalFieldKey, string> = {
  preferred_name: 'Preferred name',
  gender: 'Gender',
  blood_group: 'Blood group',
  current_address: 'Current address (if different)',
  emergency_contact_email: 'Emergency contact email',
  profile_photo: 'Profile photo',
}

export interface OptionalFieldRule {
  collect: boolean
  required: boolean
}

export type OptionalFieldSettings = Record<OptionalFieldKey, OptionalFieldRule>

/** The seeded defaults: every optional field collected, none required. */
export const DEFAULT_OPTIONAL_FIELDS: OptionalFieldSettings = Object.fromEntries(
  OPTIONAL_FIELD_KEYS.map((k) => [k, { collect: true, required: false }]),
) as OptionalFieldSettings

/**
 * Reads the stored value defensively: unknown keys are ignored, missing ones
 * fall back to the default, and a field that is not collected is never
 * required.
 */
export function normaliseOptionalFields(raw: unknown): OptionalFieldSettings {
  const out = { ...DEFAULT_OPTIONAL_FIELDS }
  if (raw && typeof raw === 'object') {
    for (const key of OPTIONAL_FIELD_KEYS) {
      const v = (raw as Record<string, unknown>)[key]
      if (v && typeof v === 'object') {
        const collect = (v as Record<string, unknown>).collect !== false
        const required = collect && (v as Record<string, unknown>).required === true
        out[key] = { collect, required }
      }
    }
  }
  return out
}
