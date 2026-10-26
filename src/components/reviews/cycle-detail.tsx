import Link from 'next/link'
import { CalendarClock, CheckCircle2, CircleDashed, Clock, FileText, Lock, MailWarning, UserRound } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import type { CycleDetail } from '@/lib/reviews/queries'
import { KIND_LABELS, ROLE_LABELS, STAGE_LABELS, decisionLabel, type ReviewStage } from '@/lib/reviews/types'
import { StageBadge } from './stage-badge'
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

const STEPS: ReviewStage[] = ['self_review', 'in_review', 'ready_for_meeting', 'meeting_scheduled', 'decision_recorded', 'closed']

function fmt(iso: string | null, withTime = false): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return withTime
    ? d.toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kolkata' }) + ' IST'
    : d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' })
}

const EVENT_LABELS: Record<string, string> = {
  opened: 'Review opened',
  invited: 'Form sent',
  submitted: 'Form submitted',
  nominated: 'Peer nominations saved',
  reminded: 'Reminder sent',
  escalated: 'Escalated to PnC',
  ready: 'Ready for the meeting',
  meeting_scheduled: 'Meeting booked',
  decision_recorded: 'Decision recorded',
  returned: 'PnC sent the decision back',
  closed: 'Closed by PnC',
  cancelled: 'Cancelled',
  withdrawn: 'Reviewer withdrawn',
}

function Stepper({ stage }: { stage: ReviewStage }) {
  if (stage === 'cancelled') return null
  // A closed review has completed every step, the last one included.
  const at = stage === 'closed' ? STEPS.length : STEPS.indexOf(stage)
  return (
    <ol className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px]">
      {STEPS.map((s, i) => (
        <li key={s} className="flex items-center gap-2">
          <span className={`inline-flex items-center gap-1 ${i < at ? 'text-emerald-700 dark:text-emerald-400' : i === at ? 'font-semibold text-foreground' : 'text-muted-foreground'}`}>
            {i < at ? <CheckCircle2 className="size-3.5" /> : i === at ? <CircleDashed className="size-3.5" /> : <span className="size-3.5 rounded-full border inline-block" />}
            {STAGE_LABELS[s]}
          </span>
          {i < STEPS.length - 1 && <span className="text-muted-foreground">›</span>}
        </li>
      ))}
    </ol>
  )
}

function StatusCell({ status, submittedAt, escalated }: { status: string; submittedAt: string | null; escalated: boolean }) {
  if (status === 'submitted') {
    return <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400"><CheckCircle2 className="size-3.5" />Submitted {fmt(submittedAt)}</span>
  }
  if (status === 'nominated') return <span className="text-muted-foreground">Nominated — form goes out with the self-reflection</span>
  if (status === 'cancelled') return <span className="text-muted-foreground line-through">Withdrawn</span>
  return (
    <span className="inline-flex items-center gap-1 text-amber-700 dark:text-amber-400">
      <Clock className="size-3.5" />
      Waiting
      {escalated && <span className="ml-1 inline-flex items-center gap-0.5 text-red-600 dark:text-red-400"><MailWarning className="size-3" />PnC told</span>}
    </span>
  )
}

