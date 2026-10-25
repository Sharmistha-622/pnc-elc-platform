// ============================================================================
// The dashboard, per role.
// ----------------------------------------------------------------------------
// The dashboard used to be the same eight shortcut cards for everyone, a
// fallback from early development: an Employee was shown "Onboarding Hub" and
// "Data Management" and redirected away from both. Now each role sees two
// things only:
//
//   Waiting on you   tasks addressed to this person — a form to fill in, a
//                    colleague's feedback, a decision on their own team.
//   At a glance      the few numbers their job turns on, each one a link to
//                    the screen where it is worked.
//
// This file is pure — which widgets exist and who gets them. The queries live
// in `getDashboardData.ts` and run only for the widgets a role is given, so a
// role that is not shown a number never has it fetched either.
// ============================================================================

import { canAccessRoute, FEATURE_ACCESS, type UserRole } from "@/lib/role-constants";

export type TaskWidgetId =
  /** Forms assigned to me that I have not submitted. */
  | "myForms"
  /** Peer feedback I have been nominated to give. */
  | "myPeerFeedback"
  /** My reportees' confirmations that wait on my decision. */
  | "teamDecisions";

export type StatWidgetId =
  | "teamSize"
  | "teamOnProbation"
  | "candidatesToReview"
  | "candidatesInPipeline"
  | "joiningSoon"
  | "confirmationsOpen"
  | "peerFeedbackPending"
  | "exitsOpen"
  | "settlementsPending"
  | "headcount"
  | "joinersThisMonth"
  | "exitsThisMonth"
  | "emailFailures"
  | "configChanges";

export type WidgetId = TaskWidgetId | StatWidgetId;

export interface StatWidget {
  id: StatWidgetId;
  label: string;
  /** One line under the number: what it counts. */
  hint: string;
  /** Where the number is worked. Every role shown the widget must reach it. */
  href: string;
  /**
   * What the number is made of. Counts only — none of these widgets ever
   * returns a row — but the matrix still decides who may see an aggregate.
   */
  resource: "general" | "performance_status" | "config";
}

export const STAT_WIDGETS: Record<StatWidgetId, StatWidget> = {
  teamSize: {
    id: "teamSize",
    label: "Direct reports",
    hint: "people reporting to you",
    href: "/my-team",
    resource: "general",
  },
  teamOnProbation: {
    id: "teamOnProbation",
    label: "On probation",
    hint: "in your team, not yet confirmed",
    href: "/my-team",
    resource: "general",
  },
  candidatesToReview: {
    id: "candidatesToReview",
    label: "Documents to verify",
    hint: "candidates who have submitted",
    href: "/onboarding/candidate",
    resource: "general",
  },
  candidatesInPipeline: {
    id: "candidatesInPipeline",
    label: "In the pipeline",
    hint: "offers out, not yet joined",
    href: "/onboarding/candidate",
    resource: "general",
  },
  joiningSoon: {
    id: "joiningSoon",
    label: "Joining in 14 days",
    hint: "accepted offers starting soon",
    href: "/onboarding/employee",
    resource: "general",
  },
  confirmationsOpen: {
    id: "confirmationsOpen",
    label: "Open confirmations",
    hint: "probation reviews in progress",
    href: "/confirmations",
    resource: "performance_status",
  },
  peerFeedbackPending: {
    id: "peerFeedbackPending",
    label: "Feedback to chase",
    hint: "peer responses not yet in",
    href: "/confirmations",
    resource: "performance_status",
  },
  exitsOpen: {
    id: "exitsOpen",
    label: "Exits in progress",
    hint: "offboarding cases still open",
    href: "/offboarding",
    resource: "general",
  },
  settlementsPending: {
    id: "settlementsPending",
    label: "Settlements due",
    hint: "exits waiting on full and final",
    href: "/offboarding",
    resource: "general",
  },
  headcount: {
    id: "headcount",
    label: "Active employees",
    hint: "on the roster today",
    href: "/employees",
    resource: "general",
  },
  joinersThisMonth: {
    id: "joinersThisMonth",
    label: "Joined this month",
    hint: "new on the roster",
    href: "/employees",
    resource: "general",
  },
  exitsThisMonth: {
    id: "exitsThisMonth",
    label: "Leaving this month",
    hint: "last working day this month",
    href: "/employees",
    resource: "general",
  },
  emailFailures: {
    id: "emailFailures",
    label: "Failed emails",
    hint: "in the last 7 days",
    href: "/manage/emails",
    resource: "config",
  },
  configChanges: {
    id: "configChanges",
    label: "Settings changes",
    hint: "in the last 7 days",
    href: "/manage/settings",
    resource: "config",
  },
};

