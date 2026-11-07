import type { PanelLoaderContext, PanelResult } from "./types";

export const COLUMNS = "team";

export interface HeadcountByTeamRow {
  team: string;
  count: number;
}

export async function loadHeadcountByTeam(
  ctx: PanelLoaderContext
): Promise<PanelResult<HeadcountByTeamRow>> {
  const { data, error } = await ctx.db
    .from("employees")
    .select(COLUMNS)
    .eq("status", "active");

  if (error) {
    console.error(`dashboard: headcountByTeam failed (${error.code ?? "unknown"})`);
    return { status: "error" };
  }

  const counts: Record<string, number> = {};
  for (const item of data ?? []) {
    const raw = item as Record<string, unknown>;
    const team = typeof raw.team === "string" && raw.team.trim().length > 0 ? raw.team.trim() : "Unassigned";
    counts[team] = (counts[team] ?? 0) + 1;
  }

  const sorted = Object.entries(counts)
    .map(([team, count]) => ({ team, count }))
    .sort((a, b) => b.count - a.count);

  const top5 = sorted.slice(0, 5);
  const remaining = sorted.slice(5);
  const otherCount = remaining.reduce((sum, item) => sum + item.count, 0);

  const rows: HeadcountByTeamRow[] = [...top5];
  if (otherCount > 0) {
    rows.push({ team: "Other", count: otherCount });
  }

  return { status: "ok", rows };
}

