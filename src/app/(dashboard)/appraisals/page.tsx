import React from "react";
import Link from "next/link";
import { getAppraisalCohortView } from "@/lib/appraisals/getAppraisalCohortView";
import { PageBanner } from "@/components/shared/page-banner";
import { TrendingUp, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AppraisalsClient } from "./appraisals-client";

export default async function AppraisalsPage() {
  const entries = await getAppraisalCohortView();

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 md:p-6 lg:p-8 max-w-7xl mx-auto w-full pb-20 animate-in fade-in duration-300">
      {/* Banner matching manage/users */}
      <PageBanner
        title="Appraisal Cohorts"
        description="Bi-annual employee evaluation cohorts categorized by reference eligibility dates and review cycles."
        icon={<TrendingUp className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />}
        actions={
          <Link href="/reports?tab=appraisals">
            <Button
              size="sm"
              className="h-8 rounded-lg text-xs gap-1.5 font-semibold bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs"
            >
              <FileText className="h-3.5 w-3.5" />
              Appraisal Report
            </Button>
          </Link>
        }
      />

      <AppraisalsClient entries={entries} />
    </div>
  );
}