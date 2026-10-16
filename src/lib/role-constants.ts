// ============================================================================
// Role constants — the bridge from RBAC v1 to route and feature gating.
// ----------------------------------------------------------------------------
// The roles themselves live in `src/lib/rbac/roles.ts`. This file maps them
// onto the features and routes the app is built from, and carries the legacy
// role names forward until every stored role has been migrated.
// ============================================================================

import {
  ROLES,
  ROLE_CODES,
  canImpersonate as canImpersonateRole,
  grantableRoles,
  isRoleCode,
  type RoleCode,
} from "@/lib/rbac/roles";

export type { RoleCode };

/**
 * The role type the app passes around.
 *
 * This is now the RBAC v1 code, not the old display name. `LEGACY_ROLE_MAP`
 * converts anything still stored in the old vocabulary.
 */
export type UserRole = RoleCode;

export type UserTeam = "Engineering" | "Operations" | "Design" | "Finance" | "PnC" | "None";

/** Display name for a role, from the single source of truth. */
export function roleLabel(role: UserRole | null | undefined): string {
  return role ? ROLES[role].label : "No role";
}

/**
 * The previous ten-role vocabulary, mapped onto RBAC v1.
 *
 * Where a role splits, the mapping errs towards **less** access: everyone with
 * `PnC` becomes `pnc_ops` rather than `pnc_admin`, because the latter can see
 * salary. Super Admin promotes the few who need more. `Admin` has no clean
 * equivalent and lands on `platform_admin`, which removes its PnC powers —
 * flagged for confirmation in docs/rbac.md.
 */
export const LEGACY_ROLE_MAP: Record<string, RoleCode> = {
  "Super Admin": "super_admin",
  Admin: "platform_admin",
  PnC: "pnc_ops",
  Finance: "fin_ops",
  Manager: "manager",
  Program: "employee",
  Operations: "employee",
  Viewer: "employee",
  Member: "employee",
  Employee: "employee",
};

/** Accepts a v1 code or a legacy display name, and returns a code. */
export function normalizeRole(value: unknown): RoleCode | null {
  if (isRoleCode(value)) return value;
  if (typeof value === "string" && value in LEGACY_ROLE_MAP) return LEGACY_ROLE_MAP[value];
  return null;
}

/**
 * The role an authenticated user with no role of their own falls back to.
 *
 * Only ever applied to a user who is signed in. An anonymous visitor resolves
 * to `null`, which every check treats as deny.
 */
export const DEFAULT_ROLE: UserRole = "employee";

export const ROLE_HIERARCHY: Record<UserRole, number> = Object.fromEntries(
  ROLE_CODES.map((code) => [code, ROLES[code].rank])
) as Record<UserRole, number>;

export const canImpersonate = canImpersonateRole;

/** Roles the actor may offer in a picker. Lifecycle roles are never listed. */
export function assignableRoles(actor: UserRole | null): UserRole[] {
  return grantableRoles(actor);
}

export const ASSIGNABLE_TEAMS = [
  "CEO's Office",
  "Engineering",
  "Operations",
  "Design",
  "Finance",
  "PnC",
  "None",
] as const;

export type Feature =
  | "employees"
  | "onboarding"
  | "confirmations"
  | "appraisals"
  | "dataManagement"
  | "manageUsers";

/**
 * Which roles reach which feature.
 *
 * Derived from the matrix rather than invented: PnC Ops runs the pipeline
 * daily, Fin Admin and Fin Ops need the employee directory for payroll, Exec
 * View reads cycles, and the platform roles maintain templates and automation
 * without seeing anyone's data.
 */
export const FEATURE_ACCESS: Record<Feature, UserRole[]> = {
  employees: ["super_admin", "pnc_admin", "pnc_ops", "fin_admin", "fin_ops", "exec_view", "manager"],
  onboarding: ["super_admin", "pnc_admin", "pnc_ops", "fin_admin", "manager"],
  confirmations: ["super_admin", "pnc_admin", "pnc_ops", "exec_view", "manager"],
  appraisals: ["super_admin", "pnc_admin", "fin_admin", "exec_view", "manager"],
  // Templates and automation: the platform roles' job, and nothing sensitive.
  dataManagement: ["super_admin", "platform_admin", "platform_ops", "pnc_admin"],
  // Granting roles is Super Admin's alone; Platform Admin reaches the screen
  // to manage core accounts, and `canGrantRole` still refuses it everything
  // but Platform Ops.
  manageUsers: ["super_admin", "platform_admin"],
};

/**
 * Route prefix to feature. Matched longest-prefix-first, so a specific entry
 * always beats the general one it sits under.
 *
 * The letter and onboarding screens live under `/manage/` for navigation
 * reasons but belong to the onboarding feature: P&C draft the offer letters,
 * so gating them as "manage users" would lock out the people who use them.
 */
const ROUTE_FEATURE: [string, Feature][] = [
  ["/employees", "employees"],
  // API routes carry the same feature gate as the screens they serve. Without
  // these, an authenticated Viewer was blocked from /employees but could still
  // read /api/employees directly.
  ["/api/employees", "employees"],
  ["/api/onboarding", "onboarding"],
  ["/api/candidate-letters", "onboarding"],
  ["/api/letter-templates", "onboarding"],
  ["/api/audit", "dataManagement"],
  ["/confirmations", "confirmations"],
  ["/appraisals", "appraisals"],
  ["/data-management", "dataManagement"],
  ["/onboarding", "onboarding"],
  ["/manage/onboarding", "onboarding"],
  ["/manage/letter-templates", "onboarding"],
  ["/manage/letters", "onboarding"],
  ["/manage/signatories", "onboarding"],
  ["/manage", "manageUsers"],
];

export function canAccessRoute(role: UserRole | null | undefined, url: string): boolean {
  // No role means no session. Deny rather than falling back to a default,
  // so an unauthenticated caller is never treated as an ordinary Employee.
  if (!role) return false;
  const matches = ROUTE_FEATURE.filter(([p]) => url === p || url.startsWith(p + "/"));
  if (matches.length === 0) return true;
  const [, feature] = matches.reduce((best, cur) => (cur[0].length > best[0].length ? cur : best));
  return FEATURE_ACCESS[feature].includes(role);
}
