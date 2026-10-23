// ============================================================================
// RBAC v1 — the twelve roles, and what each can do
// ----------------------------------------------------------------------------
// The executable copy of "PnC ELC — RBAC v1". `docs/rbac.md` is the readable
// copy; `roles.doc.test.ts` fails if the two disagree, so the matrix cannot
// drift from the code the way it did when roles lived in three places at once.
//
// Two things are deliberately separate here:
//
//   Rank controls impersonation, not access. Access comes from the role.
//   Login surface controls where a role can sign in. A role granted in core
//   grants nothing in the vault — the vault has its own login and role table.
// ============================================================================

export const ROLE_CODES = [
  'super_admin',
  'pnc_admin',
  'pnc_ops',
  'fin_admin',
  'fin_ops',
  'exec_view',
  'platform_admin',
  'platform_ops',
  'manager',
  'employee',
  'pre_joiner',
  'candidate',
] as const

export type RoleCode = (typeof ROLE_CODES)[number]

/**
 * The matrix groups roles under seven headings. (The summary in the source
 * document says six; the matrix itself lists Owner, PnC, Finance, Leadership,
 * Platform, Line and Lifecycle. The matrix is the more specific of the two and
 * is what is encoded here — see the open question in docs/rbac.md.)
 */
export type RoleGroup =
  | 'owner'
  | 'pnc'
  | 'finance'
  | 'leadership'
  | 'platform'
  | 'line'
  | 'employee'
  | 'onboarding'

/** Where a role can sign in. The vault is a separate project with its own login. */
export type LoginSurface = 'core' | 'core+vault'

/** Who may put a person into this role. */
export type GrantedBy =
  | 'owner' // the account holder; not grantable in-app at all
  | 'super_admin'
  | 'platform_admin'
  | 'auto' // the lifecycle or the reporting line assigns it; never by hand

/** The columns of the data-access matrix. */
export const RESOURCES = [
  'general', // name, team, email
  'identity', // phone, ID documents
  'bank', // account number, IFSC
  'salary', // CTC, increments
  'performance', // written feedback, decisions
  'config', // templates, automation
] as const

export type Resource = (typeof RESOURCES)[number]

export type AccessLevel = 'edit' | 'view' | 'none'

/** How far an access level reaches. */
export type AccessScope = 'all' | 'own' | 'own_team'

/**
 * Narrows what a cell actually permits, where the matrix says something more
 * specific than "view". These are the cells most likely to be got wrong, so
 * each is named rather than flattened into a plain `view`.
 */
export type AccessQualifier =
  | 'status_only' // sees whether something was submitted, never the text
  | 'outcomes_only' // sees the decision, never the written feedback
  | 'payroll_export_only' // visible on the payroll screen and export, nowhere else
  | 'via_letters' // reaches the person through a letter, never a screen
  | 'insert_only' // may submit, may not read back
  | 'with_logs' // read carries a log entry the role can also see

export interface Access {
  level: AccessLevel
  scope: AccessScope
  qualifier?: AccessQualifier
}

export interface RoleDefinition {
  code: RoleCode
  label: string
  group: RoleGroup
  /** Impersonation only. A higher rank does not imply more access. */
  rank: number
  login: LoginSurface
  grantedBy: GrantedBy
  access: Record<Resource, Access>
}

const none: Access = { level: 'none', scope: 'all' }
const edit: Access = { level: 'edit', scope: 'all' }
const view: Access = { level: 'view', scope: 'all' }

