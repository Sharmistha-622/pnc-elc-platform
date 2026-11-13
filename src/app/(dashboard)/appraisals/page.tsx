import React from "react";
import Link from "next/link";
import { getAppraisalCohortView } from "@/lib/appraisals/getAppraisalCohortView";
import {
  buildAppraisalFooterCards,
  deriveAppraisalCycleStatus,
} from "@/lib/appraisals/cycleSummary";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { loadSettings } from "@/lib/reviews/service";
import type { CycleRow } from "@/lib/reviews/types";
import { DEFAULT_APPRAISAL_CYCLES, type AppraisalCycle } from "@/lib/settings/types";
import { PageBanner } from "@/components/shared/page-banner";
import { TrendingUp, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AppraisalsClient } from "./appraisals-client";
import { getCurrentUserRole } from "@/lib/rbac/getCurrentUserRole";
import { canAccessRoute } from "@/lib/role-constants";

export default async function AppraisalsPage() {
  const supabase = await createServerSupabaseClient();
  const [
    entries,
    { role },
    reviewSettings,
    { data: appraisalCyclesData },
    { data: reviewCyclesData },
  ] = await Promise.all([
    getAppraisalCohortView(),
    getCurrentUserRole(),
    loadSettings(supabase),
    supabase.from("appraisal_cycles").select("*").order("cycle_month"),
    supabase.from("review_cycles").select("stage").eq("kind", "appraisal"),
  ]);

  const appraisalCycles =
    appraisalCyclesData && appraisalCyclesData.length > 0
      ? (appraisalCyclesData as AppraisalCycle[])
      : DEFAULT_APPRAISAL_CYCLES;
  const reviewCycles = (reviewCyclesData ?? []) as Pick<CycleRow, "stage">[];

  const cycleStatus = deriveAppraisalCycleStatus({
    reviewCycles,
    appraisalCycles,
  });
  const footerCards = buildAppraisalFooterCards(appraisalCycles, reviewSettings);

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 md:p-6 lg:p-8 max-w-7xl mx-auto w-full pb-20 animate-in fade-in duration-300">
      {/* Banner matching manage/users */}
      <PageBanner
        title="Appraisal Cohorts"
        description="Bi-annual employee evaluation cohorts categorized by reference eligibility dates and review cycles."
        icon={<TrendingUp className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />}
        // The report lives in /reports, which a manager reaches /appraisals
        // without being able to open.
        actions={
          canAccessRoute(role, "/reports") && (
            <Link href="/reports?tab=appraisals">
              <Button
                size="sm"
                className="h-8 rounded-lg text-xs gap-1.5 font-semibold bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs"
              >
                <FileText className="h-3.5 w-3.5" />
                Appraisal Report
              </Button>
            </Link>
          )
        }
      />

      <AppraisalsClient
        entries={entries}
        cycleStatus={cycleStatus}
        footerCards={footerCards}
      />
    </div>
  );
}
