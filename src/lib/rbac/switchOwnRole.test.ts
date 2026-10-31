import { describe, it, expect, vi, beforeEach } from 'vitest'

const state = vi.hoisted(() => ({
  caller: null as null | { userId: string; email: string; role: string; originalRole: string },
  calls: [] as Array<Record<string, unknown>>,
}))

vi.mock('@/lib/rbac/breakGlassAccess', () => ({ breakGlassCaller: vi.fn(async () => state.caller) }))
vi.mock('@/lib/rbac/updateUserAllocations', () => ({
  updateUserAllocations: vi.fn(async (input: Record<string, unknown>) => {
    state.calls.push(input)
    return { success: true }
  }),
}))

import { getOwnRoleSwitch, switchOwnRole } from './switchOwnRole'

const ME = '00000000-0000-4000-8000-0000000000aa'

function as(role: string) {
  state.caller = { userId: ME, email: 'bg@example.com', role, originalRole: role }
}

beforeEach(() => {
  state.caller = null
  state.calls = []
})

describe('switchOwnRole', () => {
  it('is not offered, and refuses, without break-glass access', async () => {
    expect(await getOwnRoleSwitch()).toEqual({ available: false })
    expect(await switchOwnRole('pnc_admin')).toMatchObject({ success: false })
    expect(state.calls).toEqual([])
  })

  it('offers every role but Super Admin and the portal roles', async () => {
    as('employee')
    const offer = await getOwnRoleSwitch()
    expect(offer).toMatchObject({ available: true, current: 'employee' })
    if (!offer.available) throw new Error('unreachable')
    expect(offer.options).not.toContain('super_admin')
    expect(offer.options).not.toContain('candidate')
    expect(offer.options).toContain('pnc_admin')
  })

  it('changes the caller’s own role, keeping their department', async () => {
    as('employee')
    expect(await switchOwnRole('fin_admin')).toEqual({ success: true, error: undefined })
    expect(state.calls).toHaveLength(1)
    expect(state.calls[0]).toMatchObject({ targetUserId: ME, newRole: 'fin_admin' })
    expect(state.calls[0].newTeam).toBeUndefined()
  })

  it('never switches to Super Admin, or to a role that does not exist', async () => {
    as('employee')
    expect(await switchOwnRole('super_admin')).toMatchObject({ success: false })
    expect(await switchOwnRole('candidate')).toMatchObject({ success: false })
    expect(await switchOwnRole('root')).toMatchObject({ success: false })
    expect(state.calls).toEqual([])
  })

  it('never switches a Super Admin away from it', async () => {
    as('super_admin')
    expect(await getOwnRoleSwitch()).toEqual({ available: false })
    expect(await switchOwnRole('employee')).toMatchObject({ success: false })
    expect(state.calls).toEqual([])
  })
})
