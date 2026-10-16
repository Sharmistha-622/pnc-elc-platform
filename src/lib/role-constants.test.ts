import { describe, it, expect } from 'vitest'
import {
  LEGACY_ROLE_MAP,
  normalizeRole,
  roleLabel,
  assignableRoles,
  canAccessRoute,
  FEATURE_ACCESS,
  DEFAULT_ROLE,
} from './role-constants'
import { ROLE_CODES, ROLES, isSensitiveRole, canReach, type RoleCode } from './rbac/roles'

describe('normalizeRole', () => {
  it('passes a v1 code through', () => {
    for (const code of ROLE_CODES) expect(normalizeRole(code), code).toBe(code)
  })

  // Roles stored before the migration are still display names. A user whose
  // role failed to normalize would silently drop to Employee.
  it('maps every legacy display name forward', () => {
    for (const [legacy, code] of Object.entries(LEGACY_ROLE_MAP)) {
      expect(normalizeRole(legacy), legacy).toBe(code)
    }
  })

  it('lands on the lower half wherever a role split', () => {
    // PnC and Finance each became two roles. Everyone lands on the lower one
    // and Super Admin promotes the few who need more.
    expect(normalizeRole('PnC')).toBe('pnc_ops')
    expect(normalizeRole('Finance')).toBe('fin_ops')

    expect(ROLES.pnc_ops.rank).toBeLessThan(ROLES.pnc_admin.rank)
    expect(ROLES.fin_ops.rank).toBeLessThan(ROLES.fin_admin.rank)
    // Fin Ops views salary where Fin Admin edits it.
    expect(ROLES.fin_ops.access.salary.level).toBe('view')
    expect(ROLES.fin_admin.access.salary.level).toBe('edit')
  })

  it('grants nothing in the vault, even where it maps to a vault role', () => {
    // fin_ops is one of the five vault roles, so the migration does hand out a
    // vault-capable *core* role. That is safe only because of principle 3: the
    // vault has its own role table, and a role changed in core grants nothing
    // there. If that ever stops being true, this mapping becomes a privilege
    // escalation and must change to a core-only role.
    expect(isSensitiveRole('fin_ops')).toBe(true)
    expect(ROLES.fin_ops.login).toBe('core+vault')
    // The core-side check refuses without a vault session, which core cannot
    // mint — it holds no vault key.
    expect(canReach('fin_ops', 'salary', { hasVaultSession: false })).toEqual({
      ok: false,
      reason: 'needs_vault_session',
    })
  })

  it('returns null for anything unrecognised, rather than guessing', () => {
    expect(normalizeRole('Gibberish')).toBeNull()
    expect(normalizeRole('')).toBeNull()
    expect(normalizeRole(null)).toBeNull()
    expect(normalizeRole(undefined)).toBeNull()
    expect(normalizeRole(42)).toBeNull()
  })
})

describe('roleLabel', () => {
  // The regression this guards: a switch on "Super Admin" silently stopped
  // matching when codes changed, because the parameter was typed `string`.
  // Labels now come from one place, so a role cannot render as a raw code.
  it('gives every role a human label that is not its code', () => {
    for (const code of ROLE_CODES) {
      const label = roleLabel(code)
      expect(label, code).toBeTruthy()
      expect(label, code).not.toBe(code)
      expect(label, code).not.toMatch(/_/)
    }
  })

  it('does not throw on no role', () => {
    expect(roleLabel(null)).toBe('No role')
  })
})

describe('FEATURE_ACCESS', () => {
  it('names only real roles', () => {
    for (const [feature, roles] of Object.entries(FEATURE_ACCESS)) {
      for (const role of roles) {
        expect(ROLE_CODES, `${feature} lists ${role}`).toContain(role)
      }
    }
  })

  // Candidates and pre-joiners use the token portal, never the dashboard.
  it('gives no dashboard feature to a candidate or pre-joiner', () => {
    for (const roles of Object.values(FEATURE_ACCESS)) {
      expect(roles).not.toContain('candidate')
      expect(roles).not.toContain('pre_joiner')
    }
  })

  it('lets only Super Admin and Platform Admin manage users', () => {
    expect(FEATURE_ACCESS.manageUsers.sort()).toEqual(['platform_admin', 'super_admin'])
  })
})

describe('canAccessRoute', () => {
  it('denies everything to no role', () => {
    for (const url of ['/employees', '/manage/users', '/onboarding', '/api/employees']) {
      expect(canAccessRoute(null, url), url).toBe(false)
    }
  })

  // The letter screens live under /manage but belong to onboarding; gating
  // them as "manage users" would lock P&C out of their own offer letters.
  it('keeps the letter screens with onboarding, not manage-users', () => {
    expect(canAccessRoute('pnc_admin', '/manage/letter-templates')).toBe(true)
    expect(canAccessRoute('pnc_ops', '/manage/letters')).toBe(true)
    expect(canAccessRoute('pnc_admin', '/manage/users')).toBe(false)
  })

  it('gates an API route the same as the screen it serves', () => {
    for (const role of ROLE_CODES) {
      expect(canAccessRoute(role, '/api/employees'), role).toBe(
        canAccessRoute(role, '/employees')
      )
    }
  })

  it('allows an unmapped route to any signed-in role', () => {
    expect(canAccessRoute(DEFAULT_ROLE, '/profile')).toBe(true)
  })
})

describe('assignableRoles', () => {
  it('never offers a lifecycle role in a picker', () => {
    for (const actor of [...ROLE_CODES, null] as (RoleCode | null)[]) {
      const offered = assignableRoles(actor)
      for (const code of ['candidate', 'pre_joiner', 'employee', 'manager'] as RoleCode[]) {
        expect(offered, `${actor} offered ${code}`).not.toContain(code)
      }
    }
  })

  it('never lets Platform Admin offer a role that can see sensitive data', () => {
    for (const code of assignableRoles('platform_admin')) {
      expect(ROLES[code].login, code).toBe('core')
    }
  })
})