export const ROLES: Record<RoleCode, RoleDefinition> = {
  super_admin: {
    code: 'super_admin',
    label: 'Super Admin',
    group: 'owner',
    rank: 10,
    login: 'core+vault',
    grantedBy: 'owner',
    access: { general: edit, identity: edit, bank: edit, salary: edit, performance: edit, config: edit },
  },

  pnc_admin: {
    code: 'pnc_admin',
    label: 'PnC Admin',
    group: 'pnc',
    rank: 8,
    login: 'core+vault',
    grantedBy: 'super_admin',
    access: {
      general: edit,
      identity: edit,
      // Enters the CTC on every offer and makes the final confirmation and
      // appraisal calls, but never touches a bank account.
      bank: view,
      salary: edit,
      performance: edit,
      config: view,
    },
  },

  pnc_ops: {
    code: 'pnc_ops',
    label: 'PnC Ops',
    group: 'pnc',
    rank: 6,
    login: 'core',
    grantedBy: 'super_admin',
    access: {
      general: edit,
      identity: edit,
      bank: none,
      salary: none,
      // Chases pending feedback by status; never reads the text.
      performance: { level: 'view', scope: 'all', qualifier: 'status_only' },
      config: none,
    },
  },

  fin_admin: {
    code: 'fin_admin',
    label: 'Fin Admin',
    group: 'finance',
    rank: 8,
    login: 'core+vault',
    grantedBy: 'super_admin',
    access: {
      general: view,
      identity: none,
      bank: edit,
      salary: edit,
      performance: { level: 'view', scope: 'all', qualifier: 'outcomes_only' },
      config: none,
    },
  },

  fin_ops: {
    code: 'fin_ops',
    label: 'Fin Ops',
    group: 'finance',
    rank: 6,
    login: 'core+vault',
    grantedBy: 'super_admin',
    access: {
      general: view,
      identity: none,
      bank: view,
      salary: { level: 'view', scope: 'all', qualifier: 'payroll_export_only' },
      performance: none,
      config: none,
    },
  },

  exec_view: {
    code: 'exec_view',
    label: 'Exec View',
    group: 'leadership',
    rank: 7,
    login: 'core+vault',
    grantedBy: 'super_admin',
    access: {
      general: view,
      identity: none,
      bank: none,
      salary: view,
      performance: view,
      config: none,
    },
  },

  platform_admin: {
    code: 'platform_admin',
    label: 'Platform Admin',
    group: 'platform',
    rank: 8,
    // Never a vault member: whoever builds the platform must not be able to
    // read what the platform guards.
    login: 'core',
    grantedBy: 'super_admin',
    access: {
      general: view,
      identity: none,
      bank: none,
      salary: none,
      performance: none,
      config: edit,
    },
  },

  platform_ops: {
    code: 'platform_ops',
    label: 'Platform Ops',
    group: 'platform',
    rank: 6,
    login: 'core',
    // The one role Platform Admin may assign, and it grants nothing sensitive.
    grantedBy: 'platform_admin',
    access: {
      general: view,
      identity: none,
      bank: none,
      salary: none,
      performance: none,
      config: { level: 'view', scope: 'all', qualifier: 'with_logs' },
    },
  },

  manager: {
    code: 'manager',
    label: 'Manager',
    group: 'line',
    rank: 5,
    login: 'core',
    grantedBy: 'auto',
    access: {
      general: { level: 'view', scope: 'own_team' },
      identity: none,
      bank: none,
      salary: none,
      // Records decisions and submits feedback; reads own team's text through a
      // vault function that logs every read.
      performance: { level: 'edit', scope: 'own_team', qualifier: 'with_logs' },
      config: none,
    },
  },

  employee: {
    code: 'employee',
    label: 'Employee',
    group: 'employee',
    rank: 3,
    login: 'core',
    grantedBy: 'auto',
    access: {
      general: { level: 'edit', scope: 'own' },
      identity: { level: 'view', scope: 'own' },
      bank: { level: 'view', scope: 'own' },
      // Salary reaches an employee through letters, never a screen in the app.
      salary: { level: 'view', scope: 'own', qualifier: 'via_letters' },
      performance: { level: 'view', scope: 'own', qualifier: 'outcomes_only' },
      config: none,
    },
  },

  pre_joiner: {
    code: 'pre_joiner',
    label: 'Pre-joiner',
    group: 'onboarding',
    rank: 2,
    login: 'core',
    grantedBy: 'auto',
    access: {
      general: { level: 'edit', scope: 'own' },
      // Submits ID and bank details and cannot read either back.
      identity: { level: 'edit', scope: 'own', qualifier: 'insert_only' },
      bank: { level: 'edit', scope: 'own', qualifier: 'insert_only' },
      salary: { level: 'view', scope: 'own', qualifier: 'via_letters' },
      performance: none,
      config: none,
    },
  },

  candidate: {
    code: 'candidate',
    label: 'Candidate',
    group: 'onboarding',
    rank: 1,
    login: 'core',
    grantedBy: 'auto',
    access: {
      general: { level: 'view', scope: 'own' },
      identity: none,
      bank: none,
      salary: { level: 'view', scope: 'own', qualifier: 'via_letters' },
      performance: none,
      config: none,
    },
  },
}

