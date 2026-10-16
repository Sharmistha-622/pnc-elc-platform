import { describe, it, expect } from 'vitest'
import {
  ROLES,
  ROLE_CODES,
  RESOURCES,
  ALL_ROLES,
  accessFor,
  canReach,
  canImpersonate,
  canGrantRole,
  grantableRoles,
  isSensitiveRole,
  isAutoAssigned,
  isVaultResource,
  type RoleCode,
} from './roles'

describe('the matrix', () => {
  it('has twelve roles', () => {
    expect(ROLE_CODES).toHaveLength(12)
  })

  it('gives every role a cell for every resource', () => {
    for (const role of ALL_ROLES) {
      for (const resource of RESOURCES) {
        expect(role.access[resource], `${role.code}.${resource}`).toBeDefined()
      }
    }
  })

  it('keeps each code and rank-within-group unique', () => {
    expect(new Set(ROLE_CODES).size).toBe(ROLE_CODES.length)
    const byGroup = new Map<string, number[]>()
    for (const r of ALL_ROLES) byGroup.set(r.group, [...(byGroup.get(r.group) ?? []), r.rank])
    for (const [group, ranks] of byGroup) {
      expect(new Set(ranks).size, `duplicate rank in ${group}`).toBe(ranks.length)
    }
  })

  // "Seven work only in core; five also sign in to the vault and are the only
  // roles that can see salary, bank details or written feedback."
  it('has exactly five roles with a vault login', () => {
    const vault = ALL_ROLES.filter((r) => r.login === 'core+vault').map((r) => r.code)
    expect(vault.sort()).toEqual(
      ['exec_view', 'fin_admin', 'fin_ops', 'pnc_admin', 'super_admin'].sort()
    )
    expect(ALL_ROLES.filter((r) => r.login === 'core')).toHaveLength(7)
  })

  it('salary is visible to five roles and editable by three', () => {
    const visible = ALL_ROLES.filter((r) => r.access.salary.level !== 'none' && r.access.salary.scope === 'all')
    const editable = visible.filter((r) => r.access.salary.level === 'edit')
    expect(visible.map((r) => r.code).sort()).toEqual(
      ['exec_view', 'fin_admin', 'fin_ops', 'pnc_admin', 'super_admin'].sort()
    )
    expect(editable.map((r) => r.code).sort()).toEqual(
      ['fin_admin', 'pnc_admin', 'super_admin'].sort()
    )
  })

  it('never lets a core-only role see anything sensitive', () => {
    const sensitive = RESOURCES.filter(isVaultResource)
    for (const role of ALL_ROLES.filter((r) => r.login === 'core')) {
      for (const resource of sensitive) {
        const access = role.access[resource]
        // An own-scoped cell is the person's own data reaching them, which is
        // not the platform team seeing someone else's.
        // A core-side status or decision, own/own-team data read through a
        // logged vault function, and a letter are all legitimate. What a
        // core-only role must never have is org-wide sight of the text itself.
        const reach = canReach(role.code, resource, { hasVaultSession: true })
        if (!reach.ok) continue
        expect(reach.via, `${role.code}.${resource}`).not.toBe('vault_session')
      }
    }
  })

  it('keeps the platform team out of sensitive data entirely', () => {
    for (const code of ['platform_admin', 'platform_ops'] as RoleCode[]) {
      expect(ROLES[code].login).toBe('core')
      expect(accessFor(code, 'salary').level).toBe('none')
      expect(accessFor(code, 'bank').level).toBe('none')
      expect(accessFor(code, 'performance').level).toBe('none')
      expect(accessFor(code, 'identity').level).toBe('none')
    }
  })

  it('only lets the platform roles edit config', () => {
    const editors = ALL_ROLES.filter((r) => r.access.config.level === 'edit').map((r) => r.code)
    expect(editors.sort()).toEqual(['platform_admin', 'super_admin'].sort())
  })
})

