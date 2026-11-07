import { describe, it, expect, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { loadMyProfile } from "./myProfile";
import { loadMyTeam } from "./myTeam";
import { loadOpenConfirmations } from "./openConfirmations";
import { loadExitsInProgress } from "./exitsInProgress";
import { loadSettlementsDue } from "./settlementsDue";
import { loadMonthMovements } from "./monthMovements";
import { loadMovementTrend } from "./movementTrend";
import { loadHeadcountByTeam } from "./headcountByTeam";
import { loadConfigActivity } from "./configActivity";
import { loadEmailHealth } from "./emailHealth";

function createMockDb(options: {
  error?: { code: string; message: string };
  data?: unknown[];
  singleData?: unknown;
}) {
  const queryBuilder: Record<string, unknown> = {};

  const methods = [
    "select",
    "eq",
    "in",
    "or",
    "not",
    "gte",
    "lte",
    "lt",
    "order",
    "limit",
  ];

  for (const m of methods) {
    queryBuilder[m] = vi.fn().mockImplementation(() => queryBuilder);
  }

  queryBuilder.maybeSingle = vi.fn().mockImplementation(() =>
    Promise.resolve({
      data: options.singleData ?? options.data?.[0] ?? null,
      error: options.error ?? null,
    })
  );

  queryBuilder.then = (
    onFulfilled: (res: { data: unknown[]; error: unknown }) => unknown
  ) =>
    Promise.resolve({
      data: options.data ?? [],
      error: options.error ?? null,
    }).then(onFulfilled);

  const db = {
    from: vi.fn().mockReturnValue(queryBuilder),
  } as unknown as SupabaseClient;

  return { db, queryBuilder };
}

describe("Dashboard Panel Loaders (Mocked DB)", () => {
  it("returns { status: 'error' } when a Supabase query fails", async () => {
    const { db } = createMockDb({
      error: { code: "42P01", message: "relation does not exist" },
    });
    const ctx = { db, me: { id: "emp-1" }, today: "2026-11-08" };

    const resProfile = await loadMyProfile(ctx);
    expect(resProfile).toEqual({ status: "error" });

    const resTeam = await loadMyTeam(ctx);
    expect(resTeam).toEqual({ status: "error" });

    const resConf = await loadOpenConfirmations(ctx);
    expect(resConf).toEqual({ status: "error" });

    const resExits = await loadExitsInProgress(ctx);
    expect(resExits).toEqual({ status: "error" });

    const resSettlements = await loadSettlementsDue(ctx);
    expect(resSettlements).toEqual({ status: "error" });

    const resMonth = await loadMonthMovements(ctx);
    expect(resMonth).toEqual({ status: "error" });

    const resTrend = await loadMovementTrend(ctx);
    expect(resTrend).toEqual({ status: "error" });

    const resHeadcount = await loadHeadcountByTeam(ctx);
    expect(resHeadcount).toEqual({ status: "error" });

    const resConfig = await loadConfigActivity(ctx);
    expect(resConfig).toEqual({ status: "error" });

    const resEmail = await loadEmailHealth(ctx);
    expect(resEmail).toEqual({ status: "error" });
  });

  it("myTeam explicitly filters on manager_id = me.id and status = active", async () => {
    const { db, queryBuilder } = createMockDb({
      data: [
        {
          id: "rep-1",
          name: "Alice",
          team: "Engineering",
          employee_type: "fte",
          joining_date: "2026-01-01",
          confirmation_date: "2026-04-01",
        },
      ],
    });
    const ctx = { db, me: { id: "mgr-42" }, today: "2026-11-08" };

    const res = await loadMyTeam(ctx);
    expect(res.status).toBe("ok");
    if (res.status === "ok") {
      expect(res.rows).toHaveLength(1);
      expect(res.rows[0].name).toBe("Alice");
    }

    expect(db.from).toHaveBeenCalledWith("employees");
    expect(queryBuilder.eq).toHaveBeenCalledWith("manager_id", "mgr-42");
    expect(queryBuilder.eq).toHaveBeenCalledWith("status", "active");
  });

  it("uses the passed today argument for calendar windows rather than system Date", async () => {
    const { db, queryBuilder } = createMockDb({ data: [] });
    const ctx = { db, me: { id: "emp-1" }, today: "2026-05-15" };

    await loadMonthMovements(ctx);
    // Month window for 2026-05-15 must be [2026-05-01, 2026-06-01)
    expect(queryBuilder.gte).toHaveBeenCalledWith("joining_date", "2026-05-01");
    expect(queryBuilder.lt).toHaveBeenCalledWith("joining_date", "2026-06-01");

    await loadConfigActivity(ctx);
    // Config activity 7 days before 2026-05-15 is 2026-05-08
    expect(queryBuilder.gte).toHaveBeenCalledWith(
      "changed_at",
      "2026-05-08T00:00:00+05:30"
    );
  });
});

