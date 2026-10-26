import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ClipboardCheck } from 'lucide-react'
import { PageBanner } from '@/components/shared/page-banner'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { StageBadge, Progress } from '@/components/reviews/stage-badge'
import { getMyReviews, type CycleSummary } from '@/lib/reviews/queries'
import { KIND_LABELS } from '@/lib/reviews/types'

function fmt(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' })
}

function nextStep(c: CycleSummary, mine: boolean): string {
  switch (c.stage) {
    case 'self_review':
      return mine ? 'Nominate your peers and fill in your self-reflection' : 'Waiting on their self-reflection'
    case 'in_review':
      return mine ? 'Your peers and manager are responding' : c.counts.managerDone ? 'Waiting on peers' : 'Your manager review is due'
    case 'ready_for_meeting':
      return 'Everything is in; the meeting is being set up'
    case 'meeting_scheduled':
      return mine ? 'Meeting booked' : 'Meeting booked — record your decision after it'
    case 'decision_recorded':
      return 'With PnC'
    case 'closed':
      return 'Completed'
    default:
      return ''
  }
}

function List({ items, mine }: { items: CycleSummary[]; mine: boolean }) {
  if (items.length === 0) return <p className="px-4 py-6 text-sm text-muted-foreground">Nothing here.</p>
  return (
    <ul className="divide-y">
      {items.map((c) => (
        <li key={c.id}>
          <Link href={`/my-reviews/${c.id}`} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 hover:bg-muted/40">
            <div className="space-y-0.5">
              <p className="font-medium">{mine ? `${KIND_LABELS[c.kind]} review` : c.employeeName}</p>
              <p className="text-xs text-muted-foreground">
                {mine ? c.periodLabel : `${KIND_LABELS[c.kind]} · ${c.periodLabel}`} · due {fmt(c.dueDate)} · {nextStep(c, mine)}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <Progress label="Peers" done={c.counts.peersDone} total={c.counts.peersAsked} />
              {!mine && <Progress label="Manager" done={c.counts.managerDone ? 1 : 0} total={1} />}
              <StageBadge stage={c.stage} />
            </div>
          </Link>
        </li>
      ))}
    </ul>
  )
}

export default async function MyReviewsPage() {
  const data = await getMyReviews()
  if (!data) redirect('/')

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 md:p-6 lg:p-8 max-w-5xl mx-auto w-full pb-20 animate-in fade-in duration-300">
      <PageBanner
        title="My Reviews"
        description="Your confirmation and appraisal reviews, and your team's. Forms you have been asked to fill in are in My Forms."
        icon={<ClipboardCheck className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />}
      />
      {!data.linked && (
        <p className="rounded-lg border bg-muted/40 p-3 text-sm text-muted-foreground">
          Your login is not linked to an employee record, so there are no reviews to show.
        </p>
      )}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">My reviews</CardTitle>
          <CardDescription>You see who has responded, not what they wrote.</CardDescription>
        </CardHeader>
        <CardContent className="p-0"><List items={data.mine} mine /></CardContent>
      </Card>
      {data.team.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">My team&apos;s reviews</CardTitle>
            <CardDescription>Reviews of people who report to you: fill in your review, read their self-reflection and peer feedback, and record the decision after the meeting.</CardDescription>
          </CardHeader>
          <CardContent className="p-0"><List items={data.team} mine={false} /></CardContent>
        </Card>
      )}
    </div>
  )
}
