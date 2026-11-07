import React from "react";
import { PanelFrame } from "./panel-frame";
import { Badge } from "@/components/ui/badge";
import { formatDate, formatEmploymentType } from "@/lib/employees/tenure";
import { statusTone, TONES } from "@/lib/ui/tone";
import type { PanelResult } from "@/lib/dashboard/panels/types";
import type { MyProfileRow } from "@/lib/dashboard/panels/myProfile";

export function MyProfilePanel({ result }: { result: PanelResult<MyProfileRow> }) {
  const profile = result.status === "ok" ? result.rows[0] : null;

  return (
    <PanelFrame
      id="myProfile"
      title="My profile"
      description="Your role, team and reporting manager"
      href="/profile"
      status={result.status}
      isEmpty={!profile}
      emptyText="No profile information found."
    >
      {profile && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-border pb-3">
            <div>
              <p className="font-semibold text-foreground text-sm">{profile.name}</p>
              <p className="text-xs text-muted-foreground">{profile.team ?? "No team assigned"}</p>
            </div>
            <div className="flex items-center gap-2">
              {profile.employeeType && (
                <span className="text-xs text-muted-foreground font-medium">
                  {formatEmploymentType(profile.employeeType)}
                </span>
              )}
              <Badge variant="outline" className={`text-xs font-medium ${TONES[statusTone(profile.status)].soft}`}>
                {profile.status}
              </Badge>
            </div>
          </div>

          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div>
              <dt className="text-muted-foreground">Joining date</dt>
              <dd className="font-medium text-foreground mt-0.5">{formatDate(profile.joiningDate)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Confirmation status</dt>
              <dd className="font-medium text-foreground mt-0.5">
                {profile.confirmationDate ? `Confirmed on ${formatDate(profile.confirmationDate)}` : "In probation"}
              </dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-muted-foreground">Reporting manager</dt>
              <dd className="font-medium text-foreground mt-0.5">
                {profile.manager ? (
                  <span>
                    {profile.manager.name}
                    {profile.manager.email && (
                      <span className="text-muted-foreground ml-1">({profile.manager.email})</span>
                    )}
                  </span>
                ) : (
                  "Not assigned"
                )}
              </dd>
            </div>
          </dl>
        </div>
      )}
    </PanelFrame>
  );
}

