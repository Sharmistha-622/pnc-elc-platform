export type UserRole =
  | "Super Admin"
  | "Admin"
  | "PnC"
  | "Finance"
  | "Manager"
  | "Program"
  | "Operations"
  | "Viewer"
  | "Member"
  | "Employee";

export type UserTeam = "Engineering" | "Operations" | "Design" | "Finance" | "PnC" | "None";

export const ROLE_HIERARCHY: Record<UserRole, number> = {
  "Super Admin": 7,
  "Admin": 6,
  "PnC": 5,
  "Manager": 5,
  "Finance": 4,
  "Program": 4,
  "Operations": 3,
  "Viewer": 2,
  "Member": 1,
  "Employee": 1,
};

export function canImpersonate(actorRole?: UserRole | null, targetRole?: UserRole | null): boolean {
  if (!actorRole || !targetRole) return false;
  const actorLevel = ROLE_HIERARCHY[actorRole] || 0;
  const targetLevel = ROLE_HIERARCHY[targetRole] || 0;
  return actorLevel >= 6 && actorLevel > targetLevel;
}

export const DEFAULT_ROLE: UserRole = "Employee";

export const ASSIGNABLE_ROLES: UserRole[] = [
  "Super Admin", "Admin", "PnC", "Finance", "Manager", "Employee",
];

export type Feature = "employees" | "onboarding" | "confirmations" | "appraisals" | "dataManagement" | "manageUsers";

export const FEATURE_ACCESS: Record<Feature, UserRole[]> = {
  employees: ["Super Admin", "Admin", "PnC", "Finance", "Manager"],
  onboarding: ["Super Admin", "Admin", "PnC", "Manager"],
  confirmations: ["Super Admin", "Admin", "PnC", "Manager"],
  appraisals: ["Super Admin", "Admin", "PnC", "Manager"],
  dataManagement: ["Super Admin", "Admin", "PnC"],
  manageUsers: ["Super Admin", "Admin"],
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