describe('canReach', () => {
  it('refuses a vault resource without a vault session', () => {
    expect(canReach('pnc_admin', 'salary')).toEqual({ ok: false, reason: 'needs_vault_session' })
  })

  it('allows it with one, and marks the read as logged', () => {
    expect(canReach('pnc_admin', 'salary', { hasVaultSession: true })).toEqual({
      ok: true,
      access: ROLES.pnc_admin.access.salary,
      via: 'vault_session',
      logged: true,
    })
  })

  // A vault session must not rescue a role the matrix never granted.
  it('still refuses a role with no access, even with a vault session', () => {
    expect(canReach('platform_admin', 'salary', { hasVaultSession: true })).toEqual({
      ok: false,
      reason: 'no_access',
    })
  })

  it('does not require a vault session for core resources', () => {
    expect(canReach('pnc_ops', 'general')).toMatchObject({ ok: true, logged: false })
  })

  it("serves a manager's own-team feedback through a logged function", () => {
    // Manager has no vault login, yet reads their team's written feedback.
    expect(ROLES.manager.login).toBe('core')
    expect(canReach('manager', 'performance')).toMatchObject({
      ok: true,
      via: 'logged_function',
      logged: true,
    })
  })

  it('serves PnC Ops the feedback status from core, never the text', () => {
    const reach = canReach('pnc_ops', 'performance')
    expect(reach).toMatchObject({ ok: true, via: 'core', logged: false })
    expect(accessFor('pnc_ops', 'performance').qualifier).toBe('status_only')
  })

  it('serves Fin Admin the outcome from core, not the written feedback', () => {
    expect(canReach('fin_admin', 'performance')).toMatchObject({ ok: true, via: 'core' })
  })

  it('reaches an employee with their own salary only through a letter', () => {
    expect(canReach('employee', 'salary')).toMatchObject({ ok: true, via: 'letter' })
  })

  it('requires a vault session for org-wide salary', () => {
    expect(canReach('fin_ops', 'salary')).toEqual({ ok: false, reason: 'needs_vault_session' })
    expect(canReach('fin_ops', 'salary', { hasVaultSession: true })).toMatchObject({
      ok: true,
      via: 'vault_session',
      logged: true,
    })
  })
})

describe('canImpersonate', () => {
  it('lets Super Admin be anyone', () => {
    for (const code of ROLE_CODES.filter((c) => c !== 'super_admin')) {
      expect(canImpersonate('super_admin', code), code).toBe(true)
    }
  })

  it('allows a lower rank in the same group', () => {
    expect(canImpersonate('pnc_admin', 'pnc_ops')).toBe(true)
    expect(canImpersonate('fin_admin', 'fin_ops')).toBe(true)
    expect(canImpersonate('platform_admin', 'platform_ops')).toBe(true)
  })

  it('refuses across groups, however senior', () => {
    // The whole point: a PnC Admin must not become Fin Ops to reach bank details.
    expect(canImpersonate('pnc_admin', 'fin_ops')).toBe(false)
    expect(canImpersonate('platform_admin', 'pnc_ops')).toBe(false)
    expect(canImpersonate('exec_view', 'employee')).toBe(false)
  })

  it('refuses upward and sideways', () => {
    expect(canImpersonate('pnc_ops', 'pnc_admin')).toBe(false)
    expect(canImpersonate('pnc_admin', 'pnc_admin')).toBe(false)
    expect(canImpersonate(null, 'employee')).toBe(false)
  })

  it('never lets anyone impersonate Super Admin', () => {
    for (const code of ROLE_CODES.filter((c) => c !== 'super_admin')) {
      expect(canImpersonate(code, 'super_admin'), code).toBe(false)
    }
  })
})

describe('canGrantRole', () => {
  it('lets Super Admin grant every sensitive role', () => {
    for (const code of ROLE_CODES.filter((c) => isSensitiveRole(c) && c !== 'super_admin')) {
      expect(canGrantRole('super_admin', code), code).toEqual({ ok: true })
    }
  })

  it('never lets Platform Admin grant anything sensitive', () => {
    for (const code of ROLE_CODES.filter(isSensitiveRole)) {
      expect(canGrantRole('platform_admin', code).ok, code).toBe(false)
    }
  })

  it('lets Platform Admin grant Platform Ops and nothing else', () => {
    expect(canGrantRole('platform_admin', 'platform_ops')).toEqual({ ok: true })
    expect(grantableRoles('platform_admin')).toEqual(['platform_ops'])
  })

  it('refuses the automatic roles to everyone, Super Admin included', () => {
    for (const code of ROLE_CODES.filter(isAutoAssigned)) {
      expect(canGrantRole('super_admin', code), code).toEqual({
        ok: false,
        reason: 'role_is_automatic',
      })
    }
  })

  it('refuses the owner role as not grantable in-app', () => {
    expect(canGrantRole('super_admin', 'super_admin')).toEqual({
      ok: false,
      reason: 'owner_role_is_not_grantable',
    })
  })

  it('refuses a self-change before anything else', () => {
    expect(canGrantRole('super_admin', 'pnc_admin', { isSelf: true })).toEqual({
      ok: false,
      reason: 'cannot_change_own_role',
    })
  })

  it('refuses every ordinary role', () => {
    for (const actor of ['pnc_admin', 'fin_admin', 'exec_view', 'manager', 'employee'] as RoleCode[]) {
      expect(grantableRoles(actor), actor).toEqual([])
    }
    expect(grantableRoles(null)).toEqual([])
  })
})
