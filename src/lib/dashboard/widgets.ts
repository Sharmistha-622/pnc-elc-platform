// ============================================================================
// The dashboard, per role.
// ----------------------------------------------------------------------------
// The dashboard used to be the same eight shortcut cards for everyone, a
// fallback from early development: an Employee was shown "Onboarding Hub" and
// "Data Management" and redirected away from both. Now each role sees:
//
//   Waiting on you   tasks addressed to this person — a form to fill in, a
//                    colleague's feedback, a decision on their own team.
//   At a glance      the few numbers their job turns on, each one a link to
//                    the screen where it is worked.
//   Panels           lists, tables and charts built from data the role may see.
//   Quick links      shortcuts to screens relevant to the role.
//
// This file is pure — which widgets exist and who gets them. The queries live
// in `getDashboardData.ts` and `src/lib/dashboard/panels/` and run only for the
// widgets a role is given, so a role that is not shown a widget never has it
// fetched either.
// ============================================================================

import { canAccessRoute, FEATURE_ACCESS, type UserRole } from "@/lib/role-constants";
import { ROLES } from "@/lib/rbac/roles";

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

export type PanelWidgetId =
  | "myProfile"
  | "myTeam"
  | "documentsToVerify"
  | "upcomingJoiners"
  | "openConfirmations"
  | "exitsInProgress"
  | "settlementsDue"
  | "monthMovements"
  | "movementTrend"
  | "headcountByTeam"
  | "configActivity"
  | "emailHealth"
  | "accountsByRole";

export interface PanelWidget {
  id: PanelWidgetId;
  title: string;
  /** One line under the title: what the panel lists. */
  description: string;
  /** "View all". Every role given the panel must be able to open it. */
  href: string;
  /** Every other href the panel can render (row links). Checked like `href`. */
  links: readonly string[];
  kind: "list" | "table" | "chart" | "profile";
  /** The matrix column the rows are made of. */
  resource: "general" | "performance_status" | "config";
  /** Whose rows: the viewer's own, their reportees', or the organisation's. */
  scope: "own" | "own_team" | "all";
}

export const PANEL_WIDGETS: Record<PanelWidgetId, PanelWidget> = {
  myProfile: {
    id: "myProfile",
    title: "My profile",
    description: "Your role, team and reporting manager",
    href: "/profile",
    links: ["/profile"],
    kind: "profile",
    resource: "general",
    scope: "own",
  },
  myTeam: {
    id: "myTeam",
    title: "My team",
    description: "Colleagues reporting to you",
    href: "/my-team",
    links: ["/my-team"],
    kind: "table",
    resource: "general",
    scope: "own_team",
  },
  documentsToVerify: {
    id: "documentsToVerify",
    title: "Documents to verify",
    description: "Candidates waiting on document review",
    href: "/onboarding/candidate",
    links: ["/onboarding/candidate"],
    kind: "list",
    resource: "general",
    scope: "all",
  },
  upcomingJoiners: {
    id: "upcomingJoiners",
    title: "Upcoming joiners",
    description: "Accepted offers joining in the next 30 days",
    href: "/onboarding/employee",
    links: ["/onboarding/employee"],
    kind: "list",
    resource: "general",
    scope: "all",
  },
  openConfirmations: {
    id: "openConfirmations",
    title: "Open confirmations",
    description: "Probation reviews awaiting completion",
    href: "/confirmations",
    links: ["/confirmations"],
    kind: "table",
    resource: "performance_status",
    scope: "all",
  },
  exitsInProgress: {
    id: "exitsInProgress",
    title: "Exits in progress",
    description: "Active offboarding cases",
    href: "/offboarding",
    links: ["/offboarding"],
    kind: "list",
    resource: "general",
    scope: "all",
  },
  settlementsDue: {
    id: "settlementsDue",
    title: "Settlements due",
    description: "Offboarding cases pending settlement",
    href: "/offboarding",
    links: ["/offboarding"],
    kind: "list",
    resource: "general",
    scope: "all",
  },
  monthMovements: {
    id: "monthMovements",
    title: "Movements this month",
    description: "Joiners and exits for this calendar month",
    href: "/employees",
    links: ["/employees"],
    kind: "table",
    resource: "general",
    scope: "all",
  },
  movementTrend: {
    id: "movementTrend",
    title: "Headcount movements",
    description: "Joiners and exits over the last 6 months",
    href: "/reports",
    links: ["/reports"],
    kind: "chart",
    resource: "general",
    scope: "all",
  },
  headcountByTeam: {
    id: "headcountByTeam",
    title: "Headcount by team",
    description: "Active staff across top departments",
    href: "/employees",
    links: ["/employees"],
    kind: "chart",
    resource: "general",
    scope: "all",
  },
  configActivity: {
    id: "configActivity",
    title: "Settings activity",
    description: "Configuration changes in the last 7 days",
    href: "/manage/settings",
    links: ["/manage/settings"],
    kind: "list",
    resource: "config",
    scope: "all",
  },
  emailHealth: {
    id: "emailHealth",
    title: "Email delivery",
    description: "Delivery failures in the last 7 days",
    href: "/manage/emails",
    links: ["/manage/emails"],
    kind: "list",
    resource: "config",
    scope: "all",
  },
  accountsByRole: {
    id: "accountsByRole",
    title: "Accounts by role",
    description: "Active user accounts grouped by assigned role",
    href: "/manage/users",
    links: ["/manage/users"],
    kind: "table",
    resource: "config",
    scope: "all",
  },
};

