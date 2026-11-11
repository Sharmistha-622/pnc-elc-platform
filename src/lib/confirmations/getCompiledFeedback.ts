import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createAdminSupabaseClient } from '@/lib/supabase/admin'
import { getActiveRedFlagKeywords, getPeerFeedbackSettings } from '@/lib/settings/service'
import { guard } from '@/lib/rbac/guard'
import { isTeamScoped, managesEmployee, mayReadFeedbackText } from './access'

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
  /**
   * Who was asked, and whether they have answered. Never what they wrote:
   * peers are told their feedback is anonymous, so a name and a text are
   * never returned side by side.
   */
  peers: {
    id: string
    peerName: string
    responseStatus: string
    submittedAt: string | null
  }[]
  /**
   * What was written, detached from who wrote it and sorted by its own text
   * so the order says nothing about the list above. Null when the caller may
   * see statuses only.
   */
  responses: string[] | null
}

type FeedbackRow = {
  id: string
  peer_name: string | null
  response_status: string
  submitted_at: string | null
  feedback_text?: string | null
}

/**
 * Submitted texts, for the flagged-term check only, for a caller who may not
 * read them. Read with the service role after the caller's guard and team
 * check have passed; only whether a term matched leaves this file. Without the
 * service key there is nothing to check, and no keyword flag is raised.
 */
async function submittedTextsForFlagging(confirmationId: string): Promise<string[]> {
  const admin = createAdminSupabaseClient()
  if (!admin) return []
  const { data } = await admin
    .from('peer_feedback')
    .select('feedback_text')
    .eq('confirmation_id', confirmationId)
    .eq('response_status', 'submitted')
  return ((data ?? []) as { feedback_text: string | null }[]).map((r) => r.feedback_text ?? '')
}

// Fallback keyword list and threshold if settings are unseeded
const DEFAULT_RED_FLAG_KEYWORDS = ['concern', 'issue', 'problem', 'difficult', 'poor', 'unprofessional', 'late']
const DEFAULT_RESPONSE_THRESHOLD = 0.5

export async function getCompiledFeedback(confirmationId: string): Promise<CompiledFeedback | null> {
  // Written feedback is `performance` data. Everyone in `confirmations` may
  // open the report; what they get from it differs by role (see below).
  const allowed = await guard('confirmations')
  if (!allowed.ok) return null
  const canReadText = mayReadFeedbackText(allowed.caller)

  const supabase = await createServerSupabaseClient()

  const { data: confirmation, error: confirmationError } = await supabase
    .from('confirmations')
       .select('*, employees(name, employee_types(name))')
    .eq('id', confirmationId)
    .single()

  if (confirmationError || !confirmation) {
    console.error('Error fetching confirmation:', confirmationError?.message)
    return null
  }

  // A line manager reads the report for their own reports only.
  if (isTeamScoped(allowed.caller) && !(await managesEmployee(supabase, confirmation.employee_id))) {
    return null
  }

  // A status-only reader (PnC Ops) reads who was asked and who answered from
  // `peer_feedback_status`; the database gives them no text. Everyone else
  // reads the rows themselves.
  const { data: feedbackRows, error: feedbackError } = canReadText
    ? await supabase
        .from('peer_feedback')
        .select('id, peer_name, response_status, submitted_at, feedback_text')
        .eq('confirmation_id', confirmationId)
    : await supabase
        .from('peer_feedback_status')
        .select('id, peer_name, response_status, submitted_at')
        .eq('confirmation_id', confirmationId)

  if (feedbackError) {
    console.error('Error fetching feedback:', feedbackError.message)
    return null
  }

  const rows = (feedbackRows ?? []) as FeedbackRow[]
  const totalNominated = rows.length
  const submitted = rows.filter((f) => f.response_status === 'submitted')
  const totalSubmitted = submitted.length
  const totalPending = totalNominated - totalSubmitted

  // Fetch configured active red flag keywords and threshold
  const [activeKeywords, peerSettings] = await Promise.all([
    getActiveRedFlagKeywords().catch(() => []),
    getPeerFeedbackSettings().catch(() => null),
  ])

  const threshold = peerSettings?.red_flag_response_threshold ?? DEFAULT_RESPONSE_THRESHOLD
  const keywords = activeKeywords && activeKeywords.length > 0 ? activeKeywords : DEFAULT_RED_FLAG_KEYWORDS

  // Red flag logic: low response rate OR keyword match in any submitted feedback
  let redFlag = false
  let redFlagReason: string | null = null

  if (totalNominated > 0 && totalSubmitted / totalNominated < threshold) {
    redFlag = true
    redFlagReason = `Less than ${Math.round(threshold * 100)}% of nominated peers have responded`
  }

  const texts = canReadText
    ? submitted.map((f) => f.feedback_text ?? '')
    : await submittedTextsForFlagging(confirmationId)
  for (const entry of texts) {
    const text = entry.toLowerCase()
    const matchedKeyword = keywords.find((kw) => text.includes(kw.toLowerCase()))
    if (matchedKeyword) {
      redFlag = true
      // The matched term is a quotation from the text, so a status-only
      // reader is told only that there is one.
      redFlagReason = canReadText
        ? `Feedback contains flagged term: "${matchedKeyword}"`
        : 'Submitted feedback contains a flagged term'
      break
    }
  }

   return {
    confirmationId,
    employeeId: confirmation.employee_id,
    employeeName: confirmation.employees?.name || 'Unknown',
       employeeType: confirmation.employees?.employee_types?.name || 'Unknown',
    totalNominated,
    totalSubmitted,
    totalPending,
    redFlag,
    redFlagReason,
    peers: rows.map((f) => ({
      id: f.id,
      peerName: f.peer_name ?? '',
      responseStatus: f.response_status,
      submittedAt: f.submitted_at,
    })),
    responses: canReadText
      ? submitted
          .map((f) => f.feedback_text as string | null)
          .filter((t): t is string => Boolean(t && t.trim()))
          .sort((a, b) => a.localeCompare(b))
      : null,
  }
}
