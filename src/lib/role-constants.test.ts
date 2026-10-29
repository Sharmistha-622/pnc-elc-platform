import fs from 'node:fs'
import path from 'node:path'
import { describe, it, expect } from 'vitest'
import {
  LEGACY_ROLE_MAP,
  normalizeRole,
  roleLabel,
  assignableRoles,
  canAccessRoute,
  isPortalOnlyRole,
  FEATURE_ACCESS,
  DEFAULT_ROLE,
} from './role-constants'
import {
  ROLE_CODES,
  ROLES,
  isSensitiveRole,
  canReach,
  canWrite,
  type RoleCode,
} from './rbac/roles'

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

  it('lets only Super Admin, Platform Admin and the PnC and Finance admins manage users', () => {
    expect(FEATURE_ACCESS.manageUsers.sort()).toEqual([
      'fin_admin',
      'platform_admin',
      'pnc_admin',
      'super_admin',
    ])
  })
})

describe('canAccessRoute', () => {
  it('denies everything to no role', () => {
    for (const url of ['/employees', '/manage/users', '/onboarding', '/api/employees']) {
      expect(canAccessRoute(null, url), url).toBe(false)
    }
  })

  // The letter screens live under /manage but are P&C's, not account
  // administration; gating them as "manage users" would lock P&C out of their
  // own offer letters.
  it('keeps the letter screens out of manage-users', () => {
    expect(canAccessRoute('pnc_admin', '/manage/letter-templates')).toBe(true)
    expect(canAccessRoute('fin_admin', '/manage/letters')).toBe(true)
    // Platform Admin manages users but has no letters: the letters entry, not
    // the general /manage one, decides.
    expect(canAccessRoute('platform_admin', '/manage/users')).toBe(true)
    expect(canAccessRoute('platform_admin', '/manage/letters')).toBe(false)
  })

  // Every issued letter quotes a CTC. A role that may not read salary may not
  // open the letters, whatever else it does in the pipeline.
  it('opens the letters only to roles that may read salary', () => {
    for (const role of FEATURE_ACCESS.letters) {
      expect(ROLES[role].access.salary.level, role).not.toBe('none')
    }
    expect(canAccessRoute('pnc_ops', '/manage/letters')).toBe(false)
    expect(canAccessRoute('pnc_ops', '/api/candidate-letters')).toBe(false)
  })

  // Every candidate screen shows the CTC and the salary annexure. A manager's
  // salary access is `none`, so the pipeline is closed to them; their own
  // team's joiners are general data and belong on My Team.
  it('keeps a manager out of the candidate pipeline and the org directory', () => {
    for (const url of ['/onboarding', '/onboarding/review/x', '/api/onboarding', '/employees', '/api/employees']) {
      expect(canAccessRoute('manager', url), url).toBe(false)
    }
    expect(canAccessRoute('manager', '/my-team')).toBe(true)
  })

  it('lets Exec View read confirmations but not start one', () => {
    expect(canAccessRoute('exec_view', '/confirmations')).toBe(true)
    expect(canAccessRoute('exec_view', '/confirmations/new')).toBe(false)
    expect(canAccessRoute('manager', '/confirmations/new')).toBe(true)
  })

  // They used to be gated on `onboarding`, which lists `manager` — so every
  // line manager could open the offer-letter editor and the signing
  // authorities. Running the pipeline is not the same as drafting the letters.
  it('keeps a manager out of the letter and signatory screens', () => {
    for (const url of ['/manage/letter-templates', '/manage/letters', '/manage/signatories']) {
      expect(canAccessRoute('manager', url), url).toBe(false)
    }
  })

  // Each of these was unmapped, so `canAccessRoute` fell through to "no match
  // means allow" and handed them to every signed-in user. /offboarding was the
  // sharp one: it loads every exit case in the organisation.
  it('gates the screens that used to fall through to everyone', () => {
    for (const url of ['/offboarding', '/reports', '/audit']) {
      expect(canAccessRoute('employee', url), url).toBe(false)
    }
    expect(canAccessRoute('pnc_admin', '/offboarding')).toBe(true)
    expect(canAccessRoute('exec_view', '/reports')).toBe(true)
    expect(canAccessRoute('platform_ops', '/audit')).toBe(true)
    expect(canAccessRoute('manager', '/my-team')).toBe(true)
  })

  // Nothing derives `manager` from the reporting line yet, so a line manager
  // is usually stored as `employee`. The page itself lists only their own
  // reportees.
  it('lets an employee open their own team', () => {
    expect(canAccessRoute('employee', '/my-team')).toBe(true)
  })

  // Every staff role is also somebody's employee.
  it('gives every staff role its own profile and forms', () => {
    for (const role of FEATURE_ACCESS.dashboard) {
      expect(canAccessRoute(role, '/profile'), role).toBe(true)
      expect(canAccessRoute(role, '/my-forms'), role).toBe(true)
    }
  })

  // A nominated peer is usually an ordinary employee, so peer feedback cannot
  // sit behind `confirmations`.
  it('lets an ordinary employee open a peer feedback request', () => {
    expect(canAccessRoute('employee', '/feedback/abc123')).toBe(true)
    expect(canAccessRoute('employee', '/confirmations')).toBe(false)
  })

  it('opens platform settings to PnC Admin, who owns the rules in them', () => {
    expect(canAccessRoute('pnc_admin', '/manage/settings/confirmation')).toBe(true)
    expect(canAccessRoute('pnc_admin', '/manage/emails')).toBe(true)
    // Reaching the screen is not editing it — `settings/access.ts` holds that
    // line, from `config: view` in the matrix.
    expect(canWrite('pnc_admin', 'config')).toBe(false)
    expect(canWrite('platform_admin', 'config')).toBe(true)
  })

  it('refuses the dashboard itself to a portal-only role', () => {
    for (const role of ['candidate', 'pre_joiner'] as RoleCode[]) {
      expect(canAccessRoute(role, '/'), role).toBe(false)
      expect(isPortalOnlyRole(role), role).toBe(true)
    }
    expect(canAccessRoute('employee', '/')).toBe(true)
    expect(isPortalOnlyRole('employee')).toBe(false)
    expect(isPortalOnlyRole(null)).toBe(false)
  })

  it('gates an API route the same as the screen it serves', () => {
    for (const role of ROLE_CODES) {
      expect(canAccessRoute(role, '/api/employees'), role).toBe(
        canAccessRoute(role, '/employees')
      )
    }
  })

  // This is the fail-open branch, and it is why every dashboard route has to
  // appear in ROUTE_FEATURE. Kept as a test so the behaviour is deliberate
  // rather than discovered again later.
  it('still allows a route nobody has mapped', () => {
    expect(canAccessRoute(DEFAULT_ROLE, '/some-screen-nobody-registered')).toBe(true)
  })

  // ...but never an API route. `/api/campuses` and friends were unmapped, so
  // their POST and PATCH answered to every session, a candidate's included.
  it('refuses an API route nobody has mapped, even to Super Admin', () => {
    expect(canAccessRoute('super_admin', '/api/some-handler-nobody-registered')).toBe(false)
  })

  it('maps every API route handler in the app', () => {
    // Walks the real route tree, so a new handler without an entry fails here
    // rather than in production.
    const root = path.join(process.cwd(), 'src/app/api')
    const publicPrefixes = ['/api/onboarding/token/', '/api/cron/']
    const routes: string[] = []
    const walk = (dir: string) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name)
        if (entry.isDirectory()) walk(full)
        else if (entry.name === 'route.ts') {
          routes.push('/api/' + path.relative(root, dir).split(path.sep).join('/'))
        }
      }
    }
    walk(root)
    expect(routes.length).toBeGreaterThan(10)
    for (const route of routes) {
      if (publicPrefixes.some((p) => (route + '/').startsWith(p))) continue
      const concrete = route.replace(/\[[^\]]+\]/g, 'x')
      const reachable = ROLE_CODES.filter((r) => canAccessRoute(r, concrete))
      expect(reachable.length, `${route} is reachable by nobody — unmapped?`).toBeGreaterThan(0)
    }
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
