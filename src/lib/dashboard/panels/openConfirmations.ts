import type { PanelLoaderContext, PanelResult } from "./types";

export const COLUMNS =
  "id, status, created_at, employees(name, manager:employees!manager_id(name))";

export interface OpenConfirmationRow {
  id: string;
  status: string;
  createdAt: string;
  employeeName: string;
  managerName: string | null;
}

export async function loadOpenConfirmations(
  ctx: PanelLoaderContext
): Promise<PanelResult<OpenConfirmationRow>> {
  const { data, error } = await ctx.db
    .from("confirmations")
    .select(COLUMNS)
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(6);

  if (error) {
    console.error(`dashboard: openConfirmations failed (${error.code ?? "unknown"})`);
    return { status: "error" };
  }

  const rows: OpenConfirmationRow[] = (data ?? []).map((item) => {
    const raw = item as Record<string, unknown>;
    const emp = raw.employees as { name?: string; manager?: { name?: string } | null } | null;
    return {
      id: String(raw.id),
      status: String(raw.status ?? "pending"),
      createdAt: String(raw.created_at ?? ""),
      employeeName: emp?.name ?? "Employee",
      managerName: emp?.manager?.name ?? null,
    };
  });

  return { status: "ok", rows };
}

