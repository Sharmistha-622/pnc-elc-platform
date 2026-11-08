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

import { endPlatformAccess, endRoleBeforeExit, reopenPlatformAccess, ENDED_BAN_DURATION } from './endPlatformAccess'

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
      app_metadata: {
        access_ended_at: null,
        access_ended_by: null,
        role_before_exit: null,
        role_ended_before_exit_at: null,
      },
      ban_duration: 'none',
    })
  })

  it('does nothing to an open account', async () => {
    expect(await reopenPlatformAccess('u-pa')).toEqual({ ok: true, userId: 'u-pa' })
    expect(state.updates).toHaveLength(0)
  })
})

describe('endRoleBeforeExit', () => {
  const at = new Date('2026-11-16T19:05:00Z')

  it('removes the stored role, keeps it on record, and leaves the account open', async () => {
    const result = await endRoleBeforeExit('PA@navgurukul.org', { now: at })
    expect(result).toEqual({ ok: true, outcome: 'ended', userId: 'u-pa', previousRole: 'pnc_admin' })
    expect(state.updates).toHaveLength(1)
    expect(state.updates[0]).toEqual({
      id: 'u-pa',
      attrs: {
        app_metadata: {
          provider: 'google',
          role: null,
          role_before_exit: 'pnc_admin',
          role_ended_before_exit_at: '2026-11-16T19:05:00.000Z',
        },
      },
    })
    // Not a ban and not the exit marker: those come when the exit closes.
    expect(state.updates[0].attrs).not.toHaveProperty('ban_duration')
    expect(state.updates[0].attrs.app_metadata).not.toHaveProperty('access_ended_at')
  })

  it('leaves an account with nothing above the employee baseline alone', async () => {
    state.users.push(
      { id: 'u-emp', email: 'emp@navgurukul.org', app_metadata: { role: 'employee' } },
      { id: 'u-none', email: 'none@navgurukul.org', app_metadata: {} },
      { id: 'u-legacy', email: 'legacy@navgurukul.org', app_metadata: { role: 'Viewer' } },
    )
    for (const email of ['emp@navgurukul.org', 'none@navgurukul.org', 'legacy@navgurukul.org']) {
      const result = await endRoleBeforeExit(email, { now: at })
      expect(result.ok && result.outcome, email).toBe('no_stored_role')
    }
    expect(state.updates).toHaveLength(0)
  })

  it('removes a legacy stored role that outranks employee', async () => {
    state.users.push({ id: 'u-old', email: 'old@navgurukul.org', app_metadata: { role: 'PnC' } })
    const result = await endRoleBeforeExit('old@navgurukul.org', { now: at })
    expect(result).toEqual({ ok: true, outcome: 'ended', userId: 'u-old', previousRole: 'PnC' })
  })

  it('does not touch an account the exit has already closed', async () => {
    const result = await endRoleBeforeExit('left@navgurukul.org', { now: at })
    expect(result).toEqual({ ok: true, outcome: 'access_ended', userId: 'u-left', previousRole: null })
    expect(state.updates).toHaveLength(0)
  })

  it('succeeds with nothing to do for someone who never signed in', async () => {
    expect(await endRoleBeforeExit('never@navgurukul.org', { now: at })).toEqual({
      ok: true,
      outcome: 'no_account',
      userId: null,
      previousRole: null,
    })
  })

  it('never touches the owner', async () => {
    const result = await endRoleBeforeExit('nitin@navgurukul.org', { now: at })
    expect(result).toEqual({ ok: true, outcome: 'owner', userId: null, previousRole: null })
    expect(state.updates).toHaveLength(0)
  })

  it('fails without an email or a service-role key', async () => {
    expect((await endRoleBeforeExit(null, { now: at })).ok).toBe(false)
    state.noAdmin = true
    expect((await endRoleBeforeExit('pa@navgurukul.org', { now: at })).ok).toBe(false)
  })
})
