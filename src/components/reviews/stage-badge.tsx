import { cn } from '@/lib/utils'
import { STAGE_LABELS, type ReviewStage } from '@/lib/reviews/types'

const TONE: Record<ReviewStage, string> = {
  self_review: 'bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-500/30',
  in_review: 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border-indigo-500/30',
  ready_for_meeting: 'bg-amber-500/10 text-amber-800 dark:text-amber-300 border-amber-500/30',
  meeting_scheduled: 'bg-violet-500/10 text-violet-700 dark:text-violet-300 border-violet-500/30',
  decision_recorded: 'bg-orange-500/10 text-orange-800 dark:text-orange-300 border-orange-500/30',
  closed: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30',
  cancelled: 'bg-muted text-muted-foreground border-border',
}

export function StageBadge({ stage, className }: { stage: ReviewStage; className?: string }) {
  return (
    <span className={cn('inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap', TONE[stage], className)}>
      {STAGE_LABELS[stage]}
    </span>
  )
}

/** A tick, a fraction or a dash, for the progress columns. */
export function Progress({ done, total, label }: { done: number; total: number; label: string }) {
  const complete = total > 0 && done >= total
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-medium tabular-nums',
        complete ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300' : 'bg-muted text-muted-foreground'
      )}
      title={label}
    >
      {label} {total === 0 ? '—' : `${done}/${total}`}
    </span>
  )
}
