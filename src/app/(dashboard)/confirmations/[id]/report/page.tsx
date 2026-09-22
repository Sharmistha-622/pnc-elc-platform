import { getCompiledFeedback } from '@/lib/confirmations/getCompiledFeedback'
import { ApproveButton } from './ApproveButton'
import { PageBanner } from '@/components/shared/page-banner'
import { FileText, AlertTriangle, Users, CheckCircle2, Clock } from 'lucide-react'

export default async function CompiledReportPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const report = await getCompiledFeedback(id)

  if (!report) {
    return (
      <div className="flex flex-1 flex-col gap-6 p-4 md:p-6 lg:p-8 max-w-7xl mx-auto w-full pb-20">
        <PageBanner
          title="Report Not Found"
          description="The requested confirmation feedback report could not be found."
          icon={<FileText className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />}
        />
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 md:p-6 lg:p-8 max-w-7xl mx-auto w-full pb-20 animate-in fade-in duration-300">
      <PageBanner
        title={`Compiled Feedback — ${report.employeeName}`}
        description={`Confirmation assessment and peer review report for ${report.employeeName} (${report.employeeType}).`}
        icon={<FileText className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />}
      />

      {report.redFlag && (
        <div className="bg-destructive/10 border border-destructive/30 text-destructive rounded-lg p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <div>
            <strong className="font-semibold">Red Flag Flagged:</strong> {report.redFlagReason}
          </div>
        </div>
      )}

      {/* 3 Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="rounded-lg bg-card border border-border/80 shadow-xs p-4 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Nominated</span>
            <div className="p-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400">
              <Users className="h-4 w-4" />
            </div>
          </div>
          <div className="space-y-0.5">
            <div className="text-2xl font-bold tracking-tight text-foreground">{report.totalNominated}</div>
            <p className="text-xs text-muted-foreground">Reviewers invited</p>
          </div>
        </div>

        <div className="rounded-lg bg-card border border-border/80 shadow-xs p-4 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Submitted</span>
            <div className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="h-4 w-4" />
            </div>
          </div>
          <div className="space-y-0.5">
            <div className="text-2xl font-bold tracking-tight text-foreground">{report.totalSubmitted}</div>
            <p className="text-xs text-muted-foreground">Completed responses</p>
          </div>
        </div>

        <div className="rounded-lg bg-card border border-border/80 shadow-xs p-4 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Pending</span>
            <div className="p-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400">
              <Clock className="h-4 w-4" />
            </div>
          </div>
          <div className="space-y-0.5">
            <div className="text-2xl font-bold tracking-tight text-foreground">{report.totalPending}</div>
            <p className="text-xs text-muted-foreground">Awaiting feedback</p>
          </div>
        </div>
      </div>

      <div className="rounded-lg bg-card border border-border/80 shadow-xs overflow-hidden flex flex-col">
        <div className="py-3 px-4 border-b border-border/60">
          <h3 className="text-sm font-bold tracking-tight text-foreground">Peer Responses</h3>
        </div>
        <div className="p-4 space-y-3">
          {report.feedbackEntries.map((entry) => (
            <div key={entry.id} className="rounded-lg border border-border/60 p-4 bg-muted/10 space-y-2">
              <div className="flex justify-between items-center">
                <span className="font-semibold text-sm text-foreground">{entry.peerName}</span>
                <span
                  className={`text-xs px-2.5 py-0.5 font-semibold rounded-lg capitalize ${
                    entry.responseStatus === 'submitted'
                      ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                      : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                  }`}
                >
                  {entry.responseStatus}
                </span>
              </div>
              {entry.feedbackText && (
                <p className="text-muted-foreground text-sm leading-relaxed bg-background p-3 rounded-lg border border-border/50">
                  {entry.feedbackText}
                </p>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="pt-1">
        <ApproveButton confirmationId={report.confirmationId} employeeId={report.employeeId} />
      </div>
    </div>
  )
}