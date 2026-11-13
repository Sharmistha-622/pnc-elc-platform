import Link from 'next/link'
import {
  CalendarClock,
  CheckCircle2,
  CircleDashed,
  Clock,
  FileText,
  Lock,
  MailWarning,
  UserRound,
  ArrowLeft,
  Calendar,
  Sparkles,
  Users,
  ShieldCheck,
  History,
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { MIN_PEERS_FOR_ANONYMITY, type CycleDetail } from '@/lib/reviews/queries'
import { PeerReveal } from './peer-reveal'
import { PeerRatingSummary } from './peer-rating-summary'
import { KIND_LABELS, ROLE_LABELS, STAGE_LABELS, decisionLabel, type ReviewStage } from '@/lib/reviews/types'
import { StageBadge } from './stage-badge'
import { SmartReviewAnswerView } from '@/components/shared/field-answer-view'
import {
  CancelReviewButton,
  CloseForm,
  DecisionForm,
  MeetingForm,
  NominationPanel,
  RemindAllButton,
  RemindButton,
  WithdrawButton,
} from './review-controls'

const STEPS: ReviewStage[] = [
  'self_review',
  'in_review',
  'ready_for_meeting',
  'meeting_scheduled',
  'decision_recorded',
  'closed',
]

function fmt(iso: string | null, withTime = false): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return withTime
    ? d.toLocaleString('en-IN', {
        day: 'numeric',
        month: 'short',
        hour: 'numeric',
        minute: '2-digit',
        timeZone: 'Asia/Kolkata',
      }) + ' IST'
    : d.toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        timeZone: 'Asia/Kolkata',
      })
}

const EVENT_LABELS: Record<string, string> = {
  opened: 'Review cycle opened',
  invited: 'Form invitation sent',
  submitted: 'Feedback form submitted',
  nominated: 'Peer nominations confirmed',
  reminded: 'Reminder email sent',
  escalated: 'Escalated to People & Culture',
  ready: 'All reviews in — ready for 1-on-1 meeting',
  meeting_scheduled: 'Review meeting booked',
  decision_recorded: 'Manager decision recorded',
  returned: 'PnC requested decision revision',
  closed: 'Review cycle concluded',
  cancelled: 'Cycle cancelled',
  withdrawn: 'Reviewer withdrawn',
}

