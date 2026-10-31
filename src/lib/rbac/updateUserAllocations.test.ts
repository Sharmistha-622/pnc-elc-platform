import { describe, it, expect, vi, beforeEach } from 'vitest'

// The allocation rules, with the database and auth stubbed: who may change
// whose role, and whose department.

const ROOT = 'root@navgurukul.org'

const state = vi.hoisted(() => ({
  caller: null as any,
  users: {} as Record<string, { id: string; email: string; app_metadata: any; user_metadata: any }>,
  updatedAuth: [] as string[],
  audit: [] as any[],
  trail: [] as any[],
  employeeUpdates: [] as any[],
  employeeError: null as null | { message: string },
  guardOk: true,
  breakGlass: null as any,
}))

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/rbac/getCurrentUserRole', () => ({ IMMUTABLE_SUPER_ADMIN_EMAILS: ['root@navgurukul.org'] }))
vi.mock('@/lib/rbac/guard', () => ({
  guard: vi.fn(async () =>
    state.guardOk ? { ok: true, caller: state.caller } : { ok: false, error: 'You do not have access to do that.' }
  ),
}))
// The switch and the account list are read in breakGlassAccess; here a test
// says directly whether the caller holds break-glass access.
vi.mock('@/lib/rbac/breakGlassAccess', () => ({
  breakGlassCaller: vi.fn(async () => state.breakGlass),
}))
vi.mock('@/lib/audit/service', () => ({
  recordAuditEvent: vi.fn(async (e: any) => {
    state.trail.push(e)
    return e
  }),
}))

function table(name: string) {
  const q: any = {
    select: () => q,
    ilike: () => q,
    eq: () => q,
    or: () => q,
    limit: async () => ({ data: [] }),
    maybeSingle: async () => ({ data: null }),
    update: (payload: any) => {
      if (name === 'employees') state.employeeUpdates.push(payload)
      return q
    },
    insert: async (row: any) => {
      state.audit.push(row)
      return { error: null }
    },
    then: (resolve: any) => resolve({ data: null, error: name === 'employees' ? state.employeeError : null }),
  }
  return q
}

vi.mock('@/lib/supabase/server', () => ({
  createServerSupabaseClient: async () => ({ from: table }),
}))
vi.mock('@/lib/supabase/admin', () => ({
  createAdminSupabaseClient: () => ({
    from: table,
    auth: {
      admin: {
        getUserById: async (id: string) => ({ data: { user: state.users[id] ?? null } }),
        listUsers: async () => ({ data: { users: Object.values(state.users) } }),
        updateUserById: async (id: string) => {
          state.updatedAuth.push(id)
          return { data: null, error: null }
        },
      },
    },
  }),
}))

import { updateUserAllocations } from './updateUserAllocations'

const ids = {
  root: '00000000-0000-4000-8000-000000000001',
  pnc: '00000000-0000-4000-8000-000000000002',
  emp: '00000000-0000-4000-8000-000000000003',
  plat: '00000000-0000-4000-8000-000000000004',
  fin: '00000000-0000-4000-8000-000000000005',
}

function account(id: string, email: string, role: string, team = 'None') {
  state.users[id] = { id, email, app_metadata: { role }, user_metadata: { team } }
}

function as(id: string, role: string) {
  state.caller = { userId: id, email: state.users[id].email, role, originalRole: role }
}

beforeEach(() => {
  state.users = {}
  state.updatedAuth = []
  state.audit = []
  state.trail = []
  state.employeeUpdates = []
  state.employeeError = null
  state.guardOk = true
  state.breakGlass = null
  account(ids.root, ROOT, 'super_admin')
  account(ids.pnc, 'pnc@navgurukul.org', 'pnc_admin')
  account(ids.emp, 'emp@navgurukul.org', 'employee')
  account(ids.plat, 'plat@navgurukul.org', 'platform_admin')
  account(ids.fin, 'fin@navgurukul.org', 'fin_admin')
})

