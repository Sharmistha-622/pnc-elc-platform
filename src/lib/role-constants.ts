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

export type UserTeam = string;

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

/**
 * @deprecated Prefer dynamic departments from `/api/departments` or `getDepartments()`.
 * Kept as static offline fallback.
 */
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
  | "dashboard"
  | "self"
  | "myTeam"
  | "employees"
  | "onboarding"
  | "letters"
  | "confirmations"
  | "appraisals"
  | "offboarding"
  | "reports"
  | "dataManagement"
  | "platformConfig"
  | "manageUsers";

/**
 * Everyone who belongs in the signed-in shell at all.
 *
 * `candidate` and `pre_joiner` are deliberately absent from every list below.
 * They reach the platform through the token portal at `/onboarding/[token]`,
 * never the dashboard — `role-constants.test.ts` asserts that no feature ever
 * names them, and `middleware.ts` sends them to `/portal-notice` if they
 * arrive signed in.
 */
const STAFF: UserRole[] = [
  "super_admin",
  "pnc_admin",
  "pnc_ops",
  "fin_admin",
  "fin_ops",
  "exec_view",
  "platform_admin",
  "platform_ops",
  "manager",
  "employee",
];

/**
 * Which roles reach which feature.
 *
 * Derived from the matrix rather than invented: PnC Ops runs the pipeline
 * daily, Fin Admin and Fin Ops need the employee directory for payroll, Exec
 * View reads cycles, and the platform roles maintain templates and automation
 * without seeing anyone's data.
 */
export const FEATURE_ACCESS: Record<Feature, UserRole[]> = {
  // The shell itself. Separating it from the screens inside is what lets a
  // portal-only role be refused the dashboard without being refused a session.
  dashboard: STAFF,
  // Own profile, own assigned forms, the changelog. Scoped by the data layer
  // (`getMyProfileData`, `getMyForms`), not by the route.
  self: STAFF,
  // All staff, `employee` included. `manager` is meant to follow from the
  // reporting line, but nothing assigns it yet (`deriveRole` in
  // rbac/lifecycle.ts is never called, and it cannot be granted by hand), so
  // most line managers are stored as `employee`. The page lists only the
  // viewer's own reportees (`getMyProfileData`), so someone with none sees an
  // empty team, not anyone else's.
  myTeam: STAFF,
  employees: ["super_admin", "pnc_admin", "pnc_ops", "fin_admin", "fin_ops", "exec_view", "manager"],
  onboarding: ["super_admin", "pnc_admin", "pnc_ops", "fin_admin", "manager"],
  // Split out of `onboarding` deliberately. The letter, signatory and template
  // screens were gated on it, and `onboarding` lists `manager` — so every line
  // manager could open the offer-letter editor and the signing authorities.
  // Drafting letters is P&C and Finance work; running the pipeline is not.
  letters: ["super_admin", "pnc_admin", "pnc_ops", "fin_admin"],
  confirmations: ["super_admin", "pnc_admin", "pnc_ops", "exec_view", "manager"],
  appraisals: ["super_admin", "pnc_admin", "fin_admin", "exec_view", "manager"],
  // Fin Admin is here for full-and-final settlement. `manager` is NOT: the
  // screen loads every case in the organisation (`getAllOffboardingCases`),
  // with no team filter to scope it to their own reports.
  offboarding: ["super_admin", "pnc_admin", "pnc_ops", "fin_admin"],
  // Org-wide aggregates: full headcount, every manager decision, email
  // delivery logs. Exec View is the role this screen exists for. PnC Ops is
  // out because the confirmation rows carry decisions, and their access to
  // performance is `status_only`.
  reports: ["super_admin", "pnc_admin", "fin_admin", "exec_view"],
  // Templates and automation: the platform roles' job, and nothing sensitive.
  dataManagement: ["super_admin", "platform_admin", "platform_ops", "pnc_admin"],
  // Confirmation windows, appraisal cycles and peer-feedback rules are P&C's
  // own process, so PnC Admin reaches the screen. They reach it READ-ONLY:
  // `ROLES.pnc_admin.access.config` is `view`, and the settings server actions
  // enforce that with `canWrite(role, 'config')`. Route access is not edit
  // access.
  platformConfig: ["super_admin", "platform_admin", "pnc_admin"],
  // Granting roles is Super Admin's alone; Platform Admin reaches the screen
  // to manage core accounts, and `canGrantRole` still refuses it everything
  // but Platform Ops.
  manageUsers: ["super_admin", "platform_admin"],
};

/**
 * Route prefix to feature. Matched longest-prefix-first, so a specific entry
 * always beats the general one it sits under.
 *
 * Every dashboard route is named here. A route left out falls through to the
 * "no match means allow" branch in `canAccessRoute`, which is how `/audit`,
 * `/reports`, `/offboarding`, `/my-team`, `/my-forms` and `/profile` were
 * reachable by every signed-in user, `candidate` included.
 *
 * The letter and onboarding screens live under `/manage/` for navigation
 * reasons but belong to the onboarding side of the house: P&C draft the offer
 * letters, so gating them as "manage users" would lock out the people who use
 * them.
 */
const ROUTE_FEATURE: [string, Feature][] = [
  // The shell. "/" matches only itself — every deeper path has a longer entry
  // or none, so this never shadows anything.
  ["/", "dashboard"],

  // Self-scoped screens. Reachable by all staff; the query decides what is in
  // them, not the gate.
  ["/profile", "self"],
  ["/my-forms", "self"],
  ["/changelog", "self"],
  // A nominated peer is usually an ordinary employee, so this cannot sit
  // behind `confirmations`, which excludes them.
  ["/feedback", "self"],

  ["/my-team", "myTeam"],

  ["/employees", "employees"],
  // API routes carry the same feature gate as the screens they serve. Without
  // these, an authenticated Viewer was blocked from /employees but could still
  // read /api/employees directly.
  ["/api/employees", "employees"],

  ["/onboarding", "onboarding"],
  ["/api/onboarding", "onboarding"],
  ["/manage/onboarding", "onboarding"],

  ["/manage/letter-templates", "letters"],
  ["/manage/letters", "letters"],
  ["/manage/signatories", "letters"],
  ["/api/candidate-letters", "letters"],
  ["/api/letter-templates", "letters"],

  ["/confirmations", "confirmations"],
  ["/appraisals", "appraisals"],
  ["/offboarding", "offboarding"],
  ["/reports", "reports"],

  // The screen is gated the same as the API that feeds it.
  ["/audit", "dataManagement"],
  ["/api/audit", "dataManagement"],
  ["/data-management", "dataManagement"],
  // A bare redirect to /data-management. Gated like its destination, or the
  // old link would deny the very people who can follow it.
  ["/manage/data-management", "dataManagement"],

  ["/manage/settings", "platformConfig"],
  ["/manage/emails", "platformConfig"],

  // The shadcn component gallery. Not linked from the nav; platform-only.
  ["/components", "manageUsers"],
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

/**
 * True when the role has no business in the signed-in shell at all.
 *
 * A candidate or pre-joiner can hold a Supabase session — they sign in to the
 * token portal — so refusing them `/` is not enough on its own: the ordinary
 * denial path redirects to `/`, which would loop. `middleware.ts` sends them
 * to `/portal-notice` instead.
 */
export function isPortalOnlyRole(role: UserRole | null | undefined): boolean {
  return !!role && !FEATURE_ACCESS.dashboard.includes(role);
}