export function CycleDetailView({ detail, backHref, backLabel }: { detail: CycleDetail; backHref: string; backLabel: string }) {
  const { rel } = detail
  const selfP = detail.participants.find((p) => p.role === 'self')
  const peers = detail.participants.filter((p) => p.role === 'peer')
  const open = ['self_review', 'in_review', 'ready_for_meeting', 'meeting_scheduled'].includes(detail.stage)
  const canSchedule = (rel.operator || rel.isManager) && ['in_review', 'ready_for_meeting', 'meeting_scheduled', 'decision_recorded'].includes(detail.stage)
  const canDecide =
    (rel.isManager || rel.closer) &&
    ['ready_for_meeting', 'meeting_scheduled', 'decision_recorded'].includes(detail.stage) &&
    detail.decision?.pnc_outcome !== 'accepted'
  const managerFormOutstanding = rel.isManager && detail.managerRequestId && !detail.counts.managerDone
  const hasPending = detail.participants.some((p) => p.status === 'invited')

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 md:p-6 lg:p-8 max-w-6xl mx-auto w-full pb-20">
      <Link href={backHref} className="text-sm text-indigo-600 hover:underline">&larr; {backLabel}</Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {KIND_LABELS[detail.kind]} review · {detail.periodLabel}
          </p>
          <h1 className="text-2xl font-bold">{rel.isSubject ? 'Your review' : detail.employeeName}</h1>
          <p className="text-sm text-muted-foreground">
            {detail.managerName ? `Manager: ${detail.managerName} · ` : ''}Due {fmt(detail.dueDate)} · Opened {fmt(detail.createdAt)}
          </p>
        </div>
        <StageBadge stage={detail.stage} className="text-xs" />
      </div>
      <Stepper stage={detail.stage} />

      {/* The employee: nominate, then reflect. */}
      {rel.isSubject && detail.stage === 'self_review' && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Your part: nominate peers, then fill in your self-reflection</CardTitle>
            <CardDescription>
              Save your nominations first. When you submit your self-reflection, each colleague you named is asked for feedback.
              Their answers go to your manager and PnC; you will see who has responded, not what they wrote.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
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
              <Link href={`/my-forms/${detail.selfRequestId}`}>
                <Button size="sm" className="gap-1.5"><FileText className="size-4" />Fill in my self-reflection</Button>
              </Link>
            )}
          </CardContent>
        </Card>
      )}

      {managerFormOutstanding && (
        <Card className="border-indigo-500/30">
          <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
            <p className="text-sm">Your manager review is still to do.</p>
            <Link href={`/my-forms/${detail.managerRequestId}`}>
              <Button size="sm" className="gap-1.5"><FileText className="size-4" />Fill in the manager review</Button>
            </Link>
          </CardContent>
        </Card>
      )}

      {/* Who has been asked, and where they stand. */}
      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 pb-3">
          <div>
            <CardTitle className="text-base">Who has responded</CardTitle>
            <CardDescription>
              {detail.counts.selfDone ? 'Self-reflection in' : 'Self-reflection pending'} · peers {detail.counts.peersDone}/{detail.counts.peersAsked} ·{' '}
              {detail.counts.managerDone ? 'manager review in' : 'manager review pending'}. Reminders: one per person every {detail.settings.reminder_interval_hours} hours.
            </CardDescription>
          </div>
          {open && hasPending && (rel.operator || rel.isManager || rel.isSubject) && <RemindAllButton cycleId={detail.id} />}
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-y bg-muted/40 text-left text-xs text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 font-medium">Reviewer</th>
                  <th className="px-4 py-2 font-medium">Form</th>
                  <th className="px-4 py-2 font-medium">Status</th>
                  <th className="px-4 py-2 font-medium">Due</th>
                  <th className="px-4 py-2 font-medium">Reminders</th>
                  <th className="px-4 py-2 font-medium" />
                </tr>
              </thead>
              <tbody className="divide-y">
                {detail.participants.map((p) => (
                  <tr key={p.id}>
                    <td className="px-4 py-2.5 font-medium">
                      <span className="inline-flex items-center gap-1.5"><UserRound className="size-3.5 text-muted-foreground" />{p.role === 'self' && rel.isSubject ? 'You' : p.name}</span>
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground">{ROLE_LABELS[p.role]}</td>
                    <td className="px-4 py-2.5"><StatusCell status={p.status} submittedAt={p.submittedAt} escalated={p.escalated} /></td>
                    <td className="px-4 py-2.5 text-muted-foreground">{p.status === 'invited' ? fmt(p.dueAt) : '—'}</td>
                    <td className="px-4 py-2.5 text-muted-foreground tabular-nums">{p.reminderCount > 0 ? `${p.reminderCount} · last ${fmt(p.lastRemindedAt, true)}` : '—'}</td>
                    <td className="px-4 py-2.5 text-right">
                      <div className="flex justify-end gap-1">
                        {p.status === 'invited' && <RemindButton participantId={p.id} allowed={p.remind.allowed} wait={p.remind.wait} />}
                        {rel.operator && open && p.role === 'peer' && (p.status === 'invited' || p.status === 'nominated') && <WithdrawButton participantId={p.id} />}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {selfP && rel.isSubject && selfP.status !== 'submitted' && peers.length === 0 && (
            <p className="px-4 py-3 text-xs text-muted-foreground">You have not nominated anyone yet.</p>
          )}
        </CardContent>
      </Card>

      {/* PnC can add a reviewer once the employee's part is in. */}
      {rel.operator && open && detail.stage !== 'self_review' && detail.nominees && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Add a peer reviewer</CardTitle>
          </CardHeader>
          <CardContent>
            <NominationPanel
              cycleId={detail.id}
              people={detail.nominees}
              current={peers.filter((p) => p.status !== 'cancelled').map((p) => p.employeeId)}
              locked={peers.filter((p) => p.status !== 'cancelled' && p.status !== 'nominated').map((p) => p.employeeId)}
              min={detail.peerBounds.min}
              max={detail.peerBounds.max}
              mode="pnc"
            />
          </CardContent>
        </Card>
      )}

      {/* The meeting. */}
      {(detail.meetingStart || canSchedule) && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base"><CalendarClock className="size-4" />Review meeting</CardTitle>
            <CardDescription>
              {detail.meetingStart
                ? `Booked for ${fmt(detail.meetingStart, true)}, with ${rel.isSubject ? 'you' : detail.employeeName}, ${detail.managerName ?? 'the manager'} and PnC.`
                : detail.ready
                  ? 'Everything needed is in. Book the meeting; the invitation goes to the manager, the employee and PnC.'
                  : 'Not booked yet. It is booked automatically once the reviews are in, or you can book it now.'}
            </CardDescription>
          </CardHeader>
          {canSchedule && (
            <CardContent>
              <MeetingForm cycleId={detail.id} current={detail.meetingStart} />
            </CardContent>
          )}
        </Card>
      )}

      {/* What was written — only for those who may read it. */}
      {detail.reviews && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base"><Lock className="size-4" />Reviews</CardTitle>
            <CardDescription>
              Visible to the manager and PnC only. Peer reviews are shown without names. Never shown to {detail.employeeName}.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {[detail.reviews.self, detail.reviews.manager, ...detail.reviews.peers].filter(Boolean).length === 0 && !detail.reviews.peersHidden && (
              <p className="text-sm text-muted-foreground">Nothing submitted yet.</p>
            )}
            {[detail.reviews.self, detail.reviews.manager, ...detail.reviews.peers].filter((b): b is NonNullable<typeof b> => Boolean(b)).map((b) => (
              <section key={b.title} className="space-y-2">
                <h3 className="text-sm font-semibold">
                  {b.title}
                  {b.submittedAt && <span className="ml-2 font-normal text-muted-foreground">{fmt(b.submittedAt)}</span>}
                </h3>
                <dl className="grid gap-3 rounded-lg border p-4">
                  {b.answers.map((a, i) => (
                    <div key={i}>
                      <dt className="text-xs font-medium text-muted-foreground">{a.label}</dt>
                      <dd className="whitespace-pre-line text-sm">{a.value}</dd>
                    </div>
                  ))}
                </dl>
              </section>
            ))}
            {detail.reviews.peersHidden && (
              <p className="text-sm text-muted-foreground">
                One peer has answered. Peer reviews are shown once at least two are in, so no single answer can be traced to its writer.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* The decision, and PnC's close. */}
      {(detail.decision || canDecide) && rel.readsText && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Decision</CardTitle>
            {detail.decision && (
              <CardDescription>
                {decisionLabel(detail.decision.decision)}
                {detail.decision.extend_until ? ` until ${fmt(detail.decision.extend_until)}` : ''} — recorded by {detail.decision.decidedByName ?? 'the manager'} on {fmt(detail.decision.decided_at)}
                {detail.decision.pnc_outcome === 'accepted' && `. Accepted by PnC on ${fmt(detail.decision.pnc_reviewed_at)}.`}
              </CardDescription>
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            {detail.decision?.note && <p className="whitespace-pre-line rounded-lg border bg-muted/30 p-3 text-sm">{detail.decision.note}</p>}
            {detail.decision?.pnc_outcome === 'returned' && (
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm">
                <p className="font-medium">PnC sent this back</p>
                <p className="whitespace-pre-line">{detail.decision.pnc_note}</p>
              </div>
            )}
            {canDecide && detail.stage !== 'decision_recorded' && (
              <DecisionForm cycleId={detail.id} kind={detail.kind} existing={detail.decision} />
            )}
            {rel.closer && detail.stage === 'decision_recorded' && <CloseForm cycleId={detail.id} />}
            {rel.isManager && !rel.closer && detail.stage === 'decision_recorded' && (
              <p className="text-sm text-muted-foreground">With PnC for review.</p>
            )}
          </CardContent>
        </Card>
      )}

      {rel.isSubject && (detail.stage === 'decision_recorded' || detail.stage === 'closed') && (
        <p className="text-sm text-muted-foreground">
          Your manager has recorded the outcome of your review and PnC {detail.stage === 'closed' ? 'has completed it' : 'is reviewing it'}. PnC will be in touch with the next steps.
        </p>
      )}

      {detail.events && detail.events.length > 0 && (
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base">Timeline</CardTitle></CardHeader>
          <CardContent>
            <ol className="space-y-1.5 text-sm">
              {detail.events.map((e, i) => (
                <li key={i} className="flex flex-wrap gap-x-2">
                  <span className="w-36 shrink-0 text-muted-foreground tabular-nums">{fmt(e.at, true)}</span>
                  <span className="font-medium">{EVENT_LABELS[e.kind] ?? e.kind}</span>
                  {typeof e.detail?.role === 'string' && <span className="text-muted-foreground">({ROLE_LABELS[e.detail.role as 'self'] ?? e.detail.role})</span>}
                  <span className="text-muted-foreground">· {e.actor}</span>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
      )}

      {rel.operator && open && (
        <div className="flex justify-end"><CancelReviewButton cycleId={detail.id} /></div>
      )}
    </div>
  )
}
