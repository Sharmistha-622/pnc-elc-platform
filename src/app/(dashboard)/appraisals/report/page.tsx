import { getAppraisalReportData } from '@/lib/appraisals/getAppraisalReportData'
import { PageBanner } from '@/components/shared/page-banner'
import { BarChart3, Users, Calendar, TrendingUp } from 'lucide-react'

export default async function AppraisalReportPage() {
  const { teamBreakdown, totalEligible, cycleSplit } = await getAppraisalReportData()

  return (
    <div className="space-y-6">
      <PageBanner
        badge="Analytics & Reports"
        title="Appraisal Reporting & Analytics"
        description="Historical and current cycle distribution across teams. Track cycle eligibility and performance distributions."
        icon={BarChart3}
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-card border border-border rounded-lg p-5 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-muted-foreground">Total Eligible</p>
            <div className="p-2 bg-indigo-500/10 text-indigo-600 rounded-lg">
              <Users className="w-5 h-5" />
            </div>
          </div>
          <p className="text-3xl font-bold mt-2 text-foreground">{totalEligible}</p>
          <p className="text-xs text-muted-foreground mt-1">Across all departments</p>
        </div>

        <div className="bg-card border border-border rounded-lg p-5 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-muted-foreground">July Cycle</p>
            <div className="p-2 bg-amber-500/10 text-amber-600 rounded-lg">
              <Calendar className="w-5 h-5" />
            </div>
          </div>
          <p className="text-3xl font-bold mt-2 text-foreground">{cycleSplit.july}</p>
          <p className="text-xs text-muted-foreground mt-1">Mid-year appraisal cohort</p>
        </div>

        <div className="bg-card border border-border rounded-lg p-5 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-muted-foreground">December Cycle</p>
            <div className="p-2 bg-emerald-500/10 text-emerald-600 rounded-lg">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
          <p className="text-3xl font-bold mt-2 text-foreground">{cycleSplit.december}</p>
          <p className="text-xs text-muted-foreground mt-1">Year-end appraisal cohort</p>
        </div>
      </div>

      <div className="bg-card border border-border rounded-lg overflow-hidden shadow-sm">
        <div className="p-4 border-b border-border bg-muted/30">
          <h2 className="text-base font-semibold text-foreground">Team-wise Breakdown</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-muted/50 text-muted-foreground text-xs uppercase font-semibold border-b border-border">
              <tr>
                <th className="px-5 py-3">Team</th>
                <th className="px-5 py-3">July Cycle</th>
                <th className="px-5 py-3">December Cycle</th>
                <th className="px-5 py-3">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {teamBreakdown.map((t) => (
                <tr key={t.team} className="hover:bg-muted/40 transition-colors">
                  <td className="px-5 py-3.5 font-medium text-foreground">{t.team}</td>
                  <td className="px-5 py-3.5 text-muted-foreground">{t.july}</td>
                  <td className="px-5 py-3.5 text-muted-foreground">{t.december}</td>
                  <td className="px-5 py-3.5 font-semibold text-foreground">{t.total}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