function Stepper({ stage }: { stage: ReviewStage }) {
  if (stage === 'cancelled') return null
  const at = stage === 'closed' ? STEPS.length : STEPS.indexOf(stage)

  return (
    <div className="rounded-xl border border-border/70 bg-card p-4 shadow-2xs">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
        {STEPS.map((s, i) => {
          const isDone = i < at
          const isCurrent = i === at
          return (
            <div
              key={s}
              className={`flex items-center gap-2 p-2 rounded-lg text-xs transition-colors ${
                isCurrent
                  ? 'bg-indigo-50/80 text-indigo-900 border border-indigo-200 dark:bg-indigo-950/50 dark:text-indigo-200 dark:border-indigo-800'
                  : isDone
                  ? 'text-emerald-700 dark:text-emerald-400 font-medium'
                  : 'text-muted-foreground/70'
              }`}
            >
              <div className="shrink-0">
                {isDone ? (
                  <CheckCircle2 className="size-4 text-emerald-600 dark:text-emerald-400" />
                ) : isCurrent ? (
                  <CircleDashed className="size-4 text-indigo-600 dark:text-indigo-400 animate-spin" />
                ) : (
                  <div className="size-4 rounded-full border border-muted-foreground/30 flex items-center justify-center text-[10px]">
                    {i + 1}
                  </div>
                )}
              </div>
              <span className={`truncate text-xs ${isCurrent ? 'font-bold' : ''}`}>
                {STAGE_LABELS[s]}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function StatusCell({
  status,
  submittedAt,
  escalated,
}: {
  status: string
  submittedAt: string | null
  escalated: boolean
}) {
  if (status === 'submitted') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/60">
        <CheckCircle2 className="size-3.5" />
        Submitted {fmt(submittedAt)}
      </span>
    )
  }
  if (status === 'nominated') {
    return (
      <span className="text-xs text-muted-foreground italic">
        Nominated — form dispatched with self-reflection
      </span>
    )
  }
  if (status === 'cancelled') {
    return <span className="text-xs text-muted-foreground line-through">Withdrawn</span>
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-semibold bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200/60 dark:border-amber-800/60">
      <Clock className="size-3.5" />
      Awaiting submission
      {escalated && (
        <span className="ml-1 inline-flex items-center gap-0.5 text-rose-600 dark:text-rose-400 font-bold">
          <MailWarning className="size-3" /> PnC notified
        </span>
      )}
    </span>
  )
}

export function CycleDetailView({
  detail,
  backHref,
  backLabel,
}: {
  detail: CycleDetail
  backHref: string
  backLabel: string
}) {
  const { rel } = detail
  const selfP = detail.participants.find((p) => p.role === 'self')
  const peers = detail.participants.filter((p) => p.role === 'peer')
  const peerCount = detail.reviews?.peerCount ?? 0
  const open = ['self_review', 'in_review', 'ready_for_meeting', 'meeting_scheduled'].includes(
    detail.stage
  )
  const canSchedule =
    ((rel.operator || rel.isManager) &&
      ['in_review', 'ready_for_meeting', 'meeting_scheduled', 'decision_recorded'].includes(
        detail.stage
      )) ||
    (rel.isSubject && detail.stage === 'meeting_scheduled')
  const canDecide =
    (rel.isManager || rel.closer) &&
    ['ready_for_meeting', 'meeting_scheduled', 'decision_recorded'].includes(detail.stage) &&
    detail.decision?.pnc_outcome !== 'accepted'
  const managerFormOutstanding =
    rel.isManager && detail.managerRequestId && !detail.counts.managerDone
  const hasPending = detail.participants.some((p) => p.status === 'invited')

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 md:p-6 lg:p-8 max-w-7xl mx-auto w-full pb-20 animate-in fade-in duration-300">
      {/* Back Navigation Link */}
      <div>
        <Link
          href={backHref}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
        >
          <ArrowLeft className="size-3.5" />
          <span>Back to {backLabel}</span>
        </Link>
      </div>

      {/* Header Card */}
      <Card className="border-border/70 shadow-xs">
        <CardContent className="p-6">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge
                  variant="outline"
                  className="bg-indigo-50/80 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800 text-xs font-bold px-2.5 py-0.5"
                >
                  {KIND_LABELS[detail.kind]} Review
                </Badge>
                <StageBadge stage={detail.stage} className="text-xs" />
                {detail.periodLabel && (
                  <Badge variant="secondary" className="text-xs font-normal">
                    {detail.periodLabel}
                  </Badge>
                )}
              </div>

              <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight">
                  {rel.isSubject ? 'Your Performance Review' : detail.employeeName}
                </h1>
                <div className="flex flex-wrap items-center gap-y-1 gap-x-4 text-xs text-muted-foreground mt-1.5">
                  {detail.managerName && (
                    <span className="flex items-center gap-1">
                      <UserRound className="size-3.5" />
                      Reporting Manager: <strong className="text-foreground">{detail.managerName}</strong>
                    </span>
                  )}
                  {detail.dueDate && (
                    <span className="flex items-center gap-1">
                      <Calendar className="size-3.5" />
                      Target Due Date: <strong className="text-foreground">{fmt(detail.dueDate)}</strong>
                    </span>
                  )}
                  <span className="flex items-center gap-1">
                    <Clock className="size-3.5" />
                    Initiated: {fmt(detail.createdAt)}
                  </span>
                </div>
              </div>
            </div>

            {/* Quick Response Tracker Summary */}
            <div className="flex flex-wrap items-center gap-3 bg-muted/40 p-4 rounded-xl border border-border/60 shrink-0">
              <div className="text-center px-3 border-r border-border/60 last:border-0">
                <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">
                  Self Review
                </p>
                <p
                  className={`text-sm font-bold mt-0.5 ${
                    detail.counts.selfDone ? 'text-emerald-600' : 'text-amber-600'
                  }`}
                >
                  {detail.counts.selfDone ? 'Completed' : 'Pending'}
                </p>
              </div>

              <div className="text-center px-3 border-r border-border/60 last:border-0">
                <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">
                  Peer Feedback
                </p>
                <p className="text-sm font-bold mt-0.5 text-foreground">
                  {detail.counts.peersDone} / {detail.counts.peersAsked}
                </p>
              </div>

              <div className="text-center px-3">
                <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">
                  Manager Input
                </p>
                <p
                  className={`text-sm font-bold mt-0.5 ${
                    detail.counts.managerDone ? 'text-emerald-600' : 'text-amber-600'
                  }`}
                >
                  {detail.counts.managerDone ? 'Submitted' : 'Pending'}
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stepper Process Flow */}
      <Stepper stage={detail.stage} />

      {/* Employee Action: Peer Nominations & Self-Reflection */}
      {rel.isSubject && detail.stage === 'self_review' && (
        <Card className="border-indigo-300 dark:border-indigo-800 shadow-xs">
          <CardHeader className="pb-3 bg-indigo-50/40 dark:bg-indigo-950/20 rounded-t-xl border-b border-indigo-100 dark:border-indigo-900/50">
            <CardTitle className="text-base text-indigo-950 dark:text-indigo-200 flex items-center gap-2">
              <Sparkles className="size-4 text-indigo-600 dark:text-indigo-400" />
              <span>Step 1: Nominate Colleagues and Complete Self-Reflection</span>
            </CardTitle>
            <CardDescription className="text-xs">
              Save your peer nominations first. Once you submit your self-reflection form, automated
              invitations will be sent to your nominated reviewers.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6 pt-5">
            {detail.nominees && (
              <NominationPanel
                cycleId={detail.id}
                people={detail.nominees}
                current={peers.filter((p) => p.status !== 'cancelled').map((p) => p.employeeId)}
                locked={[]}
                min={detail.peerBounds.min}
                max={detail.peerBounds.max}
                mode="employee"
              />
            )}
            {detail.selfRequestId && (
              <div className="pt-2">
                <Link href={`/my-forms/${detail.selfRequestId}`}>
                  <Button size="sm" className="gap-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg">
                    <FileText className="size-4" />
                    <span>Fill in My Self-Reflection Form</span>
                  </Button>
                </Link>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Manager Action Alert: Manager Review Pending */}
      {managerFormOutstanding && (
        <Card className="border-amber-300 dark:border-amber-800 bg-amber-50/40 dark:bg-amber-950/20">
          <CardContent className="flex flex-wrap items-center justify-between gap-4 p-5">
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-amber-950 dark:text-amber-200 flex items-center gap-2">
                <Clock className="size-4 text-amber-600" />
                <span>Manager Performance Review is Due</span>
              </h3>
              <p className="text-xs text-muted-foreground">
                Please evaluate your reportee before the review meeting takes place.
              </p>
            </div>
            <Link href={`/my-forms/${detail.managerRequestId}`}>
              <Button size="sm" className="gap-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs">
                <FileText className="size-4" />
                <span>Open Manager Review Form</span>
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}

      {/* Review Participants & Status Table */}
      <Card className="border-border/70 shadow-xs">
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 pb-3">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="size-4 text-indigo-600 dark:text-indigo-400" />
              <span>Review Participants & Progress</span>
            </CardTitle>
            <CardDescription className="text-xs">
              Reminders: automated once every {detail.settings.reminder_interval_hours} hours.
            </CardDescription>
          </div>
          {open && hasPending && (rel.operator || rel.isManager || rel.isSubject) && (
            <RemindAllButton cycleId={detail.id} />
          )}
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-y bg-muted/40 text-left text-xs text-muted-foreground font-semibold">
                <tr>
                  <th className="px-5 py-3">Participant</th>
                  <th className="px-4 py-3">Role</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Target Due</th>
                  <th className="px-4 py-3">Reminders Sent</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {detail.participants.map((p) => (
                  <tr key={p.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-5 py-3 font-semibold text-foreground">
                      <div className="flex items-center gap-2.5">
                        <div className="size-7 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold text-xs ring-1 ring-indigo-500/20 shrink-0">
                          {p.name?.charAt(0) || 'U'}
                        </div>
                        <span className="truncate">
                          {p.role === 'self' && rel.isSubject ? 'You (Self Reflection)' : p.name}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant="outline" className="text-xs font-medium">
                        {ROLE_LABELS[p.role]}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <StatusCell
                        status={p.status}
                        submittedAt={p.submittedAt}
                        escalated={p.escalated}
                      />
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">
                      {p.status === 'invited' ? fmt(p.dueAt) : '—'}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs tabular-nums">
                      {p.reminderCount > 0 ? (
                        <span className="font-medium text-foreground">
                          {p.reminderCount} sent
                          <span className="text-muted-foreground font-normal ml-1">
                            (last {fmt(p.lastRemindedAt, true)})
                          </span>
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-1.5">
                        {p.status === 'invited' && (
                          <RemindButton
                            participantId={p.id}
                            allowed={p.remind.allowed}
                            wait={p.remind.wait}
                          />
                        )}
                        {rel.operator &&
                          open &&
                          p.role === 'peer' &&
                          (p.status === 'invited' || p.status === 'nominated') && (
                            <WithdrawButton participantId={p.id} />
                          )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {selfP && rel.isSubject && selfP.status !== 'submitted' && peers.length === 0 && (
            <p className="px-5 py-4 text-xs text-muted-foreground border-t border-border/60">
              You haven&apos;t nominated any peer reviewers yet. Use the nomination tool above.
            </p>
          )}
        </CardContent>
      </Card>

      {/* PnC Operational Controls: Add Peer Reviewer */}
      {rel.operator && open && detail.stage !== 'self_review' && detail.nominees && (
        <Card className="border-border/70">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="size-4 text-indigo-600 dark:text-indigo-400" />
              <span>Admin: Add or Manage Peer Reviewers</span>
            </CardTitle>
            <CardDescription className="text-xs">
              PnC staff can add extra reviewers or modify reviewer allocation for this cycle.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <NominationPanel
              cycleId={detail.id}
              people={detail.nominees}
              current={peers.filter((p) => p.status !== 'cancelled').map((p) => p.employeeId)}
              locked={peers
                .filter((p) => p.status !== 'cancelled' && p.status !== 'nominated')
                .map((p) => p.employeeId)}
              min={detail.peerBounds.min}
              max={detail.peerBounds.max}
              mode="pnc"
            />
          </CardContent>
        </Card>
      )}

      {/* Meeting Booking Section */}
      {(detail.meetingStart || canSchedule) && (
        <Card className="border-border/70 shadow-xs">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <CalendarClock className="size-4 text-indigo-600 dark:text-indigo-400" />
              <span>1-on-1 Performance Discussion</span>
            </CardTitle>
            <CardDescription className="text-xs">
              {detail.meetingStart
                ? `Confirmed for ${fmt(detail.meetingStart, true)} between ${
                    rel.isSubject ? 'you' : detail.employeeName
                  }, ${detail.managerName ?? 'the manager'} and PnC.`
                : detail.ready
                ? 'All prerequisite submissions are in. Schedule the formal discussion below.'
                : 'Meeting scheduling will unlock once reviews are compiled, or you can book an advance slot now.'}
            </CardDescription>
          </CardHeader>
          {canSchedule && (
            <CardContent>
              <MeetingForm cycleId={detail.id} current={detail.meetingStart} />
            </CardContent>
          )}
        </Card>
      )}

      {/* Compiled Review Answers (Ratings rendered with visual bar graphs!) */}
      {detail.reviews && (
        <Card className="border-border/70 shadow-xs">
          <CardHeader className="pb-3 bg-muted/20 border-b border-border/60">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Lock className="size-4 text-indigo-600 dark:text-indigo-400" />
                  <span>Submitted Evaluation Responses</span>
                </CardTitle>
                <CardDescription className="text-xs mt-0.5">
                  Visible to reporting managers and PnC administrators only. Peer submissions remain
                  anonymized.
                </CardDescription>
              </div>
              <Badge variant="outline" className="text-xs gap-1">
                <ShieldCheck className="size-3.5 text-emerald-600" /> Confidential
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-8 pt-6">
            {[detail.reviews.self, detail.reviews.manager].filter(Boolean).length === 0 &&
              detail.reviews.peers.length === 0 &&
              !detail.reviews.peersHidden && (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  <p className="font-medium">No reviews have been submitted yet.</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Completed self, manager, and peer evaluations will appear here.
                  </p>
                </div>
              )}

            {[detail.reviews.self, detail.reviews.manager]
              .filter((b): b is NonNullable<typeof b> => Boolean(b))
              .map((b) => (
                <section
                  key={b.title}
                  className="rounded-xl border border-border/70 bg-card p-5 space-y-4 shadow-2xs"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-border/60">
                    <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                      <span className="size-2 rounded-full bg-indigo-600" />
                      <span>{b.title}</span>
                    </h3>
                    {b.submittedAt && (
                      <span className="text-xs text-muted-foreground font-mono">
                        Submitted: {fmt(b.submittedAt, true)}
                      </span>
                    )}
                  </div>

                  <div className="space-y-5">
                    {b.answers.map((a, i) => (
                      <div key={i} className="space-y-1.5">
                        <label className="text-xs font-semibold text-muted-foreground tracking-tight">
                          {a.label}
                        </label>
                        {/* Smart Review Answer View renders rating grids with visual bar graphs! */}
                        <div className="pt-0.5">
                          <SmartReviewAnswerView label={a.label} value={a.value} />
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              ))}

            {detail.reviews.peers.length > 0 && (
              <section className="rounded-xl border border-border/70 bg-card p-5 space-y-4 shadow-2xs">
                <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-border/60">
                  <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                    <span className="size-2 rounded-full bg-indigo-600" />
                    <span>Peer reviews</span>
                  </h3>
                  <span className="text-xs text-muted-foreground">
                    {detail.reviews.peerCount} peers, by question. Ratings are averaged; answers are not grouped by person.
                  </span>
                </div>
                <div className="space-y-6">
                  {detail.reviews.peers.map((q) => (
                    <div key={q.label} className="space-y-2">
                      <label className="text-xs font-semibold text-muted-foreground tracking-tight">{q.label}</label>
                      {q.kind === 'ratings' ? (
                        <PeerRatingSummary criteria={q.criteria} peerCount={peerCount} />
                      ) : (
                        <ul className="space-y-2">
                          {q.answers.map((value, i) => (
                            <li key={i} className="rounded-lg border border-border/50 bg-muted/30 p-3">
                              <SmartReviewAnswerView label={q.label} value={value} />
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            )}

            {detail.reviews.peersHidden && (
              <div className="rounded-lg border border-amber-200 bg-amber-50/60 p-4 text-xs text-amber-900 dark:bg-amber-950/30 dark:border-amber-800 dark:text-amber-200">
                Peer reviews are concealed to keep their authors anonymous until at least
                {` ${MIN_PEERS_FOR_ANONYMITY} `}peers have answered.
              </div>
            )}

            {rel.revealsPeers && detail.reviews.peerCount > 0 && <PeerReveal cycleId={detail.id} />}
          </CardContent>
        </Card>
      )}

      {/* Formal Decision Section */}
      {(detail.decision || canDecide) && rel.readsText && (
        <Card className="border-border/70 shadow-xs">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <ShieldCheck className="size-4 text-indigo-600 dark:text-indigo-400" />
              <span>Review Cycle Decision</span>
            </CardTitle>
            {detail.decision && (
              <CardDescription className="text-xs">
                Outcome:{' '}
                <strong className="text-foreground">{decisionLabel(detail.decision.decision)}</strong>
                {detail.decision.extend_until
                  ? ` (extended until ${fmt(detail.decision.extend_until)})`
                  : ''}{' '}
                — recorded by {detail.decision.decidedByName ?? 'the manager'} on{' '}
                {fmt(detail.decision.decided_at)}
                {detail.decision.pnc_outcome === 'accepted' &&
                  ` · Formally confirmed by PnC on ${fmt(detail.decision.pnc_reviewed_at)}.`}
              </CardDescription>
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            {detail.decision?.note && (
              <div className="rounded-lg border border-border/70 bg-muted/30 p-4 text-sm text-foreground">
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">
                  Manager Remarks & Decision Rationale
                </p>
                <p className="whitespace-pre-line leading-relaxed">{detail.decision.note}</p>
              </div>
            )}
            {detail.decision?.pnc_outcome === 'returned' && (
              <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:bg-amber-950/40 dark:text-amber-200 dark:border-amber-800">
                <p className="font-bold text-xs uppercase tracking-wider text-amber-800 dark:text-amber-300">
                  PnC Returned for Clarification
                </p>
                <p className="whitespace-pre-line mt-1">{detail.decision.pnc_note}</p>
              </div>
            )}
            {canDecide && detail.stage !== 'decision_recorded' && (
              <DecisionForm cycleId={detail.id} kind={detail.kind} existing={detail.decision} />
            )}
            {rel.closer && detail.stage === 'decision_recorded' && <CloseForm cycleId={detail.id} />}
            {rel.isManager && !rel.closer && detail.stage === 'decision_recorded' && (
              <p className="text-xs text-muted-foreground italic">
                Awaiting PnC sign-off and closure.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {rel.isSubject && (detail.stage === 'decision_recorded' || detail.stage === 'closed') && (
        <div className="rounded-xl border border-indigo-200 bg-indigo-50/50 p-4 text-xs text-indigo-900 dark:bg-indigo-950/30 dark:border-indigo-800 dark:text-indigo-200">
          Your manager has recorded the review outcome and PnC{' '}
          {detail.stage === 'closed' ? 'has formalized it' : 'is currently completing the final audit'}
          . You will receive an official communication shortly.
        </div>
      )}

      {/* Activity Timeline */}
      {detail.events && detail.events.length > 0 && (
        <Card className="border-border/70 shadow-xs">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <History className="size-4 text-muted-foreground" />
              <span>Audit Trail & Activity Log</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="space-y-2 text-xs">
              {detail.events.map((e, i) => (
                <li key={i} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-1">
                  <span className="w-36 shrink-0 text-muted-foreground font-mono text-[11px]">
                    {fmt(e.at, true)}
                  </span>
                  <span className="font-semibold text-foreground">
                    {EVENT_LABELS[e.kind] ?? e.kind}
                  </span>
                  {typeof e.detail?.role === 'string' && (
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">
                      {ROLE_LABELS[e.detail.role as 'self'] ?? e.detail.role}
                    </Badge>
                  )}
                  <span className="text-muted-foreground">by {e.actor}</span>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
      )}

      {/* Cancellation controls */}
      {rel.operator && open && (
        <div className="flex justify-end pt-2">
          <CancelReviewButton cycleId={detail.id} />
        </div>
      )}
    </div>
  )
}
