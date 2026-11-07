import React from "react";
import type { PanelWidgetId } from "@/lib/dashboard/widgets";
import type { PanelEntry } from "@/lib/dashboard/getDashboardData";
import type { PanelResult } from "@/lib/dashboard/panels/types";

import type { MyProfileRow } from "@/lib/dashboard/panels/myProfile";
import type { MyTeamRow } from "@/lib/dashboard/panels/myTeam";
import type { DocumentToVerifyRow } from "@/lib/dashboard/panels/documentsToVerify";
import type { UpcomingJoinerRow } from "@/lib/dashboard/panels/upcomingJoiners";
import type { OpenConfirmationRow } from "@/lib/dashboard/panels/openConfirmations";
import type { ExitInProgressRow } from "@/lib/dashboard/panels/exitsInProgress";
import type { SettlementDueRow } from "@/lib/dashboard/panels/settlementsDue";
import type { MonthMovementRow } from "@/lib/dashboard/panels/monthMovements";
import type { MovementTrendRow } from "@/lib/dashboard/panels/movementTrend";
import type { HeadcountByTeamRow } from "@/lib/dashboard/panels/headcountByTeam";
import type { ConfigActivityRow } from "@/lib/dashboard/panels/configActivity";
import type { EmailHealthRow } from "@/lib/dashboard/panels/emailHealth";
import type { AccountByRoleRow } from "@/lib/dashboard/panels/accountsByRole";

import { MyProfilePanel } from "./my-profile-panel";
import { MyTeamPanel } from "./my-team-panel";
import { DocumentsToVerifyPanel } from "./documents-to-verify-panel";
import { UpcomingJoinersPanel } from "./upcoming-joiners-panel";
import { OpenConfirmationsPanel } from "./open-confirmations-panel";
import { ExitsInProgressPanel } from "./exits-in-progress-panel";
import { SettlementsDuePanel } from "./settlements-due-panel";
import { MonthMovementsPanel } from "./month-movements-panel";
import { MovementTrendPanel } from "./movement-trend-panel";
import { HeadcountByTeamPanel } from "./headcount-by-team-panel";
import { ConfigActivityPanel } from "./config-activity-panel";
import { EmailHealthPanel } from "./email-health-panel";
import { AccountsByRolePanel } from "./accounts-by-role-panel";

type PanelRenderer = (result: PanelResult<unknown>) => React.ReactNode;

// Typed component dispatcher. Every PanelWidgetId must have a renderer.
const PANEL_RENDERERS: Record<PanelWidgetId, PanelRenderer> = {
  myProfile: (res) => <MyProfilePanel result={res as PanelResult<MyProfileRow>} />,
  myTeam: (res) => <MyTeamPanel result={res as PanelResult<MyTeamRow>} />,
  documentsToVerify: (res) => <DocumentsToVerifyPanel result={res as PanelResult<DocumentToVerifyRow>} />,
  upcomingJoiners: (res) => <UpcomingJoinersPanel result={res as PanelResult<UpcomingJoinerRow>} />,
  openConfirmations: (res) => <OpenConfirmationsPanel result={res as PanelResult<OpenConfirmationRow>} />,
  exitsInProgress: (res) => <ExitsInProgressPanel result={res as PanelResult<ExitInProgressRow>} />,
  settlementsDue: (res) => <SettlementsDuePanel result={res as PanelResult<SettlementDueRow>} />,
  monthMovements: (res) => <MonthMovementsPanel result={res as PanelResult<MonthMovementRow>} />,
  movementTrend: (res) => <MovementTrendPanel result={res as PanelResult<MovementTrendRow>} />,
  headcountByTeam: (res) => <HeadcountByTeamPanel result={res as PanelResult<HeadcountByTeamRow>} />,
  configActivity: (res) => <ConfigActivityPanel result={res as PanelResult<ConfigActivityRow>} />,
  emailHealth: (res) => <EmailHealthPanel result={res as PanelResult<EmailHealthRow>} />,
  accountsByRole: (res) => <AccountsByRolePanel result={res as PanelResult<AccountByRoleRow>} />,
};

// Panels that render charts or wide tables can span both columns on large screens
const FULL_WIDTH_PANELS = new Set<PanelWidgetId>([
  "movementTrend",
  "monthMovements",
]);

export function DashboardPanels({ panels }: { panels: PanelEntry[] }) {
  if (panels.length === 0) return null;

  return (
    <section aria-labelledby="dashboard-panels-heading" className="space-y-4">
      <h2 id="dashboard-panels-heading" className="sr-only">
        Dashboard panels
      </h2>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {panels.map(({ id, result }) => {
          const render = PANEL_RENDERERS[id];
          const isFullWidth = FULL_WIDTH_PANELS.has(id);

          return (
            <div key={id} className={isFullWidth ? "lg:col-span-2" : "col-span-1"}>
              {render(result)}
            </div>
          );
        })}
      </div>
    </section>
  );
}
