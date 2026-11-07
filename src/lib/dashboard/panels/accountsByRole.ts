// ============================================================================
// Service-role client behind accountsByRole.
// Only on the server, only inside a loader that getDashboardData calls after
// dashboardFor has given the role that panel.
// ============================================================================

import { listUsersWithRoles } from "@/lib/rbac/listUsersWithRoles";
import { roleLabel, type UserRole } from "@/lib/role-constants";
import type { PanelResult } from "./types";

export const COLUMNS = "role";

export interface AccountByRoleRow {
  role: string;
  label: string;
  count: number;
}

export async function loadAccountsByRole(): Promise<PanelResult<AccountByRoleRow>> {
  try {
    const users = await listUsersWithRoles();
    const roleCounts: Record<string, number> = {};

    for (const u of users) {
      const r = u.role || "employee";
      roleCounts[r] = (roleCounts[r] ?? 0) + 1;
    }

    const rows: AccountByRoleRow[] = Object.entries(roleCounts)
      .map(([role, count]) => ({
        role,
        label: roleLabel(role as UserRole),
        count,
      }))
      .sort((a, b) => b.count - a.count);

    return { status: "ok", rows };
  } catch (error) {
    const code = (error as { code?: string })?.code ?? "unknown";
    console.error(`dashboard: accountsByRole failed (${code})`);
    return { status: "error" };
  }
}

