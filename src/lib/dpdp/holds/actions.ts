'use server'

import { revalidatePath } from 'next/cache'
import { guard } from '@/lib/rbac/guard'
import { createAdminSupabaseClient } from '@/lib/supabase/admin'
import { fieldErrors } from '../settings/schemas'
import { isoDate } from '../dates'
import { placeHoldSchema, releaseHoldSchema } from './schemas'

// ============================================================================
// Legal holds: server actions (`privacyCases`: Super Admin, PnC Admin)
// ----------------------------------------------------------------------------
// A hold pauses every retention rule for its person or record (DPDP Act
// s. 17(1)(a)). Sessions cannot write dpdp_legal_holds; these actions do,
// with the service role, after the guard. A hold is released, never deleted.
// ============================================================================

type Result = { success: true } | { success: false; error: string; fieldErrors?: Record<string, string> }

function revalidate() {
  revalidatePath('/manage/privacy/holds')
  revalidatePath('/manage/settings/dpdp')
}

/** Places a hold on a person (employee or candidate) or on one record. */
export async function placeLegalHold(input: unknown): Promise<Result> {
  const allowed = await guard('privacyCases')
  if (!allowed.ok) return { success: false, error: allowed.error }
  const parsed = placeHoldSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: 'Check the highlighted fields.', fieldErrors: fieldErrors(parsed.error) }
  const v = parsed.data
  if (v.review_date <= isoDate(new Date())) {
    return { success: false, error: 'The review date must be in the future.', fieldErrors: { review_date: 'Choose a future date' } }
  }

  const admin = createAdminSupabaseClient()
  if (!admin) return { success: false, error: 'The server is missing its service key.' }
  const isRecord = v.subject_type === 'record'
  const { error } = await admin.from('dpdp_legal_holds').insert({
    subject_type: v.subject_type,
    subject_ref: isRecord ? null : v.subject_ref,
    record_table: isRecord ? v.record_table : null,
    record_id: isRecord ? v.record_id : null,
    reason: v.reason,
    review_date: v.review_date,
    placed_by: allowed.caller.email ?? allowed.caller.userId,
  })
  if (error) return { success: false, error: 'Could not place the hold.' }
  revalidate()
  return { success: true }
}

/** Releases a hold, with the reason. Retention resumes on the next daily run. */
export async function releaseLegalHold(input: unknown): Promise<Result> {
  const allowed = await guard('privacyCases')
  if (!allowed.ok) return { success: false, error: allowed.error }
  const parsed = releaseHoldSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: 'Check the highlighted fields.', fieldErrors: fieldErrors(parsed.error) }

  const admin = createAdminSupabaseClient()
  if (!admin) return { success: false, error: 'The server is missing its service key.' }
  const { data, error } = await admin
    .from('dpdp_legal_holds')
    .update({
      released_at: new Date().toISOString(),
      released_by: allowed.caller.email ?? allowed.caller.userId,
      release_reason: parsed.data.release_reason,
    })
    .eq('id', parsed.data.id)
    .is('released_at', null)
    .select('id')
  if (error) return { success: false, error: 'Could not release the hold.' }
  if (!data || data.length === 0) return { success: false, error: 'That hold is already released.' }
  revalidate()
  return { success: true }
}
