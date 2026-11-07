// ============================================================================
// Service-role client: only for onboarding_records (closed to sessions at the
// database, so CTC leaves only through the onboarding API's redaction).
// Only on the server, only inside a loader that getDashboardData calls after
// dashboardFor has given the role that panel.
// ============================================================================

import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { addDays } from "@/lib/dashboard/dates";
import type { PanelLoaderContext, PanelResult } from "./types";

export const COLUMNS =
  "id, candidate_name, designation, department, status, joining_date, teams(name)";

export interface UpcomingJoinerRow {
  id: string;
  candidateName: string;
  designation: string;
  department: string | null;
  status: string;
  joiningDate: string | null;
}

const ACCEPTED = [
  "in_progress",
  "submitted",
  "under_review",
  "changes_requested",
  "approved",
  "account_provisioning",
];
const NOT_WITHDRAWN = "joiner_status.is.null,joiner_status.neq.withdrawn";

export async function loadUpcomingJoiners(
  ctx: PanelLoaderContext
): Promise<PanelResult<UpcomingJoinerRow>> {
  const admin = createAdminSupabaseClient();
  if (!admin) {
    console.error("dashboard: upcomingJoiners failed (admin_client_unavailable)");
    return { status: "error" };
  }

  const { data, error } = await admin
    .from("onboarding_records")
    .select(COLUMNS)
    .in("status", ACCEPTED)
    .or(NOT_WITHDRAWN)
    .gte("joining_date", ctx.today)
    .lte("joining_date", addDays(ctx.today, 30))
    .order("joining_date", { ascending: true })
    .limit(6);

  if (error) {
    console.error(`dashboard: upcomingJoiners failed (${error.code ?? "unknown"})`);
    return { status: "error" };
  }

  const rows: UpcomingJoinerRow[] = (data ?? []).map((item) => {
    const raw = item as Record<string, unknown>;
    const teamRel = raw.teams as { name?: string } | null;
    return {
      id: String(raw.id),
      candidateName: String(raw.candidate_name ?? "Candidate"),
      designation: String(raw.designation ?? "New hire"),
      department: teamRel?.name ?? (typeof raw.department === "string" ? raw.department : null),
      status: String(raw.status ?? "accepted"),
      joiningDate: typeof raw.joining_date === "string" ? raw.joining_date : null,
    };
  });

  return { status: "ok", rows };
}

