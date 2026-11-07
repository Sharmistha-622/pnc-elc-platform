import React from "react";
import Link from "next/link";
import { PanelFrame } from "./panel-frame";
import { Badge } from "@/components/ui/badge";
import { formatDate, formatEmploymentType } from "@/lib/employees/tenure";
import { TONES } from "@/lib/ui/tone";
import type { PanelResult } from "@/lib/dashboard/panels/types";
import type { MyTeamRow } from "@/lib/dashboard/panels/myTeam";

export function MyTeamPanel({ result }: { result: PanelResult<MyTeamRow> }) {
  const rows = result.status === "ok" ? result.rows : [];

  return (
    <PanelFrame
      id="myTeam"
      title="My team"
      description="Colleagues reporting to you"
      href="/my-team"
      status={result.status}
      isEmpty={rows.length === 0}
      emptyText="No direct reports found."
    >
      <div className="overflow-x-auto -mx-5 px-5">
        <table className="w-full text-left text-xs">
          <caption className="sr-only">Direct reports in your team</caption>
          <thead>
            <tr className="border-b border-border text-muted-foreground">
              <th scope="col" className="pb-2 font-medium">Name</th>
              <th scope="col" className="pb-2 font-medium">Type</th>
              <th scope="col" className="pb-2 font-medium">Joined</th>
              <th scope="col" className="pb-2 font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((member) => (
              <tr key={member.id} className="hover:bg-muted/40 transition-colors">
                <td className="py-2.5 font-medium text-foreground">
                  <Link href="/my-team" className="hover:underline focus-visible:outline-2 focus-visible:outline-offset-2">
                    {member.name}
                  </Link>
                </td>
                <td className="py-2.5 text-muted-foreground">
                  {formatEmploymentType(member.employeeType)}
                </td>
                <td className="py-2.5 text-muted-foreground whitespace-nowrap">
                  {formatDate(member.joiningDate)}
                </td>
                <td className="py-2.5">
                  <Badge variant="outline" className={`text-xs font-medium ${member.confirmationDate ? TONES.success.soft : TONES.warning.soft}`}>
                    {member.confirmationDate ? "Confirmed" : "Probation"}
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

