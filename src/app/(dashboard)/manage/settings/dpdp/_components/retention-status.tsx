import Link from 'next/link'
import { Scale } from 'lucide-react'
import { getRetentionStatus } from '@/lib/dpdp/holds/queries'
import { isoDate } from '@/lib/dpdp/dates'

const STATUS: Record<string, string> = {
  running: 'Running',
  ok: 'Completed',
  partial: 'Completed with errors',
  failed: 'Failed',
}

/**
 * Under the retention rules: the latest daily run (counts only) and, for
 * privacy case roles, the legal holds.
 */
export async function RetentionStatusPanel() {
  const status = await getRetentionStatus(isoDate(new Date()))
  if (!status) return null
  const run = status.lastRun
  const counts = (run?.counts ?? {}) as Record<string, { due?: number; deleted?: number; held?: number; under_floor?: number } | number | null>

  return (
    <div className="space-y-4 rounded-xl border border-border bg-card p-4">
      <div>
        <p className="text-sm font-semibold text-foreground">Latest retention run</p>
        {run ? (
          <p className="text-xs text-muted-foreground">
            {isoDate(new Date(run.started_at))} · {run.mode === 'live' ? 'Live' : 'Dry run'} · {STATUS[run.status] ?? run.status}
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">The daily job has not run yet.</p>
        )}
      </div>
      {run && (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="text-left text-muted-foreground">
              <tr>
                <th className="py-1 pr-3 font-medium">Rule</th>
                <th className="py-1 pr-3 font-medium">Due</th>
                <th className="py-1 pr-3 font-medium">Deleted</th>
                <th className="py-1 pr-3 font-medium">Held</th>
                <th className="py-1 font-medium">Under the 1-year floor</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {Object.entries(counts)
                .filter(([, c]) => c !== null && typeof c === 'object' && 'due' in c)
                .map(([rule, c]) => {
                  const v = c as { due?: number; deleted?: number; held?: number; under_floor?: number }
                  return (
                    <tr key={rule}>
                      <td className="py-1 pr-3 font-mono">{rule}</td>
                      <td className="py-1 pr-3">{v.due ?? 0}</td>
                      <td className="py-1 pr-3">{v.deleted ?? 0}</td>
                      <td className="py-1 pr-3">{v.held ?? 0}</td>
                      <td className="py-1">{v.under_floor ?? 0}</td>
                    </tr>
                  )
                })}
            </tbody>
          </table>
        </div>
      )}
      {status.holds && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
          <p className="flex items-center gap-2 text-xs text-foreground">
            <Scale className="size-4 text-indigo-600 dark:text-indigo-400" aria-hidden="true" />
            {status.holds.active} active legal hold{status.holds.active === 1 ? '' : 's'}
            {status.holds.reviewOverdue > 0 && <span className="text-amber-700 dark:text-amber-300">· {status.holds.reviewOverdue} past review date</span>}
          </p>
          <Link href="/manage/privacy/holds" className="text-xs font-medium text-indigo-700 hover:underline dark:text-indigo-300">Manage legal holds</Link>
        </div>
      )}
    </div>
  )
}
