import { addDays } from "@/lib/dashboard/dates";
import type { PanelLoaderContext, PanelResult } from "./types";

export const COLUMNS = "id, table_name, setting_key, changed_at";

export interface ConfigActivityRow {
  id: string;
  tableName: string;
  settingKey: string | null;
  changedAt: string;
}

export async function loadConfigActivity(
  ctx: PanelLoaderContext
): Promise<PanelResult<ConfigActivityRow>> {
  const since = `${addDays(ctx.today, -7)}T00:00:00+05:30`;

  const { data, error } = await ctx.db
    .from("settings_change_log")
    .select(COLUMNS)
    .gte("changed_at", since)
    .order("changed_at", { ascending: false })
    .limit(6);

  if (error) {
    console.error(`dashboard: configActivity failed (${error.code ?? "unknown"})`);
    return { status: "error" };
  }

  const rows: ConfigActivityRow[] = (data ?? []).map((item) => {
    const raw = item as Record<string, unknown>;
    return {
      id: String(raw.id),
      tableName: String(raw.table_name ?? "settings"),
      settingKey: typeof raw.setting_key === "string" ? raw.setting_key : null,
      changedAt: String(raw.changed_at ?? ""),
    };
  });

  return { status: "ok", rows };
}

