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
}))

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/rbac/getCurrentUserRole', () => ({ IMMUTABLE_SUPER_ADMIN_EMAILS: ['root@navgurukul.org'] }))
vi.mock('@/lib/rbac/guard', () => ({
  guard: vi.fn(async () => ({ ok: true, caller: state.caller })),
}))
vi.mock('@/lib/audit/service', () => ({
  recordAuditEvent: vi.fn(async (e: any) => {
    state.trail.push(e)
    return e
  }),
}))

function table() {
  const q: any = {
    select: () => q,
    ilike: () => q,
    eq: () => q,
    or: () => q,
    limit: async () => ({ data: [] }),
    maybeSingle: async () => ({ data: null }),
    update: () => q,
    insert: async (row: any) => {
      state.audit.push(row)
      return { error: null }
    },
    then: (resolve: any) => resolve({ data: null, error: null }),
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
  account(ids.root, ROOT, 'super_admin')
  account(ids.pnc, 'pnc@navgurukul.org', 'pnc_admin')
  account(ids.emp, 'emp@navgurukul.org', 'employee')
  account(ids.plat, 'plat@navgurukul.org', 'platform_admin')
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
