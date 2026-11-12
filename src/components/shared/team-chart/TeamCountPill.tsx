import { cn } from '@/lib/utils'
import type { TeamHue } from '@/lib/org/teamPalette'

interface TeamCountPillProps {
  count: number
  hue: TeamHue
  /** Collapsed teams spell the count out: "4 people". */
  isCollapsed: boolean
}

/** A team's rolled-up headcount, beside its name. */
export const TeamCountPill = ({ count, hue, isCollapsed }: TeamCountPillProps) => {
  const label = `${count} ${count === 1 ? 'person' : 'people'}`
  return (
    <span
      className={cn(
        'inline-flex h-6 min-w-6 shrink-0 items-center justify-center rounded-full border bg-card px-2 text-xs font-semibold tabular-nums',
        hue.pill,
      )}
      aria-label={label}
    >
      {isCollapsed ? label : count}
    </span>
  )
}
