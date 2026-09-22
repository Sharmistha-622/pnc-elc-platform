import { createServerSupabaseClient } from '@/lib/supabase/server'

export async function getPeerFeedback(peerFeedbackId: string) {
  const supabase = createServerSupabaseClient()
  const { data, error } = await supabase
    .from('peer_feedback')
    .select('*, confirmations(employee_id, employees(name))')
    .eq('id', peerFeedbackId)
    .single()

  if (error) {
    console.error('Error fetching peer feedback:', error.message)
    return null
  }

  return data
}