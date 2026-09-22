import { getAppraisalReportData } from '@/lib/appraisals/getAppraisalReportData'
import { PageBanner } from '@/components/shared/page-banner'
import { BarChart3, Users, Calendar, TrendingUp, ArrowLeft } from 'lucide-react'
import Link from 'next/link'

export default async function AppraisalReportPage() {
  const { teamBreakdown, totalEligible, cycleSplit } = await getAppraisalReportData()

  const julyPct = totalEligible > 0 ? Math.round((cycleSplit.july / totalEligible) * 100) : 0
  const decemberPct = totalEligible > 0 ? Math.round((cycleSplit.december / totalEligible) * 100) : 0

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 md:p-6 lg:p-8 max-w-7xl mx-auto w-full pb-20 animate-in fade-in duration-300">
      <PageBanner
        title="Appraisal Reporting & Analytics"
        description="Historical and current cycle distribution across teams. Track cycle eligibility and performance distributions."
        icon={<BarChart3 className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />}
        actions={
          <Link
            href="/appraisals"
            className="px-3 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-800 dark:text-zinc-200 rounded-lg text-xs font-semibold shadow-xs flex items-center gap-1.5 transition-colors border border-border"
          >
            <ArrowLeft className="size-3.5" />
            <span>View Cohorts</span>
          </Link>
        }
      />

      {/* 3 Metric Cards matching manage/users */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* 1. Total Eligible */}
        <div className="rounded-lg bg-card border border-border/80 shadow-xs p-4 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Total Eligible</span>
            <div className="p-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400">
              <Users className="h-4 w-4" />
            </div>
          </div>
          <div className="space-y-0.5">
            <div className="text-2xl font-bold tracking-tight text-foreground">{totalEligible}</div>
            <p className="text-xs text-muted-foreground">Across all functional teams</p>
          </div>
        </div>

        {/* 2. July Cycle */}
        <div className="rounded-lg bg-card border border-border/80 shadow-xs p-4 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">July Cycle</span>
            <div className="p-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400">
              <Calendar className="h-4 w-4" />
            </div>
          </div>
          <div className="space-y-0.5">
            <div className="text-2xl font-bold tracking-tight text-foreground">
              {cycleSplit.july} <span className="text-muted-foreground text-sm font-normal">/ {totalEligible}</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-semibold bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300">
                {julyPct}%
              </span>
              <span>mid-year appraisal cohort</span>
            </div>
          </div>
        </div>

        {/* 3. December Cycle */}
        <div className="rounded-lg bg-card border border-border/80 shadow-xs p-4 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">December Cycle</span>
            <div className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400">
              <TrendingUp className="h-4 w-4" />
            </div>
          </div>
          <div className="space-y-0.5">
            <div className="text-2xl font-bold tracking-tight text-foreground">
              {cycleSplit.december} <span className="text-muted-foreground text-sm font-normal">/ {totalEligible}</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-semibold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300">
                {decemberPct}%
              </span>
              <span>year-end appraisal cohort</span>
            </div>
          </div>
        </div>
      </div>

      {/* Team-wise Breakdown Table Card */}
      <div className="rounded-lg bg-card border border-border/80 shadow-xs overflow-hidden flex flex-col mt-1">
        <div className="py-3 px-4 border-b border-border/60">
          <h3 className="text-sm font-bold tracking-tight text-foreground">Team-wise Breakdown</h3>
          <p className="text-xs text-muted-foreground">
            Distribution of eligible employees across review cycles by team
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-muted/30 text-muted-foreground text-xs uppercase font-semibold border-b border-border/60">
              <tr>
                <th className="px-4 py-3">Team</th>
                <th className="px-4 py-3">July Cycle</th>
                <th className="px-4 py-3">December Cycle</th>
                <th className="px-4 py-3 font-semibold text-foreground">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {teamBreakdown.map((t) => (
                <tr key={t.team} className="hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-3 font-semibold text-foreground">{t.team}</td>
                  <td className="px-4 py-3 text-muted-foreground">{t.july}</td>
                  <td className="px-4 py-3 text-muted-foreground">{t.december}</td>
                  <td className="px-4 py-3 font-bold text-foreground">{t.total}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
