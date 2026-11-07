import type { PanelLoaderContext, PanelResult } from "./types";

export const COLUMNS =
  "id, name, team, employee_type, status, joining_date, confirmation_date, manager:employees!manager_id(name, email, team)";

export interface MyProfileRow {
  id: string;
  name: string;
  team: string | null;
  employeeType: string | null;
  status: string;
  joiningDate: string | null;
  confirmationDate: string | null;
  manager: {
    name: string;
    email: string | null;
    team: string | null;
  } | null;
}

export async function loadMyProfile(
  ctx: PanelLoaderContext
): Promise<PanelResult<MyProfileRow>> {
  if (!ctx.me) {
    return { status: "ok", rows: [] };
  }

  const { data, error } = await ctx.db
    .from("employees")
    .select(COLUMNS)
    .eq("id", ctx.me.id)
    .maybeSingle();

  if (error) {
    console.error(`dashboard: myProfile failed (${error.code ?? "unknown"})`);
    return { status: "error" };
  }

  if (!data) {
    return { status: "ok", rows: [] };
  }

  const raw = data as Record<string, unknown>;
  const rawMgr = raw.manager as Record<string, unknown> | null;

  const row: MyProfileRow = {
    id: String(raw.id),
    name: String(raw.name ?? "Staff member"),
    team: typeof raw.team === "string" ? raw.team : null,
    employeeType: typeof raw.employee_type === "string" ? raw.employee_type : null,
    status: String(raw.status ?? "active"),
    joiningDate: typeof raw.joining_date === "string" ? raw.joining_date : null,
    confirmationDate: typeof raw.confirmation_date === "string" ? raw.confirmation_date : null,
    manager: rawMgr
      ? {
          name: String(rawMgr.name ?? "Manager"),
          email: typeof rawMgr.email === "string" ? rawMgr.email : null,
          team: typeof rawMgr.team === "string" ? rawMgr.team : null,
        }
      : null,
  };

  return { status: "ok", rows: [row] };
}

