'use server'

import { createServerSupabaseClient } from '@/lib/supabase/server'

export async function submitPeerFeedback(peerFeedbackId: string, feedbackText: string) {
  const supabase = createServerSupabaseClient()

  const { data, error } = await supabase
    .from('peer_feedback')
    .update({
      feedback_text: feedbackText,
      response_status: 'submitted',
      submitted_at: new Date().toISOString(),
    })
    .eq('id', peerFeedbackId)
    .select()
    .single()

  if (error) {
    console.error('Error submitting peer feedback:', error.message, error.details, error.hint)
    return null
  }

  return data
}