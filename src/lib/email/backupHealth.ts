import {
  getGoogleWorkspaceAccountsInternal,
  saveGoogleWorkspaceAccountsInternal,
} from '@/lib/email/accounts'
import { pingEmailProvider, type EmailPingResult } from '@/lib/email/sendEmail'
import type { GoogleWorkspaceAccount } from '@/lib/settings/types'

export interface BackupMailboxHealthReport {
  checked: number
  connected: number
  needsReauth: number
  skipped: number
}

export interface BackupMailboxHealthDeps {
  getAccounts?: () => Promise<GoogleWorkspaceAccount[]>
  pingAccount?: (accountId: string) => Promise<EmailPingResult>
  saveAccounts?: (accounts: GoogleWorkspaceAccount[]) => Promise<{ success: boolean; error?: string }>
}

/**
 * Pings every configured backup Google Workspace mailbox so unused OAuth
 * refresh tokens do not silently expire after six months of inactivity.
 *
 * Marks any backup whose token is refused as `needs_reauth` on Manage -> Emails,
 * and restores `connected` if a previously flagged backup succeeds again.
 * Returns counts only.
 */
export async function runBackupMailboxHealthCheck(
  deps: BackupMailboxHealthDeps = {},
): Promise<BackupMailboxHealthReport> {
  const getAccounts = deps.getAccounts ?? getGoogleWorkspaceAccountsInternal
  const pingAccount = deps.pingAccount ?? ((accountId: string) => pingEmailProvider(accountId))
  const saveAccounts =
    deps.saveAccounts ??
    ((accounts: GoogleWorkspaceAccount[]) =>
      saveGoogleWorkspaceAccountsInternal(accounts, {
        changedBy: 'system:cron:email-backup-ping',
        canWriteCredentials: false,
      }))

  const accounts = await getAccounts()
  const backups = accounts.filter((acc) => !acc.is_active)

  const report: BackupMailboxHealthReport = {
    checked: backups.length,
    connected: 0,
    needsReauth: 0,
    skipped: 0,
  }

  if (backups.length === 0) {
    return report
  }

  const updates = new Map<string, Pick<GoogleWorkspaceAccount, 'status' | 'error_message'>>()

  for (const acc of backups) {
    const res = await pingAccount(acc.id)

    if (res.status === 'not_configured') {
      report.skipped += 1
      continue
    }

    if (res.ok) {
      report.connected += 1
      if (acc.status !== 'connected' || acc.error_message) {
        updates.set(acc.id, { status: 'connected', error_message: null })
      }
      continue
    }

    report.needsReauth += 1
    const nextMessage = res.message || 'OAuth refresh token refused or expired'
    if (acc.status !== 'needs_reauth' || acc.error_message !== nextMessage) {
      updates.set(acc.id, { status: 'needs_reauth', error_message: nextMessage })
    }
  }

  if (updates.size > 0) {
    const nextAccounts = accounts.map((acc) => {
      const patch = updates.get(acc.id)
      return patch ? { ...acc, ...patch } : acc
    })
    const saved = await saveAccounts(nextAccounts)
    if (!saved.success) {
      throw new Error(saved.error || 'Failed to save backup mailbox status')
    }
  }

  return report
}

