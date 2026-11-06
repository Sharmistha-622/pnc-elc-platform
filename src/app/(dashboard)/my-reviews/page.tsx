import Link from 'next/link'
import { redirect } from 'next/navigation'
import {
  ClipboardCheck,
  Calendar,
  Clock,
  ChevronRight,
  UserCheck,
  Users,
  CheckCircle2,
  Sparkles,
  AlertCircle,
  FileText,
} from 'lucide-react'
import { PageBanner } from '@/components/shared/page-banner'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { StageBadge } from '@/components/reviews/stage-badge'
import { getMyReviews, type CycleSummary } from '@/lib/reviews/queries'
import { KIND_LABELS } from '@/lib/reviews/types'

function fmt(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'Asia/Kolkata',
  })
}

function nextStepInfo(c: CycleSummary, mine: boolean): { text: string; urgent: boolean } {
  switch (c.stage) {
    case 'self_review':
      return mine
        ? { text: 'Nominate peers & submit your self-reflection', urgent: true }
        : { text: 'Waiting for employee self-reflection', urgent: false }
    case 'in_review':
      if (mine) {
        return { text: 'Peers and manager are submitting feedback', urgent: false }
      }
      return c.counts.managerDone
        ? { text: 'Peers are responding', urgent: false }
        : { text: 'Your manager review is due', urgent: true }
    case 'ready_for_meeting':
      return { text: 'Feedback complete — 1-on-1 meeting ready to schedule', urgent: true }
    case 'meeting_scheduled':
      return mine
        ? { text: '1-on-1 meeting scheduled', urgent: false }
        : { text: 'Meeting scheduled — record final decision afterward', urgent: true }
    case 'decision_recorded':
      return { text: 'Decision recorded — under final PnC review', urgent: false }
    case 'closed':
      return { text: 'Review cycle completed', urgent: false }
    default:
      return { text: 'In progress', urgent: false }
  }
}

