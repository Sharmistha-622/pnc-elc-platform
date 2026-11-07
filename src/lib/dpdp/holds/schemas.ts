import { z } from 'zod'

// ============================================================================
// Legal holds: the forms, shared by the page and the server actions
// ============================================================================

/** Tables a record-level hold can name: the ones the retention job deletes from. */
export const HOLDABLE_TABLES = ['onboarding_documents', 'privacy_requests', 'privacy_nominations', 'privacy_incidents'] as const
export const HOLD_SUBJECTS = ['employee', 'candidate', 'record'] as const

export const placeHoldSchema = z
  .object({
    subject_type: z.enum(HOLD_SUBJECTS, { error: 'Choose what is held' }),
    subject_ref: z.union([z.literal(''), z.uuid()]).optional(),
    record_table: z.union([z.literal(''), z.enum(HOLDABLE_TABLES)]).optional(),
    record_id: z.union([z.literal(''), z.uuid('Paste the record id')]).optional(),
    reason: z.string().trim().min(5, 'Say why, in a few words').max(1000, 'At most 1,000 characters'),
    review_date: z.iso.date('Choose a review date'),
  })
  .superRefine((v, ctx) => {
    if (v.subject_type !== 'record' && !v.subject_ref) ctx.addIssue({ code: 'custom', path: ['subject_ref'], message: 'Choose the person' })
    if (v.subject_type === 'record') {
      if (!v.record_table) ctx.addIssue({ code: 'custom', path: ['record_table'], message: 'Choose the table' })
      if (!v.record_id) ctx.addIssue({ code: 'custom', path: ['record_id'], message: 'Paste the record id' })
    }
  })
export type PlaceHoldInput = z.input<typeof placeHoldSchema>

export const releaseHoldSchema = z.object({
  id: z.uuid(),
  release_reason: z.string().trim().min(5, 'Say why it is released').max(1000, 'At most 1,000 characters'),
})
