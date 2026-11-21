import { describe, it, expect, vi, afterEach } from 'vitest'

// An in-memory general_settings, recording every write.
const db = vi.hoisted(() => ({
  settings: new Map<string, string>(),
  writes: [] as { table: string; row: unknown }[],
}))

function fakeClient() {
  return {
    from(table: string) {
      const filters: Record<string, unknown> = {}
      const chain = {
        select: () => chain,
        eq: (col: string, v: unknown) => ((filters[col] = v), chain),
        maybeSingle: async () => {
          const value = table === 'general_settings' ? db.settings.get(filters.key as string) : undefined
          return { data: value ? { value } : null, error: null }
        },
        upsert: async (row: Record<string, unknown>) => {
          db.writes.push({ table, row })
          if (table === 'general_settings') db.settings.set(row.key as string, row.value as string)
          return { error: null }
        },
        update: (row: unknown) => {
          db.writes.push({ table, row })
          return { eq: async () => ({ error: null }) }
        },
      }
      return chain
    },
  }
}

vi.mock('@/lib/supabase/admin', () => ({ createAdminSupabaseClient: () => fakeClient() }))
vi.mock('@/lib/supabase/server', () => ({ createServerSupabaseClient: async () => fakeClient() }))

import { runBackupMailboxHealthCheck } from './backupHealth'
import { MAIL_ACCOUNTS } from './accounts'
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

  describe('with the code-defined accounts', () => {
    afterEach(() => vi.unstubAllEnvs())

    it('saves a refused backup as needs_reauth by email, skips one without a token, and writes no credential', async () => {
      db.settings.clear()
      db.writes.length = 0
      vi.stubEnv('GOOGLE_CLIENT_ID', 'client-env.apps.googleusercontent.com')
      vi.stubEnv('GOOGLE_CLIENT_SECRET', 'env-client-secret')
      vi.stubEnv('GOOGLE_SENDER_EMAIL', '')
      vi.stubEnv('GOOGLE_REFRESH_TOKEN', '')
      vi.stubEnv('GOOGLE_REFRESH_TOKEN_PEOPLE', 'people-token-1111')
      vi.stubEnv('GOOGLE_REFRESH_TOKEN_AUTOMATIONS_PNC', 'automations-pnc-token-2222')
      vi.stubEnv('GOOGLE_REFRESH_TOKEN_AUTOMATION', '')
      const [, backup1, backup2] = MAIL_ACCOUNTS

      const { getGoogleWorkspaceAccountsInternal } = await import('./accounts')
      const pinged: string[] = []
      const report = await runBackupMailboxHealthCheck({
        pingAccount: async (accountId): Promise<EmailPingResult> => {
          pinged.push(accountId)
          const acc = (await getGoogleWorkspaceAccountsInternal()).find((a) => a.id === accountId)!
          if (!acc.refresh_token) return { ok: false, status: 'not_configured', message: 'Missing credentials' }
          return { ok: false, status: 'error', message: 'invalid_grant' }
        },
      })

      expect(pinged).toEqual([backup1.id, backup2.id])
      expect(report).toEqual({ checked: 2, connected: 0, needsReauth: 1, skipped: 1 })

      const row = JSON.parse(db.settings.get('google_workspace_accounts')!) as Record<string, unknown>[]
      expect(row.find((r) => r.email === backup1.email)).toMatchObject({ status: 'needs_reauth', error_message: 'invalid_grant' })
      const written = JSON.stringify(db.writes)
      expect(written).not.toContain('token-1111')
      expect(written).not.toContain('token-2222')
      expect(written).not.toContain('env-client-secret')
      expect(written).not.toContain('refresh_token')

      const after = await getGoogleWorkspaceAccountsInternal()
      expect(after.find((a) => a.id === backup1.id)?.status).toBe('needs_reauth')
    })
  })
})
