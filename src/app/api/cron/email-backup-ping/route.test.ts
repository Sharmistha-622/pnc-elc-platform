import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const state = vi.hoisted(() => ({
  report: { checked: 2, connected: 1, needsReauth: 1, skipped: 0 },
  ran: 0,
  throws: false,
}))

vi.mock('@/lib/supabase/admin', () => ({ createAdminSupabaseClient: () => ({}) }))
vi.mock('@/lib/email/backupHealth', () => ({
  runBackupMailboxHealthCheck: vi.fn(async () => {
    state.ran += 1
    if (state.throws) throw new Error('boom')
    return state.report
  }),
}))

import { GET } from './route'

const call = (authorization?: string) =>
  GET(new Request('http://localhost/api/cron/email-backup-ping', { headers: authorization ? { authorization } : {} }))

beforeEach(() => {
  vi.stubEnv('CRON_SECRET', 'test-secret')
  state.ran = 0
  state.throws = false
  state.report = { checked: 2, connected: 1, needsReauth: 1, skipped: 0 }
})
afterEach(() => vi.unstubAllEnvs())

describe('GET /api/cron/email-backup-ping', () => {
  it('refuses a request without the cron secret, before doing anything', async () => {
    expect((await call()).status).toBe(401)
    expect((await call('Bearer wrong')).status).toBe(401)
    expect(state.ran).toBe(0)
  })

  it('runs the health check and returns counts only', async () => {
    const res = await call('Bearer test-secret')
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual({
      success: true,
      data: { checked: 2, connected: 1, needsReauth: 1, skipped: 0 },
    })
    expect(Object.keys(body.data)).toEqual(['checked', 'connected', 'needsReauth', 'skipped'])
  })

  it('answers with a generic error when the job throws', async () => {
    state.throws = true
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {})
    const res = await call('Bearer test-secret')
    expect(res.status).toBe(500)
    expect(await res.json()).toEqual({ success: false, error: 'Backup mailbox health check failed' })
    errors.mockRestore()
  })
})

