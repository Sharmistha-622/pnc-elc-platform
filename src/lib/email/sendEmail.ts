// ============================================================================
// Gmail transport with Multi-Account Failover
// ----------------------------------------------------------------------------
// Deliberately NOT a 'use server' module. `sendEmail` takes any recipient, any
// subject and any HTML, so as a server action it would let any signed-in
// browser send arbitrary mail from the organisation's Google Workspace account.
// Only server code imports it — the lifecycle services, which decide who is
// written to and why, are the actions the browser may call.
//
// Supports multiple Google Workspace accounts (e.g. Account A, B, C...) with
// priority-ordered automatic fallback if the active sender fails.
// ============================================================================

import { google } from 'googleapis'
import { logWriter } from '@/lib/logs/writer'
import { revalidatePath } from 'next/cache'
import {
  getGoogleWorkspaceAccountsInternal,
  getOAuth2ClientForAccount,
} from './accounts'

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

function createEmailBody(
  to: string,
  subject: string,
  htmlBody: string,
  cc?: string,
  senderEmail?: string
) {
  const from = senderEmail || process.env.GOOGLE_SENDER_EMAIL || 'sharmisthamazumdar24@navgurukul.org'
  const messageParts = [
    `From: ${from}`,
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

/**
 * Dispatches an email using the active Google Workspace account, with
 * automatic sequential failover to configured backup accounts (B, C...)
 * if the primary dispatch fails.
 */
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

  // Retrieve multi-account configuration
  const accounts = await getGoogleWorkspaceAccountsInternal()
  const activeAccount = accounts.find((a) => a.is_active) || accounts[0]
  const backupAccounts = accounts
    .filter((a) => a.id !== activeAccount.id)
    .sort((a, b) => (a.backup_priority || 0) - (b.backup_priority || 0))

  const attemptChain = [activeAccount, ...backupAccounts]
  let lastError: string | null = null

  for (let i = 0; i < attemptChain.length; i++) {
    const acc = attemptChain[i]
    const isBackup = i > 0

    try {
      const oAuth2Client = getOAuth2ClientForAccount(acc)
      const gmail = google.gmail({ version: 'v1', auth: oAuth2Client })
      const raw = createEmailBody(to, subject, htmlBody, cc, acc.email)

      const response = await gmail.users.messages.send({
        userId: 'me',
        requestBody: { raw },
      })

      const messageId = response.data.id || 'msg-sent'

      // Automatically record real successful dispatch in database.
      try {
        const supabase = logWriter()
        await supabase?.from('email_delivery_logs').insert({
          recipient_name: data.recipient_name || to.split('@')[0],
          recipient_email: to,
          recipient_role: data.recipient_role || null,
          category,
          notification_type: notificationType,
          subject,
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
      } catch {}

      return {
        success: true,
        messageId,
        accountUsed: acc.name,
        senderEmail: acc.email,
        isBackup,
      }
    } catch (error: any) {
      const errorMsg = error?.message || 'Unknown error'
      lastError = errorMsg
      console.warn(`[sendEmail] Attempt via ${acc.name} (${acc.email}) failed: ${errorMsg}`)

      // If there are more backup accounts, failover to the next one!
      if (i < attemptChain.length - 1) {
        const nextAcc = attemptChain[i + 1]
        console.info(
          `[sendEmail Failover] Failing over to next backup: ${nextAcc.name} (${nextAcc.email})`
        )
        continue
      }
    }
  }

  // All accounts failed: record final failure in database
  try {
    const supabase = logWriter()
    await supabase?.from('email_delivery_logs').insert({
      recipient_name: data.recipient_name || to.split('@')[0],
      recipient_email: to,
      recipient_role: data.recipient_role || null,
      category,
      notification_type: notificationType,
      subject,
      status: 'failed',
      error_message: `All Google accounts failed. Last error (${attemptChain[attemptChain.length - 1]?.name}): ${lastError}`,
      sent_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
    })
  } catch {}

  try {
    revalidatePath('/manage/emails')
  } catch {}

  return {
    success: false,
    error: `All configured Google accounts failed to send. Last error: ${lastError}`,
  }
}

/**
 * Sends one meeting invitation to several people: an HTML note plus an
 * iCalendar REQUEST, which Gmail and Outlook render with Yes / No / Maybe and
 * add to the calendar. Each recipient is logged as a delivery, like any mail.
 * Supports automated failover to backup Google accounts if the primary sender fails.
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

  // Retrieve multi-account configuration
  const accounts = await getGoogleWorkspaceAccountsInternal()
  const activeAccount = accounts.find((a) => a.is_active) || accounts[0]
  const backupAccounts = accounts
    .filter((a) => a.id !== activeAccount.id)
    .sort((a, b) => (a.backup_priority || 0) - (b.backup_priority || 0))

  const attemptChain = [activeAccount, ...backupAccounts]
  let result: { success: true; messageId: string } | { success: false; error: string } = {
    success: false,
    error: 'No accounts configured',
  }

  for (let i = 0; i < attemptChain.length; i++) {
    const acc = attemptChain[i]
    const senderEmail = acc.email || process.env.GOOGLE_SENDER_EMAIL || 'sharmisthamazumdar24@navgurukul.org'
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
    const raw = Buffer.from(message)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '')

    try {
      const oAuth2Client = getOAuth2ClientForAccount(acc)
      const gmail = google.gmail({ version: 'v1', auth: oAuth2Client })
      const response = await gmail.users.messages.send({ userId: 'me', requestBody: { raw } })
      result = { success: true, messageId: response.data.id || 'msg-sent' }
      break
    } catch (err: any) {
      const errorMsg = err?.message || 'Unknown calendar invite error'
      result = { success: false, error: errorMsg }
      console.warn(`[sendCalendarInvite] Attempt via ${acc.name} (${acc.email}) failed: ${errorMsg}`)

      if (i < attemptChain.length - 1) {
        continue
      }
    }
  }

  const now = new Date().toISOString()
  try {
    const supabase = logWriter()
    await supabase?.from('email_delivery_logs').insert(
      opts.to.map((r) => ({
        recipient_name: r.name || r.email.split('@')[0],
        recipient_email: r.email,
        recipient_role: null,
        category: getCategoryFromTemplate(opts.template),
        notification_type: opts.template.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
        subject,
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
  accountName?: string
}

/**
 * Pings Google Workspace API to verify OAuth credentials.
 * If accountId is provided, tests that specific account; otherwise tests the active account.
 */
export async function pingEmailProvider(accountId?: string): Promise<EmailPingResult> {
  const accounts = await getGoogleWorkspaceAccountsInternal()
  const target = accountId ? accounts.find((a) => a.id === accountId) || accounts[0] : accounts.find((a) => a.is_active) || accounts[0]

  if (!target) {
    return {
      ok: false,
      status: 'not_configured',
      message: 'No Google Workspace account configured.',
    }
  }

  const clientId = target.client_id || process.env.GOOGLE_CLIENT_ID
  const clientSecret = target.client_secret || process.env.GOOGLE_CLIENT_SECRET
  const refreshToken = target.refresh_token || process.env.GOOGLE_REFRESH_TOKEN
  const senderEmail = target.email || process.env.GOOGLE_SENDER_EMAIL || 'sharmisthamazumdar24@navgurukul.org'

  if (!clientId || !clientSecret || !refreshToken) {
    return {
      ok: false,
      status: 'not_configured',
      message: `${target.name} credentials missing OAuth2 refresh token or client secret.`,
      senderEmail,
      accountName: target.name,
    }
  }

  const start = Date.now()
  try {
    const oAuth2Client = getOAuth2ClientForAccount(target)
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
    }

    return {
      ok: true,
      status: 'connected',
      message: `${target.name} (${detectedEmail}) authenticated successfully (${latencyMs}ms)`,
      latencyMs,
      email: detectedEmail,
      senderEmail,
      accountName: target.name,
    }
  } catch (err: any) {
    const latencyMs = Date.now() - start
    return {
      ok: false,
      status: 'error',
      message: `${target.name} failed: ${err?.message || 'Authentication error'}`,
      latencyMs,
      senderEmail,
      accountName: target.name,
    }
  }
}
