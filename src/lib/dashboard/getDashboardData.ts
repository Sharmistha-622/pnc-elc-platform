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
import type { UserRole } from "@/lib/role-constants";
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

export interface DashboardData {
  focus: string;
  tasks: TaskGroup[];
  stats: StatResult[];
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

/**
 * Everything the dashboard shows this person, or null for a role that has no
 * dashboard (the portal-only roles, which middleware never lets this far).
 */
export async function getDashboardData(
  role: UserRole | null,
  options: { hasReports?: boolean } = {}
): Promise<DashboardData | null> {
  const dashboard = dashboardFor(role, options);
  if (!dashboard) return null;

  const db = await createServerSupabaseClient();
  const { employee: me, email } = await getCurrentEmployee(db);
  const today = istToday();

  const taskLoaders: Record<TaskWidgetId, () => Promise<TaskGroup>> = {
    myForms: loadMyForms,
    myPeerFeedback: () => loadMyPeerFeedback(db, me, email),
    teamDecisions: () => loadTeamDecisions(db, me),
  };

  const [tasks, values] = await Promise.all([
    Promise.all(dashboard.tasks.map((id) => taskLoaders[id]())),
    Promise.all(dashboard.stats.map((id) => loadStat(db, id, me, today))),
  ]);

  return {
    focus: dashboard.focus,
    tasks: tasks.map((t) => ({ ...t, items: t.items.slice(0, TASK_LIMIT) })),
    stats: dashboard.stats.map((id, i) => ({ ...STAT_WIDGETS[id], value: values[i] })),
  };
}
