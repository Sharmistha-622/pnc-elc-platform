import { describe, it, expect } from 'vitest'
import {
  BREAK_GLASS_EMAILS,
  BREAK_GLASS_GRANTABLE_ROLES,
  canBreakGlassChange,
  isBreakGlassEmail,
  isBreakGlassRoute,
} from './breakGlass'
import { ROLE_CODES } from './roles'

describe('break-glass rules', () => {
  it('names two accounts and matches them ignoring case and spaces', () => {
    expect(BREAK_GLASS_EMAILS).toHaveLength(2)
    for (const email of BREAK_GLASS_EMAILS) {
      expect(isBreakGlassEmail(email)).toBe(true)
      expect(isBreakGlassEmail(` ${email.toUpperCase()} `)).toBe(true)
    }
    expect(isBreakGlassEmail('someone@example.com')).toBe(false)
    expect(isBreakGlassEmail(null)).toBe(false)
    expect(isBreakGlassEmail('')).toBe(false)
  })

  it('opens the users screen and nothing else', () => {
    expect(isBreakGlassRoute('/manage/users')).toBe(true)
    expect(isBreakGlassRoute('/manage/users/anything')).toBe(true)
    expect(isBreakGlassRoute('/manage/users-export')).toBe(false)
    expect(isBreakGlassRoute('/manage/roles')).toBe(false)
    expect(isBreakGlassRoute('/manage/settings')).toBe(false)
    expect(isBreakGlassRoute('/api/users')).toBe(false)
  })

  it('offers every role but Super Admin and the portal roles', () => {
    expect(BREAK_GLASS_GRANTABLE_ROLES).not.toContain('super_admin')
    expect(BREAK_GLASS_GRANTABLE_ROLES).not.toContain('candidate')
    expect(BREAK_GLASS_GRANTABLE_ROLES).not.toContain('pre_joiner')
    expect(BREAK_GLASS_GRANTABLE_ROLES).toHaveLength(ROLE_CODES.length - 3)
  })

  it('moves anyone but a Super Admin to any offered role', () => {
    for (const from of ROLE_CODES.filter((r) => r !== 'super_admin')) {
      for (const to of BREAK_GLASS_GRANTABLE_ROLES) {
        expect(canBreakGlassChange(from, to), `${from} → ${to}`).toEqual({ ok: true })
      }
      expect(canBreakGlassChange(from, 'super_admin')).toEqual({ ok: false, reason: 'role_not_allowed' })
    }
  })

  it('never touches a Super Admin, not even their department', () => {
    for (const to of ROLE_CODES) {
      expect(canBreakGlassChange('super_admin', to)).toEqual({ ok: false, reason: 'target_is_super_admin' })
    }
  })
})
