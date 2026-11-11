import { createServerSupabaseClient } from '@/lib/supabase/server'
import { guard, passes } from '@/lib/rbac/guard'
import { isNominatedPeer } from './access'

export type PeerFeedbackRequest = {
  id: string
  confirmation_id: string
  peer_employee_id: string | null
  peer_email: string | null
  response_status: string
  confirmations: { employee_id: string; employees: { name: string | null } | null } | null
}

export async function getPeerFeedback(peerFeedbackId: string): Promise<PeerFeedbackRequest | null> {
  const allowed = await guard('self')
  if (!allowed.ok) return null

  const supabase = await createServerSupabaseClient()
  // Only what the feedback page shows. The written text stays out even for
  // the peer who wrote it: the page never displays it back.
  const { data, error } = await supabase
    .from('peer_feedback')
    .select('id, confirmation_id, peer_employee_id, peer_email, response_status, confirmations(employee_id)')
    .eq('id', peerFeedbackId)
    .single()

  if (error) {
    console.error('Error fetching peer feedback:', error.message)
    return null
  }

  // The request belongs to the peer it was sent to. P&C admins may open it to
  // see where it stands; nobody else may, the employee under review included.
  const isAdmin = passes(allowed.caller, ['super_admin', 'pnc_admin'])
  if (!isAdmin && !(await isNominatedPeer(supabase, data))) return null

  // The person under review is a colleague of the peer, so their name comes
  // from the directory rather than their record.
  // The embedded row is to-one; the generated select type cannot tell.
  const confirmation = (data as unknown as { confirmations: { employee_id: string } | null }).confirmations
  let subjectName: string | null = null
  if (confirmation?.employee_id) {
    const { data: person } = await supabase.from('directory').select('name').eq('id', confirmation.employee_id).maybeSingle()
    subjectName = (person?.name as string | undefined) ?? null
  }

  return {
    ...(data as unknown as Omit<PeerFeedbackRequest, 'confirmations'>),
    confirmations: confirmation ? { employee_id: confirmation.employee_id, employees: { name: subjectName } } : null,
  }
}