export interface RoleDashboard {
  /** One sentence, shown under the greeting: what this dashboard is for. */
  focus: string;
  tasks: TaskWidgetId[];
  stats: StatWidgetId[];
}

/** Everyone in the shell can be asked to fill a form or give feedback. */
const SELF_TASKS: TaskWidgetId[] = ["myForms", "myPeerFeedback"];
/** Anyone can have reportees; `teamDecisions` is dropped when they have none. */
const ALL_TASKS: TaskWidgetId[] = [...SELF_TASKS, "teamDecisions"];

/**
 * What each staff role sees. Portal-only roles (`candidate`, `pre_joiner`)
 * have no dashboard at all — middleware sends them to the portal notice.
 *
 * The platform roles are given configuration numbers and nothing about
 * people: whoever builds the platform is not shown even a headcount they
 * have no use for.
 */
export const ROLE_DASHBOARDS: Partial<Record<UserRole, RoleDashboard>> = {
  super_admin: {
    focus: "The whole organisation: the pipeline, reviews in flight, exits, and platform health.",
    tasks: ALL_TASKS,
    stats: ["headcount", "candidatesInPipeline", "confirmationsOpen", "exitsOpen", "emailFailures", "configChanges"],
  },
  pnc_admin: {
    focus: "Your people pipeline, from offer to exit.",
    tasks: ALL_TASKS,
    stats: ["candidatesToReview", "joiningSoon", "confirmationsOpen", "exitsOpen", "headcount"],
  },
  pnc_ops: {
    focus: "What needs doing today: documents to verify, joiners to prepare, feedback to chase.",
    tasks: ALL_TASKS,
    stats: ["candidatesToReview", "joiningSoon", "peerFeedbackPending", "exitsOpen"],
  },
  fin_admin: {
    focus: "Movements that touch payroll this month, and settlements waiting on Finance.",
    tasks: ALL_TASKS,
    stats: ["joinersThisMonth", "exitsThisMonth", "settlementsPending", "headcount"],
  },
  fin_ops: {
    focus: "Who joins and who leaves this month, for the payroll run.",
    tasks: ALL_TASKS,
    stats: ["joinersThisMonth", "exitsThisMonth", "headcount"],
  },
  exec_view: {
    focus: "Headcount and movement across the organisation.",
    tasks: ALL_TASKS,
    stats: ["headcount", "joinersThisMonth", "exitsThisMonth", "confirmationsOpen"],
  },
  platform_admin: {
    focus: "Platform health: delivery failures and configuration changes.",
    tasks: ALL_TASKS,
    stats: ["emailFailures", "configChanges"],
  },
  platform_ops: {
    focus: "Anything assigned to you.",
    tasks: ALL_TASKS,
    stats: [],
  },
  manager: {
    focus: "Your team, and the decisions that wait on you.",
    tasks: ALL_TASKS,
    stats: ["teamSize", "teamOnProbation"],
  },
  employee: {
    focus: "Anything that is waiting on you.",
    tasks: SELF_TASKS,
    stats: [],
  },
};

/**
 * The dashboard this role is given, pruned for the person holding it.
 *
 * Every stat is re-checked against the route gate rather than trusted from
 * the table above, so a role narrowed in `FEATURE_ACCESS` loses the number
 * the same day it loses the screen. `hasReports: false` drops the team
 * widgets: a Platform Admin with no reportees has no team to show.
 */
export function dashboardFor(
  role: UserRole | null | undefined,
  options: { hasReports?: boolean } = {}
): RoleDashboard | null {
  if (!role || !FEATURE_ACCESS.dashboard.includes(role)) return null;
  const base = ROLE_DASHBOARDS[role];
  if (!base) return null;

  const noTeam = options.hasReports === false;
  const teamStats: StatWidgetId[] = ["teamSize", "teamOnProbation"];
  // A decision is recorded on the confirmation screens. A role that cannot
  // open them would be handed a link that redirects home.
  const canDecide = canAccessRoute(role, "/confirmations");

  return {
    focus: base.focus,
    tasks: base.tasks.filter((t) => t !== "teamDecisions" || (!noTeam && canDecide)),
    stats: base.stats.filter(
      (s) => canAccessRoute(role, STAT_WIDGETS[s].href) && !(noTeam && teamStats.includes(s))
    ),
  };
}
