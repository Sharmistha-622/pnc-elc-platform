import { getAppraisalCohortView } from "@/lib/appraisals/getAppraisalCohortView";
import { PageBanner } from "@/components/shared/page-banner";
import { TrendingUp, Award, Calendar, FileText } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";

export default async function AppraisalsPage() {
  const entries = await getAppraisalCohortView();

  const julyCohort = entries.filter((e) => e.cohort === "july");
  const decemberCohort = entries.filter((e) => e.cohort === "december");

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 md:p-6 lg:p-8 max-w-7xl mx-auto w-full pb-20 animate-in fade-in duration-300">
      {/* Banner */}
      <PageBanner
        title="Appraisal Cohorts"
        description="Bi-annual employee evaluation cohorts categorized by reference eligibility dates and review cycles."
        icon={<TrendingUp className="h-8 w-8 text-teal-500" />}
        actions={
          <Link
            href="/appraisals/report"
            className="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-xs flex items-center gap-1.5"
          >
            <FileText className="size-3.5" />
            <span>Appraisal Report</span>
          </Link>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* July Cycle */}
        <div className="rounded-lg border border-border bg-card/60 backdrop-blur-md shadow-xs p-5 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-border">
            <div className="flex items-center gap-2">
              <Calendar className="size-4 text-indigo-500" />
              <h2 className="text-base font-bold text-foreground">July Cycle</h2>
            </div>
            <Badge variant="secondary" className="rounded-lg text-xs font-semibold px-2 py-0.5">
              {julyCohort.length} Employees
            </Badge>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-muted/40 border-b border-border text-xs text-muted-foreground uppercase font-semibold">
                <tr>
                  <th className="py-2.5 px-3">Name</th>
                  <th className="py-2.5 px-3">Type</th>
                  <th className="py-2.5 px-3 text-right">Reference Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {julyCohort.map((e) => (
                  <tr key={e.employeeId} className="hover:bg-muted/20">
                    <td className="py-2.5 px-3 font-semibold text-foreground">{e.name}</td>
                    <td className="py-2.5 px-3">
                      <Badge variant="outline" className="rounded-lg text-[11px]">
                        {e.employeeType}
                      </Badge>
                    </td>
                    <td className="py-2.5 px-3 text-right text-muted-foreground text-xs">
                      {e.referenceDate}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* December Cycle */}
        <div className="rounded-lg border border-border bg-card/60 backdrop-blur-md shadow-xs p-5 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-border">
            <div className="flex items-center gap-2">
              <Calendar className="size-4 text-emerald-500" />
              <h2 className="text-base font-bold text-foreground">December Cycle</h2>
            </div>
            <Badge variant="secondary" className="rounded-lg text-xs font-semibold px-2 py-0.5">
              {decemberCohort.length} Employees
            </Badge>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-muted/40 border-b border-border text-xs text-muted-foreground uppercase font-semibold">
                <tr>
                  <th className="py-2.5 px-3">Name</th>
                  <th className="py-2.5 px-3">Type</th>
                  <th className="py-2.5 px-3 text-right">Reference Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {decemberCohort.map((e) => (
                  <tr key={e.employeeId} className="hover:bg-muted/20">
                    <td className="py-2.5 px-3 font-semibold text-foreground">{e.name}</td>
                    <td className="py-2.5 px-3">
                      <Badge variant="outline" className="rounded-lg text-[11px]">
                        {e.employeeType}
                      </Badge>
                    </td>
                    <td className="py-2.5 px-3 text-right text-muted-foreground text-xs">
                      {e.referenceDate}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}