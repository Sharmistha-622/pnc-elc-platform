import { describe, it, expect, vi } from 'vitest'

// The pure decisions under test never touch the request-bound clients.
vi.mock('@/lib/supabase/server', () => ({ createServerSupabaseClient: vi.fn() }))
vi.mock('@/lib/forms/currentEmployee', () => ({ getCurrentEmployee: vi.fn() }))
vi.mock('@/lib/rbac/getCurrentUserRole', () => ({ getCurrentUserRole: vi.fn() }))

import { isTeamScoped, mayReadFeedbackText } from './access'
import type { UserRole } from '@/lib/role-constants'

function as(role: UserRole, originalRole: UserRole = role) {
  return { role, originalRole }
}

describe('mayReadFeedbackText', () => {
  it('lets the roles that read performance in full read the text', () => {
    expect(mayReadFeedbackText(as('super_admin'))).toBe(true)
    expect(mayReadFeedbackText(as('pnc_admin'))).toBe(true)
    expect(mayReadFeedbackText(as('exec_view'))).toBe(true)
  })

  it('lets a manager read it; scoping to their team is checked separately', () => {
    expect(mayReadFeedbackText(as('manager'))).toBe(true)
  })

  it('gives PnC Ops statuses only', () => {
    // performance: status_only
    expect(mayReadFeedbackText(as('pnc_ops'))).toBe(false)
  })

  it('refuses outcome-only and no-access roles', () => {
    expect(mayReadFeedbackText(as('fin_admin'))).toBe(false)
    expect(mayReadFeedbackText(as('platform_admin'))).toBe(false)
    expect(mayReadFeedbackText(as('employee'))).toBe(false)
  })

  it('follows the narrower role while emulating', () => {
    expect(mayReadFeedbackText(as('pnc_ops', 'super_admin'))).toBe(false)
  })
})

describe('isTeamScoped', () => {
  it('scopes a manager to their team', () => {
    expect(isTeamScoped(as('manager'))).toBe(true)
  })

  it('scopes a Super Admin viewing the app as Manager the same way', () => {
    expect(isTeamScoped(as('manager', 'super_admin'))).toBe(true)
  })

  it('leaves org-wide roles unscoped', () => {
    expect(isTeamScoped(as('pnc_admin'))).toBe(false)
    expect(isTeamScoped(as('pnc_ops'))).toBe(false)
    expect(isTeamScoped(as('exec_view'))).toBe(false)
  })
})