function ReviewCard({ cycle, mine }: { cycle: CycleSummary; mine: boolean }) {
  const step = nextStepInfo(cycle, mine)
  const peerPercentage =
    cycle.counts.peersAsked > 0
      ? Math.round((cycle.counts.peersDone / cycle.counts.peersAsked) * 100)
      : 0

  return (
    <Card className="hover:border-indigo-300 dark:hover:border-indigo-700/60 transition-all duration-200 hover:shadow-md group">
      <CardContent className="p-5 sm:p-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          {/* Main Info */}
          <div className="space-y-3 min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <Badge
                variant="outline"
                className="bg-indigo-50/80 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800 text-xs font-semibold px-2.5 py-0.5"
              >
                {KIND_LABELS[cycle.kind]}
              </Badge>
              <StageBadge stage={cycle.stage} />
              <span className="text-xs text-muted-foreground font-medium flex items-center gap-1">
                <Calendar className="size-3.5" />
                {cycle.periodLabel}
              </span>
            </div>

            <div>
              <h3 className="text-lg font-bold text-foreground group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                {mine ? 'My Performance Review' : cycle.employeeName}
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                {mine ? `Cycle ID: ${cycle.id.slice(0, 8)}` : `Reviewee: ${cycle.employeeName}`}
              </p>
            </div>

            {/* Next Step Callout */}
            <div
              className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium ${
                step.urgent
                  ? 'bg-amber-50 text-amber-900 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-200 dark:border-amber-800/60'
                  : 'bg-muted/60 text-muted-foreground border border-border/50'
              }`}
            >
              <Clock className="size-3.5 shrink-0" />
              <span>{step.text}</span>
            </div>
          </div>

          {/* Progress Metrics & Action */}
          <div className="flex flex-col sm:flex-row lg:flex-col items-start sm:items-center lg:items-end justify-between gap-4 border-t lg:border-t-0 pt-4 lg:pt-0 border-border/50 shrink-0">
            {/* Progress Bars */}
            <div className="space-y-2 w-full sm:w-48 lg:w-44 text-xs">
              <div className="space-y-1">
                <div className="flex justify-between text-muted-foreground text-[11px]">
                  <span className="flex items-center gap-1 font-medium">
                    <Users className="size-3" /> Peer Reviews
                  </span>
                  <span className="font-semibold tabular-nums text-foreground">
                    {cycle.counts.peersDone} / {cycle.counts.peersAsked}
                  </span>
                </div>
                <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-indigo-600 rounded-full transition-all duration-300"
                    style={{ width: `${peerPercentage}%` }}
                  />
                </div>
              </div>

              {!mine && (
                <div className="flex items-center justify-between text-[11px] pt-1 text-muted-foreground">
                  <span className="flex items-center gap-1 font-medium">
                    <UserCheck className="size-3" /> Manager Review
                  </span>
                  <span
                    className={`font-semibold px-1.5 py-0.2 rounded text-[10px] ${
                      cycle.counts.managerDone
                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                        : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                    }`}
                  >
                    {cycle.counts.managerDone ? 'Submitted' : 'Pending'}
                  </span>
                </div>
              )}

              {cycle.dueDate && (
                <p className="text-[11px] text-muted-foreground text-left lg:text-right pt-0.5">
                  Due: <span className="font-medium text-foreground">{fmt(cycle.dueDate)}</span>
                </p>
              )}
            </div>

            {/* CTA */}
            <Link href={`/my-reviews/${cycle.id}`} className="w-full sm:w-auto">
              <Button
                size="sm"
                className="w-full sm:w-auto gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs rounded-lg text-xs"
              >
                <span>Open Review</span>
                <ChevronRight className="size-3.5 group-hover:translate-x-0.5 transition-transform" />
              </Button>
            </Link>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export default async function MyReviewsPage() {
  const data = await getMyReviews()
  if (!data) redirect('/')

  const activePersonal = data.mine.filter((c) => c.stage !== 'closed' && c.stage !== 'cancelled')
  const activeTeam = data.team.filter((c) => c.stage !== 'closed' && c.stage !== 'cancelled')

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 md:p-6 lg:p-8 max-w-7xl mx-auto w-full pb-20 animate-in fade-in duration-300">
      {/* Banner */}
      <PageBanner
        title="Performance & Confirmation Reviews"
        description="Track your self-evaluations, 360° peer nominations, and appraisals for team members you manage."
        icon={<ClipboardCheck className="h-8 w-8 text-indigo-600 dark:text-indigo-400" />}
      />

      {/* Unlinked Alert */}
      {!data.linked && (
        <div className="flex items-center gap-3 rounded-xl border border-amber-300/60 bg-amber-50/70 dark:bg-amber-950/30 p-4 text-amber-900 dark:text-amber-200">
          <AlertCircle className="size-5 shrink-0 text-amber-600" />
          <p className="text-sm">
            Your login is not currently linked to an active employee profile, so personalized review
            workflows cannot be populated.
          </p>
        </div>
      )}

      {/* Overview Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-border/60">
          <CardContent className="p-4 sm:p-5 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
                My Reviews
              </p>
              <p className="text-2xl font-bold text-foreground mt-1">{data.mine.length}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {activePersonal.length} currently active
              </p>
            </div>
            <div className="size-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <ClipboardCheck className="size-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/60">
          <CardContent className="p-4 sm:p-5 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
                Team Reviews
              </p>
              <p className="text-2xl font-bold text-foreground mt-1">{data.team.length}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {activeTeam.length} need attention
              </p>
            </div>
            <div className="size-10 rounded-xl bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 flex items-center justify-center">
              <Users className="size-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/60">
          <CardContent className="p-4 sm:p-5 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
                Peer Feedback Given
              </p>
              <p className="text-2xl font-bold text-foreground mt-1">My Forms</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                <Link href="/my-forms" className="text-indigo-600 hover:underline">
                  Go to feedback forms →
                </Link>
              </p>
            </div>
            <div className="size-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <CheckCircle2 className="size-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/60">
          <CardContent className="p-4 sm:p-5 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
                Cycle System
              </p>
              <p className="text-sm font-bold text-foreground mt-1">Automated 360°</p>
              <p className="text-xs text-muted-foreground mt-0.5">Continuous evaluation</p>
            </div>
            <div className="size-10 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <Sparkles className="size-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Section 1: My Reviews */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-1 border-b border-border/60">
          <div>
            <h2 className="text-base font-bold text-foreground">My Personal Reviews</h2>
            <p className="text-xs text-muted-foreground">
              Your self-reflections, nominated reviewers, and evaluation results.
            </p>
          </div>
          <Badge variant="outline" className="text-xs w-fit">
            {data.mine.length} cycles total
          </Badge>
        </div>

        {data.mine.length === 0 ? (
          <Card className="border-dashed bg-card/50">
            <CardContent className="p-8 text-center space-y-2">
              <div className="size-10 rounded-full bg-muted mx-auto flex items-center justify-center text-muted-foreground">
                <FileText className="size-5" />
              </div>
              <p className="text-sm font-semibold text-foreground">No personal reviews active</p>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                When a confirmation or appraisal cycle begins for you, it will appear here with instructions.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-3">
            {data.mine.map((cycle) => (
              <ReviewCard key={cycle.id} cycle={cycle} mine />
            ))}
          </div>
        )}
      </div>

      {/* Section 2: Team's Reviews (If any) */}
      {data.team.length > 0 && (
        <div className="space-y-4 pt-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-1 border-b border-border/60">
            <div>
              <h2 className="text-base font-bold text-foreground">Direct Reports' Reviews</h2>
              <p className="text-xs text-muted-foreground">
                Reviews for team members reporting to you. Provide manager feedback and finalize outcomes.
              </p>
            </div>
            <Badge variant="outline" className="text-xs w-fit">
              {data.team.length} reportees
            </Badge>
          </div>

          <div className="grid grid-cols-1 gap-3">
            {data.team.map((cycle) => (
              <ReviewCard key={cycle.id} cycle={cycle} mine={false} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
