import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { GoogleWorkspaceAccount } from '@/lib/settings/types'

// An in-memory stand-in for the two tables, recording every write.
const db = vi.hoisted(() => ({
  settings: new Map<string, { value: string; is_active: boolean }>(),
  credentials: new Map<string, { account_id: string; client_secret: string | null; refresh_token: string | null }>(),
  writes: [] as { table: string; op: string; row: unknown }[],
  admin: true,
}))

function fakeClient() {
  return {
    from(table: string) {
      const filters: Record<string, unknown> = {}
      let inIds: string[] | null = null
      const rows = () => {
        if (table === 'general_settings') {
          const r = db.settings.get(filters.key as string)
          return r ? [{ key: filters.key, ...r }] : []
        }
        if (table === 'mail_account_credentials') {
          return [...db.credentials.values()].filter((r) => !inIds || inIds.includes(r.account_id))
        }
        return []
      }
      const chain = {
        select: () => chain,
        eq: (col: string, v: unknown) => ((filters[col] = v), chain),
        in: (_col: string, ids: string[]) => ((inIds = ids), chain),
        maybeSingle: async () => ({ data: rows()[0] ?? null, error: null }),
        then: (resolve: (v: unknown) => void) => resolve({ data: rows(), error: null }),
        upsert: async (row: Record<string, unknown>) => {
          db.writes.push({ table, op: 'upsert', row })
          if (table === 'general_settings') db.settings.set(row.key as string, { value: row.value as string, is_active: true })
          if (table === 'mail_account_credentials') db.credentials.set(row.account_id as string, row as never)
          return { error: null }
        },
        update: (row: unknown) => {
          db.writes.push({ table, op: 'update', row })
          return { eq: async () => ({ error: null }) }
        },
        delete: () => ({
          in: async (_col: string, ids: string[]) => {
            db.writes.push({ table, op: 'delete', row: ids })
            for (const id of ids) db.credentials.delete(id)
            return { error: null }
          },
        }),
      }
      return chain
    },
  }
}

vi.mock('@/lib/supabase/admin', () => ({ createAdminSupabaseClient: () => (db.admin ? fakeClient() : null) }))
vi.mock('@/lib/supabase/server', () => ({ createServerSupabaseClient: async () => fakeClient() }))

import {
  CREDENTIAL_FIELDS,
  SECRET_MASK,
  getGoogleWorkspaceAccountsInternal,
  getOAuth2ClientForAccount,
  maskGoogleAccounts,
  resolveCredentials,
  saveGoogleWorkspaceAccountsInternal,
  toStoredAccount,
} from './accounts'

const account = (over: Partial<GoogleWorkspaceAccount> = {}): GoogleWorkspaceAccount => ({
  id: 'acc-1',
  name: 'Account A',
  email: 'sender@example.org',
  client_id: 'client-env.apps.googleusercontent.com',
  is_active: true,
  backup_priority: 0,
  status: 'connected',
  daily_send_limit: 2000,
  daily_sent_count: 0,
  ...over,
})

const ENV = {
  senderEmail: 'sender@example.org',
  clientId: 'client-env.apps.googleusercontent.com',
  clientSecret: 'env-client-secret',
  refreshToken: 'env-refresh-token-0001',
}

beforeEach(() => {
  db.settings.clear()
  db.credentials.clear()
  db.writes.length = 0
  db.admin = true
  vi.stubEnv('GOOGLE_SENDER_EMAIL', ENV.senderEmail)
  vi.stubEnv('GOOGLE_CLIENT_ID', ENV.clientId)
  vi.stubEnv('GOOGLE_CLIENT_SECRET', ENV.clientSecret)
  vi.stubEnv('GOOGLE_REFRESH_TOKEN', ENV.refreshToken)
})
afterEach(() => vi.unstubAllEnvs())

