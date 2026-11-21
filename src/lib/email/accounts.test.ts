import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { GoogleWorkspaceAccount } from '@/lib/settings/types'

// An in-memory stand-in for the database, recording every write and every
// table touched.
const db = vi.hoisted(() => ({
  settings: new Map<string, { value: string; is_active: boolean }>(),
  writes: [] as { table: string; op: string; row: unknown }[],
  tablesTouched: new Set<string>(),
  admin: true,
}))

function fakeClient() {
  return {
    from(table: string) {
      db.tablesTouched.add(table)
      const filters: Record<string, unknown> = {}
      const rows = () => {
        if (table === 'general_settings') {
          const r = db.settings.get(filters.key as string)
          return r ? [{ key: filters.key, ...r }] : []
        }
        return []
      }
      const chain = {
        select: () => chain,
        eq: (col: string, v: unknown) => ((filters[col] = v), chain),
        in: () => chain,
        maybeSingle: async () => ({ data: rows()[0] ?? null, error: null }),
        then: (resolve: (v: unknown) => void) => resolve({ data: rows(), error: null }),
        upsert: async (row: Record<string, unknown>) => {
          db.writes.push({ table, op: 'upsert', row })
          if (table === 'general_settings') db.settings.set(row.key as string, { value: row.value as string, is_active: true })
          return { error: null }
        },
        update: (row: unknown) => {
          db.writes.push({ table, op: 'update', row })
          return { eq: async () => ({ error: null }) }
        },
        delete: () => ({
          in: async (_col: string, ids: string[]) => {
            db.writes.push({ table, op: 'delete', row: ids })
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
  MAIL_ACCOUNTS,
  SECRET_MASK,
  buildAccount,
  getGoogleWorkspaceAccountsInternal,
  getOAuth2ClientForAccount,
  maskGoogleAccounts,
  resolveCredentials,
  saveGoogleWorkspaceAccountsInternal,
  sendingChain,
  toStoredStatus,
} from './accounts'

const [PEOPLE, AUTOMATIONS_PNC, AUTOMATION] = MAIL_ACCOUNTS

// Made-up values. Every token is distinct so a test can tell which was used.
const ENV = {
  GOOGLE_CLIENT_ID: 'client-env.apps.googleusercontent.com',
  GOOGLE_CLIENT_SECRET: 'env-client-secret',
  GOOGLE_REFRESH_TOKEN_PEOPLE: 'people-token-1111',
  GOOGLE_REFRESH_TOKEN_AUTOMATIONS_PNC: 'automations-pnc-token-2222',
  GOOGLE_REFRESH_TOKEN_AUTOMATION: 'automation-token-3333',
}

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

function stubEnv(env: Record<string, string | undefined>) {
  for (const key of [
    'GOOGLE_CLIENT_ID',
    'GOOGLE_CLIENT_SECRET',
    'GOOGLE_REFRESH_TOKEN',
    'GOOGLE_SENDER_EMAIL',
    ...MAIL_ACCOUNTS.map((d) => d.tokenEnv),
  ]) {
    vi.stubEnv(key, env[key] ?? '')
  }
}

beforeEach(() => {
  db.settings.clear()
  db.writes.length = 0
  db.tablesTouched.clear()
  db.admin = true
  stubEnv(ENV)
})
afterEach(() => vi.unstubAllEnvs())

/** Every value written anywhere, as text. */
const allWrites = () => db.writes.map((w) => JSON.stringify(w.row))

describe('MAIL_ACCOUNTS', () => {
  it('defines the three senders in fallback order, the first primary', () => {
    expect(MAIL_ACCOUNTS.map((d) => [d.tokenEnv, d.is_active, d.backup_priority])).toEqual([
      ['GOOGLE_REFRESH_TOKEN_PEOPLE', true, 0],
      ['GOOGLE_REFRESH_TOKEN_AUTOMATIONS_PNC', false, 1],
      ['GOOGLE_REFRESH_TOKEN_AUTOMATION', false, 2],
    ])
  })
})

describe('resolveCredentials (environment only)', () => {
  it("uses each account's own token and the shared OAuth client", () => {
    expect(resolveCredentials(PEOPLE, ENV)).toEqual({
      client_id: ENV.GOOGLE_CLIENT_ID,
      client_secret: ENV.GOOGLE_CLIENT_SECRET,
      refresh_token: ENV.GOOGLE_REFRESH_TOKEN_PEOPLE,
    })
    expect(resolveCredentials(AUTOMATIONS_PNC, ENV).refresh_token).toBe(ENV.GOOGLE_REFRESH_TOKEN_AUTOMATIONS_PNC)
    expect(resolveCredentials(AUTOMATION, ENV).refresh_token).toBe(ENV.GOOGLE_REFRESH_TOKEN_AUTOMATION)
  })

  it('falls back to GOOGLE_REFRESH_TOKEN for the GOOGLE_SENDER_EMAIL account only', () => {
    const env = {
      GOOGLE_CLIENT_ID: ENV.GOOGLE_CLIENT_ID,
      GOOGLE_CLIENT_SECRET: ENV.GOOGLE_CLIENT_SECRET,
      GOOGLE_REFRESH_TOKEN: 'legacy-token-0000',
      GOOGLE_SENDER_EMAIL: ` ${AUTOMATIONS_PNC.email.toUpperCase()} `,
    }
    expect(resolveCredentials(AUTOMATIONS_PNC, env).refresh_token).toBe('legacy-token-0000')
    expect(resolveCredentials(PEOPLE, env).refresh_token).toBeUndefined()
    expect(resolveCredentials(AUTOMATION, env).refresh_token).toBeUndefined()
  })

  it("prefers the account's own token to GOOGLE_REFRESH_TOKEN", () => {
    const env = { ...ENV, GOOGLE_REFRESH_TOKEN: 'legacy-token-0000', GOOGLE_SENDER_EMAIL: PEOPLE.email }
    expect(resolveCredentials(PEOPLE, env).refresh_token).toBe(ENV.GOOGLE_REFRESH_TOKEN_PEOPLE)
  })

  it('treats a blank token as unset', () => {
    expect(resolveCredentials(PEOPLE, { ...ENV, GOOGLE_REFRESH_TOKEN_PEOPLE: '  ' }).refresh_token).toBeUndefined()
  })
})

describe('getGoogleWorkspaceAccountsInternal', () => {
  it('returns the code-defined accounts with credentials from the environment', async () => {
    const accounts = await getGoogleWorkspaceAccountsInternal()
    expect(accounts.map((a) => a.email)).toEqual(MAIL_ACCOUNTS.map((d) => d.email))
    expect(accounts.map((a) => a.refresh_token)).toEqual([
      ENV.GOOGLE_REFRESH_TOKEN_PEOPLE,
      ENV.GOOGLE_REFRESH_TOKEN_AUTOMATIONS_PNC,
      ENV.GOOGLE_REFRESH_TOKEN_AUTOMATION,
    ])
    expect(accounts.every((a) => a.status === 'connected')).toBe(true)
  })

  it('never reads the credentials table', async () => {
    await getGoogleWorkspaceAccountsInternal()
    expect(db.tablesTouched.has('mail_account_credentials')).toBe(false)
  })

  it('ignores credentials left in an old settings row', async () => {
    stubEnv({ GOOGLE_CLIENT_ID: ENV.GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET: ENV.GOOGLE_CLIENT_SECRET })
    db.settings.set('google_workspace_accounts', {
      is_active: true,
      value: JSON.stringify([
        account({ email: PEOPLE.email, refresh_token: 'left-behind-token', client_secret: 'left-behind' }),
      ]),
    })
    const [people] = await getGoogleWorkspaceAccountsInternal()
    expect(people.refresh_token).toBeUndefined()
    expect(people.client_secret).toBe(ENV.GOOGLE_CLIENT_SECRET)
    expect(people.status).toBe('disconnected')
  })

  it('applies stored status and usage, matched by email', async () => {
    db.settings.set('google_workspace_accounts', {
      is_active: true,
      value: JSON.stringify([
        { id: 'old-id', email: AUTOMATION.email.toUpperCase(), status: 'needs_reauth', error_message: 'invalid_grant', daily_sent_count: 7 },
        { email: 'someone-else@example.org', status: 'needs_reauth' },
      ]),
    })
    const accounts = await getGoogleWorkspaceAccountsInternal()
    const automation = accounts.find((a) => a.id === AUTOMATION.id)!
    expect(automation).toMatchObject({ status: 'needs_reauth', error_message: 'invalid_grant', daily_sent_count: 7 })
    expect(accounts.find((a) => a.id === PEOPLE.id)?.status).toBe('connected')
    expect(accounts).toHaveLength(MAIL_ACCOUNTS.length)
  })
})

describe('sendingChain', () => {
  const accountsFor = (env: Record<string, string | undefined>) => MAIL_ACCOUNTS.map((d) => buildAccount(d, env, undefined))

  it('tries the primary first, then the backups in order', () => {
    const { chain, primary, primarySkipped } = sendingChain(accountsFor(ENV))
    expect(chain.map((a) => a.id)).toEqual(['people', 'automations-pnc', 'automation'])
    expect(primary?.id).toBe('people')
    expect(primarySkipped).toBeNull()
  })

  it('skips an account without a token, and says why the primary was skipped without any value', () => {
    const { chain, primary, primarySkipped } = sendingChain(
      accountsFor({ ...ENV, GOOGLE_REFRESH_TOKEN_PEOPLE: undefined, GOOGLE_REFRESH_TOKEN_AUTOMATION: '' }),
    )
    expect(chain.map((a) => a.id)).toEqual(['automations-pnc'])
    expect(primary?.id).toBe('people')
    expect(primarySkipped).toContain('GOOGLE_REFRESH_TOKEN_PEOPLE')
    expect(primarySkipped).not.toContain(ENV.GOOGLE_CLIENT_SECRET)
  })

  it('marks an account without a token as disconnected', () => {
    const [people] = accountsFor({ ...ENV, GOOGLE_REFRESH_TOKEN_PEOPLE: undefined })
    expect(people.status).toBe('disconnected')
  })

  it('is empty when nothing is configured', () => {
    expect(sendingChain(accountsFor({})).chain).toEqual([])
  })
})

describe('getOAuth2ClientForAccount', () => {
  it('refuses an account without its own credentials instead of borrowing one', () => {
    expect(() => getOAuth2ClientForAccount(account({ refresh_token: undefined, client_secret: 's' }))).toThrow(
      /no saved credentials/,
    )
  })
})

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
    expect(a).toMatchObject({ id: 'acc-1', name: 'Account A', email: 'sender@example.org', is_active: true })
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

describe('toStoredStatus', () => {
  it('keeps status and usage only, no credential field', () => {
    const stored = toStoredStatus(
      account({ client_secret: 's', refresh_token: 't', refresh_token_preview: 'p', error_message: 'e' }),
    ) as Record<string, unknown>
    for (const field of CREDENTIAL_FIELDS) expect(stored).not.toHaveProperty(field)
    expect(Object.keys(stored).sort()).toEqual(
      ['daily_send_limit', 'daily_sent_count', 'email', 'error_message', 'status'].sort(),
    )
  })
})

describe('saveGoogleWorkspaceAccountsInternal', () => {
  const save = (accounts: GoogleWorkspaceAccount[]) =>
    saveGoogleWorkspaceAccountsInternal(accounts, { changedBy: 'admin@example.org' })

  it('never writes a credential, to settings or anywhere else', async () => {
    const res = await save([
      account({ email: PEOPLE.email, client_secret: 'new-secret-value', refresh_token: 'new-refresh-token', refresh_token_preview: 'x' }),
      account({ email: AUTOMATION.email, is_active: false, refresh_token: 'backup-token-9999' }),
    ])
    expect(res.success).toBe(true)
    expect(res.credentialsDropped).toBe(true)
    expect(db.writes.length).toBeGreaterThan(0)
    for (const w of allWrites()) {
      for (const field of CREDENTIAL_FIELDS) expect(w).not.toContain(field)
      expect(w).not.toContain('new-secret-value')
      expect(w).not.toContain('new-refresh-token')
      expect(w).not.toContain('backup-token-9999')
    }
    expect(db.tablesTouched.has('mail_account_credentials')).toBe(false)
    // Still sending with the environment's tokens.
    expect(res.accounts.map((a) => a.refresh_token)).toEqual([
      ENV.GOOGLE_REFRESH_TOKEN_PEOPLE,
      ENV.GOOGLE_REFRESH_TOKEN_AUTOMATIONS_PNC,
      ENV.GOOGLE_REFRESH_TOKEN_AUTOMATION,
    ])
  })

  it('does not flag masked values sent back as credentials', async () => {
    const res = await save([account({ email: PEOPLE.email, client_secret: SECRET_MASK, refresh_token: '••••1111' })])
    expect(res.credentialsDropped).toBe(false)
  })

  it('saves status and usage for the defined accounts, matched by email', async () => {
    await save([
      account({ email: AUTOMATIONS_PNC.email.toUpperCase(), status: 'needs_reauth', error_message: 'invalid_grant', daily_sent_count: 3 }),
      account({ email: 'not-defined@example.org', status: 'needs_reauth' }),
    ])
    const row = JSON.parse(db.settings.get('google_workspace_accounts')!.value) as Record<string, unknown>[]
    expect(row.map((r) => r.email)).toEqual(MAIL_ACCOUNTS.map((d) => d.email))
    expect(row[1]).toMatchObject({ status: 'needs_reauth', error_message: 'invalid_grant', daily_sent_count: 3 })
    expect(JSON.stringify(row)).not.toContain('not-defined@example.org')
  })

  it("keeps an account's earlier status when the save does not mention it", async () => {
    await save([account({ email: AUTOMATION.email, status: 'needs_reauth', error_message: 'invalid_grant' })])
    await save([account({ email: PEOPLE.email, daily_sent_count: 5 })])
    const accounts = await getGoogleWorkspaceAccountsInternal()
    expect(accounts.find((a) => a.id === AUTOMATION.id)).toMatchObject({ status: 'needs_reauth', error_message: 'invalid_grant' })
    expect(accounts.find((a) => a.id === PEOPLE.id)?.daily_sent_count).toBe(5)
  })

  it('cannot change which account is primary or the fallback order', async () => {
    await save([
      account({ email: PEOPLE.email, is_active: false, backup_priority: 2 }),
      account({ email: AUTOMATION.email, is_active: true, backup_priority: 0 }),
    ])
    const accounts = await getGoogleWorkspaceAccountsInternal()
    expect(accounts.map((a) => [a.id, a.is_active, a.backup_priority])).toEqual([
      ['people', true, 0],
      ['automations-pnc', false, 1],
      ['automation', false, 2],
    ])
  })
})
