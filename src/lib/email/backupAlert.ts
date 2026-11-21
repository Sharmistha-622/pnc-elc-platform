// ============================================================================
// Backup sender alert
// ----------------------------------------------------------------------------
// When a mail goes out from a backup account instead of the primary, PnC (the
// mailbox in Settings > Reviews) is told which account sent and why the
// primary did not, at most once a day. The alert names accounts and
// environment variables, never a credential.
// ============================================================================

import { createAdminSupabaseClient } from '@/lib/supabase/admin'
import type { GoogleWorkspaceAccount } from '@/lib/settings/types'
import type { CredentialEnv } from './accounts'
import { MAIL_ACCOUNTS } from './accounts'

const ALERT_KEY = 'email_backup_alert_last_sent'
const MAX_REASON_LENGTH = 300

export interface BackupSendEvent {
  primary: Pick<GoogleWorkspaceAccount, 'name' | 'email'>
  sentBy: Pick<GoogleWorkspaceAccount, 'name' | 'email'>
  /** Why the primary did not send: its error, or that it is not configured. */
  reason: string
}

export interface BackupAlertDeps {
  now?: Date
  env?: CredentialEnv
  /** Records today as alerted. True only for the first caller of the day. */
  claimDay?: (day: string) => Promise<boolean>
  getPncMailbox?: () => Promise<string | null>
  /** Sends the alert. Goes out from the account that just worked. */
  send: (to: string, subject: string, html: string) => Promise<void>
}

/** The calendar day in India, so the limit resets at local midnight. */
export function alertDay(now: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(now)
}

/**
 * The reason, safe to send: any credential from the environment replaced,
 * and cut to a readable length. Pure, for tests.
 */
export function redactReason(reason: string, env: CredentialEnv): string {
  const secrets = [
    env.GOOGLE_CLIENT_SECRET,
    env.GOOGLE_REFRESH_TOKEN,
    ...MAIL_ACCOUNTS.map((d) => env[d.tokenEnv]),
  ].filter((s): s is string => !!s && s.trim().length >= 4)
  let out = reason
  for (const secret of secrets) out = out.split(secret.trim()).join('[redacted]')
  out = out.replace(/\s+/g, ' ').trim()
  return out.length > MAX_REASON_LENGTH ? `${out.slice(0, MAX_REASON_LENGTH)}…` : out || 'Unknown error'
}

const escapeHtml = (value: string) =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')

/** The alert's subject and body. Pure, for tests. */
export function buildBackupAlert(event: BackupSendEvent, env: CredentialEnv): { subject: string; html: string } {
  const reason = redactReason(event.reason, env)
  return {
    subject: `Email sent from a backup account: ${event.sentBy.email}`,
    html: [
      '<p>Hello PnC team,</p>',
      `<p>Platform email is being sent from the backup account <strong>${escapeHtml(event.sentBy.name)}</strong> ` +
        `(${escapeHtml(event.sentBy.email)}) because the primary account, ${escapeHtml(event.primary.name)} ` +
        `(${escapeHtml(event.primary.email)}), could not send.</p>`,
      `<p><strong>Why the primary failed:</strong> ${escapeHtml(reason)}</p>`,
      '<p>Mail is still being delivered. To restore the primary, ask the platform team to check its refresh ' +
        'token in the environment and re-authorise it if needed. This alert is sent at most once a day.</p>',
    ].join('\n'),
  }
}

/** Atomic: of all callers on one day, only the first gets true. */
async function claimDayInSettings(day: string): Promise<boolean> {
  const db = createAdminSupabaseClient()
  if (!db) return false
  const now = new Date().toISOString()
  const updatedBy = 'system:email-failover'

  const { data: updated } = await db
    .from('general_settings')
    .update({ value: day, updated_at: now, updated_by: updatedBy })
    .eq('key', ALERT_KEY)
    .neq('value', day)
    .select('key')
  if (updated && updated.length > 0) return true

  const { data: inserted } = await db
    .from('general_settings')
    .upsert(
      {
        key: ALERT_KEY,
        value: day,
        value_type: 'text',
        category: 'email',
        label: 'Last backup sender alert',
        description: 'The day PnC was last told that mail went out from a backup account.',
        is_active: true,
        updated_at: now,
        updated_by: updatedBy,
      },
      { onConflict: 'key', ignoreDuplicates: true },
    )
    .select('key')
  return Boolean(inserted && inserted.length > 0)
}

async function pncMailboxFromSettings(): Promise<string | null> {
  const db = createAdminSupabaseClient()
  if (!db) return null
  const { data } = await db
    .from('review_cycle_settings')
    .select('pnc_notification_email')
    .eq('id', 'default')
    .maybeSingle()
  const raw = (data as { pnc_notification_email?: string | null } | null)?.pnc_notification_email ?? ''
  return (
    raw
      .split(',')
      .map((s) => s.trim())
      .find((s) => /^[^@\s]+@[^@\s]+$/.test(s)) ?? null
  )
}

/**
 * Tells PnC that a backup account sent, once a day at most. Never throws: an
 * alert that fails must not fail the mail that worked. Returns whether it sent.
 */
export async function alertPncOfBackupSend(event: BackupSendEvent, deps: BackupAlertDeps): Promise<boolean> {
  try {
    const env = deps.env ?? process.env
    const getMailbox = deps.getPncMailbox ?? pncMailboxFromSettings
    const claimDay = deps.claimDay ?? claimDayInSettings

    const to = await getMailbox()
    if (!to) return false
    if (!(await claimDay(alertDay(deps.now ?? new Date())))) return false

    const { subject, html } = buildBackupAlert(event, env)
    await deps.send(to, subject, html)
    return true
  } catch {
    console.warn('[sendEmail] Backup sender alert could not be sent')
    return false
  }
}
