import type { PanelLoaderContext, PanelResult } from "./types";

export const COLUMNS =
  "id, status, proposed_lwd, actual_lwd, employees(name, team)";

export interface ExitInProgressRow {
  id: string;
  status: string;
  proposedLwd: string;
  actualLwd: string | null;
  employeeName: string;
  team: string | null;
}

export async function loadExitsInProgress(
  ctx: PanelLoaderContext
): Promise<PanelResult<ExitInProgressRow>> {
  const { data, error } = await ctx.db
    .from("offboarding_cases")
    .select(COLUMNS)
    .not("status", "in", "(completed,cancelled)")
    .order("created_at", { ascending: false })
    .limit(6);

  if (error) {
    console.error(`dashboard: exitsInProgress failed (${error.code ?? "unknown"})`);
    return { status: "error" };
  }

  const rows: ExitInProgressRow[] = (data ?? []).map((item) => {
    const raw = item as Record<string, unknown>;
    const emp = raw.employees as { name?: string; team?: string | null } | null;
    return {
      id: String(raw.id),
      status: String(raw.status ?? "in_progress"),
      proposedLwd: String(raw.proposed_lwd ?? ""),
      actualLwd: typeof raw.actual_lwd === "string" ? raw.actual_lwd : null,
      employeeName: emp?.name ?? "Employee",
      team: emp?.team ?? null,
    };
  });

  return { status: "ok", rows };
}

