'use server'

import { google } from 'googleapis'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

const oAuth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET
)

oAuth2Client.setCredentials({
  refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
})

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
  const subject = data.subject || `Notification: ${template}`
  const htmlBody = data.body || `<p>You have a new notification: ${template}</p>`
  const newLogId = `log-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`
  const category = getCategoryFromTemplate(template)
  const notificationType = template
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())

  try {
    const gmail = google.gmail({ version: 'v1', auth: oAuth2Client })
    const raw = createEmailBody(recipient, subject, htmlBody, data.cc)

    const response = await gmail.users.messages.send({
      userId: 'me',
      requestBody: { raw },
    })

    const messageId = response.data.id || 'msg-sent'

    // Automatically record real successful dispatch in database
    try {
      const supabase = await createServerSupabaseClient()
      await supabase.from('email_delivery_logs').insert({
        id: newLogId,
        recipient_name: data.recipient_name || recipient.split('@')[0],
        recipient_email: recipient,
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
    console.error('Error sending email:', error)
    const errorMsg = error?.message || String(error)

    // Automatically record failure in database
    try {
      const supabase = await createServerSupabaseClient()
      await supabase.from('email_delivery_logs').insert({
        id: newLogId,
        recipient_name: data.recipient_name || recipient.split('@')[0],
        recipient_email: recipient,
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