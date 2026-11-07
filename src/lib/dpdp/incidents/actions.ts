'use server'

import { revalidatePath } from 'next/cache'
import { guard } from '@/lib/rbac/guard'
import { createAdminSupabaseClient } from '@/lib/supabase/admin'
import { fieldErrors } from '../settings/schemas'
import { incidentNarrativeSchema, incidentStatusSchema, incidentStepSchema, istToIso, recordIncidentSchema } from './schemas'

// ============================================================================
// Incidents: server actions (`privacyCases`: Super Admin, PnC Admin)
// ----------------------------------------------------------------------------
// Records incidents and the reports made about them. Nothing here sends a
// message: CERT-In, the Board and affected people are told by PnC, from the
// drafts, and the time is recorded here.
// ============================================================================

type Result = { success: true; id?: string; reference?: string } | { success: false; error: string; fieldErrors?: Record<string, string> }

const db = () => createAdminSupabaseClient()

function revalidate(id?: string) {
  revalidatePath('/manage/privacy/incidents')
  if (id) revalidatePath(`/manage/privacy/incidents/${id}`)
}

/** Records a new incident. The deadlines follow from the time it was noticed. */
export async function recordIncident(input: unknown): Promise<Result> {
  const allowed = await guard('privacyCases')
  if (!allowed.ok) return { success: false, error: allowed.error }
  const parsed = recordIncidentSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: 'Check the highlighted fields.', fieldErrors: fieldErrors(parsed.error) }
  const v = parsed.data
  const detected = istToIso(v.detected_at)
  if (new Date(detected) > new Date()) return { success: false, error: 'The time noticed cannot be in the future.', fieldErrors: { detected_at: 'Not in the future' } }
  const occurred = v.occurred_at ? istToIso(v.occurred_at) : null
  if (occurred && occurred > detected) return { success: false, error: 'It cannot have begun after it was noticed.', fieldErrors: { occurred_at: 'Before the time noticed' } }

  const admin = db()
  if (!admin) return { success: false, error: 'The server is missing its service key.' }
  const { data, error } = await admin
    .from('privacy_incidents')
    .insert({
      title: v.title,
      detected_at: detected,
      occurred_at: occurred,
      severity: v.severity,
      personal_data: v.personal_data,
      certin_reportable: v.certin_reportable,
      people_affected: v.people_affected === '' || v.people_affected === undefined ? null : v.people_affected,
      systems: v.systems,
      description: v.description,
      recorded_by: allowed.caller.email ?? allowed.caller.userId,
    })
    .select('id, reference')
    .single()
  if (error || !data) return { success: false, error: 'Could not record the incident.' }
  revalidate()
  return { success: true, id: data.id as string, reference: data.reference as string }
}

/** Updates what is known: the facts the drafts are filled from. */
export async function updateIncidentNarrative(input: unknown): Promise<Result> {
  const allowed = await guard('privacyCases')
  if (!allowed.ok) return { success: false, error: allowed.error }
  const parsed = incidentNarrativeSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: 'Check the highlighted fields.', fieldErrors: fieldErrors(parsed.error) }
  const { id, ...patch } = parsed.data
  const admin = db()
  if (!admin) return { success: false, error: 'The server is missing its service key.' }
  const { error } = await admin.from('privacy_incidents').update(patch).eq('id', id).neq('status', 'closed')
  if (error) return { success: false, error: 'Could not save.' }
  revalidate(id)
  return { success: true }
}

/** Records when a report was made. Each step is recorded once. */
export async function recordIncidentStep(input: unknown): Promise<Result> {
  const allowed = await guard('privacyCases')
  if (!allowed.ok) return { success: false, error: allowed.error }
  const parsed = incidentStepSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: 'Enter when it was done.' }
  const at = istToIso(parsed.data.at)
  if (new Date(at) > new Date()) return { success: false, error: 'That time is in the future.' }
  const admin = db()
  if (!admin) return { success: false, error: 'The server is missing its service key.' }
  const { data, error } = await admin
    .from('privacy_incidents')
    .update({ [parsed.data.step]: at })
    .eq('id', parsed.data.id)
    .is(parsed.data.step, null)
    .select('id')
  if (error) return { success: false, error: 'Could not record it.' }
  if (!data || data.length === 0) return { success: false, error: 'That step is already recorded.' }
  revalidate(parsed.data.id)
  return { success: true }
}

/** Moves an incident to contained, or closes it with a note. */
export async function setIncidentStatus(input: unknown): Promise<Result> {
  const allowed = await guard('privacyCases')
  if (!allowed.ok) return { success: false, error: allowed.error }
  const parsed = incidentStatusSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: 'Invalid status.' }
  const { id, status, closure_note } = parsed.data
  if (status === 'closed' && !closure_note?.trim()) {
    return { success: false, error: 'Say how it was resolved before closing it.', fieldErrors: { closure_note: 'Required to close' } }
  }
  const admin = db()
  if (!admin) return { success: false, error: 'The server is missing its service key.' }
  const closing = status === 'closed'
  const { error } = await admin
    .from('privacy_incidents')
    .update({
      status,
      closed_at: closing ? new Date().toISOString() : null,
      closed_by: closing ? (allowed.caller.email ?? allowed.caller.userId) : null,
      closure_note: closing ? closure_note : null,
    })
    .eq('id', id)
  if (error) return { success: false, error: 'Could not update the incident.' }
  revalidate(id)
  return { success: true }
}
