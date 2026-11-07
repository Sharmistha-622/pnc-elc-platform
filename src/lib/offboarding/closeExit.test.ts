import { describe, it, expect, vi, beforeEach } from 'vitest'

// Closing an exit: the employee is marked exited, their platform access is
// ended, and only then is the revocation recorded.

const state = vi.hoisted(() => ({
  calls: [] as string[],
  employeeUpdateError: null as null | { message: string },
  endResult: { ok: true, userId: 'u-1' } as { ok: true; userId: string | null } | { ok: false; error: string },
  endArgs: [] as Array<[string | null | undefined, { endedBy: string }]>,
}))

const caseRow = {
  id: 'case-1',
  employee_id: 'emp-1',
  employee_name: 'G Gone',
  employee_email: 'g@navgurukul.org',
  status: 'fnf_pending',
  proposed_lwd: '2026-11-01',
  created_at: '2026-10-01T00:00:00Z',
  updated_at: '2026-10-01T00:00:00Z',
  employees: { name: 'G Gone', email: 'g@navgurukul.org' },
}

function table(name: string) {
  let op = 'select'
  const q: Record<string, unknown> = {}
  const chain = () => q
  Object.assign(q, {
    select: chain,
    eq: chain,
    order: chain,
    abortSignal: chain,
    insert: async () => ({ error: null }),
    update: () => {
      op = 'update'
      state.calls.push(`update:${name}`)
      return q
    },
    single: async () => ({ data: name === 'offboarding_cases' ? caseRow : null, error: null }),
    maybeSingle: async () => ({ data: null, error: null }),
    then: (resolve: (v: unknown) => void) =>
      resolve(
        op === 'update' && name === 'employees'
          ? { data: null, error: state.employeeUpdateError }
          : { data: [], error: null },
      ),
  })
  return q
}

vi.mock('@/lib/supabase/server', () => ({ createServerSupabaseClient: async () => ({ from: table }) }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminSupabaseClient: () => ({ from: table }) }))
vi.mock('next/cache', () => ({ revalidatePath: () => {} }))
vi.mock('@/lib/email/sendEmail', () => ({ sendEmail: async () => ({ success: true }) }))
vi.mock('@/lib/rbac/guard', () => ({
  guard: async () => ({
    ok: true,
    caller: { role: 'pnc_admin', originalRole: 'pnc_admin', userId: 'u-pa', email: 'pa@navgurukul.org' },
  }),
  guardResource: async () => ({ ok: true }),
  maySeeSalary: () => true,
}))
vi.mock('@/lib/rbac/endPlatformAccess', () => ({
  endPlatformAccess: async (email: string | null | undefined, opts: { endedBy: string }) => {
    state.calls.push('endPlatformAccess')
    state.endArgs.push([email, opts])
    return state.endResult
  },
}))
vi.mock('@/lib/audit/events', () => {
  const record = (label: string) => async () => {
    state.calls.push(label)
  }
  return {
    auditOffboarding: new Proxy({}, { get: (_t, key) => record(`offboarding.${String(key)}`) }),
    auditLetters: new Proxy({}, { get: (_t, key) => record(`letters.${String(key)}`) }),
    auditAccess: new Proxy({}, { get: (_t, key) => record(`access.${String(key)}`) }),
  }
})
vi.mock('@/lib/integrations/assets', () => ({ assetIntegrationService: { getEmployeeAssignedAssets: async () => null } }))
vi.mock('@/lib/integrations/attendance', () => ({ attendanceIntegrationService: { getEmployeeAttendanceSummary: async () => null } }))
vi.mock('@/lib/integrations/leave', () => ({ leaveIntegrationService: { getEmployeeLeaveSummary: async () => null } }))

import { closeOffboardingCase } from './service'

beforeEach(() => {
  state.calls = []
  state.employeeUpdateError = null
  state.endResult = { ok: true, userId: 'u-1' }
  state.endArgs = []
})

describe('closeOffboardingCase', () => {
  it('marks the employee exited, ends their access, then records the revocation', async () => {
    const result = await closeOffboardingCase('case-1', 'P&C', '2026-11-01')
    expect(result).toEqual({ success: true })

    const exited = state.calls.indexOf('update:employees')
    const ended = state.calls.indexOf('endPlatformAccess')
    const revoked = state.calls.indexOf('access.revoked')
    expect(exited).toBeGreaterThanOrEqual(0)
    expect(ended).toBeGreaterThan(exited)
    expect(revoked).toBeGreaterThan(ended)
    expect(state.endArgs[0][0]).toBe('g@navgurukul.org')
    expect(state.endArgs[0][1].endedBy).toBe('pa@navgurukul.org')
  })

  it('reports a failure to end access instead of recording a revocation', async () => {
    state.endResult = { ok: false, error: 'Could not close the account.' }
    const result = await closeOffboardingCase('case-1', 'P&C', '2026-11-01')
    expect(result.success).toBe(false)
    expect(state.calls).not.toContain('access.revoked')
  })

  it('stops before touching the account when the employee record cannot be updated', async () => {
    state.employeeUpdateError = { message: 'denied' }
    const result = await closeOffboardingCase('case-1', 'P&C', '2026-11-01')
    expect(result.success).toBe(false)
    expect(state.calls).not.toContain('endPlatformAccess')
    expect(state.calls).not.toContain('access.revoked')
  })
})
