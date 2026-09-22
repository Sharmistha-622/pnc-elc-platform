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
      <div className="space-y-6">
        <PageBanner
          badge="Error"
          title="Report Not Found"
          description="The requested confirmation feedback report could not be found."
          icon={FileText}
        />
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <PageBanner
        badge="Evaluation Report"
        title={`Compiled Feedback — ${report.employeeName}`}
        description={`Confirmation assessment and peer review report for ${report.employeeName} (${report.employeeType}).`}
        icon={FileText}
      />

      {report.redFlag && (
        <div className="bg-destructive/10 border border-destructive/30 text-destructive rounded-lg p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <div>
            <strong className="font-semibold">Red Flag Flagged:</strong> {report.redFlagReason}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-card border border-border rounded-lg p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-muted-foreground">Nominated</p>
            <div className="p-2 bg-indigo-500/10 text-indigo-600 rounded-lg">
              <Users className="w-5 h-5" />
            </div>
          </div>
          <p className="text-3xl font-bold mt-2 text-foreground">{report.totalNominated}</p>
          <p className="text-xs text-muted-foreground mt-1">Reviewers invited</p>
        </div>

        <div className="bg-card border border-border rounded-lg p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-muted-foreground">Submitted</p>
            <div className="p-2 bg-emerald-500/10 text-emerald-600 rounded-lg">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>
          <p className="text-3xl font-bold mt-2 text-foreground">{report.totalSubmitted}</p>
          <p className="text-xs text-muted-foreground mt-1">Completed responses</p>
        </div>

        <div className="bg-card border border-border rounded-lg p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-muted-foreground">Pending</p>
            <div className="p-2 bg-amber-500/10 text-amber-600 rounded-lg">
              <Clock className="w-5 h-5" />
            </div>
          </div>
          <p className="text-3xl font-bold mt-2 text-foreground">{report.totalPending}</p>
          <p className="text-xs text-muted-foreground mt-1">Awaiting feedback</p>
        </div>
      </div>

      <div className="space-y-3">
        <h2 className="text-base font-semibold text-foreground">Peer Responses</h2>
        <div className="space-y-3">
          {report.feedbackEntries.map((entry) => (
            <div key={entry.id} className="bg-card border border-border rounded-lg p-4 shadow-sm space-y-2">
              <div className="flex justify-between items-center">
                <span className="font-semibold text-sm text-foreground">{entry.peerName}</span>
                <span
                  className={`text-xs px-2.5 py-0.5 font-medium rounded-lg capitalize ${
                    entry.responseStatus === 'submitted'
                      ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                      : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                  }`}
                >
                  {entry.responseStatus}
                </span>
              </div>
              {entry.feedbackText && (
                <p className="text-muted-foreground text-sm leading-relaxed bg-muted/30 p-3 rounded-lg border border-border/50">
                  {entry.feedbackText}
                </p>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="pt-2">
        <ApproveButton confirmationId={report.confirmationId} employeeId={report.employeeId} />
      </div>
    </div>
  )
}