const move = (targetUserId: string, newRole: any, newTeam: string) =>
  updateUserAllocations({ targetUserId, targetEmail: '', newRole, newTeam })

describe('updateUserAllocations', () => {
  it('lets the root Super Admin move their own department', async () => {
    as(ids.root, 'super_admin')
    const res = await move(ids.root, 'super_admin', 'CEO Office')
    expect(res.success).toBe(true)
    expect(state.updatedAuth).toEqual([ids.root])
  })

  it('still refuses anyone changing their own role', async () => {
    account(ids.pnc, 'pnc@navgurukul.org', 'super_admin')
    as(ids.pnc, 'super_admin')
    const res = await move(ids.pnc, 'pnc_admin', 'None')
    expect(res).toMatchObject({ success: false, error: "You can't change your own role." })
    expect(state.updatedAuth).toEqual([])
  })

  it("refuses changing the root Super Admin's role, but allows their department", async () => {
    account(ids.pnc, 'pnc@navgurukul.org', 'super_admin')
    as(ids.pnc, 'super_admin')
    expect((await move(ids.root, 'employee', 'None')).success).toBe(false)
    expect((await move(ids.root, 'super_admin', 'CEO Office')).success).toBe(true)
  })

  it("refuses a Platform Admin moving a PnC Admin's department", async () => {
    as(ids.plat, 'platform_admin')
    const res = await move(ids.pnc, 'pnc_admin', 'CEO Office')
    expect(res.success).toBe(false)
    expect(state.updatedAuth).toEqual([])
  })

  it('lets a PnC Admin make an employee PnC Admin or PnC Ops', async () => {
    as(ids.pnc, 'pnc_admin')
    expect((await move(ids.emp, 'pnc_ops', 'None')).success).toBe(true)
    account(ids.emp, 'emp@navgurukul.org', 'pnc_ops')
    expect((await move(ids.emp, 'pnc_admin', 'None')).success).toBe(true)
  })

  it('refuses a PnC Admin granting a Finance role, or changing a Fin Admin', async () => {
    as(ids.pnc, 'pnc_admin')
    expect((await move(ids.emp, 'fin_admin', 'None')).success).toBe(false)
    expect((await move(ids.fin, 'pnc_ops', 'None')).success).toBe(false)
    expect(state.updatedAuth).toEqual([])
  })

  it('lets a Fin Admin make an employee Fin Admin or Fin Ops', async () => {
    as(ids.fin, 'fin_admin')
    expect((await move(ids.emp, 'fin_ops', 'None')).success).toBe(true)
    account(ids.emp, 'emp@navgurukul.org', 'fin_ops')
    expect((await move(ids.emp, 'fin_admin', 'None')).success).toBe(true)
  })

  it('refuses a Fin Admin granting a PnC role, or changing a PnC Admin', async () => {
    as(ids.fin, 'fin_admin')
    expect((await move(ids.emp, 'pnc_ops', 'None')).success).toBe(false)
    expect((await move(ids.pnc, 'fin_ops', 'None')).success).toBe(false)
    expect(state.updatedAuth).toEqual([])
  })

  it("refuses a Fin Admin moving anyone's department", async () => {
    as(ids.fin, 'fin_admin')
    const res = await move(ids.emp, 'fin_ops', 'CEO Office')
    expect(res.success).toBe(false)
    expect(state.updatedAuth).toEqual([])
  })

  it("moves the employee record's department, using only columns the table has", async () => {
    as(ids.root, 'super_admin')
    expect((await move(ids.emp, 'employee', 'CEO Office')).success).toBe(true)
    expect(state.employeeUpdates).toHaveLength(1)
    expect(Object.keys(state.employeeUpdates[0]).sort()).toEqual(['team', 'team_id', 'updated_at'])
    expect(state.employeeUpdates[0].team).toBe('CEO Office')
  })

  it('says so when the employee record could not be moved', async () => {
    as(ids.root, 'super_admin')
    state.employeeError = { message: 'boom' }
    const res = await move(ids.emp, 'employee', 'CEO Office')
    expect(res).toMatchObject({ success: false, error: expect.stringContaining('department was not') })
  })

  it('writes one allocation id into both audit records of a save', async () => {
    as(ids.root, 'super_admin')
    const res = await move(ids.emp, 'platform_ops', 'CEO Office')
    expect(res.success).toBe(true)
    expect(state.audit).toHaveLength(1)
    expect(state.trail).toHaveLength(1)
    const id = state.audit[0].changed_data.allocation_id
    expect(id).toMatch(/^[0-9a-f-]{36}$/)
    expect(state.trail[0].metadata.allocation_id).toBe(id)
    expect(state.audit[0].changed_data.changes).toHaveLength(2)
  })
})

