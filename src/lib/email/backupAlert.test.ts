import { describe, it, expect, vi } from 'vitest'

vi.mock('@/lib/supabase/admin', () => ({ createAdminSupabaseClient: () => null }))

import { alertDay, alertPncOfBackupSend, buildBackupAlert, redactReason } from './backupAlert'

const ENV = {
  GOOGLE_CLIENT_SECRET: 'env-client-secret',
  GOOGLE_REFRESH_TOKEN: 'legacy-token-0000',
  GOOGLE_REFRESH_TOKEN_PEOPLE: 'people-token-1111',
  GOOGLE_REFRESH_TOKEN_AUTOMATIONS_PNC: 'automations-pnc-token-2222',
}

const event = {
  primary: { name: 'Primary', email: 'primary@example.org' },
  sentBy: { name: 'Backup 1', email: 'backup@example.org' },
  reason: 'invalid_grant',
}

describe('buildBackupAlert', () => {
  it('names the account that sent and why the primary failed', () => {
    const { subject, html } = buildBackupAlert(event, ENV)
    expect(subject).toContain('backup@example.org')
    expect(html).toContain('Backup 1')
    expect(html).toContain('primary@example.org')
    expect(html).toContain('invalid_grant')
  })

  it('carries no secret value, even if the error quoted one', () => {
    const { subject, html } = buildBackupAlert(
      { ...event, reason: 'refused people-token-1111 with env-client-secret and legacy-token-0000' },
      ENV,
    )
    for (const secret of Object.values(ENV)) {
      expect(html).not.toContain(secret)
      expect(subject).not.toContain(secret)
    }
    expect(html).toContain('[redacted]')
  })

  it('escapes the reason', () => {
    expect(buildBackupAlert({ ...event, reason: '<script>x</script>' }, ENV).html).not.toContain('<script>')
  })
})

describe('redactReason', () => {
  it('cuts a long reason short', () => {
    expect(redactReason('x'.repeat(1000), ENV).length).toBeLessThanOrEqual(301)
  })
})

describe('alertDay', () => {
  it('uses the date in India', () => {
    expect(alertDay(new Date('2026-11-20T19:00:00Z'))).toBe('2026-11-21')
    expect(alertDay(new Date('2026-11-20T10:00:00Z'))).toBe('2026-11-20')
  })
})

describe('alertPncOfBackupSend', () => {
  it('alerts once per day at most', async () => {
    const claimed = new Set<string>()
    const claimDay = async (day: string) => (claimed.has(day) ? false : (claimed.add(day), true))
    const send = vi.fn<(to: string, subject: string, html: string) => Promise<void>>(async () => {})
    const deps = { env: ENV, claimDay, getPncMailbox: async () => 'pnc@example.org', send }

    expect(await alertPncOfBackupSend(event, { ...deps, now: new Date('2026-11-20T05:00:00Z') })).toBe(true)
    expect(await alertPncOfBackupSend(event, { ...deps, now: new Date('2026-11-20T12:00:00Z') })).toBe(false)
    expect(await alertPncOfBackupSend(event, { ...deps, now: new Date('2026-11-21T05:00:00Z') })).toBe(true)
    expect(send).toHaveBeenCalledTimes(2)
    expect(send.mock.calls[0][0]).toBe('pnc@example.org')
  })

  it('sends nothing, and claims nothing, without a PnC mailbox', async () => {
    const claimDay = vi.fn(async () => true)
    const send = vi.fn(async () => {})
    expect(await alertPncOfBackupSend(event, { env: ENV, claimDay, getPncMailbox: async () => null, send })).toBe(false)
    expect(claimDay).not.toHaveBeenCalled()
    expect(send).not.toHaveBeenCalled()
  })

  it('never throws when the alert fails', async () => {
    const send = async () => {
      throw new Error('boom')
    }
    await expect(
      alertPncOfBackupSend(event, { env: ENV, claimDay: async () => true, getPncMailbox: async () => 'pnc@example.org', send }),
    ).resolves.toBe(false)
  })
})