export const ALL_ROLES: RoleDefinition[] = ROLE_CODES.map((c) => ROLES[c])

export function isRoleCode(value: unknown): value is RoleCode {
  return typeof value === 'string' && (ROLE_CODES as readonly string[]).includes(value)
}

// ---------------------------------------------------------------------------
// Where data lives
// ---------------------------------------------------------------------------

/**
 * Resources held in the vault project rather than core.
 *
 * Any non-`none` cell on one of these is a vault read, and is logged. A role
 * without a vault login cannot reach them at all, whatever the matrix says —
 * see `canReach`.
 */
/**
 * Resources that are born in the vault and never exist in core.
 *
 * A pre-joiner's bank details arrive through a vault Edge Function; a CTC is
 * entered by PnC Admin in the vault. Neither ever touches core.
 */
export const VAULT_NATIVE_RESOURCES: Resource[] = ['bank', 'salary']

/**
 * Resources that live in core while a process is running, then seal into the
 * vault when it finishes.
 *
 *   identity     an ID document is uploaded to core, verified there by PnC Ops,
 *                and sealed into the vault on approval.
 *   performance  feedback is collected in core while a confirmation or
 *                appraisal cycle is live, and sealed when the cycle closes.
 *
 * This is what lets PnC Ops verify documents and a manager read their team's
 * in-flight feedback without either holding a vault login: during the staging
 * window the data is genuinely core data.
 *
 * The cost is real and deliberate: while staged, the platform team can read it.
 * Sealing is what ends that, so an un-sealed record is an open exposure — see
 * `src/lib/vault/sealing.ts`.
 */
export const STAGED_RESOURCES: Resource[] = ['identity', 'performance']

/** Where a staged resource currently sits. Vault-native resources ignore it. */
export type ResourceStage = 'staging' | 'sealed'

export function isVaultNative(resource: Resource): boolean {
  return VAULT_NATIVE_RESOURCES.includes(resource)
}

export function isStaged(resource: Resource): boolean {
  return STAGED_RESOURCES.includes(resource)
}

/** True when reaching this resource, at this stage, means reaching the vault. */
export function isVaultResource(resource: Resource, stage: ResourceStage = 'staging'): boolean {
  if (isVaultNative(resource)) return true
  return isStaged(resource) && stage === 'sealed'
}

// ---------------------------------------------------------------------------
// Access checks
// ---------------------------------------------------------------------------

export function accessFor(role: RoleCode, resource: Resource): Access {
  return ROLES[role].access[resource]
}

/** True when the role has any access at all to the resource. */
export function canRead(role: RoleCode, resource: Resource): boolean {
  return accessFor(role, resource).level !== 'none'
}

export function canWrite(role: RoleCode, resource: Resource): boolean {
  return accessFor(role, resource).level === 'edit'
}

/** How a permitted read is actually served. */
export type ReachVia =
  | 'core' // plain core read
  | 'vault_session' // the role signs in to the vault and reads it there
  | 'logged_function' // a vault function reads on their behalf and logs it
  | 'letter' // it reaches the person in a letter, never on a screen

export type Reach =
  | { ok: true; access: Access; via: ReachVia; logged: boolean }
  | { ok: false; reason: 'no_access' | 'needs_vault_session' }

/**
 * Whether a role can actually reach a resource, and by what route.
 *
 * The route matters as much as the yes/no, and for a staged resource it
 * changes once the record is sealed. A cell on a vault-held resource is not
 * automatically a vault read:
 *
 *   status_only / outcomes_only  the status or decision, which lives in core
 *   via_letters                  built in the vault, delivered as a document
 *   own / own_team               a vault function reads on their behalf, logged
 *   everything else              a vault session, which the role must have
 */
