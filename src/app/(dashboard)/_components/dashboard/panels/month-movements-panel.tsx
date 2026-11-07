import React from "react";
import Link from "next/link";
import { PanelFrame } from "./panel-frame";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/employees/tenure";
import { TONES } from "@/lib/ui/tone";
import type { PanelResult } from "@/lib/dashboard/panels/types";
import type { MonthMovementRow } from "@/lib/dashboard/panels/monthMovements";

export function MonthMovementsPanel({
  result,
}: {
  result: PanelResult<MonthMovementRow>;
}) {
  const rows = result.status === "ok" ? result.rows : [];

  return (
    <PanelFrame
      id="monthMovements"
      title="Movements this month"
      description="Joiners and exits for this calendar month"
      href="/employees"
      status={result.status}
      isEmpty={rows.length === 0}
      emptyText="No employee movements recorded this month."
    >
      <div className="overflow-x-auto -mx-5 px-5">
        <table className="w-full text-left text-xs">
          <caption className="sr-only">Employee joiners and exits this month</caption>
          <thead>
            <tr className="border-b border-border text-muted-foreground">
              <th scope="col" className="pb-2 font-medium">Employee</th>
              <th scope="col" className="pb-2 font-medium">Department</th>
              <th scope="col" className="pb-2 font-medium">Movement</th>
              <th scope="col" className="pb-2 font-medium">Date</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((row) => (
              <tr key={`${row.kind}-${row.id}`} className="hover:bg-muted/40 transition-colors">
                <td className="py-2.5 font-medium text-foreground">
                  <Link
                    href="/employees"
                    className="hover:underline focus-visible:outline-2 focus-visible:outline-offset-2"
                  >
                    {row.name}
                  </Link>
                </td>
                <td className="py-2.5 text-muted-foreground">{row.team ?? "—"}</td>
                <td className="py-2.5">
                  <Badge
                    variant="outline"
                    className={`text-xs font-medium capitalize ${
                      row.kind === "joiner" ? TONES.info.soft : TONES.warning.soft
                    }`}
                  >
                    {row.kind}
                  </Badge>
                </td>
                <td className="py-2.5 text-muted-foreground whitespace-nowrap">
                  {formatDate(row.date)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </PanelFrame>
  );
}

