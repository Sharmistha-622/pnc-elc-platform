// ============================================================================
// Dashboard loader.
// ----------------------------------------------------------------------------
// Runs a query only for the widgets `dashboardFor` hands this role, so a number
// a role is not shown is never fetched for it. Two rules hold throughout:
//
//   The RLS-bound client wherever the table allows it. The one exception is
//   `onboarding_records`, which is closed to user sessions at the database so
//   that CTC can only leave through the onboarding API's per-role redaction.
//   Its counts use the service-role client, and are only ever run for roles
//   `dashboardFor` has already given the widget to.
//
//   Counts, not rows. Every stat is a `head: true` count — no row leaves the
//   database. The task lists return names and titles of things addressed to
//   this person, and nothing else.
// ============================================================================

import type { SupabaseClient } from "@supabase/supabase-js";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { getCurrentEmployee } from "@/lib/forms/currentEmployee";
import { getMyForms } from "@/lib/forms/getMyForms";
import { roleLabel, type UserRole } from "@/lib/role-constants";
import { listUsersWithRoles } from "@/lib/rbac/listUsersWithRoles";
import { addDays, istToday, monthWindow } from "./dates";
import {
  dashboardFor,
  STAT_WIDGETS,
  type StatWidget,
  type StatWidgetId,
  type TaskWidgetId,
} from "./widgets";

type Db = SupabaseClient;

export interface TaskItem {
  id: string;
  title: string;
  detail: string | null;
  href: string;
}

export interface TaskGroup {
  id: TaskWidgetId;
  label: string;
  /** Where the full list lives, when there is a screen for it. */
  href: string | null;
  items: TaskItem[];
  /** False when the lookup failed — the panel says so rather than "all clear". */
  loaded: boolean;
}

export interface StatResult extends StatWidget {
  /** Null when the count could not be read. */
  value: number | null;
}

export interface EmployeeProfileSnapshot {
  id: string;
  name: string;
  email: string | null;
  department: string | null;
  employeeType: string | null;
  status: string;
  joiningDate: string | null;
  confirmationDate: string | null;
  manager: {
    id?: string;
    name: string;
    email: string | null;
    department: string | null;
  } | null;
}

export interface TeamMemberSnapshot {
  id: string;
  name: string;
  email: string | null;
  department: string | null;
  employeeType: string | null;
  joiningDate: string | null;
  confirmationDate: string | null;
  status: string;
}

export interface CandidateSnapshot {
  id: string;
  name: string;
  role: string | null;
  department: string | null;
  submittedAt: string | null;
  status: string;
}

export interface UpcomingJoinerSnapshot {
  id: string;
  name: string;
  role: string | null;
  department: string | null;
  joiningDate: string | null;
  status: string;
}

export interface ConfirmationSnapshot {
  id: string;
  employeeName: string;
  managerName?: string | null;
  status: string;
  createdAt: string;
}

export interface MovementSnapshot {
  id: string;
  name: string;
  department: string | null;
  date: string | null;
  status?: string;
}

export interface SettlementSnapshot {
  id: string;
  employeeName: string;
  department: string | null;
  status: string;
  lastWorkingDay?: string | null;
}

export interface DepartmentCount {
  department: string;
  count: number;
}

export interface UserRoleCount {
  role: string;
  label: string;
  count: number;
}

export interface SettingsChangeSnapshot {
  id: string;
  section: string;
  changedAt: string;
  changedBy: string | null;
}

export interface RoleCustomData {
  employeeProfile?: EmployeeProfileSnapshot | null;
  teamMembers?: TeamMemberSnapshot[];
  candidatesToReview?: CandidateSnapshot[];
  upcomingJoiners?: UpcomingJoinerSnapshot[];
  openConfirmationsList?: ConfirmationSnapshot[];
  monthJoiners?: MovementSnapshot[];
  monthExits?: MovementSnapshot[];
  pendingSettlements?: SettlementSnapshot[];
  departmentBreakdown?: DepartmentCount[];
  recentJoiners?: MovementSnapshot[];
  userRoleCounts?: UserRoleCount[];
  recentSettingsChanges?: SettingsChangeSnapshot[];
}

export interface DashboardData {
  focus: string;
  tasks: TaskGroup[];
  stats: StatResult[];
  roleCustomData: RoleCustomData;
}

