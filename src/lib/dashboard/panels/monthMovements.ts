import { monthWindow } from "@/lib/dashboard/dates";
import type { PanelLoaderContext, PanelResult } from "./types";

export const COLUMNS =
  "id, name, team, joining_date, exit_date, status";

export interface MonthMovementRow {
  id: string;
  name: string;
  team: string | null;
  kind: "joiner" | "exit";
  date: string;
  status: string;
}

export async function loadMonthMovements(
  ctx: PanelLoaderContext
): Promise<PanelResult<MonthMovementRow>> {
  const month = monthWindow(ctx.today);

  const [joinersRes, exitsRes] = await Promise.all([
    ctx.db
      .from("employees")
      .select(COLUMNS)
      .gte("joining_date", month.from)
      .lt("joining_date", month.to)
      .order("joining_date", { ascending: false })
      .limit(6),
    ctx.db
      .from("employees")
      .select(COLUMNS)
      .gte("exit_date", month.from)
      .lt("exit_date", month.to)
      .order("exit_date", { ascending: false })
      .limit(6),
  ]);

  if (joinersRes.error) {
    console.error(`dashboard: monthMovements failed (${joinersRes.error.code ?? "unknown"})`);
    return { status: "error" };
  }
  if (exitsRes.error) {
    console.error(`dashboard: monthMovements failed (${exitsRes.error.code ?? "unknown"})`);
    return { status: "error" };
  }

  const joinerRows: MonthMovementRow[] = (joinersRes.data ?? []).map((item) => {
    const raw = item as Record<string, unknown>;
    return {
      id: String(raw.id),
      name: String(raw.name ?? "Employee"),
      team: typeof raw.team === "string" ? raw.team : null,
      kind: "joiner",
      date: String(raw.joining_date ?? ""),
      status: String(raw.status ?? "active"),
    };
  });

  const exitRows: MonthMovementRow[] = (exitsRes.data ?? []).map((item) => {
    const raw = item as Record<string, unknown>;
    return {
      id: String(raw.id),
      name: String(raw.name ?? "Employee"),
      team: typeof raw.team === "string" ? raw.team : null,
      kind: "exit",
      date: String(raw.exit_date ?? ""),
      status: String(raw.status ?? "exited"),
    };
  });

  const combined = [...joinerRows, ...exitRows].sort((a, b) => b.date.localeCompare(a.date));

  return { status: "ok", rows: combined.slice(0, 6) };
}

