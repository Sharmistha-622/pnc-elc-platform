import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Inbox } from 'lucide-react'
import { PageBanner } from '@/components/shared/page-banner'
import { Badge } from '@/components/ui/badge'
import { guard } from '@/lib/rbac/guard'
import { listQueue } from '@/lib/dpdp/requests/service'
import { deadlineState, daysLeft } from '@/lib/dpdp/requests/deadlines'
import { REQUEST_LABELS, STATUS_LABELS } from '@/lib/dpdp/requests/types'
import { RecordEmailRequest } from '../_components/record-email-request'

export const dynamic = 'force-dynamic'

const STATE: Record<string, { label: string; className: string }> = {
  closed: { label: 'Done', className: 'text-muted-foreground' },
  on_track: { label: 'On track', className: 'text-emerald-700 dark:text-emerald-300' },
  escalate: { label: 'Escalated', className: 'text-amber-700 dark:text-amber-300' },
  overdue: { label: 'Overdue', className: 'text-rose-700 dark:text-rose-300' },
}

/** The rights request queue, soonest due first. */
export default async function RequestsPage() {
  const allowed = await guard('privacyCases')
  if (!allowed.ok) redirect('/')
  const requests = await listQueue()
  const now = new Date()
  const open = requests.filter((r) => r.status !== 'closed')

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 md:p-6 lg:p-8 max-w-6xl mx-auto w-full pb-20">
      <PageBanner title="Rights requests" description={`${open.length} open. Due dates come from Settings → DPDP & Privacy; requests past 80% of their period are escalated.`} icon={<Inbox className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />} />
      <RecordEmailRequest />
      <div className="overflow-x-auto rounded-xl border border-border bg-card">
        <table className="w-full text-xs">
          <thead className="bg-muted/40 text-left text-muted-foreground">
            <tr>
              <th className="p-2 font-medium">Reference</th>
              <th className="p-2 font-medium">Request</th>
              <th className="p-2 font-medium">From</th>
              <th className="p-2 font-medium">Status</th>
              <th className="p-2 font-medium">Due</th>
              <th className="p-2 font-medium">Assigned</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {requests.length === 0 && (
              <tr><td colSpan={6} className="p-4 text-center text-muted-foreground">No requests yet.</td></tr>
            )}
            {requests.map((r) => {
              const state = STATE[deadlineState(r, now)]
              return (
                <tr key={r.id}>
                  <td className="p-2 font-mono"><Link href={`/manage/privacy/requests/${r.id}`} className="text-indigo-700 hover:underline dark:text-indigo-300">{r.reference}</Link></td>
                  <td className="p-2">{REQUEST_LABELS[r.request_type].label}</td>
                  <td className="p-2">{r.principal_type.replace('_', ' ')} · {r.channel}</td>
                  <td className="p-2"><Badge variant="outline" className="text-[10px]">{STATUS_LABELS[r.status]}</Badge></td>
                  <td className="p-2">
                    <span className={state.className}>{state.label}</span>
                    {r.status !== 'closed' && r.status !== 'answered' && <span className="block text-[10px] text-muted-foreground">{daysLeft(r.due_at, now)} days left</span>}
                  </td>
                  <td className="p-2">{r.assigned_to ?? '—'}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
