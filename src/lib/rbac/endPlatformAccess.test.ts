import { describe, it, expect, vi, beforeEach } from 'vitest'

const state = vi.hoisted(() => ({
  users: [] as Array<{ id: string; email: string; app_metadata: Record<string, unknown> }>,
  updates: [] as Array<{ id: string; attrs: Record<string, unknown> }>,
  noAdmin: false,
}))

vi.mock('@/lib/supabase/admin', () => ({
  createAdminSupabaseClient: () =>
    state.noAdmin
      ? null
      : {
          auth: {
            admin: {
              listUsers: async ({ page }: { page: number }) => ({
                data: { users: page === 1 ? state.users : [] },
                error: null,
              }),
              getUserById: async (id: string) => ({
                data: { user: state.users.find((u) => u.id === id) ?? null },
                error: null,
              }),
              updateUserById: async (id: string, attrs: Record<string, unknown>) => {
                state.updates.push({ id, attrs })
                return { data: null, error: null }
              },
            },
          },
        },
}))

import { endPlatformAccess, reopenPlatformAccess, ENDED_BAN_DURATION } from './endPlatformAccess'

const now = new Date('2026-11-07T10:00:00Z')

beforeEach(() => {
  state.users = [
    { id: 'u-pa', email: 'pa@navgurukul.org', app_metadata: { role: 'pnc_admin', provider: 'google' } },
    { id: 'u-left', email: 'left@navgurukul.org', app_metadata: { access_ended_at: '2026-10-01T00:00:00Z' } },
  ]
  state.updates = []
  state.noAdmin = false
})

describe('endPlatformAccess', () => {
  it('removes the role, marks the account ended and bans it, in one write', async () => {
    const result = await endPlatformAccess('PA@navgurukul.org', { endedBy: 'sa@navgurukul.org', now })
    expect(result).toEqual({ ok: true, userId: 'u-pa' })
    expect(state.updates).toHaveLength(1)
    const { attrs } = state.updates[0]
    expect(attrs.ban_duration).toBe(ENDED_BAN_DURATION)
    expect(attrs.app_metadata).toEqual({
      role: null,
      provider: 'google',
      access_ended_at: '2026-11-07T10:00:00.000Z',
      access_ended_by: 'sa@navgurukul.org',
    })
  })

  it('leaves an account that is already ended alone', async () => {
    expect(await endPlatformAccess('left@navgurukul.org', { endedBy: 'x', now })).toEqual({ ok: true, userId: 'u-left' })
    expect(state.updates).toHaveLength(0)
  })

  it('succeeds with nothing to change when the person has no account', async () => {
    expect(await endPlatformAccess('never@navgurukul.org', { endedBy: 'x', now })).toEqual({ ok: true, userId: null })
  })

  it('refuses the owner account', async () => {
    const result = await endPlatformAccess('nitin@navgurukul.org', { endedBy: 'x', now })
    expect(result.ok).toBe(false)
    expect(state.updates).toHaveLength(0)
  })

  it('fails, rather than pretending, without a service-role key', async () => {
    state.noAdmin = true
    expect((await endPlatformAccess('pa@navgurukul.org', { endedBy: 'x', now })).ok).toBe(false)
  })

  it('fails without an email to look up', async () => {
    expect((await endPlatformAccess(null, { endedBy: 'x', now })).ok).toBe(false)
  })
})

describe('reopenPlatformAccess', () => {
  it('clears the marker and lifts the ban, without restoring a role', async () => {
    expect(await reopenPlatformAccess('u-left')).toEqual({ ok: true, userId: 'u-left' })
    expect(state.updates[0].attrs).toEqual({
      app_metadata: { access_ended_at: null, access_ended_by: null },
      ban_duration: 'none',
    })
  })

  it('does nothing to an open account', async () => {
    expect(await reopenPlatformAccess('u-pa')).toEqual({ ok: true, userId: 'u-pa' })
    expect(state.updates).toHaveLength(0)
  })
})