// Counted on `status`, the field every onboarding transition writes.
// `joiner_status` was backfilled once and is otherwise only ever set to
// `withdrawn`, so it is used for that and nothing else.
/** Offered and not yet joined. */
const PIPELINE = [
  "draft", "invited", "in_progress", "submitted", "under_review",
  "changes_requested", "approved", "account_provisioning",
];
/** Documents in, waiting on P&C. */
const AWAITING_REVIEW = ["submitted", "under_review"];
/** The candidate has accepted and started the portal: they will turn up. */
const ACCEPTED = [
  "in_progress", "submitted", "under_review", "changes_requested", "approved", "account_provisioning",
];
/** Rows that are not withdrawn. A null `joiner_status` is a live candidate. */
const NOT_WITHDRAWN = "joiner_status.is.null,joiner_status.neq.withdrawn";
const OPEN_FEEDBACK = ["pending", "reminded"];
const CLOSED_EXITS = "(completed,cancelled)";
/** A task panel shows this many; the rest are a click away. */
const TASK_LIMIT = 5;

/** A count with errors logged by code, never by payload. */
async function count(
  label: string,
  query: PromiseLike<{ count: number | null; error: { code?: string; message: string } | null }>
): Promise<number | null> {
  const { count, error } = await query;
  if (error) {
    console.error(`dashboard: ${label} count failed (${error.code ?? "unknown"})`);
    return null;
  }
  return count ?? 0;
}

function headCount(db: Db, table: string) {
  return db.from(table).select("id", { count: "exact", head: true });
}

async function loadStat(
  db: Db,
  id: StatWidgetId,
  me: { id: string } | null,
  today: string
): Promise<number | null> {
  const month = monthWindow(today);
  // Service-role, for the candidate counts only — see the header.
  const pipeline = () => createAdminSupabaseClient();

  switch (id) {
    case "teamSize":
      if (!me) return null;
      return count(id, headCount(db, "employees").eq("manager_id", me.id).eq("status", "active"));
    case "teamOnProbation":
      if (!me) return null;
      return count(
        id,
        headCount(db, "employees")
          .eq("manager_id", me.id)
          .eq("status", "active")
          .is("confirmation_date", null)
      );
    case "candidatesToReview": {
      const admin = pipeline();
      if (!admin) return null;
      return count(
        id,
        headCount(admin, "onboarding_records").in("status", AWAITING_REVIEW).or(NOT_WITHDRAWN)
      );
    }
    case "candidatesInPipeline": {
      const admin = pipeline();
      if (!admin) return null;
      return count(id, headCount(admin, "onboarding_records").in("status", PIPELINE).or(NOT_WITHDRAWN));
    }
    case "joiningSoon": {
      const admin = pipeline();
      if (!admin) return null;
      return count(
        id,
        headCount(admin, "onboarding_records")
          .in("status", ACCEPTED)
          .or(NOT_WITHDRAWN)
          .gte("joining_date", today)
          .lte("joining_date", addDays(today, 14))
      );
    }
    case "confirmationsOpen":
      return count(id, headCount(db, "confirmations").eq("status", "pending"));
    case "peerFeedbackPending":
      return count(id, headCount(db, "peer_feedback").in("response_status", OPEN_FEEDBACK));
    case "exitsOpen":
      return count(id, headCount(db, "offboarding_cases").not("status", "in", CLOSED_EXITS));
    case "settlementsPending":
      return count(id, headCount(db, "offboarding_cases").eq("status", "settlement_pending"));
    case "headcount":
      return count(id, headCount(db, "employees").eq("status", "active"));
    case "joinersThisMonth":
      return count(
        id,
        headCount(db, "employees").gte("joining_date", month.from).lt("joining_date", month.to)
      );
    case "exitsThisMonth":
      return count(
        id,
        headCount(db, "employees").gte("exit_date", month.from).lt("exit_date", month.to)
      );
    case "emailFailures":
      return count(
        id,
        headCount(db, "email_delivery_logs")
          .eq("status", "failed")
          .gte("sent_at", `${addDays(today, -7)}T00:00:00+05:30`)
      );
    case "configChanges":
      return count(
        id,
        headCount(db, "settings_change_log").gte("changed_at", `${addDays(today, -7)}T00:00:00+05:30`)
      );
  }
}

