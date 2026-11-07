import React from "react";
import Link from "next/link";
import { PanelFrame } from "./panel-frame";
import { formatDate } from "@/lib/employees/tenure";
import type { PanelResult } from "@/lib/dashboard/panels/types";
import type { ConfigActivityRow } from "@/lib/dashboard/panels/configActivity";

export function ConfigActivityPanel({
  result,
}: {
  result: PanelResult<ConfigActivityRow>;
}) {
  const rows = result.status === "ok" ? result.rows : [];

  return (
    <PanelFrame
      id="configActivity"
      title="Settings activity"
      description="Configuration changes in the last 7 days"
      href="/manage/settings"
      status={result.status}
      isEmpty={rows.length === 0}
      emptyText="No settings changes in the last 7 days."
    >
      <div className="overflow-x-auto -mx-5 px-5">
        <table className="w-full text-left text-xs">
          <caption className="sr-only">Recent configuration and settings changes</caption>
          <thead>
            <tr className="border-b border-border text-muted-foreground">
              <th scope="col" className="pb-2 font-medium">Table</th>
              <th scope="col" className="pb-2 font-medium">Setting key</th>
              <th scope="col" className="pb-2 font-medium">Changed</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((row) => (
              <tr key={row.id} className="hover:bg-muted/40 transition-colors">
                <td className="py-2.5 font-medium text-foreground">
                  <Link
                    href="/manage/settings"
                    className="hover:underline focus-visible:outline-2 focus-visible:outline-offset-2"
                  >
                    {row.tableName.replace(/_/g, " ")}
                  </Link>
                </td>
                <td className="py-2.5 text-muted-foreground font-mono text-[11px]">
                  {row.settingKey ?? "—"}
                </td>
                <td className="py-2.5 text-muted-foreground whitespace-nowrap">
                  {formatDate(row.changedAt)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </PanelFrame>
  );
}

