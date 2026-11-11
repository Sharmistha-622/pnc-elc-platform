import { z } from 'zod'
import type { OptionalFieldKey, OptionalFieldSettings } from '@/lib/dpdp/optional-fields'

// ============================================================================
// Candidate personal details: validation
// ----------------------------------------------------------------------------
// Shared by the portal form (react-hook-form) and the portal API, which parses
// again before writing: unknown keys are dropped, fields the Data collection
// settings do not collect are dropped, and nothing has a default value. Every
// personal field starts empty and holds only what the candidate typed
// (DPDP Act s. 6(1), s. 8(3)).
// ============================================================================

// Transgender is offered in line with the Transgender Persons (Protection of
// Rights) Act 2019 (decided 2026-11-11).
export const GENDER_OPTIONS = ['Female', 'Male', 'Transgender', 'Non-binary', 'Prefer not to say'] as const
export const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'Not known'] as const
export const RELATIONS = ['Parent', 'Spouse or partner', 'Sibling', 'Child', 'Relative', 'Friend', 'Other'] as const

const phone = (message: string) =>
  z.string().trim().regex(/^\+?[0-9][0-9 ()-]{6,19}$/, message)

/** '' or nothing becomes null: an unanswered optional field is stored as empty. */
const blankToNull = <T extends z.ZodType>(schema: T) =>
  z
    .union([z.literal(''), z.null(), schema])
    .optional()
    .transform((v) => (v === '' || v === undefined ? null : v))

const OPTIONAL_FIELDS: Record<Exclude<OptionalFieldKey, 'profile_photo'>, { required: z.ZodType; optional: z.ZodType }> = {
  preferred_name: {
    required: z.string().trim().min(1, 'Enter the name you go by').max(80),
    optional: blankToNull(z.string().trim().max(80)),
  },
  gender: {
    required: z.enum(GENDER_OPTIONS, { error: 'Choose one' }),
    optional: blankToNull(z.enum(GENDER_OPTIONS)),
  },
  blood_group: {
    required: z.enum(BLOOD_GROUPS, { error: 'Choose one, or "Not known"' }),
    optional: blankToNull(z.enum(BLOOD_GROUPS)),
  },
  current_address: {
    required: z.string().trim().min(5, 'Enter your current address').max(500),
    optional: blankToNull(z.string().trim().max(500)),
  },
  emergency_contact_email: {
    required: z.email('Enter a valid email'),
    optional: blankToNull(z.email('Enter a valid email')),
  },
}

/**
 * The personal-details schema for the given collection settings.
 * @param optional - `dpdp_settings.optional_fields`, normalised
 * @param today - the date of birth must be before it
 */
export function buildPersonalDetailsSchema(optional: OptionalFieldSettings, today: Date) {
  const shape: Record<string, z.ZodType> = {
    full_name: z.string().trim().min(2, 'Enter your full legal name').max(150),
    date_of_birth: z.iso
      .date('Enter your date of birth')
      .refine((d) => {
        const date = new Date(`${d}T00:00:00Z`)
        return date < today && date.getUTCFullYear() > 1900
      }, 'Enter your real date of birth'),
    phone: phone('Enter your phone number'),
    permanent_address: z.string().trim().min(5, 'Enter your permanent address').max(500),
    city: blankToNull(z.string().trim().max(80)),
    state: blankToNull(z.string().trim().max(80)),
    pincode: blankToNull(z.string().trim().regex(/^\d{6}$/, 'A 6-digit pincode')),
    emergency_contact_name: z.string().trim().min(2, 'Enter a name').max(150),
    emergency_contact_relation: z.enum(RELATIONS, { error: 'Choose how they are related to you' }),
    emergency_contact_phone: phone('Enter their phone number'),
  }
  for (const [key, schemas] of Object.entries(OPTIONAL_FIELDS) as [keyof typeof OPTIONAL_FIELDS, (typeof OPTIONAL_FIELDS)[keyof typeof OPTIONAL_FIELDS]][]) {
    const rule = optional[key]
    if (!rule.collect) continue
    shape[key] = rule.required ? schemas.required : schemas.optional
  }
  return z.object(shape)
}

export type PersonalDetailsInput = Record<string, string>

/** The form's starting values: the candidate's saved answers, otherwise empty. */
export function personalDetailsDefaults(
  saved: Record<string, unknown> | null | undefined,
  fromRecord: { candidate_name?: string | null; phone?: string | null },
): PersonalDetailsInput {
  const text = (v: unknown) => (typeof v === 'string' ? v : '')
  return {
    full_name: text(saved?.full_name) || text(fromRecord.candidate_name),
    preferred_name: text(saved?.preferred_name),
    date_of_birth: text(saved?.date_of_birth),
    gender: text(saved?.gender),
    blood_group: text(saved?.blood_group),
    phone: text(saved?.phone) || text(fromRecord.phone),
    permanent_address: text(saved?.permanent_address),
    city: text(saved?.city),
    state: text(saved?.state),
    pincode: text(saved?.pincode),
    current_address: text(saved?.current_address),
    emergency_contact_name: text(saved?.emergency_contact_name),
    emergency_contact_relation: text(saved?.emergency_contact_relation),
    emergency_contact_phone: text(saved?.emergency_contact_phone),
    emergency_contact_email: text(saved?.emergency_contact_email),
  }
}
