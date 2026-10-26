// ============================================================================
// Gmail transport
// ----------------------------------------------------------------------------
// Deliberately NOT a 'use server' module. `sendEmail` takes any recipient, any
// subject and any HTML, so as a server action it would let any signed-in
// browser send arbitrary mail from the organisation's Google Workspace account.
// Only server code imports it — the lifecycle services, which decide who is
// written to and why, are the actions the browser may call.
// ============================================================================

import { google } from 'googleapis'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createAdminSupabaseClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'

const oAuth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET
)

oAuth2Client.setCredentials({
  refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
})

/**
 * A value safe to place in a mail header.
 *
 * A CR or LF in `To`, `Cc` or `Subject` ends that header and starts another,
 * so a name or subject carrying one could add a `Bcc:` line or replace the
 * body. Folding them to spaces keeps the value readable and on one line.
 */
function headerValue(value: string): string {
  return value.replace(/[\r\n]+/g, ' ').trim()
}

/** Escapes a value for interpolation into an email's HTML body. */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function createEmailBody(to: string, subject: string, htmlBody: string, cc?: string) {
  const senderEmail = process.env.GOOGLE_SENDER_EMAIL || 'sharmisthamazumdar24@navgurukul.org'
  const messageParts = [
    `From: ${senderEmail}`,
    `To: ${to}`,
    ...(cc ? [`Cc: ${cc}`] : []),
    'Content-Type: text/html; charset=utf-8',
    'MIME-Version: 1.0',
    `Subject: ${subject}`,
    '',
    htmlBody,
  ]
  const message = messageParts.join('\n')

  return Buffer.from(message)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

function getCategoryFromTemplate(template: string): 'onboarding' | 'confirmation' | 'appraisal' | 'offboarding' | 'system' {
  const t = template.toLowerCase()
  if (t.includes('offer') || t.includes('onboard') || t.includes('welcome') || t.includes('buddy') || t.includes('provision')) {
    return 'onboarding'
  }
  if (t.includes('peer') || t.includes('confirm') || t.includes('probation')) {
    return 'confirmation'
  }
  if (t.includes('appraisal') || t.includes('review') || t.includes('cycle') || t.includes('feedback')) {
    return 'appraisal'
  }
  if (t.includes('resign') || t.includes('clearance') || t.includes('offboard') || t.includes('exit')) {
    return 'offboarding'
  }
  return 'system'
}

export async function sendEmail(
  template: string,
  data: Record<string, string>,
  recipient: string
) {
  const subject = headerValue(data.subject || `Notification: ${template}`)
  const to = headerValue(recipient)
  const cc = data.cc ? headerValue(data.cc) : undefined
  const htmlBody = data.body || `<p>You have a new notification: ${template}</p>`
  const category = getCategoryFromTemplate(template)
  const notificationType = template
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())

  try {
    const gmail = google.gmail({ version: 'v1', auth: oAuth2Client })
    const raw = createEmailBody(to, subject, htmlBody, cc)

    const response = await gmail.users.messages.send({
      userId: 'me',
      requestBody: { raw },
    })

    const messageId = response.data.id || 'msg-sent'

    // Automatically record real successful dispatch in database. The id is the
    // table's own (a uuid default); a made-up text id made every insert fail.
    try {
      // Service-role when available: reminders are sent from cron runs, which
      // have no session, and the database refuses the anonymous role.
      const supabase = createAdminSupabaseClient() ?? (await createServerSupabaseClient())
      await supabase.from('email_delivery_logs').insert({
        recipient_name: data.recipient_name || to.split('@')[0],
        recipient_email: to,
        recipient_role: data.recipient_role || null,
        category,
        notification_type: notificationType,
        subject,
        body_preview: htmlBody.replace(/<[^>]*>?/gm, '').substring(0, 200),
        status: 'delivered',
        error_message: null,
        sent_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
      })
    } catch (logErr) {
      console.warn('Could not insert to email_delivery_logs:', logErr)
    }

    try {
      revalidatePath('/manage/emails')
    } catch {
      // ignore
    }

    return { success: true, messageId }
  } catch (error: any) {
    // The message and code only. A Gmail client error carries the request it
    // failed on — the OAuth bearer token in its headers and the whole message
    // in its body — and none of that belongs in a log.
    const errorMsg = error?.message || 'Unknown error'
    console.error('Error sending email:', errorMsg, error?.code ?? '')

    // Automatically record failure in database
    try {
      // Service-role when available: reminders are sent from cron runs, which
      // have no session, and the database refuses the anonymous role.
      const supabase = createAdminSupabaseClient() ?? (await createServerSupabaseClient())
      await supabase.from('email_delivery_logs').insert({
        recipient_name: data.recipient_name || to.split('@')[0],
        recipient_email: to,
        recipient_role: data.recipient_role || null,
        category,
        notification_type: notificationType,
        subject,
        body_preview: htmlBody.replace(/<[^>]*>?/gm, '').substring(0, 200),
        status: 'failed',
        error_message: errorMsg,
        sent_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
      })
    } catch {
      // ignore
    }

    try {
      revalidatePath('/manage/emails')
    } catch {
      // ignore
    }

    return { success: false, error: errorMsg }
  }
}

