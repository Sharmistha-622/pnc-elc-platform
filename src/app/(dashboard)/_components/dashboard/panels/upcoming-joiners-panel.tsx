import React from "react";
import Link from "next/link";
import { PanelFrame } from "./panel-frame";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/employees/tenure";
import { statusTone, TONES } from "@/lib/ui/tone";
import type { PanelResult } from "@/lib/dashboard/panels/types";
import type { UpcomingJoinerRow } from "@/lib/dashboard/panels/upcomingJoiners";

export function UpcomingJoinersPanel({
  result,
}: {
  result: PanelResult<UpcomingJoinerRow>;
}) {
  const rows = result.status === "ok" ? result.rows : [];

  return (
    <PanelFrame
      id="upcomingJoiners"
      title="Upcoming joiners"
      description="Accepted offers joining in the next 30 days"
      href="/onboarding/employee"
      status={result.status}
      isEmpty={rows.length === 0}
      emptyText="No upcoming joiners in the next 30 days."
    >
      <div className="overflow-x-auto -mx-5 px-5">
        <table className="w-full text-left text-xs">
          <caption className="sr-only">Accepted offers joining in the next 30 days</caption>
          <thead>
            <tr className="border-b border-border text-muted-foreground">
              <th scope="col" className="pb-2 font-medium">Candidate</th>
              <th scope="col" className="pb-2 font-medium">Role</th>
              <th scope="col" className="pb-2 font-medium">Joining</th>
              <th scope="col" className="pb-2 font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((row) => (
              <tr key={row.id} className="hover:bg-muted/40 transition-colors">
                <td className="py-2.5 font-medium text-foreground">
                  <Link
                    href="/onboarding/employee"
                    className="hover:underline focus-visible:outline-2 focus-visible:outline-offset-2"
                  >
                    {row.candidateName}
                  </Link>
                  {row.department && (
                    <span className="block text-muted-foreground text-[11px]">{row.department}</span>
                  )}
                </td>
                <td className="py-2.5 text-muted-foreground">{row.designation}</td>
                <td className="py-2.5 text-muted-foreground whitespace-nowrap">
                  {formatDate(row.joiningDate)}
                </td>
                <td className="py-2.5">
                  <Badge variant="outline" className={`text-xs font-medium ${TONES[statusTone(row.status)].soft}`}>
                    {row.status.replace(/_/g, " ")}
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

