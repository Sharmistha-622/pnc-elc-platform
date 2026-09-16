import { createServerSupabaseClient } from '@/lib/supabase/server'

export type CompiledFeedback = {
  confirmationId: string
  employeeId: string
  employeeName: string
  employeeType: string
  totalNominated: number
  totalSubmitted: number
  totalPending: number
  redFlag: boolean
  redFlagReason: string | null
  feedbackEntries: {
    id: string
    peerName: string
    feedbackText: string | null
    responseStatus: string
    submittedAt: string | null
  }[]
}

// Simple keyword list for red-flag detection — expand/adjust once criteria is confirmed with the team
const RED_FLAG_KEYWORDS = ['concern', 'issue', 'problem', 'difficult', 'poor', 'unprofessional', 'late']

export async function getCompiledFeedback(confirmationId: string): Promise<CompiledFeedback | null> {
  const supabase = createServerSupabaseClient()

  const { data: confirmation, error: confirmationError } = await supabase
    .from('confirmations')
    .select('*, employees(name, employee_type)')
    .eq('id', confirmationId)
    .single()

  if (confirmationError || !confirmation) {
    console.error('Error fetching confirmation:', confirmationError?.message)
    return null
  }

  const { data: feedbackRows, error: feedbackError } = await supabase
    .from('peer_feedback')
    .select('*')
    .eq('confirmation_id', confirmationId)

  if (feedbackError) {
    console.error('Error fetching feedback:', feedbackError.message)
    return null
  }

  const totalNominated = feedbackRows?.length || 0
  const submitted = feedbackRows?.filter((f) => f.response_status === 'submitted') || []
  const totalSubmitted = submitted.length
  const totalPending = totalNominated - totalSubmitted

  // Red flag logic: low response rate OR keyword match in any submitted feedback
  let redFlag = false
  let redFlagReason: string | null = null

  if (totalNominated > 0 && totalSubmitted / totalNominated < 0.5) {
    redFlag = true
    redFlagReason = 'Less than half of nominated peers have responded'
  }

  for (const entry of submitted) {
    const text = (entry.feedback_text || '').toLowerCase()
    const matchedKeyword = RED_FLAG_KEYWORDS.find((kw) => text.includes(kw))
    if (matchedKeyword) {
      redFlag = true
      redFlagReason = `Feedback contains flagged term: "${matchedKeyword}"`
      break
    }
  }

   return {
    confirmationId,
    employeeId: confirmation.employee_id,
    employeeName: confirmation.employees?.name || 'Unknown',
    employeeType: confirmation.employees?.employee_type || 'Unknown',
    totalNominated,
    totalSubmitted,
    totalPending,
    redFlag,
    redFlagReason,
    feedbackEntries: (feedbackRows || []).map((f) => ({
      id: f.id,
      peerName: f.peer_name,
      feedbackText: f.feedback_text,
      responseStatus: f.response_status,
      submittedAt: f.submitted_at,
    })),
  }
}