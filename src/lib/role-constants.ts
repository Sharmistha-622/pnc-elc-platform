export type UserRole = "Super Admin" | "Admin" | "Manager" | "Program" | "Operations" | "Viewer" | "Member";

export type UserTeam = "Engineering" | "Operations" | "Design" | "Finance" | "PnC" | "None";

export const ROLE_HIERARCHY: Record<UserRole, number> = {
  "Super Admin": 7,
  "Admin": 6,
  "Manager": 5,
  "Program": 4,
  "Operations": 3,
  "Viewer": 2,
  "Member": 1,
};

export function canImpersonate(actorRole?: UserRole | null, targetRole?: UserRole | null): boolean {
  if (!actorRole || !targetRole) return false;
  const actorLevel = ROLE_HIERARCHY[actorRole] || 0;
  const targetLevel = ROLE_HIERARCHY[targetRole] || 0;
  return actorLevel >= 6 && actorLevel > targetLevel;
}