export function canReach(
  role: RoleCode,
  resource: Resource,
  session: { hasVaultSession?: boolean; stage?: ResourceStage } = {}
): Reach {
  const { hasVaultSession = false, stage = 'staging' } = session
  const access = accessFor(role, resource)
  if (access.level === 'none') return { ok: false, reason: 'no_access' }

  if (!isVaultResource(resource, stage)) {
    return { ok: true, access, via: 'core', logged: access.qualifier === 'with_logs' }
  }

  // The core-side status or decision, not the sensitive text behind it. These
  // stay readable after sealing: what was sealed is the text, not the fact.
  if (access.qualifier === 'status_only' || access.qualifier === 'outcomes_only') {
    return { ok: true, access, via: 'core', logged: false }
  }

  if (access.qualifier === 'via_letters') {
    return { ok: true, access, via: 'letter', logged: true }
  }

  // Scoped to the person or their team: mediated by a vault function that logs
  // the read, so the reader never holds a vault login of their own.
  if (access.scope === 'own' || access.scope === 'own_team') {
    return { ok: true, access, via: 'logged_function', logged: true }
  }

  // Org-wide sight of sensitive data requires a vault login, and a session.
  if (ROLES[role].login !== 'core+vault') return { ok: false, reason: 'no_access' }
  if (!hasVaultSession) return { ok: false, reason: 'needs_vault_session' }
  return { ok: true, access, via: 'vault_session', logged: true }
}

// ---------------------------------------------------------------------------
// Impersonation
// ---------------------------------------------------------------------------

/**
 * Rank controls impersonation, and only within a group — a PnC Admin cannot
 * become a Fin Ops to see bank details. Super Admin may impersonate anyone.
 */
export function canImpersonate(actor: RoleCode | null, target: RoleCode | null): boolean {
  if (!actor || !target) return false
  if (actor === target) return false
  if (actor === 'super_admin') return true

  const a = ROLES[actor]
  const t = ROLES[target]
  return a.group === t.group && a.rank > t.rank
}

// ---------------------------------------------------------------------------
// Granting
// ---------------------------------------------------------------------------

/** Roles nobody grants by hand: the lifecycle and the reporting line set them. */
export function isAutoAssigned(role: RoleCode): boolean {
  return ROLES[role].grantedBy === 'auto'
}

/** Roles that can see salary, bank details or written feedback. */
export function isSensitiveRole(role: RoleCode): boolean {
  return ROLES[role].login === 'core+vault'
}

export type GrantRefusal =
  | 'role_is_automatic'
  | 'only_super_admin_may_grant'
  | 'platform_admin_may_grant_platform_ops_only'
  | 'owner_role_is_not_grantable'
  | 'cannot_change_own_role'

export type GrantDecision = { ok: true } | { ok: false; reason: GrantRefusal }

/**
 * Whether `actor` may put someone into `role`.
 *
 * The rule that matters most: Platform Admin can never grant access to
 * sensitive data. Whoever builds the platform cannot widen their own sight of
 * it, and cannot widen anyone else's either.
 */
export function canGrantRole(
  actor: RoleCode | null,
  role: RoleCode,
  options: { isSelf?: boolean } = {}
): GrantDecision {
  if (!actor) return { ok: false, reason: 'only_super_admin_may_grant' }
  if (options.isSelf) return { ok: false, reason: 'cannot_change_own_role' }

  const target = ROLES[role]

  if (target.grantedBy === 'auto') return { ok: false, reason: 'role_is_automatic' }
  if (target.grantedBy === 'owner') return { ok: false, reason: 'owner_role_is_not_grantable' }

  if (actor === 'super_admin') return { ok: true }

  if (actor === 'platform_admin') {
    return target.grantedBy === 'platform_admin'
      ? { ok: true }
      : { ok: false, reason: 'platform_admin_may_grant_platform_ops_only' }
  }

  return { ok: false, reason: 'only_super_admin_may_grant' }
}

/** Roles an actor can offer in a role picker. */
export function grantableRoles(actor: RoleCode | null): RoleCode[] {
  return ROLE_CODES.filter((code) => canGrantRole(actor, code).ok)
}
