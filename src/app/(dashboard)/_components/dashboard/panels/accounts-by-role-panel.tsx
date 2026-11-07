import React from "react";
import Link from "next/link";
import { PanelFrame } from "./panel-frame";
import { Badge } from "@/components/ui/badge";
import { TONES } from "@/lib/ui/tone";
import type { PanelResult } from "@/lib/dashboard/panels/types";
import type { AccountByRoleRow } from "@/lib/dashboard/panels/accountsByRole";

export function AccountsByRolePanel({
  result,
}: {
  result: PanelResult<AccountByRoleRow>;
}) {
  const rows = result.status === "ok" ? result.rows : [];

  return (
    <PanelFrame
      id="accountsByRole"
      title="Accounts by role"
      description="Active user accounts grouped by assigned role"
      href="/manage/users"
      status={result.status}
      isEmpty={rows.length === 0}
      emptyText="No user account records found."
    >
      <div className="overflow-x-auto -mx-5 px-5">
        <table className="w-full text-left text-xs">
          <caption className="sr-only">Active accounts grouped by role</caption>
          <thead>
            <tr className="border-b border-border text-muted-foreground">
              <th scope="col" className="pb-2 font-medium">Role</th>
              <th scope="col" className="pb-2 font-medium">Role code</th>
              <th scope="col" className="pb-2 font-medium text-right">Users</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((row) => (
              <tr key={row.role} className="hover:bg-muted/40 transition-colors">
                <td className="py-2.5 font-medium text-foreground">
                  <Link
                    href="/manage/users"
                    className="hover:underline focus-visible:outline-2 focus-visible:outline-offset-2"
                  >
                    {row.label}
                  </Link>
                </td>
                <td className="py-2.5 text-muted-foreground font-mono text-[11px]">
                  {row.role}
                </td>
                <td className="py-2.5 text-right">
                  <Badge variant="outline" className={`text-xs font-semibold ${TONES.accent.soft}`}>
                    {row.count}
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

