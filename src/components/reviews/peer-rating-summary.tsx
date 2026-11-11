import { BarChart3 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import type { PeerRating } from '@/lib/reviews/queries'

/** Where a 1 to 5 score sits along the bar, as a percentage. */
const at = (score: number) => `${(Math.min(Math.max(score, 1), 5) - 1) * 25}%`

/**
 * Every peer's ratings on one rating grid question, one row per criterion:
 * the average as a dot, the lowest to highest as a band behind it.
 */
export function PeerRatingSummary({ criteria, peerCount }: { criteria: PeerRating[]; peerCount: number }) {
  const overall = Math.round((criteria.reduce((sum, c) => sum + c.average, 0) / criteria.length) * 10) / 10

  return (
    <div className="space-y-3 rounded-lg border border-border/50 bg-muted/30 p-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="flex size-7 items-center justify-center rounded-md bg-muted text-muted-foreground">
            <BarChart3 className="size-4" aria-hidden="true" />
          </span>
          <div>
            <span className="block text-xs font-semibold text-foreground">Average of {peerCount} peers</span>
            <span className="block text-[11px] leading-snug text-muted-foreground">
              Dot is the average; band runs from the lowest to the highest rating given
            </span>
          </div>
        </div>
        <Badge variant="outline" className="px-2.5 py-1 font-mono text-xs font-bold">
          Overall: {overall.toFixed(1)} / 5
        </Badge>
      </div>

      <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {criteria.map((c) => (
          <li key={c.criterion} className="space-y-2 rounded-xl border border-border/80 bg-card p-3.5">
            <div className="flex items-start justify-between gap-2">
              <span className="text-xs font-semibold leading-snug tracking-tight text-foreground">{c.criterion}</span>
              <span className="shrink-0 font-mono text-xs font-bold text-foreground">{c.average.toFixed(1)} / 5</span>
            </div>

            <div
              role="img"
              aria-label={`${c.criterion}: average ${c.average.toFixed(1)} out of 5, lowest ${c.lowest}, highest ${c.highest}`}
              className="relative h-2.5 w-full rounded-full bg-muted"
            >
              <div
                className="absolute inset-y-0 rounded-full bg-chart-1/30"
                style={{ left: at(c.lowest), width: `calc(${at(c.highest)} - ${at(c.lowest)})` }}
              />
              <div
                className="absolute top-1/2 size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-chart-1 ring-2 ring-background"
                style={{ left: at(c.average) }}
              />
            </div>

            <div className="flex justify-between font-mono text-[10px] text-muted-foreground" aria-hidden="true">
              {[1, 2, 3, 4, 5].map((n) => (
                <span key={n}>{n}</span>
              ))}
            </div>

            <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
              <span>
                Lowest <span className="font-mono font-semibold text-foreground">{c.lowest}</span>
              </span>
              <span>
                Highest <span className="font-mono font-semibold text-foreground">{c.highest}</span>
              </span>
              {c.count < peerCount && <span>{c.count} of {peerCount} peers rated this</span>}
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
