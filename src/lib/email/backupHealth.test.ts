import { describe, it, expect, vi } from 'vitest'
import { runBackupMailboxHealthCheck } from './backupHealth'
import type { GoogleWorkspaceAccount } from '@/lib/settings/types'
import type { EmailPingResult } from './sendEmail'

function makeAccount(overrides: Partial<GoogleWorkspaceAccount>): GoogleWorkspaceAccount {
  return {
    id: 'acc-b',
    name: 'Account B',
    email: 'backup@example.org',
    is_active: false,
    backup_priority: 1,
    status: 'connected',
    daily_send_limit: 2000,
    daily_sent_count: 0,
    last_used_at: null,
    error_message: null,
    ...overrides,
  }
}

describe('runBackupMailboxHealthCheck', () => {
  it('pings only backup accounts and marks an account whose token is refused as needs_reauth', async () => {
    const accounts: GoogleWorkspaceAccount[] = [
      makeAccount({ id: 'acc-a', name: 'Account A (Primary)', email: 'primary@example.org', is_active: true, backup_priority: 0 }),
      makeAccount({ id: 'acc-b', name: 'Account B', email: 'backup-b@example.org', backup_priority: 1, status: 'connected' }),
      makeAccount({ id: 'acc-c', name: 'Account C', email: 'backup-c@example.org', backup_priority: 2, status: 'connected' }),
    ]

    const pinged: string[] = []
    let savedAccounts: GoogleWorkspaceAccount[] | null = null

    const report = await runBackupMailboxHealthCheck({
      getAccounts: async () => accounts,
      pingAccount: async (accountId): Promise<EmailPingResult> => {
        pinged.push(accountId)
        if (accountId === 'acc-b') {
          return {
            ok: false,
            status: 'error',
            message: 'Account B failed: invalid_grant',
          }
        }
        return {
          ok: true,
          status: 'connected',
          message: 'Account C authenticated successfully',
        }
      },
      saveAccounts: async (next) => {
        savedAccounts = next
        return { success: true }
      },
    })

    expect(pinged).toEqual(['acc-b', 'acc-c'])
    expect(report).toEqual({
      checked: 2,
      connected: 1,
      needsReauth: 1,
      skipped: 0,
    })

    expect(savedAccounts).not.toBeNull()
    const b = savedAccounts!.find((a) => a.id === 'acc-b')
    const c = savedAccounts!.find((a) => a.id === 'acc-c')
    expect(b?.status).toBe('needs_reauth')
    expect(b?.error_message).toBe('Account B failed: invalid_grant')
    expect(c?.status).toBe('connected')
  })

  it('restores connected status and clears error_message when a flagged backup succeeds again', async () => {
    const accounts: GoogleWorkspaceAccount[] = [
      makeAccount({ id: 'acc-a', is_active: true, backup_priority: 0 }),
      makeAccount({
        id: 'acc-b',
        status: 'needs_reauth',
        error_message: 'Account B failed: invalid_grant',
      }),
    ]

    let savedAccounts: GoogleWorkspaceAccount[] = []

    const report = await runBackupMailboxHealthCheck({
      getAccounts: async () => accounts,
      pingAccount: async () => ({
        ok: true,
        status: 'connected',
        message: 'Account B authenticated successfully',
      }),
      saveAccounts: async (next) => {
        savedAccounts = next
        return { success: true }
      },
    })

    expect(report).toEqual({ checked: 1, connected: 1, needsReauth: 0, skipped: 0 })
    expect(savedAccounts[1].status).toBe('connected')
    expect(savedAccounts[1].error_message).toBeNull()
  })

  it('skips unconfigured backup accounts without rewriting settings when nothing changed', async () => {
    const saveAccounts = vi.fn(async () => ({ success: true }))
    const report = await runBackupMailboxHealthCheck({
      getAccounts: async () => [
        makeAccount({ id: 'acc-a', is_active: true, backup_priority: 0 }),
        makeAccount({ id: 'acc-b', status: 'disconnected' }),
      ],
      pingAccount: async () => ({
        ok: false,
        status: 'not_configured',
        message: 'Missing credentials',
      }),
      saveAccounts,
    })

    expect(report).toEqual({ checked: 1, connected: 0, needsReauth: 0, skipped: 1 })
    expect(saveAccounts).not.toHaveBeenCalled()
  })
})

