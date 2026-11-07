import React from "react";
import { PanelFrame } from "./panel-frame";
import { MovementTrendChart } from "./movement-trend-chart";
import type { PanelResult } from "@/lib/dashboard/panels/types";
import type { MovementTrendRow } from "@/lib/dashboard/panels/movementTrend";

export function MovementTrendPanel({
  result,
}: {
  result: PanelResult<MovementTrendRow>;
}) {
  const rows = result.status === "ok" ? result.rows : [];

  return (
    <PanelFrame
      id="movementTrend"
      title="Headcount movements"
      description="Joiners and exits over the last 6 months"
      href="/reports"
      status={result.status}
      isEmpty={rows.length === 0}
      emptyText="No movement data recorded in the last 6 months."
    >
      <MovementTrendChart rows={rows} />
    </PanelFrame>
  );
}

