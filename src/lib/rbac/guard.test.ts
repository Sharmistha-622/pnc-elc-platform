import { describe, it, expect, vi } from 'vitest'

// `guard.ts` imports the request-bound role lookup; the pure check under test
// does not touch it.
vi.mock('@/lib/rbac/getCurrentUserRole', () => ({ getCurrentUserRole: vi.fn() }))

import { passes, maySeeSalary } from './guard'
import type { ResolvedRole } from './resolveRole'
import type { UserRole } from '@/lib/role-constants'

function as(role: UserRole | null, originalRole: UserRole | null = role): ResolvedRole {
  return {
    userId: role ? 'u1' : null,
    email: 'someone@navgurukul.org',
    role,
    originalRole,
    isEmulating: role !== originalRole,
  }
}

describe('passes', () => {
  it('admits a role the feature lists', () => {
    expect(passes(as('pnc_ops'), 'onboarding')).toBe(true)
  })

  it('refuses a role the feature does not list', () => {
    expect(passes(as('platform_admin'), 'onboarding')).toBe(false)
  })

  it('refuses an anonymous caller outright', () => {
    expect(passes(as(null), 'self')).toBe(false)
  })

  it('refuses a Super Admin emulating a role that is not allowed', () => {
    // Emulation narrows: the effective role must pass too.
    expect(passes(as('employee', 'super_admin'), 'onboarding')).toBe(false)
  })

  it('refuses when only the effective role passes', () => {
    // The override cookie can never widen what the real role may do.
    expect(passes(as('pnc_admin', 'employee'), ['pnc_admin'])).toBe(false)
  })

  it('accepts an explicit role list', () => {
    expect(passes(as('fin_admin'), ['super_admin', 'fin_admin'])).toBe(true)
  })
})

describe('maySeeSalary', () => {
  it('follows the matrix', () => {
    expect(maySeeSalary({ role: 'pnc_admin', originalRole: 'pnc_admin' })).toBe(true)
    expect(maySeeSalary({ role: 'pnc_ops', originalRole: 'pnc_ops' })).toBe(false)
    expect(maySeeSalary({ role: 'manager', originalRole: 'manager' })).toBe(false)
    expect(maySeeSalary({ role: 'platform_admin', originalRole: 'platform_admin' })).toBe(false)
  })
})