/**
 * Sends one meeting invitation to several people: an HTML note plus an
 * iCalendar REQUEST, which Gmail and Outlook render with Yes / No / Maybe and
 * add to the calendar. Each recipient is logged as a delivery, like any mail.
 */
export async function sendCalendarInvite(opts: {
  template: string
  subject: string
  html: string
  ics: string
  to: { name: string; email: string }[]
}) {
  const subject = headerValue(opts.subject)
  const to = opts.to.map((r) => headerValue(r.email)).filter(Boolean)
  if (to.length === 0) return { success: false, error: 'No recipients' }
  const senderEmail = process.env.GOOGLE_SENDER_EMAIL || 'sharmisthamazumdar24@navgurukul.org'
  const boundary = `elc-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
  const message = [
    `From: ${senderEmail}`,
    `To: ${to.join(', ')}`,
    `Subject: ${subject}`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    '',
    `--${boundary}`,
    'Content-Type: text/html; charset=utf-8',
    '',
    opts.html,
    `--${boundary}`,
    'Content-Type: text/calendar; charset=utf-8; method=REQUEST',
    'Content-Transfer-Encoding: 7bit',
    '',
    opts.ics,
    `--${boundary}--`,
    '',
  ].join('\r\n')
  const raw = Buffer.from(message).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

  let result: { success: true; messageId: string } | { success: false; error: string }
  try {
    const gmail = google.gmail({ version: 'v1', auth: oAuth2Client })
    const response = await gmail.users.messages.send({ userId: 'me', requestBody: { raw } })
    result = { success: true, messageId: response.data.id || 'msg-sent' }
  } catch (error: any) {
    const errorMsg = error?.message || 'Unknown error'
    console.error('Error sending calendar invite:', errorMsg, error?.code ?? '')
    result = { success: false, error: errorMsg }
  }

  try {
    const supabase = createAdminSupabaseClient() ?? (await createServerSupabaseClient())
    const now = new Date().toISOString()
    await supabase.from('email_delivery_logs').insert(
      opts.to.map((r) => ({
        recipient_name: r.name || r.email.split('@')[0],
        recipient_email: r.email,
        recipient_role: null,
        category: getCategoryFromTemplate(opts.template),
        notification_type: opts.template.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
        subject,
        body_preview: opts.html.replace(/<[^>]*>?/gm, '').substring(0, 200),
        status: result.success ? 'delivered' : 'failed',
        error_message: result.success ? null : result.error,
        sent_at: now,
        created_at: now,
      }))
    )
  } catch {
    // A failed log never fails the invitation.
  }

  return result
}

export type EmailPingResult = {
  ok: boolean
  status: 'connected' | 'error' | 'not_configured'
  message: string
  latencyMs?: number
  email?: string
  senderEmail?: string
}

export async function pingEmailProvider(): Promise<EmailPingResult> {
  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN
  const senderEmail = process.env.GOOGLE_SENDER_EMAIL || 'sharmisthamazumdar24@navgurukul.org'

  if (!clientId || !clientSecret || !refreshToken) {
    return {
      ok: false,
      status: 'not_configured',
      message: 'Google Workspace credentials missing in server environment variables (GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET / GOOGLE_REFRESH_TOKEN).',
      senderEmail,
    }
  }

  const start = Date.now()
  try {
    await oAuth2Client.getAccessToken()
    const latencyMs = Date.now() - start

    let detectedEmail = senderEmail
    try {
      const gmail = google.gmail({ version: 'v1', auth: oAuth2Client })
      const profile = await gmail.users.getProfile({ userId: 'me' })
      if (profile.data.emailAddress) {
        detectedEmail = profile.data.emailAddress
      }
    } catch {
      // getProfile may require read scope if token is scoped to gmail.send only.
      // Token acquisition itself proves valid credentials and connectivity.
    }

    return {
      ok: true,
      status: 'connected',
      message: `Google Workspace OAuth2 connected & authenticated successfully (${latencyMs}ms)`,
      latencyMs,
      email: detectedEmail,
      senderEmail,
    }
  } catch (err: any) {
    const latencyMs = Date.now() - start
    return {
      ok: false,
      status: 'error',
      message: err?.message || 'Failed to authenticate with Google Workspace API',
      latencyMs,
      senderEmail,
    }
  }
}