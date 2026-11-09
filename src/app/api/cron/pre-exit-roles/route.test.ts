import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const state = vi.hoisted(() => ({
  report: { checked: 2, due: 1, ended: 1, failed: 0, reporteesToReassign: 3 },
  exited: { exitedPeople: 4, ended: 1, failed: 0 },
  ran: 0,
  throws: false,
}))

vi.mock('@/lib/supabase/admin', () => ({ createAdminSupabaseClient: () => ({}) }))
vi.mock('@/lib/offboarding/preExitRoles', () => ({
  runPreExitRoleEnding: vi.fn(async () => {
    state.ran += 1
    if (state.throws) throw new Error('boom')
    return state.report
  }),
  endAccessOfExitedRecords: vi.fn(async () => state.exited),
}))

import { GET } from './route'

const call = (authorization?: string) =>
  GET(new Request('http://localhost/api/cron/pre-exit-roles', { headers: authorization ? { authorization } : {} }))

beforeEach(() => {
  vi.stubEnv('CRON_SECRET', 'test-secret')
  state.ran = 0
  state.throws = false
  state.report = { checked: 2, due: 1, ended: 1, failed: 0, reporteesToReassign: 3 }
  state.exited = { exitedPeople: 4, ended: 1, failed: 0 }
})
afterEach(() => vi.unstubAllEnvs())

describe('GET /api/cron/pre-exit-roles', () => {
  it('refuses a request without the cron secret, before doing anything', async () => {
    expect((await call()).status).toBe(401)
    expect((await call('Bearer wrong')).status).toBe(401)
    expect(state.ran).toBe(0)
  })

  it('runs the job and returns counts only', async () => {
    const res = await call('Bearer test-secret')
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      success: true,
      data: { ...state.report, exitedAccessEnded: 1, exitedAccessFailed: 0 },
    })
  })

  it('reports a run with failures as a failure', async () => {
    state.report = { ...state.report, failed: 1 }
    const res = await call('Bearer test-secret')
    expect(res.status).toBe(500)
    expect((await res.json()).success).toBe(false)
    state.report = { ...state.report, failed: 0 }
    state.exited = { ...state.exited, failed: 1 }
    expect((await call('Bearer test-secret')).status).toBe(500)
  })

  it('answers with a generic error when the job throws', async () => {
    state.throws = true
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {})
    const res = await call('Bearer test-secret')
    expect(res.status).toBe(500)
    expect(await res.json()).toEqual({ success: false, error: 'Pre-exit role job failed' })
    errors.mockRestore()
  })
})