async function loadMyForms(): Promise<TaskGroup> {
  const group: TaskGroup = { id: "myForms", label: "Forms to fill in", href: "/my-forms", items: [], loaded: true };
  try {
    const { items } = await getMyForms();
    group.items = items
      .filter((f) => f.canOpen && (f.status === "Not started" || f.status === "In progress"))
      .map((f) => ({
        id: f.requestId,
        title: f.formName,
        detail: f.aboutName ? `About ${f.aboutName}` : f.status,
        href: `/my-forms/${f.requestId}`,
      }));
  } catch {
    console.error("dashboard: my forms failed to load");
    group.loaded = false;
  }
  return group;
}

async function loadMyPeerFeedback(
  db: Db,
  me: { id: string } | null,
  email: string | null
): Promise<TaskGroup> {
  const group: TaskGroup = {
    id: "myPeerFeedback",
    label: "Feedback you've been asked for",
    // Each request is its own page; there is no list of them to link to.
    href: null,
    items: [],
    loaded: true,
  };
  if (!me && !email) return group;

  // A peer is nominated either from the directory (employee id) or by typing
  // their address (email only), so both are asked for and merged. Explicit
  // filters, not RLS: for P&C roles RLS returns every request in the org.
  const open = () =>
    db
      .from("peer_feedback")
      .select("id, created_at, confirmations(employees(name))")
      .in("response_status", OPEN_FEEDBACK)
      .order("created_at", { ascending: true })
      .limit(TASK_LIMIT);
  const results = await Promise.all([
    me ? open().eq("peer_employee_id", me.id) : null,
    email ? open().ilike("peer_email", email.replace(/[\\%_]/g, "\\$&")) : null,
  ]);

  const failed = results.find((r) => r?.error);
  if (failed?.error) {
    console.error(`dashboard: peer feedback requests failed (${failed.error.code ?? "unknown"})`);
    return { ...group, loaded: false };
  }

  const byId = new Map<string, { id: string; created_at: string; confirmations: unknown }>();
  for (const r of results) for (const row of r?.data ?? []) byId.set(row.id as string, row as never);
  const data = [...byId.values()].sort((a, b) => a.created_at.localeCompare(b.created_at));

  group.items = data.map((row) => {
    const subject = (row.confirmations as { employees?: { name?: string } | null } | null)?.employees?.name;
    return {
      id: row.id as string,
      title: subject ? `Feedback for ${subject}` : "Peer feedback",
      detail: "Probation confirmation",
      href: `/feedback/${row.id}`,
    };
  });
  return group;
}

async function loadTeamDecisions(db: Db, me: { id: string } | null): Promise<TaskGroup> {
  const group: TaskGroup = {
    id: "teamDecisions",
    label: "Decisions for your team",
    href: "/my-team",
    items: [],
    loaded: true,
  };
  if (!me) return group;

  // Scoped to this person's own reportees here, explicitly — not left to RLS
  // to narrow an org-wide query.
  const { data: reportees, error: teamError } = await db
    .from("employees")
    .select("id")
    .eq("manager_id", me.id)
    .eq("status", "active");
  if (teamError) {
    console.error(`dashboard: team lookup failed (${teamError.code ?? "unknown"})`);
    return { ...group, loaded: false };
  }
  const ids = (reportees ?? []).map((r) => r.id as string);
  if (ids.length === 0) return group;

  const { data, error } = await db
    .from("confirmations")
    .select("id, employees(name)")
    .in("employee_id", ids)
    .eq("status", "pending")
    .is("manager_decision", null)
    .order("created_at", { ascending: true })
    .limit(TASK_LIMIT);
  if (error) {
    console.error(`dashboard: team confirmations failed (${error.code ?? "unknown"})`);
    return { ...group, loaded: false };
  }

  group.items = (data ?? []).map((row) => {
    const name = (row.employees as { name?: string } | null)?.name ?? "A team member";
    return {
      id: row.id as string,
      title: `Confirm ${name}`,
      detail: "Probation decision",
      href: `/confirmations/${row.id}/manager-decision`,
    };
  });
  return group;
}

