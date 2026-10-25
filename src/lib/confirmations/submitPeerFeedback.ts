'use server'

import { createServerSupabaseClient } from '@/lib/supabase/server'
import { auditPeerFeedback } from '@/lib/audit/events'
import { resolveSubjectFromConfirmation } from '@/lib/audit/subject'
import { guard } from '@/lib/rbac/guard'
import { isNominatedPeer } from './access'

export async function submitPeerFeedback(peerFeedbackId: string, feedbackText: string) {
  // A nominated peer is usually an ordinary employee, so there is no feature
  // to gate on beyond being signed in. What decides it is the request itself:
  // only the peer it was sent to may answer it, and only once. Anyone else
  // could otherwise write feedback under that peer's name, or overwrite what
  // they already wrote.
  const allowed = await guard('self')
  if (!allowed.ok) return null
  if (typeof feedbackText !== 'string' || !feedbackText.trim()) return null

  const supabase = await createServerSupabaseClient()

  const { data: request } = await supabase
    .from('peer_feedback')
    .select('id, peer_employee_id, peer_email, response_status')
    .eq('id', peerFeedbackId)
    .maybeSingle()

  if (!request || request.response_status === 'submitted') return null
  if (!(await isNominatedPeer(supabase, request))) return null

  const { data, error } = await supabase
    .from('peer_feedback')
    .update({
      feedback_text: feedbackText,
      response_status: 'submitted',
      submitted_at: new Date().toISOString(),
    })
    .eq('id', peerFeedbackId)
    // Repeated in the write, so two submissions racing each other cannot both
    // land: the second finds nothing left to update.
    .neq('response_status', 'submitted')
    .select()
    .single()

  if (error) {
    console.error('Error submitting peer feedback:', error.message, error.details, error.hint)
    return null
  }

  // The subject is the employee under review, not the peer writing.
  await auditPeerFeedback.submitted({
    subject: await resolveSubjectFromConfirmation(data.confirmation_id),
    actorName: data.peer_name,
    actorEmail: data.peer_email,
    actorType: 'employee',
    entityId: peerFeedbackId,
    entityType: 'peer_feedback',
    reviewer: data.peer_name,
  })

  return data
}
