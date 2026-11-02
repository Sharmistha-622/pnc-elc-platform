import { describe, expect, it } from 'vitest'
import { cycleHref } from './links'
import { FEATURE_ACCESS, canAccessRoute, type UserRole } from '@/lib/role-constants'

const as = (role: UserRole | null, originalRole: UserRole | null = role) => ({
  userId: 'u1',
  email: 'someone@example.com',
  role,
  originalRole,
  isEmulating: role !== originalRole,
})

describe('cycleHref', () => {
  // Every role that can open a confirmation's report must land on a page
  // that role can open, never on a gate that bounces it to the dashboard.
  it.each(FEATURE_ACCESS.confirmations)('sends %s to a cycle page it can open', (role) => {
    const href = cycleHref(as(role), 'c1')
    expect(canAccessRoute(role, href)).toBe(true)
  })

  it('sends a line manager to My Reviews', () => {
    expect(cycleHref(as('manager'), 'c1')).toBe('/my-reviews/c1')
  })

  it('sends the review roles to the dashboard', () => {
    for (const role of FEATURE_ACCESS.reviews) expect(cycleHref(as(role), 'c1')).toBe('/reviews/c1')
  })

  it('does not widen the link while emulating', () => {
    // A manager with a forged override cookie still goes to My Reviews.
    expect(cycleHref(as('pnc_admin', 'manager'), 'c1')).toBe('/my-reviews/c1')
  })

  it('falls back to My Reviews without a session', () => {
    expect(cycleHref({ ...as(null), userId: null }, 'c1')).toBe('/my-reviews/c1')
  })
})
