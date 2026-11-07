import { z } from 'zod'
import { GRIEVANCE_MAX_DAYS } from '../constants'
import { LAWFUL_BASES, PRINCIPAL_TYPES, RETENTION_ACTIONS, RETENTION_MODES, DATA_CATEGORIES } from '../types'
import { BREACH_TEMPLATE_TYPES, NOTICE_LANGUAGES, PRIVACY_NOTICE_TYPES } from '../notices'
import { OPTIONAL_FIELD_KEYS } from '../optional-fields'
import { isIdentityOrBankDocument } from '@/lib/onboarding/document-classes'

// ============================================================================
// DPDP & Privacy settings: validation
// ----------------------------------------------------------------------------
// One schema per form, shared by the browser (react-hook-form) and the server
// action, which parses again before writing: the browser's check is a
// convenience, the server's is the rule. The database's check constraints are
// the last line (202611071010_dpdp_settings.sql).
// ============================================================================

const days = (min: number, max: number) =>
  z.coerce
    .number({ error: 'Enter a number of days' })
    .int('Whole days only')
    .min(min, `At least ${min}`)
    .max(max, `At most ${max}`)

const text = (max: number) => z.string().trim().max(max, `At most ${max} characters`)
const optionalEmail = z.union([z.literal(''), z.email('Enter a valid email')])
const optionalUrl = z.union([z.literal(''), z.url({ protocol: /^https?$/, error: 'Enter a full link, starting https://' })])

/** Required for retention changes, the mode switch and publishing. */
export const reasonSchema = z
  .string()
  .trim()
  .min(5, 'Say why, in a few words')
  .max(500, 'At most 500 characters')

export const contactSchema = z.object({
  contact_name: text(120),
  contact_role: text(120),
  contact_email: optionalEmail,
  contact_phone: text(40).regex(/^[+0-9 ()-]*$/, 'Digits, spaces, + ( ) and - only'),
  escalation_name: text(120),
  escalation_email: optionalEmail,
  board_complaint_url: optionalUrl,
  request_identifier: text(200).min(3, 'Say which identifier a request must carry'),
})
export type ContactInput = z.infer<typeof contactSchema>

export const periodsSchema = z.object({
  grievance_days: days(1, GRIEVANCE_MAX_DAYS.value),
  access_days: days(1, 90),
  correction_days: days(1, 90),
  erasure_days: days(1, 90),
  nomination_days: days(1, 90),
})
export type PeriodsInput = z.infer<typeof periodsSchema>

export const linksStagingSchema = z.object({
  invitation_validity_days: days(1, 30),
  staging_budget_document_days: days(1, 14),
  staging_budget_feedback_days: days(1, 30),
})
export type LinksStagingInput = z.infer<typeof linksStagingSchema>

export const childrenSchema = z.object({
  guardian_methods: z.array(z.enum(['employee_attestation', 'document_check'])).min(1, 'Keep at least one method'),
})
export type ChildrenInput = z.infer<typeof childrenSchema>

const fieldRule = z.object({ collect: z.boolean(), required: z.boolean() })

export const dataCollectionSchema = z.object({
  optional_fields: z
    .object(Object.fromEntries(OPTIONAL_FIELD_KEYS.map((k) => [k, fieldRule])) as Record<
      (typeof OPTIONAL_FIELD_KEYS)[number],
      typeof fieldRule
    >)
    .refine((fields) => Object.values(fields).every((f) => f.collect || !f.required), {
      message: 'A field that is not collected cannot be required',
    }),
  drive_copy_document_types: z
    .array(z.string().trim().regex(/^[a-z][a-z0-9_]{1,40}$/))
    .refine((types) => types.every((t) => !isIdentityOrBankDocument(t)), {
      message: 'Identity and bank documents are never copied to Drive',
    }),
})
export type DataCollectionInput = z.infer<typeof dataCollectionSchema>

export const languagesSchema = z.object({
  notice_languages: z
    .array(z.string().refine((c) => c in NOTICE_LANGUAGES, 'Unknown language'))
    .min(1)
    .refine((codes) => codes.includes('en'), { message: 'English is always offered' }),
})
export type LanguagesInput = z.infer<typeof languagesSchema>