/** Every value written to general_settings, as text. */
const settingsWrites = () =>
  db.writes.filter((w) => w.table === 'general_settings').map((w) => JSON.stringify(w.row))

describe('maskGoogleAccounts', () => {
  const raw = [
    account({ client_secret: 'GOCSPX-super-secret-key', refresh_token: '1//042-very-secret-refresh-token' }),
    account({ id: 'acc-2', email: 'backup@example.org', is_active: false, backup_priority: 1 }),
  ]

  it('shows only that a credential is set', () => {
    const [a, b] = maskGoogleAccounts(raw)
    expect(a.client_secret).toBe(SECRET_MASK)
    expect(a.refresh_token).toBeUndefined()
    expect(a.refresh_token_preview).toBe(SECRET_MASK)
    expect(a.email).toBe('sender@example.org')
    expect(b.client_secret).toBeUndefined()
    expect(b.refresh_token_preview).toBeUndefined()
  })

  it('adds the last four characters for whoever may replace them, and nothing more', () => {
    const [a] = maskGoogleAccounts(raw, { showLast4: true })
    expect(a.refresh_token_preview).toBe('••••oken')
    expect(a.client_secret).toBe('••••-key')
    expect(JSON.stringify(a)).not.toContain('very-secret')
    expect(JSON.stringify(a)).not.toContain('super-secret')
  })
})

describe('toStoredAccount', () => {
  it('keeps no credential field', () => {
    const stored = toStoredAccount(
      account({ client_secret: 's', refresh_token: 't', refresh_token_preview: 'p' }),
    ) as Record<string, unknown>
    for (const field of CREDENTIAL_FIELDS) expect(stored).not.toHaveProperty(field)
    expect(stored.email).toBe('sender@example.org')
  })
})

describe('resolveCredentials', () => {
  it("uses the account's own stored token first", () => {
    const creds = resolveCredentials(account(), { account_id: 'acc-1', client_secret: 'own-secret', refresh_token: 'own-token' }, ENV)
    expect(creds).toEqual({ client_id: ENV.clientId, client_secret: 'own-secret', refresh_token: 'own-token' })
  })

  it("lets the environment's sender use the environment's token", () => {
    expect(resolveCredentials(account(), undefined, ENV).refresh_token).toBe(ENV.refreshToken)
    expect(resolveCredentials(account({ email: 'SENDER@example.org ' }), undefined, ENV).refresh_token).toBe(ENV.refreshToken)
  })

  it("never lends the environment's token to another mailbox", () => {
    const creds = resolveCredentials(account({ email: 'backup@example.org' }), undefined, ENV)
    expect(creds.refresh_token).toBeUndefined()
  })

  it("lends the environment's client secret only to accounts on the environment's client", () => {
    expect(resolveCredentials(account({ client_id: undefined }), undefined, ENV).client_secret).toBe(ENV.clientSecret)
    expect(resolveCredentials(account({ client_id: 'other-client' }), undefined, ENV).client_secret).toBeUndefined()
  })
})

describe('getOAuth2ClientForAccount', () => {
  it('refuses an account without its own credentials instead of borrowing one', () => {
    expect(() => getOAuth2ClientForAccount(account({ refresh_token: undefined, client_secret: 's' }))).toThrow(
      /no saved credentials/,
    )
  })
})

