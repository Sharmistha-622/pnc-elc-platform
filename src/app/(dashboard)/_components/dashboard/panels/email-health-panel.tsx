import React from "react";
import Link from "next/link";
import { PanelFrame } from "./panel-frame";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/employees/tenure";
import { TONES } from "@/lib/ui/tone";
import type { PanelResult } from "@/lib/dashboard/panels/types";
import type { EmailHealthRow } from "@/lib/dashboard/panels/emailHealth";

export function EmailHealthPanel({
  result,
}: {
  result: PanelResult<EmailHealthRow>;
}) {
  const rows = result.status === "ok" ? result.rows : [];

  return (
    <PanelFrame
      id="emailHealth"
      title="Email delivery"
      description="Delivery failures in the last 7 days"
      href="/manage/emails"
      status={result.status}
      isEmpty={rows.length === 0}
      emptyText="No failed email deliveries in the last 7 days."
    >
      <div className="overflow-x-auto -mx-5 px-5">
        <table className="w-full text-left text-xs">
          <caption className="sr-only">Recent email delivery failures</caption>
          <thead>
            <tr className="border-b border-border text-muted-foreground">
              <th scope="col" className="pb-2 font-medium">Notification</th>
              <th scope="col" className="pb-2 font-medium">Category</th>
              <th scope="col" className="pb-2 font-medium">Failed</th>
              <th scope="col" className="pb-2 font-medium">Latest failure</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((row) => (
              <tr key={row.notificationType} className="hover:bg-muted/40 transition-colors">
                <td className="py-2.5 font-medium text-foreground">
                  <Link
                    href="/manage/emails"
                    className="hover:underline focus-visible:outline-2 focus-visible:outline-offset-2"
                  >
                    {row.notificationType.replace(/_/g, " ")}
                  </Link>
                </td>
                <td className="py-2.5 text-muted-foreground capitalize">
                  {row.category}
                </td>
                <td className="py-2.5">
                  <Badge variant="outline" className={`text-xs font-semibold ${TONES.danger.soft}`}>
                    {row.failedCount} failed
                  </Badge>
                </td>
                <td className="py-2.5 text-muted-foreground whitespace-nowrap">
                  {formatDate(row.latestSentAt)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </PanelFrame>
  );
}

