import React from "react";
import { PanelFrame } from "./panel-frame";
import { HeadcountByTeamChart } from "./headcount-by-team-chart";
import type { PanelResult } from "@/lib/dashboard/panels/types";
import type { HeadcountByTeamRow } from "@/lib/dashboard/panels/headcountByTeam";

export function HeadcountByTeamPanel({
  result,
}: {
  result: PanelResult<HeadcountByTeamRow>;
}) {
  const rows = result.status === "ok" ? result.rows : [];

  return (
    <PanelFrame
      id="headcountByTeam"
      title="Headcount by team"
      description="Active staff across top departments"
      href="/employees"
      status={result.status}
      isEmpty={rows.length === 0}
      emptyText="No active employee records found."
    >
      <HeadcountByTeamChart rows={rows} />
    </PanelFrame>
  );
}