export type QuickLinkId =
  | "employees"
  | "onboarding"
  | "reviews"
  | "usersAndRoles"
  | "settings"
  | "newCandidate"
  | "startConfirmation"
  | "appraisals"
  | "letters"
  | "candidates"
  | "joiners"
  | "offboarding"
  | "reports"
  | "emails"
  | "dataManagement"
  | "auditLog"
  | "myTeam"
  | "myReviews"
  | "confirmations"
  | "myForms"
  | "myProfile"
  | "whatsNew";

export interface QuickLink {
  id: QuickLinkId;
  label: string;
  href: string;
}

export const QUICK_LINKS: Record<QuickLinkId, QuickLink> = {
  employees: { id: "employees", label: "Employees", href: "/employees" },
  onboarding: { id: "onboarding", label: "Onboarding", href: "/onboarding" },
  reviews: { id: "reviews", label: "Reviews", href: "/reviews" },
  usersAndRoles: { id: "usersAndRoles", label: "Users & roles", href: "/manage/users" },
  settings: { id: "settings", label: "Settings", href: "/manage/settings" },
  newCandidate: { id: "newCandidate", label: "New candidate", href: "/onboarding/candidate/new" },
  startConfirmation: { id: "startConfirmation", label: "Start a confirmation", href: "/confirmations/new" },
  appraisals: { id: "appraisals", label: "Appraisals", href: "/appraisals" },
  letters: { id: "letters", label: "Letters", href: "/manage/letters" },
  candidates: { id: "candidates", label: "Candidates", href: "/onboarding/candidate" },
  joiners: { id: "joiners", label: "Joiners", href: "/onboarding/employee" },
  offboarding: { id: "offboarding", label: "Offboarding", href: "/offboarding" },
  reports: { id: "reports", label: "Reports", href: "/reports" },
  emails: { id: "emails", label: "Emails", href: "/manage/emails" },
  dataManagement: { id: "dataManagement", label: "Data management", href: "/data-management" },
  auditLog: { id: "auditLog", label: "Audit log", href: "/audit" },
  myTeam: { id: "myTeam", label: "My team", href: "/my-team" },
  myReviews: { id: "myReviews", label: "My reviews", href: "/my-reviews" },
  confirmations: { id: "confirmations", label: "Confirmations", href: "/confirmations" },
  myForms: { id: "myForms", label: "My forms", href: "/my-forms" },
  myProfile: { id: "myProfile", label: "My profile", href: "/profile" },
  whatsNew: { id: "whatsNew", label: "What's new", href: "/changelog" },
};

