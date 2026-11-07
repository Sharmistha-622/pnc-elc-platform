import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { guard } from '@/lib/rbac/guard'
import { getRequest } from '@/lib/dpdp/requests/service'
import { deadlineState, daysLeft } from '@/lib/dpdp/requests/deadlines'
import { REQUEST_LABELS, STATUS_LABELS } from '@/lib/dpdp/requests/types'
import { RequestWork } from '../../_components/request-work'

export const dynamic = 'force-dynamic'

const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '—')

/** One rights request: who, what, when it is due, and its answer. */
export default async function RequestPage({ params }: { params: Promise<{ id: string }> }) {
  const allowed = await guard('privacyCases')
  if (!allowed.ok) redirect('/')
  const { id } = await params
  const r = await getRequest(id)
  if (!r) notFound()
  const now = new Date()
  const state = deadlineState(r, now)

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 md:p-6 lg:p-8 max-w-4xl mx-auto w-full pb-20">
      <Link href="/manage/privacy/requests" className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-3.5" /> Back to requests
      </Link>
      <section className="space-y-3 rounded-xl border border-border bg-card p-4">
        <h1 className="text-base font-bold text-foreground">
          <span className="font-mono text-muted-foreground">{r.reference}</span> {REQUEST_LABELS[r.request_type].label}
        </h1>
        <dl className="grid gap-x-6 gap-y-1.5 text-xs sm:grid-cols-2">
          <div><dt className="inline text-muted-foreground">Status: </dt><dd className="inline">{STATUS_LABELS[r.status]}</dd></div>
          <div><dt className="inline text-muted-foreground">From: </dt><dd className="inline">{r.principal_type.replace('_', ' ')}{r.requester_name ? `, ${r.requester_name}` : ''} ({r.channel})</dd></div>
          <div><dt className="inline text-muted-foreground">Received: </dt><dd className="inline">{when(r.received_at)}</dd></div>
          <div><dt className="inline text-muted-foreground">Due: </dt><dd className="inline">{when(r.due_at)}{state !== 'closed' && ` (${daysLeft(r.due_at, now)} days left${state === 'overdue' ? ', overdue' : ''})`}</dd></div>
          <div><dt className="inline text-muted-foreground">Acknowledged: </dt><dd className="inline">{when(r.acknowledged_at)}</dd></div>
          <div><dt className="inline text-muted-foreground">Escalated: </dt><dd className="inline">{when(r.escalated_at)}</dd></div>
          <div><dt className="inline text-muted-foreground">Assigned to: </dt><dd className="inline">{r.assigned_to ?? '—'}</dd></div>
          <div><dt className="inline text-muted-foreground">Legal reference: </dt><dd className="inline">{REQUEST_LABELS[r.request_type].ref}</dd></div>
        </dl>
        {r.details && <p className="whitespace-pre-line rounded-lg bg-muted/40 p-3 text-xs">{r.details}</p>}
      </section>
      <RequestWork request={r} />
    </div>
  )
}
