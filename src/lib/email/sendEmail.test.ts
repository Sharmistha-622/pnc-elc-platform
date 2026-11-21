import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// End to end through sendEmail: the real account list, sending chain and
// backup alert, with Gmail and the database replaced by in-memory fakes.

const state = vi.hoisted(() => ({
  /** Refresh tokens Gmail refuses. */
  refused: new Set<string>(),
  /** Every message Gmail accepted: which token sent it, and the decoded MIME. */
  sent: [] as { token: string; mime: string }[],
  settings: new Map<string, string>(),
  pncMailbox: 'pnc@example.org',
}))

vi.mock('googleapis', () => {
  class OAuth2 {
    token = ''
    setCredentials(c: { refresh_token: string }) {
      this.token = c.refresh_token
    }
  }
  return {
    google: {
      auth: { OAuth2 },
      gmail: ({ auth }: { auth: OAuth2 }) => ({
        users: {
          messages: {
            send: async ({ requestBody }: { requestBody: { raw: string } }) => {
              if (state.refused.has(auth.token)) throw new Error('invalid_grant')
              const mime = Buffer.from(requestBody.raw.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString()
              state.sent.push({ token: auth.token, mime })
              return { data: { id: `msg-${state.sent.length}` } }
            },
          },
        },
      }),
    },
  }
})

vi.mock('next/cache', () => ({ revalidatePath: () => {} }))
vi.mock('./templates', () => ({
  resolveEmailTemplate: async (_key: string, data: Record<string, string>) => ({ subject: data.subject, body: data.body }),
}))

// general_settings and review_cycle_settings, enough for the account status
// read and the alert's once-a-day claim (update ... neq ... select, then
// upsert ignoreDuplicates ... select).
function fakeClient() {
  return {
    from(table: string) {
      const filters: Record<string, unknown> = {}
      const neq: Record<string, unknown> = {}
      let pending: (() => { key: string }[]) | null = null
      const chain = {
        select: () => {
          if (pending) {
            const rows = pending()
            return Promise.resolve({ data: rows, error: null })
          }
          return chain
        },
        eq: (col: string, v: unknown) => ((filters[col] = v), chain),
        neq: (col: string, v: unknown) => ((neq[col] = v), chain),
        maybeSingle: async () => {
          if (table === 'review_cycle_settings') return { data: { pnc_notification_email: state.pncMailbox }, error: null }
          const value = state.settings.get(filters.key as string)
          return { data: value ? { value } : null, error: null }
        },
        update: (row: { value?: string }) => {
          pending = () => {
            const key = filters.key as string
            const current = state.settings.get(key)
            if (current === undefined || ('value' in neq && current === neq.value)) return []
            if (row.value !== undefined) state.settings.set(key, row.value)
            return [{ key }]
          }
          return chain
        },
        upsert: (row: { key: string; value: string }, opts?: { ignoreDuplicates?: boolean }) => {
          const apply = () => {
            if (opts?.ignoreDuplicates && state.settings.has(row.key)) return []
            state.settings.set(row.key, row.value)
            return [{ key: row.key }]
          }
          // Awaited directly (settings save) or followed by .select() (alert claim).
          const rows = apply()
          return { select: async () => ({ data: rows, error: null }), then: (r: (v: unknown) => void) => r({ error: null }) }
        },
        insert: async () => ({ error: null }),
      }
      return chain
    },
  }
}

vi.mock('@/lib/supabase/admin', () => ({ createAdminSupabaseClient: () => fakeClient() }))
vi.mock('@/lib/supabase/server', () => ({ createServerSupabaseClient: async () => fakeClient() }))

import { sendEmail } from './sendEmail'
import { MAIL_ACCOUNTS } from './accounts'

const [PRIMARY, BACKUP_1] = MAIL_ACCOUNTS
const TOKENS = {
  GOOGLE_REFRESH_TOKEN_PEOPLE: 'people-token-1111',
  GOOGLE_REFRESH_TOKEN_AUTOMATIONS_PNC: 'automations-pnc-token-2222',
  GOOGLE_REFRESH_TOKEN_AUTOMATION: 'automation-token-3333',
}

beforeEach(() => {
  state.refused.clear()
  state.sent.length = 0
  state.settings.clear()
  vi.stubEnv('GOOGLE_CLIENT_ID', 'client-env.apps.googleusercontent.com')
  vi.stubEnv('GOOGLE_CLIENT_SECRET', 'env-client-secret')
  vi.stubEnv('GOOGLE_SENDER_EMAIL', '')
  vi.stubEnv('GOOGLE_REFRESH_TOKEN', '')
  for (const [k, v] of Object.entries(TOKENS)) vi.stubEnv(k, v)
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(console, 'info').mockImplementation(() => {})
})
afterEach(() => {
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

const send = () =>
  sendEmail('system_notice', { subject: 'Hello', body: '<p>Body</p>' }, 'employee@example.org')

const alerts = () => state.sent.filter((m) => /^To: pnc@example\.org$/m.test(m.mime))
const deliveries = () => state.sent.filter((m) => /^To: employee@example\.org$/m.test(m.mime))

describe('sendEmail failover', () => {
  it('sends from the primary and alerts no one when the primary works', async () => {
    const res = await send()
    expect(res).toMatchObject({ success: true, senderEmail: PRIMARY.email, isBackup: false })
    expect(deliveries()).toHaveLength(1)
    expect(alerts()).toHaveLength(0)
  })

  it('fails over to a backup when the primary fails, delivers, and alerts PnC once a day', async () => {
    state.refused.add(TOKENS.GOOGLE_REFRESH_TOKEN_PEOPLE)

    const first = await send()
    expect(first).toMatchObject({ success: true, senderEmail: BACKUP_1.email, isBackup: true })

    // The email went out, from backup 1.
    expect(deliveries()).toHaveLength(1)
    expect(deliveries()[0].token).toBe(TOKENS.GOOGLE_REFRESH_TOKEN_AUTOMATIONS_PNC)
    expect(deliveries()[0].mime).toContain(`From: ${BACKUP_1.email}`)

    // PnC was told, from the account that worked, which account sent and why.
    expect(alerts()).toHaveLength(1)
    const alert = alerts()[0]
    expect(alert.token).toBe(TOKENS.GOOGLE_REFRESH_TOKEN_AUTOMATIONS_PNC)
    expect(alert.mime).toContain(BACKUP_1.email)
    expect(alert.mime).toContain(PRIMARY.email)
    expect(alert.mime).toContain('invalid_grant')
    for (const secret of [...Object.values(TOKENS), 'env-client-secret']) expect(alert.mime).not.toContain(secret)

    // A second failover the same day delivers but does not alert again.
    const second = await send()
    expect(second).toMatchObject({ success: true, isBackup: true })
    expect(deliveries()).toHaveLength(2)
    expect(alerts()).toHaveLength(1)
  })

  it('skips a primary with no token, sends from the backup, and says why in the alert', async () => {
    vi.stubEnv('GOOGLE_REFRESH_TOKEN_PEOPLE', '')

    const res = await send()
    expect(res).toMatchObject({ success: true, senderEmail: BACKUP_1.email, isBackup: true })
    expect(deliveries()).toHaveLength(1)
    expect(alerts()).toHaveLength(1)
    expect(alerts()[0].mime).toContain('GOOGLE_REFRESH_TOKEN_PEOPLE')
  })
})
