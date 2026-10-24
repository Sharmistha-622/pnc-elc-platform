// Not a 'use server' module, and it must never become one. Its only caller is
// `/api/cron/peer-reminders`, which checks the cron secret first, and it runs
// on the service-role client: as a server action, any signed-in browser could
// set it off, with RLS out of the way.

import { createAdminSupabaseClient } from '@/lib/supabase/admin'
import { escapeHtml, sendEmail } from '@/lib/email/sendEmail'
import { DEFAULT_NOTIFICATION_SETTINGS, type NotificationSettings } from '@/lib/settings/types'
import { auditPeerFeedback } from '@/lib/audit/events'
import { resolveSubjectFromConfirmation } from '@/lib/audit/subject'

export async function sendPeerReminders() {
  // The scheduler has no user session, so the ordinary server client would
  // act as `anon`, which holds no table privileges.
  const supabase = createAdminSupabaseClient()
  if (!supabase) {
    return {
      success: false,
      error: 'Peer reminders are unavailable: SUPABASE_SERVICE_ROLE_KEY is not configured.',
    }
  }

  // Read here rather than through `getNotificationSettings`, which uses the
  // session client: its failure falls back to the defaults, where reminders
  // are on, and would quietly override an admin who switched them off.
  const { data: storedSettings } = await supabase
    .from('notification_settings')
    .select('*')
    .limit(1)
    .maybeSingle()
  const notificationSettings: NotificationSettings = {
    ...DEFAULT_NOTIFICATION_SETTINGS,
    ...(storedSettings ?? {}),
  }
  if (!notificationSettings.peer_reminder_enabled) {
    return { success: true, remindersSent: 0, message: 'Peer reminders are disabled in settings' }
  }

  const { data: pendingFeedback, error } = await supabase
    .from('peer_feedback')
    .select('*')
    .eq('response_status', 'pending')

  if (error) {
    console.error('Error fetching pending feedback:', error.message)
    return { success: false, error: error.message }
  }

  if (!pendingFeedback || pendingFeedback.length === 0) {
    return { success: true, remindersSent: 0 }
  }

  let remindersSent = 0
  const subject = notificationSettings.peer_reminder_subject || 'Reminder: Peer Feedback Requested'

  for (const feedback of pendingFeedback) {
    if (!feedback.peer_email) continue

    const feedbackLink = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/feedback/${feedback.id}`

    const result = await sendEmail(
      'peer_feedback_reminder',
      {
        subject,
        body: `<p>Hi ${escapeHtml(feedback.peer_name ?? '')},</p><p>This is a friendly reminder to share your feedback:</p><p><a href="${feedbackLink}">${feedbackLink}</a></p><p>Thank you!</p>`,
      },
      feedback.peer_email
    )

    if (result.success) {
      remindersSent++
      await supabase
        .from('peer_feedback')
        .update({ response_status: 'reminded' })
        .eq('id', feedback.id)

      // Recorded against the employee under review, not the peer reminded.
      await auditPeerFeedback.reminded({
        subject: await resolveSubjectFromConfirmation(feedback.confirmation_id),
        actorType: 'system',
        entityId: feedback.id,
        entityType: 'peer_feedback',
        reviewer: feedback.peer_name,
      })
    }
  }

  return { success: true, remindersSent }
}
