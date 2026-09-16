'use server'

import { createServerSupabaseClient } from '@/lib/supabase/server'
import { sendEmail } from '@/lib/email/sendEmail'

export async function nominatePeers(
  confirmationId: string,
  peers: { name: string; employeeId?: string; email?: string }[]
) {
  const supabase = createServerSupabaseClient()
   const rows = peers.map((peer) => ({
    confirmation_id: confirmationId,
    peer_name: peer.name,
    peer_email: peer.email || null,
    peer_employee_id: peer.employeeId || null,
    response_status: 'pending',
  }))

  const { data, error } = await supabase
    .from('peer_feedback')
    .insert(rows)
    .select()

  if (error) {
    console.error('Error nominating peers:', error.message, error.details, error.hint)
    return null
  }

  // Send notification email to each peer that has an email address
  for (let i = 0; i < peers.length; i++) {
    const peer = peers[i]
    const feedbackRecord = data?.[i]

    if (peer.email && feedbackRecord) {
      const feedbackLink = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/feedback/${feedbackRecord.id}`

      await sendEmail(
        'peer_feedback_request',
        {
          subject: 'Peer Feedback Requested',
          body: `<p>Hi ${peer.name},</p><p>You've been nominated to provide feedback as part of a confirmation review. Please share your feedback using the link below:</p><p><a href="${feedbackLink}">${feedbackLink}</a></p><p>Thank you!</p>`,
        },
        peer.email
      )
    }
  }

  return data
}