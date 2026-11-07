import { addDays } from "@/lib/dashboard/dates";
import type { PanelLoaderContext, PanelResult } from "./types";

export const COLUMNS = "id, category, notification_type, status, sent_at";

export interface EmailHealthRow {
  notificationType: string;
  category: string;
  failedCount: number;
  latestSentAt: string;
}

export async function loadEmailHealth(
  ctx: PanelLoaderContext
): Promise<PanelResult<EmailHealthRow>> {
  const since = `${addDays(ctx.today, -7)}T00:00:00+05:30`;

  const { data, error } = await ctx.db
    .from("email_delivery_logs")
    .select(COLUMNS)
    .eq("status", "failed")
    .gte("sent_at", since)
    .order("sent_at", { ascending: false });

  if (error) {
    console.error(`dashboard: emailHealth failed (${error.code ?? "unknown"})`);
    return { status: "error" };
  }

  const grouped = new Map<string, { category: string; failedCount: number; latestSentAt: string }>();

  for (const item of data ?? []) {
    const raw = item as Record<string, unknown>;
    const type = String(raw.notification_type ?? "General");
    const category = String(raw.category ?? "system");
    const sentAt = String(raw.sent_at ?? "");

    const existing = grouped.get(type);
    if (!existing) {
      grouped.set(type, { category, failedCount: 1, latestSentAt: sentAt });
    } else {
      existing.failedCount += 1;
      if (sentAt > existing.latestSentAt) {
        existing.latestSentAt = sentAt;
      }
    }
  }

  const rows: EmailHealthRow[] = [...grouped.entries()]
    .map(([notificationType, val]) => ({
      notificationType,
      category: val.category,
      failedCount: val.failedCount,
      latestSentAt: val.latestSentAt,
    }))
    .sort((a, b) => b.failedCount - a.failedCount)
    .slice(0, 6);

  return { status: "ok", rows };
}

