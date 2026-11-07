// ============================================================================
// Service-role client: only for onboarding_records (closed to sessions at the
// database, so CTC leaves only through the onboarding API's redaction).
// Only on the server, only inside a loader that getDashboardData calls after
// dashboardFor has given the role that panel.
// ============================================================================

import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import type { PanelResult } from "./types";

export const COLUMNS =
  "id, candidate_name, designation, department, status, submitted_at, teams(name)";

export interface DocumentToVerifyRow {
  id: string;
  candidateName: string;
  designation: string;
  department: string | null;
  status: string;
  submittedAt: string | null;
}

const AWAITING_REVIEW = ["submitted", "under_review"];
const NOT_WITHDRAWN = "joiner_status.is.null,joiner_status.neq.withdrawn";

export async function loadDocumentsToVerify(): Promise<PanelResult<DocumentToVerifyRow>> {
  const admin = createAdminSupabaseClient();
  if (!admin) {
    console.error("dashboard: documentsToVerify failed (admin_client_unavailable)");
    return { status: "error" };
  }

  const { data, error } = await admin
    .from("onboarding_records")
    .select(COLUMNS)
    .in("status", AWAITING_REVIEW)
    .or(NOT_WITHDRAWN)
    .order("submitted_at", { ascending: false })
    .limit(6);

  if (error) {
    console.error(`dashboard: documentsToVerify failed (${error.code ?? "unknown"})`);
    return { status: "error" };
  }

  const rows: DocumentToVerifyRow[] = (data ?? []).map((item) => {
    const raw = item as Record<string, unknown>;
    const teamRel = raw.teams as { name?: string } | null;
    return {
      id: String(raw.id),
      candidateName: String(raw.candidate_name ?? "Candidate"),
      designation: String(raw.designation ?? "New hire"),
      department: teamRel?.name ?? (typeof raw.department === "string" ? raw.department : null),
      status: String(raw.status ?? "submitted"),
      submittedAt: typeof raw.submitted_at === "string" ? raw.submitted_at : null,
    };
  });

  return { status: "ok", rows };
}