describe('saveGoogleWorkspaceAccountsInternal', () => {
  const save = (accounts: GoogleWorkspaceAccount[], canWriteCredentials = true) =>
    saveGoogleWorkspaceAccountsInternal(accounts, { changedBy: 'admin@example.org', canWriteCredentials })

  it('never writes a credential to general_settings', async () => {
    const res = await save([
      account({ client_secret: 'new-secret-value', refresh_token: 'new-refresh-token', refresh_token_preview: 'x' }),
      account({ id: 'acc-2', email: 'backup@example.org', is_active: false, backup_priority: 1, refresh_token: 'backup-token-9999' }),
    ])
    expect(res.success).toBe(true)
    const written = settingsWrites()
    expect(written.length).toBeGreaterThan(0)
    for (const w of written) {
      for (const field of CREDENTIAL_FIELDS) expect(w).not.toContain(field)
      expect(w).not.toContain('new-secret-value')
      expect(w).not.toContain('new-refresh-token')
      expect(w).not.toContain('backup-token-9999')
    }
  })

  it('stores newly entered credentials in the credentials table, per account', async () => {
    const res = await save([
      account({ client_secret: 'new-secret-value', refresh_token: 'new-refresh-token' }),
      account({ id: 'acc-2', email: 'backup@example.org', is_active: false, backup_priority: 1, refresh_token: 'backup-token-9999' }),
    ])
    expect(db.credentials.get('acc-1')).toMatchObject({ client_secret: 'new-secret-value', refresh_token: 'new-refresh-token' })
    expect(db.credentials.get('acc-2')).toMatchObject({ refresh_token: 'backup-token-9999' })
    expect(res.credentialsReplaced).toEqual(['acc-1', 'acc-2'])
    // The backup sends with its own token now, not the environment's.
    expect(res.accounts.find((a) => a.id === 'acc-2')?.refresh_token).toBe('backup-token-9999')
  })

  it('keeps a stored credential the browser sent back masked', async () => {
    await save([account({ refresh_token: 'first-token-1111', client_secret: 'first-secret' })])
    db.writes.length = 0
    await save([account({ refresh_token: '••••1111', client_secret: SECRET_MASK, name: 'Renamed' })])
    expect(db.credentials.get('acc-1')).toMatchObject({ refresh_token: 'first-token-1111', client_secret: 'first-secret' })
    expect(db.writes.some((w) => w.table === 'mail_account_credentials')).toBe(false)
  })

  it("drops credentials from a caller who may not set them, and says so", async () => {
    const res = await save([account({ refresh_token: 'sneaky-token-0000' })], false)
    expect(res.success).toBe(true)
    expect(res.credentialsDropped).toBe(true)
    expect(db.credentials.size).toBe(0)
    expect(settingsWrites().join()).not.toContain('sneaky-token-0000')
  })

  it("deletes a removed account's credentials", async () => {
    await save([
      account({ refresh_token: 'a-token-1111' }),
      account({ id: 'acc-2', email: 'backup@example.org', is_active: false, backup_priority: 1, refresh_token: 'b-token-2222' }),
    ])
    await save([account()])
    expect(db.credentials.has('acc-2')).toBe(false)
    expect(db.credentials.has('acc-1')).toBe(true)
  })

  it('refuses to take credentials without the service key rather than store them elsewhere', async () => {
    db.admin = false
    const res = await save([account({ refresh_token: 'token-without-key' })])
    expect(res.success).toBe(false)
    expect(db.writes).toHaveLength(0)
  })
})

describe('getGoogleWorkspaceAccountsInternal', () => {
  it('ignores credentials left in an old settings row', async () => {
    db.settings.set('google_workspace_accounts', {
      is_active: true,
      value: JSON.stringify([
        account({ id: 'acc-2', email: 'backup@example.org', refresh_token: 'left-behind-token', client_secret: 'left-behind' }),
      ]),
    })
    const [acc] = await getGoogleWorkspaceAccountsInternal()
    expect(acc.refresh_token).toBeUndefined()
    expect(acc.status).toBe('disconnected')
  })

  it('reads no credentials without the service key', async () => {
    db.credentials.set('acc-2', { account_id: 'acc-2', client_secret: 'x', refresh_token: 'stored-token' })
    db.settings.set('google_workspace_accounts', {
      is_active: true,
      value: JSON.stringify([account({ id: 'acc-2', email: 'backup@example.org' })]),
    })
    db.admin = false
    const [acc] = await getGoogleWorkspaceAccountsInternal()
    expect(acc.refresh_token).toBeUndefined()
  })
})
