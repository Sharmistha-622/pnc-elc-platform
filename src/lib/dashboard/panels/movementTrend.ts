import type { PanelLoaderContext, PanelResult } from "./types";

export const COLUMNS = "joining_date, exit_date";

export interface MovementTrendRow {
  month: string;
  joiners: number;
  exits: number;
}

const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

export async function loadMovementTrend(
  ctx: PanelLoaderContext
): Promise<PanelResult<MovementTrendRow>> {
  const [currentY, currentM] = ctx.today.split("-").map(Number);

  // Generate 6 month buckets from oldest to newest
  const buckets: { key: string; label: string; from: string; to: string; joiners: number; exits: number }[] = [];
  for (let offset = 5; offset >= 0; offset--) {
    let y = currentY;
    let m = currentM - offset;
    while (m <= 0) {
      m += 12;
      y -= 1;
    }
    const nextY = m === 12 ? y + 1 : y;
    const nextM = m === 12 ? 1 : m + 1;
    const key = `${y}-${String(m).padStart(2, "0")}`;
    const from = `${key}-01`;
    const to = `${nextY}-${String(nextM).padStart(2, "0")}-01`;
    const label = `${MONTH_NAMES[m - 1]} ${y}`;
    buckets.push({ key, label, from, to, joiners: 0, exits: 0 });
  }

  const startDate = buckets[0].from;

  const { data, error } = await ctx.db
    .from("employees")
    .select(COLUMNS)
    .or(`joining_date.gte.${startDate},exit_date.gte.${startDate}`);

  if (error) {
    console.error(`dashboard: movementTrend failed (${error.code ?? "unknown"})`);
    return { status: "error" };
  }

  for (const item of data ?? []) {
    const raw = item as Record<string, unknown>;
    const joinDate = typeof raw.joining_date === "string" ? raw.joining_date : null;
    const exitDate = typeof raw.exit_date === "string" ? raw.exit_date : null;

    if (joinDate) {
      const b = buckets.find((bucket) => joinDate >= bucket.from && joinDate < bucket.to);
      if (b) b.joiners += 1;
    }
    if (exitDate) {
      const b = buckets.find((bucket) => exitDate >= bucket.from && exitDate < bucket.to);
      if (b) b.exits += 1;
    }
  }

  const rows: MovementTrendRow[] = buckets.map((b) => ({
    month: b.label,
    joiners: b.joiners,
    exits: b.exits,
  }));

  return { status: "ok", rows };
}

