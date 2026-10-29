import { describe, it, expect, vi, beforeEach } from 'vitest'

// Adding a user, with the guard and auth stubbed: who may add whom, as what.

const state = vi.hoisted(() => ({
  guarded: true,
  caller: null as any,
  created: [] as any[],
  createError: null as null | { code?: string; message: string },
  trail: [] as any[],
}))

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/rbac/getCurrentUserRole', () => ({ IMMUTABLE_SUPER_ADMIN_EMAILS: ['root@navgurukul.org'] }))
vi.mock('@/lib/rbac/guard', () => ({
  guard: vi.fn(async () =>
    state.guarded ? { ok: true, caller: state.caller } : { ok: false, error: 'You do not have access to do that.' }
  ),
}))
vi.mock('@/lib/audit/service', () => ({
  recordAuditEvent: vi.fn(async (e: any) => {
    state.trail.push(e)
    return e
  }),
}))
vi.mock('@/lib/supabase/admin', () => ({
  createAdminSupabaseClient: () => ({
    auth: {
      admin: {
        createUser: async (attrs: any) => {
          if (state.createError) return { data: { user: null }, error: state.createError }
          state.created.push(attrs)
          return {
            data: { user: { id: '00000000-0000-4000-8000-0000000000aa', created_at: '2026-10-29T00:00:00Z' } },
            error: null,
          }
        },
      },
    },
  }),
}))

import { createUserWithRole } from './createUserWithRole'

function as(role: string, email = `${role}@navgurukul.org`) {
  state.caller = { userId: '00000000-0000-4000-8000-000000000001', email, role, originalRole: role }
}

beforeEach(() => {
  state.guarded = true
  state.created = []
  state.createError = null
  state.trail = []
})

describe('createUserWithRole', () => {
  it('refuses a caller the users screen refuses, before anything else', async () => {
    state.guarded = false
    as('pnc_ops')
    const res = await createUserWithRole({ email: 'new@navgurukul.org', role: 'pnc_ops' })
    expect(res.success).toBe(false)
    expect(state.created).toEqual([])
  })

  it('creates a confirmed account holding the role and department', async () => {
    as('super_admin')
    const res = await createUserWithRole({
      email: ' New@NavGurukul.org ',
      fullName: 'Asha Example',
      role: 'exec_view',
      team: 'CEO Office',
    })
    expect(res).toMatchObject({ success: true, user: { email: 'new@navgurukul.org', role: 'exec_view' } })
    expect(state.created).toEqual([
      {
        email: 'new@navgurukul.org',
        email_confirm: true,
        app_metadata: { role: 'exec_view' },
        user_metadata: { full_name: 'Asha Example', team: 'CEO Office' },
      },
    ])
    expect(state.trail[0]).toMatchObject({ action: 'access.user.created' })
  })

  it('lets PnC Admin add PnC roles only', async () => {
    as('pnc_admin')
    expect((await createUserWithRole({ email: 'a@navgurukul.org', role: 'pnc_ops' })).success).toBe(true)
    expect((await createUserWithRole({ email: 'b@navgurukul.org', role: 'pnc_admin' })).success).toBe(true)
    expect((await createUserWithRole({ email: 'c@navgurukul.org', role: 'fin_ops' })).success).toBe(false)
    expect(state.created).toHaveLength(2)
  })

  it('lets Fin Admin add Finance roles only, without a department', async () => {
    as('fin_admin')
    expect((await createUserWithRole({ email: 'a@navgurukul.org', role: 'fin_ops' })).success).toBe(true)
    expect((await createUserWithRole({ email: 'b@navgurukul.org', role: 'pnc_ops' })).success).toBe(false)
    expect(
      (await createUserWithRole({ email: 'c@navgurukul.org', role: 'fin_admin', team: 'Finance' })).success
    ).toBe(false)
    expect(state.created).toHaveLength(1)
  })

  it('refuses Platform Admin anything but Platform Ops', async () => {
    as('platform_admin')
    expect((await createUserWithRole({ email: 'a@navgurukul.org', role: 'pnc_admin' })).success).toBe(false)
    expect((await createUserWithRole({ email: 'b@navgurukul.org', role: 'platform_ops' })).success).toBe(true)
  })

  it('refuses the lifecycle roles and the owner role', async () => {
    as('super_admin')
    for (const role of ['employee', 'manager', 'candidate', 'super_admin'] as const) {
      expect((await createUserWithRole({ email: 'a@navgurukul.org', role })).success, role).toBe(false)
    }
    expect(state.created).toEqual([])
  })

  it('refuses an address outside the organisation, and the immutable owner', async () => {
    as('super_admin')
    expect((await createUserWithRole({ email: 'a@example.com', role: 'pnc_ops' })).success).toBe(false)
    expect((await createUserWithRole({ email: 'root@navgurukul.org', role: 'pnc_ops' })).success).toBe(false)
    expect(state.created).toEqual([])
  })

  it('refuses adding yourself', async () => {
    as('pnc_admin', 'me@navgurukul.org')
    expect((await createUserWithRole({ email: 'me@navgurukul.org', role: 'pnc_ops' })).success).toBe(false)
  })

  it('points to the list when the account already exists', async () => {
    as('super_admin')
    state.createError = { code: 'email_exists', message: 'A user with this email address has already been registered' }
    const res = await createUserWithRole({ email: 'a@navgurukul.org', role: 'pnc_ops' })
    expect(res).toMatchObject({ success: false, error: expect.stringContaining('already has an account') })
  })
})
