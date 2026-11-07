import type { PanelLoaderContext, PanelResult } from "./types";

export const COLUMNS =
  "id, name, team, employee_type, joining_date, confirmation_date";

export interface MyTeamRow {
  id: string;
  name: string;
  team: string | null;
  employeeType: string | null;
  joiningDate: string | null;
  confirmationDate: string | null;
}

export async function loadMyTeam(
  ctx: PanelLoaderContext
): Promise<PanelResult<MyTeamRow>> {
  if (!ctx.me) {
    return { status: "ok", rows: [] };
  }

  const { data, error } = await ctx.db
    .from("employees")
    .select(COLUMNS)
    .eq("manager_id", ctx.me.id)
    .eq("status", "active")
    .order("name")
    .limit(6);

  if (error) {
    console.error(`dashboard: myTeam failed (${error.code ?? "unknown"})`);
    return { status: "error" };
  }

  const rows: MyTeamRow[] = (data ?? []).map((item) => {
    const raw = item as Record<string, unknown>;
    return {
      id: String(raw.id),
      name: String(raw.name ?? "Team member"),
      team: typeof raw.team === "string" ? raw.team : null,
      employeeType: typeof raw.employee_type === "string" ? raw.employee_type : null,
      joiningDate: typeof raw.joining_date === "string" ? raw.joining_date : null,
      confirmationDate: typeof raw.confirmation_date === "string" ? raw.confirmation_date : null,
    };
  });

  return { status: "ok", rows };
}