describe('updateUserAllocations, break-glass', () => {
  const bg = '00000000-0000-4000-8000-000000000009'

  /** A break-glass account holding `role`; `onScreen` is whether that role has `manageUsers`. */
  function breakGlassAs(role: string, onScreen = false) {
    account(bg, 'bg@navgurukul.org', role)
    as(bg, role)
    state.guardOk = onScreen
    state.breakGlass = state.caller
  }

  it('lets a break-glass employee change their own role', async () => {
    breakGlassAs('employee')
    const res = await move(bg, 'pnc_admin', 'None')
    expect(res.success).toBe(true)
    expect(state.updatedAuth).toEqual([bg])
    expect(state.audit[0].changed_data.break_glass).toBe(true)
    expect(state.trail[0].metadata.break_glass).toBe(true)
  })

  it('lets a break-glass account promote, demote and move anyone else', async () => {
    breakGlassAs('employee')
    expect((await move(ids.emp, 'platform_admin', 'Engineering')).success).toBe(true)
    expect((await move(ids.pnc, 'employee', 'None')).success).toBe(true)
    expect(state.updatedAuth).toEqual([ids.emp, ids.pnc])
  })

  it('goes past what the role it holds could grant', async () => {
    // Platform Admin may grant Platform Ops only, and cannot touch a PnC Admin.
    breakGlassAs('platform_admin', true)
    const res = await move(ids.pnc, 'fin_admin', 'Finance')
    expect(res.success).toBe(true)
    expect(state.audit[0].changed_data.break_glass).toBe(true)
  })

  it('never grants Super Admin, to themselves or anyone', async () => {
    breakGlassAs('employee')
    expect(await move(bg, 'super_admin', 'None')).toMatchObject({ success: false })
    expect(await move(ids.emp, 'super_admin', 'None')).toMatchObject({ success: false })
    expect(state.updatedAuth).toEqual([])
  })

  it('never changes a Super Admin, role or department', async () => {
    account(ids.pnc, 'pnc@navgurukul.org', 'super_admin')
    breakGlassAs('employee')
    expect(await move(ids.pnc, 'employee', 'None')).toMatchObject({
      success: false,
      error: 'Break-glass access cannot change a Super Admin.',
    })
    expect(await move(ids.pnc, 'super_admin', 'Engineering')).toMatchObject({ success: false })
    expect(await move(ids.root, 'employee', 'None')).toMatchObject({ success: false })
    expect(state.updatedAuth).toEqual([])
  })

  it('does not offer the portal roles', async () => {
    breakGlassAs('employee')
    expect(await move(ids.emp, 'candidate', 'None')).toMatchObject({ success: false })
    expect(state.updatedAuth).toEqual([])
  })

  it('refuses the same account once the switch is off', async () => {
    breakGlassAs('employee')
    state.breakGlass = null
    expect(await move(bg, 'pnc_admin', 'None')).toMatchObject({ success: false })
    expect(state.updatedAuth).toEqual([])
  })

  it('leaves an ordinary change unmarked', async () => {
    as(ids.root, 'super_admin')
    expect((await move(ids.emp, 'pnc_ops', 'None')).success).toBe(true)
    expect(state.audit[0].changed_data.break_glass).toBe(false)
  })
})