async function loadRoleCustomData(
  db: Db,
  role: UserRole,
  me: { id: string } | null,
  email: string | null,
  today: string,
  options: { hasReports?: boolean } = {}
): Promise<RoleCustomData> {
  const custom: RoleCustomData = {};
  const month = monthWindow(today);

  // If user is employee or manager or has direct reports, load their personal employment profile
  if (role === "employee" || role === "manager" || options.hasReports) {
    if (me) {
      try {
        const { data: emp } = await db
          .from("employees")
          .select("id, name, email, team, status, employee_type, joining_date, confirmation_date, manager:employees!manager_id(id, name, email, team)")
          .eq("id", me.id)
          .maybeSingle();

        if (emp) {
          const mgr = emp.manager as { id?: string; name?: string; email?: string | null; team?: string | null } | null;
          custom.employeeProfile = {
            id: emp.id,
            name: emp.name,
            email: emp.email,
            department: emp.team,
            employeeType: emp.employee_type,
            status: emp.status,
            joiningDate: emp.joining_date,
            confirmationDate: emp.confirmation_date,
            manager: mgr ? {
              id: mgr.id,
              name: mgr.name ?? "Manager",
              email: mgr.email ?? null,
              department: mgr.team ?? null,
            } : null,
          };
        }
      } catch (e) {
        console.error("dashboard: failed to load employee profile", e);
      }
    }
  }

  // If role is manager or user has direct reports, load team members roster
  if (role === "manager" || options.hasReports) {
    if (me) {
      try {
        const { data: reportees } = await db
          .from("employees")
          .select("id, name, email, team, status, employee_type, joining_date, confirmation_date")
          .eq("manager_id", me.id)
          .eq("status", "active")
          .order("name");

        custom.teamMembers = (reportees ?? []).map((r: any) => ({
          id: r.id,
          name: r.name,
          email: r.email,
          department: r.team,
          employeeType: r.employee_type,
          joiningDate: r.joining_date,
          confirmationDate: r.confirmation_date,
          status: r.status,
        }));
      } catch (e) {
        console.error("dashboard: failed to load team members", e);
      }
    }
  }

  // PnC Ops: Operational candidates awaiting document verification and upcoming joiners (NO SALARY/CTC!)
  if (role === "pnc_ops") {
    try {
      const admin = createAdminSupabaseClient();
      if (admin) {
        const [candRes, joinRes] = await Promise.all([
          admin
            .from("onboarding_records")
            .select("id, first_name, last_name, position_title, status, submitted_at, team_name, teams(name)")
            .in("status", AWAITING_REVIEW)
            .or(NOT_WITHDRAWN)
            .order("submitted_at", { ascending: false })
            .limit(6),
          admin
            .from("onboarding_records")
            .select("id, first_name, last_name, position_title, status, joining_date, team_name, teams(name)")
            .in("status", ACCEPTED)
            .or(NOT_WITHDRAWN)
            .gte("joining_date", today)
            .lte("joining_date", addDays(today, 30))
            .order("joining_date", { ascending: true })
            .limit(6),
        ]);

        custom.candidatesToReview = (candRes.data ?? []).map((c: any) => ({
          id: c.id,
          name: [c.first_name, c.last_name].filter(Boolean).join(" ") || "Candidate",
          role: c.position_title || "New Hire",
          department: c.teams?.name || c.team_name || "General",
          submittedAt: c.submitted_at,
          status: c.status,
        }));

        custom.upcomingJoiners = (joinRes.data ?? []).map((j: any) => ({
          id: j.id,
          name: [j.first_name, j.last_name].filter(Boolean).join(" ") || "Candidate",
          role: j.position_title || "New Hire",
          department: j.teams?.name || j.team_name || "General",
          joiningDate: j.joining_date,
          status: j.status,
        }));
      }
    } catch (e) {
      console.error("dashboard: failed to load pnc_ops data", e);
    }
  }

  // PnC Admin: Full HR pipeline (Candidates to review, upcoming joiners, open confirmations in flight)
  if (role === "pnc_admin") {
    try {
      const admin = createAdminSupabaseClient();
      const [candRes, joinRes, confRes] = await Promise.all([
        admin
          ? admin
              .from("onboarding_records")
              .select("id, first_name, last_name, position_title, status, submitted_at, team_name, teams(name)")
              .in("status", AWAITING_REVIEW)
              .or(NOT_WITHDRAWN)
              .order("submitted_at", { ascending: false })
              .limit(5)
          : Promise.resolve({ data: [] }),
        admin
          ? admin
              .from("onboarding_records")
              .select("id, first_name, last_name, position_title, status, joining_date, team_name, teams(name)")
              .in("status", ACCEPTED)
              .or(NOT_WITHDRAWN)
              .gte("joining_date", today)
              .lte("joining_date", addDays(today, 30))
              .order("joining_date", { ascending: true })
              .limit(5)
          : Promise.resolve({ data: [] }),
        db
          .from("confirmations")
          .select("id, status, created_at, employees(name, manager:employees!manager_id(name))")
          .eq("status", "pending")
          .order("created_at", { ascending: false })
          .limit(5),
      ]);

      custom.candidatesToReview = (candRes.data ?? []).map((c: any) => ({
        id: c.id,
        name: [c.first_name, c.last_name].filter(Boolean).join(" ") || "Candidate",
        role: c.position_title || "New Hire",
        department: c.teams?.name || c.team_name || "General",
        submittedAt: c.submitted_at,
        status: c.status,
      }));

      custom.upcomingJoiners = (joinRes.data ?? []).map((j: any) => ({
        id: j.id,
        name: [j.first_name, j.last_name].filter(Boolean).join(" ") || "Candidate",
        role: j.position_title || "New Hire",
        department: j.teams?.name || j.team_name || "General",
        joiningDate: j.joining_date,
        status: j.status,
      }));

      custom.openConfirmationsList = (confRes.data ?? []).map((c: any) => ({
        id: c.id,
        employeeName: c.employees?.name || "Employee",
        managerName: (c.employees?.manager as any)?.name ?? null,
        status: c.status,
        createdAt: c.created_at,
      }));
    } catch (e) {
      console.error("dashboard: failed to load pnc_admin data", e);
    }
  }

  // Finance: movements touching payroll (joiners, exits, settlements)
  if (role === "fin_admin" || role === "fin_ops") {
    try {
      const [joinRes, exitRes, settleRes] = await Promise.all([
        db
          .from("employees")
          .select("id, name, team, joining_date, status")
          .gte("joining_date", month.from)
          .lt("joining_date", month.to)
          .order("joining_date", { ascending: false })
          .limit(6),
        db
          .from("employees")
          .select("id, name, team, exit_date, status")
          .gte("exit_date", month.from)
          .lt("exit_date", month.to)
          .order("exit_date", { ascending: false })
          .limit(6),
        db
          .from("offboarding_cases")
          .select("id, status, last_working_day, employees(name, team)")
          .eq("status", "settlement_pending")
          .order("created_at", { ascending: false })
          .limit(6),
      ]);

      custom.monthJoiners = (joinRes.data ?? []).map((j: any) => ({
        id: j.id,
        name: j.name,
        department: j.team,
        date: j.joining_date,
        status: j.status,
      }));

      custom.monthExits = (exitRes.data ?? []).map((e: any) => ({
        id: e.id,
        name: e.name,
        department: e.team,
        date: e.exit_date,
        status: e.status,
      }));

      custom.pendingSettlements = (settleRes.data ?? []).map((s: any) => ({
        id: s.id,
        employeeName: s.employees?.name || "Employee",
        department: s.employees?.team || null,
        status: s.status,
        lastWorkingDay: s.last_working_day,
      }));
    } catch (e) {
      console.error("dashboard: failed to load finance data", e);
    }
  }

  // Exec View: Department distribution and growth
  if (role === "exec_view") {
    try {
      const [deptRes, joinRes] = await Promise.all([
        db.from("employees").select("team").eq("status", "active"),
        db
          .from("employees")
          .select("id, name, team, joining_date")
          .eq("status", "active")
          .order("joining_date", { ascending: false })
          .limit(5),
      ]);

      const counts: Record<string, number> = {};
      for (const row of deptRes.data ?? []) {
        const team = (row.team as string) || "General";
        counts[team] = (counts[team] ?? 0) + 1;
      }
      custom.departmentBreakdown = Object.entries(counts)
        .map(([department, count]) => ({ department, count }))
        .sort((a, b) => b.count - a.count);

      custom.recentJoiners = (joinRes.data ?? []).map((j: any) => ({
        id: j.id,
        name: j.name,
        department: j.team,
        date: j.joining_date,
      }));
    } catch (e) {
      console.error("dashboard: failed to load exec data", e);
    }
  }

  // Platform Admin & Ops: User role breakdown and settings audit
  if (role === "platform_admin" || role === "platform_ops") {
    try {
      const [auditRes, users] = await Promise.all([
        db
          .from("settings_change_log")
          .select("id, section, changed_at, changed_by")
          .order("changed_at", { ascending: false })
          .limit(6),
        listUsersWithRoles().catch(() => []),
      ]);

      custom.recentSettingsChanges = (auditRes.data ?? []).map((a: any) => ({
        id: a.id,
        section: a.section,
        changedAt: a.changed_at,
        changedBy: a.changed_by,
      }));

      const roleCounts: Record<string, number> = {};
      for (const u of users) {
        const r = u.role || "employee";
        roleCounts[r] = (roleCounts[r] ?? 0) + 1;
      }
      custom.userRoleCounts = Object.entries(roleCounts)
        .map(([r, count]) => ({
          role: r,
          label: roleLabel(r as any),
          count,
        }))
        .sort((a, b) => b.count - a.count);
    } catch (e) {
      console.error("dashboard: failed to load platform data", e);
    }
  }

  // Super Admin: Comprehensive cross-functional snapshot
  if (role === "super_admin") {
    try {
      const admin = createAdminSupabaseClient();
      const [deptRes, candRes, joinRes, users] = await Promise.all([
        db.from("employees").select("team").eq("status", "active"),
        admin
          ? admin
              .from("onboarding_records")
              .select("id, first_name, last_name, position_title, status, submitted_at, team_name, teams(name)")
              .in("status", AWAITING_REVIEW)
              .or(NOT_WITHDRAWN)
              .order("submitted_at", { ascending: false })
              .limit(5)
          : Promise.resolve({ data: [] }),
        admin
          ? admin
              .from("onboarding_records")
              .select("id, first_name, last_name, position_title, status, joining_date, team_name, teams(name)")
              .in("status", ACCEPTED)
              .or(NOT_WITHDRAWN)
              .gte("joining_date", today)
              .lte("joining_date", addDays(today, 30))
              .order("joining_date", { ascending: true })
              .limit(5)
          : Promise.resolve({ data: [] }),
        listUsersWithRoles().catch(() => []),
      ]);

      const counts: Record<string, number> = {};
      for (const row of deptRes.data ?? []) {
        const team = (row.team as string) || "General";
        counts[team] = (counts[team] ?? 0) + 1;
      }
      custom.departmentBreakdown = Object.entries(counts)
        .map(([department, count]) => ({ department, count }))
        .sort((a, b) => b.count - a.count);

      custom.candidatesToReview = (candRes.data ?? []).map((c: any) => ({
        id: c.id,
        name: [c.first_name, c.last_name].filter(Boolean).join(" ") || "Candidate",
        role: c.position_title || "New Hire",
        department: c.teams?.name || c.team_name || "General",
        submittedAt: c.submitted_at,
        status: c.status,
      }));

      custom.upcomingJoiners = (joinRes.data ?? []).map((j: any) => ({
        id: j.id,
        name: [j.first_name, j.last_name].filter(Boolean).join(" ") || "Candidate",
        role: j.position_title || "New Hire",
        department: j.teams?.name || j.team_name || "General",
        joiningDate: j.joining_date,
        status: j.status,
      }));

      const roleCounts: Record<string, number> = {};
      for (const u of users) {
        const r = u.role || "employee";
        roleCounts[r] = (roleCounts[r] ?? 0) + 1;
      }
      custom.userRoleCounts = Object.entries(roleCounts)
        .map(([r, count]) => ({
          role: r,
          label: roleLabel(r as any),
          count,
        }))
        .sort((a, b) => b.count - a.count);
    } catch (e) {
      console.error("dashboard: failed to load super_admin data", e);
    }
  }

  return custom;
}