export type WidgetId = TaskWidgetId | StatWidgetId | PanelWidgetId | QuickLinkId;

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
  panels: PanelWidgetId[];
  quickLinks: QuickLinkId[];
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
    panels: [
      "headcountByTeam",
      "documentsToVerify",
      "upcomingJoiners",
      "openConfirmations",
      "exitsInProgress",
      "configActivity",
      "emailHealth",
      "accountsByRole",
    ],
    quickLinks: ["employees", "onboarding", "reviews", "usersAndRoles", "settings"],
  },
  pnc_admin: {
    focus: "Your people pipeline, from offer to exit.",
    tasks: ALL_TASKS,
    stats: ["candidatesToReview", "joiningSoon", "confirmationsOpen", "exitsOpen", "headcount"],
    panels: ["documentsToVerify", "upcomingJoiners", "openConfirmations", "exitsInProgress"],
    quickLinks: ["newCandidate", "startConfirmation", "appraisals", "letters"],
  },
  pnc_ops: {
    focus: "What needs doing today: documents to verify, joiners to prepare, feedback to chase.",
    tasks: ALL_TASKS,
    stats: ["candidatesToReview", "joiningSoon", "peerFeedbackPending", "exitsOpen"],
    panels: ["documentsToVerify", "upcomingJoiners", "openConfirmations", "exitsInProgress"],
    quickLinks: ["candidates", "joiners", "reviews", "offboarding"],
  },
  fin_admin: {
    focus: "Movements that touch payroll this month, and settlements waiting on Finance.",
    tasks: ALL_TASKS,
    stats: ["joinersThisMonth", "exitsThisMonth", "settlementsPending", "headcount"],
    panels: ["monthMovements", "settlementsDue", "movementTrend"],
    quickLinks: ["employees", "offboarding", "reports", "letters"],
  },
  fin_ops: {
    focus: "Who joins and who leaves this month, for the payroll run.",
    tasks: ALL_TASKS,
    stats: ["joinersThisMonth", "exitsThisMonth", "headcount"],
    panels: ["monthMovements"],
    quickLinks: ["employees"],
  },
  exec_view: {
    focus: "Headcount and movement across the organisation.",
    tasks: ALL_TASKS,
    stats: ["headcount", "joinersThisMonth", "exitsThisMonth", "confirmationsOpen"],
    panels: ["headcountByTeam", "movementTrend", "openConfirmations"],
    quickLinks: ["reports", "reviews", "employees", "appraisals"],
  },
  platform_admin: {
    focus: "Platform health: delivery failures and configuration changes.",
    tasks: ALL_TASKS,
    stats: ["emailFailures", "configChanges"],
    panels: ["configActivity", "emailHealth", "accountsByRole"],
    quickLinks: ["usersAndRoles", "emails", "settings", "dataManagement"],
  },
  platform_ops: {
    focus: "Anything assigned to you.",
    tasks: ALL_TASKS,
    stats: [],
    panels: [],
    quickLinks: ["dataManagement", "auditLog"],
  },
  manager: {
    focus: "Your team, and the decisions that wait on you.",
    tasks: ALL_TASKS,
    stats: ["teamSize", "teamOnProbation"],
    panels: ["myTeam", "myProfile"],
    quickLinks: ["myTeam", "myReviews", "confirmations", "appraisals"],
  },
  employee: {
    focus: "Anything that is waiting on you.",
    tasks: SELF_TASKS,
    stats: [],
    panels: ["myProfile"],
    quickLinks: ["myForms", "myReviews", "myProfile", "whatsNew"],
  },
};

/**
 * The dashboard this role is given, pruned for the person holding it.
 *
 * Every stat, panel and quick link is re-checked against the route gate rather
 * than trusted from the table above, so a role narrowed in `FEATURE_ACCESS`
 * loses the item the same day it loses the screen. `hasReports: false` drops
 * the team widgets.
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

  // Every staff role gets myTeam appended when they have reportees (or lookup is unknown),
  // unless it is already in their base panels.
  const initialPanels: PanelWidgetId[] = [...base.panels];
  if (!noTeam && !initialPanels.includes("myTeam")) {
    initialPanels.push("myTeam");
  }

  const rolePerformance = (ROLES as Record<string, { access: { performance: { level: string } } }>)[role]?.access
    ?.performance?.level;

  return {
    focus: base.focus,
    tasks: base.tasks.filter((t) => t !== "teamDecisions" || (!noTeam && canDecide)),
    stats: base.stats.filter(
      (s) => canAccessRoute(role, STAT_WIDGETS[s].href) && !(noTeam && teamStats.includes(s))
    ),
    panels: initialPanels.filter((p) => {
      const panel = PANEL_WIDGETS[p];
      if (!panel) return false;
      if (!canAccessRoute(role, panel.href)) return false;
      if (!panel.links.every((link) => canAccessRoute(role, link))) return false;
      if (panel.scope === "own_team" && noTeam) return false;
      if (panel.resource === "performance_status" && rolePerformance === "none") return false;
      return true;
    }),
    quickLinks: base.quickLinks.filter((q) => {
      const link = QUICK_LINKS[q];
      if (!link) return false;
      return canAccessRoute(role, link.href);
    }),
  };
}