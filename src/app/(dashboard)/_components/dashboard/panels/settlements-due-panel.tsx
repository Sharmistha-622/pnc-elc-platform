import React from "react";
import Link from "next/link";
import { PanelFrame } from "./panel-frame";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/employees/tenure";
import { TONES } from "@/lib/ui/tone";
import type { PanelResult } from "@/lib/dashboard/panels/types";
import type { SettlementDueRow } from "@/lib/dashboard/panels/settlementsDue";

export function SettlementsDuePanel({
  result,
}: {
  result: PanelResult<SettlementDueRow>;
}) {
  const rows = result.status === "ok" ? result.rows : [];

  return (
    <PanelFrame
      id="settlementsDue"
      title="Settlements due"
      description="Offboarding cases pending settlement"
      href="/offboarding"
      status={result.status}
      isEmpty={rows.length === 0}
      emptyText="No settlements pending."
    >
      <div className="overflow-x-auto -mx-5 px-5">
        <table className="w-full text-left text-xs">
          <caption className="sr-only">Offboarding cases pending full-and-final settlement</caption>
          <thead>
            <tr className="border-b border-border text-muted-foreground">
              <th scope="col" className="pb-2 font-medium">Employee</th>
              <th scope="col" className="pb-2 font-medium">Department</th>
              <th scope="col" className="pb-2 font-medium">LWD</th>
              <th scope="col" className="pb-2 font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((row) => (
              <tr key={row.id} className="hover:bg-muted/40 transition-colors">
                <td className="py-2.5 font-medium text-foreground">
                  <Link
                    href="/offboarding"
                    className="hover:underline focus-visible:outline-2 focus-visible:outline-offset-2"
                  >
                    {row.employeeName}
                  </Link>
                </td>
                <td className="py-2.5 text-muted-foreground">{row.team ?? "—"}</td>
                <td className="py-2.5 text-muted-foreground whitespace-nowrap">
                  {formatDate(row.actualLwd ?? row.proposedLwd)}
                </td>
                <td className="py-2.5">
                  <Badge variant="outline" className={`text-xs font-medium ${TONES.pending.soft}`}>
                    Settlement pending
                  </Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </PanelFrame>
  );
}