/**
 * Everything the dashboard shows this person, or null for a role that has no
 * dashboard (the portal-only roles, which middleware never lets this far).
 */
export async function getDashboardData(
  role: UserRole | null,
  options: { hasReports?: boolean } = {}
): Promise<DashboardData | null> {
  const dashboard = dashboardFor(role, options);
  if (!dashboard || !role) return null;

  const db = await createServerSupabaseClient();
  const { employee: me, email } = await getCurrentEmployee(db);
  const today = istToday();

  const taskLoaders: Record<TaskWidgetId, () => Promise<TaskGroup>> = {
    myForms: loadMyForms,
    myPeerFeedback: () => loadMyPeerFeedback(db, me, email),
    teamDecisions: () => loadTeamDecisions(db, me),
  };

  const [tasks, values, roleCustomData] = await Promise.all([
    Promise.all(dashboard.tasks.map((id) => taskLoaders[id]())),
    Promise.all(dashboard.stats.map((id) => loadStat(db, id, me, today))),
    loadRoleCustomData(db, role, me, email, today, options),
  ]);

  return {
    focus: dashboard.focus,
    tasks: tasks.map((t) => ({ ...t, items: t.items.slice(0, TASK_LIMIT) })),
    stats: dashboard.stats.map((id, i) => ({ ...STAT_WIDGETS[id], value: values[i] })),
    roleCustomData,
  };
}
