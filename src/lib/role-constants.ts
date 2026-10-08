export type UserRole =
  | "Super Admin" | "Admin" | "PnC" | "Finance"
  | "Manager" | "Program" | "Operations" | "Viewer" | "Member" | "Employee";

export type UserTeam = "Engineering" | "Operations" | "Design" | "Finance" | "PnC" | "None";

export const ROLE_HIERARCHY: Record<UserRole, number> = {
  "Super Admin": 7, "Admin": 6, "PnC": 5, "Manager": 5, "Finance": 4,
  "Program": 4, "Operations": 3, "Viewer": 2, "Member": 1, "Employee": 1,
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

export type Feature = "employees" | "confirmations" | "appraisals" | "dataManagement" | "manageUsers";

export const FEATURE_ACCESS: Record<Feature, UserRole[]> = {
  employees: ["Super Admin", "Admin", "PnC", "Finance", "Manager"],
  confirmations: ["Super Admin", "Admin", "PnC", "Manager"],
  appraisals: ["Super Admin", "Admin", "PnC", "Manager"],
  dataManagement: ["Super Admin", "Admin", "PnC"],
  manageUsers: ["Super Admin", "Admin"],
};

const ROUTE_FEATURE: [string, Feature][] = [
  ["/employees", "employees"],
  ["/confirmations", "confirmations"],
  ["/appraisals", "appraisals"],
  ["/data-management", "dataManagement"],
  ["/manage", "manageUsers"],
];

export function canAccessRoute(role: UserRole | null | undefined, url: string): boolean {
  const effective = role ?? DEFAULT_ROLE;
  const match = ROUTE_FEATURE.find(([p]) => url === p || url.startsWith(p + "/"));
  if (!match) return true;
  return FEATURE_ACCESS[match[1]].includes(effective);
}