export const breachContactsSchema = z.object({
  breach_internal_contacts: text(2000),
  certin_contact: text(500),
  board_contact: text(500),
})
export type BreachContactsInput = z.infer<typeof breachContactsSchema>

/**
 * Days that may be blank. Blank (or null) stays null — "no period, counsel
 * decides" — and is never coerced to 0, which would mean "delete at once".
 */
const nullableDays = (min: number, minMessage: string) =>
  z.preprocess(
    (v) => (v === '' || v === null || v === undefined ? null : typeof v === 'string' ? Number(v) : v),
    z
      .number({ error: 'Enter a number of days' })
      .int('Whole days only')
      .min(min, minMessage)
      .max(36500, 'At most 100 years')
      .nullable(),
  )

/** A retention rule's editable values; the floor comes from the stored rule. */
export function retentionRuleSchema(floorDays: number) {
  return z
    .object({
      id: z.string().min(1),
      period_days: nullableDays(floorDays, `Never below the statutory floor of ${floorDays} days`),
      consent_period_days: nullableDays(0, 'At least 0'),
      action: z.enum(RETENTION_ACTIONS),
      reason: reasonSchema,
    })
    .refine((r) => r.consent_period_days === null || r.period_days === null || r.consent_period_days >= r.period_days, {
      message: 'The period with consent cannot be shorter than the period without',
      path: ['consent_period_days'],
    })
}
export type RetentionRuleInput = z.infer<ReturnType<typeof retentionRuleSchema>>

export const retentionModeSchema = z.object({
  mode: z.enum(RETENTION_MODES),
  reason: reasonSchema,
})

const ALL_NOTICE_TYPES = [...PRIVACY_NOTICE_TYPES, ...BREACH_TEMPLATE_TYPES] as const

export const noticeDraftSchema = z.object({
  notice_type: z.enum(ALL_NOTICE_TYPES),
  language: z.string().refine((c) => c in NOTICE_LANGUAGES, 'Unknown language'),
  title: text(200).min(3, 'Give the notice a title'),
  sections: z.record(z.string().regex(/^[a-z_]{2,40}$/), text(20000)),
})
export type NoticeDraftInput = z.infer<typeof noticeDraftSchema>

export const publishNoticeSchema = z.object({
  id: z.uuid(),
  reason: reasonSchema,
})

export const purposeSchema = z.object({
  code: z.string().trim().regex(/^[a-z][a-z0-9_]{1,40}$/, 'Lower case letters, digits and _ only'),
  label: text(120).min(3, 'Name the purpose'),
  description: text(1000),
  principal_types: z.array(z.enum(PRINCIPAL_TYPES)).min(1, 'Choose who it applies to'),
  lawful_basis: z.enum(LAWFUL_BASES),
  required: z.boolean(),
  active: z.boolean(),
  sort_order: z.coerce.number().int().min(0).max(1000),
})
export type PurposeInput = z.infer<typeof purposeSchema>

const optionalDate = z.union([z.literal(''), z.iso.date('Use a date')])

export const processorSchema = z.object({
  code: z.string().trim().regex(/^[a-z][a-z0-9_]{1,40}$/, 'Lower case letters, digits and _ only'),
  name: text(120).min(2, 'Name the processor'),
  purpose: text(500),
  data_categories: z.array(z.enum(DATA_CATEGORIES)),
  hosting_region: text(200),
  dpa_status: z.enum(['not_started', 'requested', 'signed', 'accepted_online', 'not_required']),
  dpa_date: optionalDate,
  next_review_date: optionalDate,
  notes: text(1000),
  active: z.boolean(),
})
export type ProcessorInput = z.infer<typeof processorSchema>

export const attestationSchema = z.object({
  code: z.string().trim().regex(/^[a-z][a-z0-9_]{1,40}$/),
  evidence_note: text(1000),
})
export type AttestationInput = z.infer<typeof attestationSchema>

/** Flattens zod issues into `{ field: message }` for the form. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {}
  for (const issue of error.issues) {
    const key = issue.path.join('.') || '_'
    if (!(key in out)) out[key] = issue.message
  }
  return out
}
