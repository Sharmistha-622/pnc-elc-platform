'use server'

import { createServerSupabaseClient } from '@/lib/supabase/server'
import { escapeHtml, sendEmail } from '@/lib/email/sendEmail'
import { getNotificationSettings } from '@/lib/settings/service'
import { auditPeerFeedback } from '@/lib/audit/events'
import { resolveSubjectFromConfirmation } from '@/lib/audit/subject'
import { guard } from '@/lib/rbac/guard'
import { FEATURE_ACCESS } from '@/lib/role-constants'
import { isAllowedEmail } from '@/lib/auth/allowedEmail'
import { confirmationEmployeeId, mayActOnConfirmationOf } from './access'

export async function nominatePeers(
  confirmationId: string,
  peers: { name: string; employeeId?: string; email?: string }[]
) {
  // Nominating is part of starting a confirmation, and each nomination sends
  // an email, so it is gated as tightly: P&C for anyone, and a line manager
  // (whatever their role) only on a confirmation about one of their reports.
  const allowed = await guard('dashboard')
  if (!allowed.ok) return null

  const supabase = await createServerSupabaseClient()
  const subjectId = await confirmationEmployeeId(supabase, confirmationId)
  if (!(await mayActOnConfirmationOf(supabase, allowed.caller, subjectId, FEATURE_ACCESS.confirmationsInitiate))) {
    return null
  }

  // A peer answers by signing in, and only organisation accounts can. Anyone
  // else would be emailed a link they could never use, and their feedback
  // would never arrive.
  if (peers.some((peer) => peer.email && !isAllowedEmail(peer.email))) return null

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

  const notificationSettings = await getNotificationSettings().catch(() => null)
  const subject = notificationSettings?.peer_request_subject || 'Peer Feedback Requested'

  // Send notification email to each peer that has an email address
  for (let i = 0; i < peers.length; i++) {
    const peer = peers[i]
    const feedbackRecord = data?.[i]

    if (peer.email && feedbackRecord) {
      const feedbackLink = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/feedback/${feedbackRecord.id}`

      await sendEmail(
        'peer_feedback_request',
        {
          subject,
          body: `<p>Hi ${escapeHtml(peer.name)},</p><p>You've been nominated to provide feedback as part of a confirmation review. Please share your feedback using the link below:</p><p><a href="${feedbackLink}">${feedbackLink}</a></p><p>Thank you!</p>`,
        },
        peer.email
      )
    }
  }

  await auditPeerFeedback.requested({
    subject: await resolveSubjectFromConfirmation(confirmationId),
    entityId: confirmationId,
    entityType: 'confirmation',
    reviewerCount: peers.length,
    metadata: { peers: peers.map((p) => p.name) },
  })

  return data
}