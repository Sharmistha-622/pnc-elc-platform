import Link from 'next/link'
import { redirect } from 'next/navigation'
import { AlertTriangle, ClipboardCheck, Info } from 'lucide-react'
import { PageBanner } from '@/components/shared/page-banner'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { StageBadge, Progress } from '@/components/reviews/stage-badge'
import { DashboardActions, StartReviewButton } from '@/components/reviews/review-controls'
import { getReviewDashboard } from '@/lib/reviews/queries'
import { KIND_LABELS } from '@/lib/reviews/types'

function fmt(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' })
}

const KINDS = [
  { value: '', label: 'All' },
  { value: 'confirmation', label: 'Confirmations' },
  { value: 'appraisal', label: 'Appraisals' },
]

export default async function ReviewsPage({ searchParams }: { searchParams: Promise<{ kind?: string; show?: string }> }) {
  const { kind = '', show = 'active' } = await searchParams
  const data = await getReviewDashboard({ kind })
  if (!data) redirect('/')

  const { totals } = data
  const shown = data.cycles.filter((c) =>
    show === 'all' ? true : show === 'closed' ? c.stage === 'closed' || c.stage === 'cancelled' : c.stage !== 'closed' && c.stage !== 'cancelled'
  )
  const dueNow = data.due.filter((d) => d.state !== 'upcoming')
  const upcoming = data.due.filter((d) => d.state === 'upcoming')

  const stats = [
    { label: 'Up for review', value: totals.open, hint: 'open this cycle' },
    { label: 'Self-reflections in', value: totals.selfDone, hint: 'employees who have submitted' },
    { label: 'Peer reviews', value: `${totals.peerDone}/${totals.peerRequests}`, hint: 'answered of requested' },
    { label: 'Manager reviews in', value: totals.managerDone, hint: 'managers who have submitted' },
    { label: 'Ready for meeting', value: totals.ready, hint: 'meeting still to book' },
    { label: 'Meetings booked', value: totals.meetings, hint: 'waiting on a decision' },
    { label: 'With PnC', value: totals.awaitingPnc, hint: 'decisions to review' },
    { label: 'Not responding', value: totals.escalated, hint: 'escalated after reminders', warn: totals.escalated > 0 },
  ]

  const tab = (k: string, s: string) => `/reviews?${new URLSearchParams({ ...(k ? { kind: k } : {}), ...(s !== 'active' ? { show: s } : {}) })}`

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 md:p-6 lg:p-8 max-w-7xl mx-auto w-full pb-20 animate-in fade-in duration-300">
      <PageBanner
        title="Reviews"
        description="Every confirmation and appraisal in flight: who is due, who has responded, what is waiting on PnC."
        icon={<ClipboardCheck className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />}
        actions={<DashboardActions canOperate={data.canOperate} />}
      />

      {!data.automationEnabled && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600" />
          Review automation is switched off in Settings › Reviews. Nothing opens or reminds on its own until it is switched back on.
        </div>
      )}
      {!data.pncMailboxSet && (
        <div className="flex items-start gap-2 rounded-lg border bg-muted/40 p-3 text-sm text-muted-foreground">
          <Info className="mt-0.5 size-4 shrink-0" />
          No PnC mailbox is set in Settings › Reviews, so PnC notices and meeting invitations go to every PnC Admin account.
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label} className={s.warn ? 'border-red-500/40' : ''}>
            <CardContent className="p-4">
              <p className="text-xs font-medium text-muted-foreground">{s.label}</p>
              <p className={`text-2xl font-bold tabular-nums ${s.warn ? 'text-red-600 dark:text-red-400' : ''}`}>{s.value}</p>
              <p className="text-[11px] text-muted-foreground">{s.hint}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <nav className="flex gap-1 rounded-lg border p-1 text-sm" aria-label="Review type">
          {KINDS.map((k) => (
            <Link key={k.value} href={tab(k.value, show)} className={`rounded-md px-3 py-1 ${kind === k.value ? 'bg-muted font-semibold' : 'text-muted-foreground hover:text-foreground'}`}>
              {k.label}
            </Link>
          ))}
        </nav>
        <nav className="flex gap-1 rounded-lg border p-1 text-sm" aria-label="Status">
          {[['active', 'In progress'], ['closed', 'Finished'], ['all', 'All']].map(([v, l]) => (
            <Link key={v} href={tab(kind, v)} className={`rounded-md px-3 py-1 ${show === v ? 'bg-muted font-semibold' : 'text-muted-foreground hover:text-foreground'}`}>
              {l}
            </Link>
          ))}
        </nav>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Reviews {show === 'closed' ? 'finished' : show === 'all' ? '' : 'in progress'}</CardTitle>
          <CardDescription>{shown.length} {shown.length === 1 ? 'person' : 'people'}</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-y bg-muted/40 text-left text-xs text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 font-medium">Employee</th>
                  <th className="px-4 py-2 font-medium">Review</th>
                  <th className="px-4 py-2 font-medium">Manager</th>
                  <th className="px-4 py-2 font-medium">Stage</th>
                  <th className="px-4 py-2 font-medium">Progress</th>
                  <th className="px-4 py-2 font-medium">Due</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {shown.length === 0 && (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">Nothing here yet.</td></tr>
                )}
                {shown.map((c) => (
                  <tr key={c.id} className="hover:bg-muted/30">
                    <td className="px-4 py-2.5 font-medium">
                      <Link href={`/reviews/${c.id}`} className="hover:underline">{c.employeeName}</Link>
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground">{KIND_LABELS[c.kind]} · {c.periodLabel}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{c.managerName ?? '—'}</td>
                    <td className="px-4 py-2.5"><StageBadge stage={c.stage} /></td>
                    <td className="px-4 py-2.5">
                      <div className="flex flex-wrap gap-1">
                        <Progress label="Self" done={c.counts.selfDone ? 1 : 0} total={1} />
                        <Progress label="Peers" done={c.counts.peersDone} total={c.counts.peersAsked} />
                        <Progress label="Manager" done={c.counts.managerDone ? 1 : 0} total={1} />
                        {c.counts.escalated > 0 && (
                          <span className="rounded bg-red-500/10 px-1.5 py-0.5 text-[11px] font-medium text-red-700 dark:text-red-400">{c.counts.escalated} not responding</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground tabular-nums">{fmt(c.dueDate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Due, not started</CardTitle>
          <CardDescription>
            People whose confirmation or appraisal is due and has no review yet. The daily job opens these on its own; start one now if it cannot wait.
            Anyone more than 30 days overdue is left for you to start by hand, so an old record with no confirmation date does not set off an email.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-y bg-muted/40 text-left text-xs text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 font-medium">Employee</th>
                  <th className="px-4 py-2 font-medium">Review</th>
                  <th className="px-4 py-2 font-medium">Due</th>
                  <th className="px-4 py-2 font-medium" />
                </tr>
              </thead>
              <tbody className="divide-y">
                {dueNow.length === 0 && <tr><td colSpan={4} className="px-4 py-6 text-center text-muted-foreground">Nobody is waiting to start.</td></tr>}
                {dueNow.map((d) => (
                  <tr key={`${d.employeeId}-${d.periodKey}`}>
                    <td className="px-4 py-2.5 font-medium">{d.name}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">
                      {KIND_LABELS[d.kind]} · {d.periodLabel}
                      {d.state === 'overdue_manual' && <span className="ml-2 rounded bg-amber-500/10 px-1.5 py-0.5 text-[11px] text-amber-800 dark:text-amber-300">overdue — start by hand</span>}
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground tabular-nums">{fmt(d.dueDate)}</td>
                    <td className="px-4 py-2.5 text-right">
                      {data.canOperate && (
                        <StartReviewButton
                          employeeId={d.employeeId}
                          kind={d.kind}
                          periodKey={d.periodKey}
                          periodLabel={d.periodLabel}
                          dueDate={d.dueDate}
                          disabledReason={d.hasManager ? undefined : 'No manager on record'}
                        />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {upcoming.length > 0 && (
            <details className="border-t px-4 py-3 text-sm">
              <summary className="cursor-pointer font-medium">Coming up ({upcoming.length})</summary>
              <ul className="mt-2 space-y-1 text-muted-foreground">
                {upcoming.slice(0, 100).map((d) => (
                  <li key={`${d.employeeId}-${d.periodKey}`}>
                    {d.name} — {KIND_LABELS[d.kind]} · {d.periodLabel}, due {fmt(d.dueDate)}{d.opensOn ? `, opens ${fmt(d.opensOn)}` : ''}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
