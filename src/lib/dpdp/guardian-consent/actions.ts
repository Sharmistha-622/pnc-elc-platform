'use server'

import { revalidatePath } from 'next/cache'
import { guard } from '@/lib/rbac/guard'
import { createAdminSupabaseClient } from '@/lib/supabase/admin'
import { fieldErrors } from '../settings/schemas'
import { readDpdpSettings } from '../settings/queries'
import { ageConfirmedSchema, guardianConsentSchema } from './schemas'

// ============================================================================
// Guardian consent: server actions (`privacyCases`: Super Admin, PnC Admin)
// ----------------------------------------------------------------------------
// A joiner under 18 waits in the portal until one of these runs:
//   recordGuardianConsent  a guardian's verified consent (DPDP Act s. 9(1);
//                          Rules r. 10), kept in consent_records
//   confirmAdultAge        the date of birth was wrong: the joiner is 18 or
//                          over, confirmed from a document; they enter the
//                          right date, which is checked again
// Each moves the record only from `required`, and leaves a line in the
// onboarding activity log.
// ============================================================================

type Result = { success: true } | { success: false; error: string; fieldErrors?: Record<string, string> }

async function moveFromRequired(
  db: NonNullable<ReturnType<typeof createAdminSupabaseClient>>,
  onboardingId: string,
  to: 'given' | 'not_required',
): Promise<'ok' | 'not_held' | 'error'> {
  const { data, error } = await db
    .from('onboarding_records')
    .update({ guardian_consent_status: to })
    .eq('id', onboardingId)
    .eq('guardian_consent_status', 'required')
    .select('id')
  if (error) return 'error'
  return data && data.length > 0 ? 'ok' : 'not_held'
}

/** Records a guardian's consent for a joiner under 18, and lets the portal continue. */
export async function recordGuardianConsent(input: unknown): Promise<Result> {
  const allowed = await guard('privacyCases')
  if (!allowed.ok) return { success: false, error: allowed.error }
  const parsed = guardianConsentSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: 'Check the highlighted fields.', fieldErrors: fieldErrors(parsed.error) }
  const v = parsed.data
  const settings = await readDpdpSettings()
  if (!settings.guardian_methods.includes(v.method)) {
    return { success: false, error: 'That method is not allowed in Settings → DPDP & Privacy → Children.', fieldErrors: { method: 'Not allowed in settings' } }
  }

  const db = createAdminSupabaseClient()
  if (!db) return { success: false, error: 'The server is missing its service key.' }
  const actor = allowed.caller.email ?? allowed.caller.userId
  const moved = await moveFromRequired(db, v.onboarding_id, 'given')
  if (moved === 'not_held') return { success: false, error: 'This joiner is not waiting for guardian consent.' }
  if (moved === 'error') return { success: false, error: 'Could not record the consent.' }

  const { error } = await db.from('consent_records').insert({
    principal_type: 'candidate',
    principal_ref: v.onboarding_id,
    record_type: 'guardian',
    method: v.method,
    evidence_note: v.evidence_note,
    channel: v.channel,
    recorded_by: actor,
  })
  if (error) {
    // Put the hold back: consent that is not on record has not been given.
    await db.from('onboarding_records').update({ guardian_consent_status: 'required' }).eq('id', v.onboarding_id)
    return { success: false, error: 'Could not record the consent.' }
  }
  await db.from('onboarding_activity_log').insert({
    onboarding_id: v.onboarding_id,
    actor_type: 'pnc',
    action: 'Guardian Consent Recorded',
    description: `A guardian's consent was recorded (${v.method.replace('_', ' ')}). The portal is open again.`,
    metadata: { method: v.method, recorded_by: actor },
  })
  revalidatePath('/manage/privacy/guardians')
  return { success: true }
}

/** The joiner is 18 or over after all (a mistyped date of birth), confirmed from a document. */
export async function confirmAdultAge(input: unknown): Promise<Result> {
  const allowed = await guard('privacyCases')
  if (!allowed.ok) return { success: false, error: allowed.error }
  const parsed = ageConfirmedSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: 'Check the highlighted fields.', fieldErrors: fieldErrors(parsed.error) }

  const db = createAdminSupabaseClient()
  if (!db) return { success: false, error: 'The server is missing its service key.' }
  const actor = allowed.caller.email ?? allowed.caller.userId
  const moved = await moveFromRequired(db, parsed.data.onboarding_id, 'not_required')
  if (moved === 'not_held') return { success: false, error: 'This joiner is not waiting for guardian consent.' }
  if (moved === 'error') return { success: false, error: 'Could not update the record.' }
  await db.from('onboarding_activity_log').insert({
    onboarding_id: parsed.data.onboarding_id,
    actor_type: 'pnc',
    action: 'Age Confirmed',
    description: 'PnC confirmed from a document that the joiner is 18 or over. They enter their date of birth again, and it is checked again.',
    metadata: { recorded_by: actor, evidence_note: parsed.data.evidence_note },
  })
  revalidatePath('/manage/privacy/guardians')
  return { success: true }
}
