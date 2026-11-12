import { Building2 } from 'lucide-react'

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Card } from '@/components/ui/card'
import type { TeamChartRoot } from '@/lib/org/teamChartTypes'
import { initialsOf } from '@/lib/org/teamTree'
import { cn } from '@/lib/utils'

interface RootCardProps {
  root: TeamChartRoot
  /** Top-level teams on the chart. */
  teamCount: number
  peopleCount: number
  className?: string
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

/**
 * The card the chart hangs from: the viewer on My team, the organisation on
 * the Org chart. Larger than every other card on purpose.
 */
export const RootCard = ({ root, teamCount, peopleCount, className }: RootCardProps) => {
  const isPerson = root.kind === 'person'
  const name = isPerson ? root.person.name : root.name
  const line2 = isPerson ? [root.person.subtitle, root.teamName].filter(Boolean).join(' – ') : 'Organisation'
  const line3 = isPerson
    ? `${plural(root.directReports, 'direct report', 'direct reports')} · ${plural(teamCount, 'team', 'teams')}`
    : `${plural(peopleCount, 'person', 'people')} · ${plural(teamCount, 'team', 'teams')}`

  return (
    <Card className={cn('flex-row items-center gap-4 p-5 shadow-md', className)}>
      <Avatar className="size-13">
        {isPerson && root.person.avatarUrl ? <AvatarImage src={root.person.avatarUrl} alt="" className="object-cover" /> : null}
        <AvatarFallback className="bg-foreground text-base font-semibold text-background">
          {isPerson ? initialsOf(name) : <Building2 className="size-6" aria-hidden="true" />}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0">
        <p className="truncate text-lg font-semibold text-foreground" title={name}>
          {name}
        </p>
        <p className="truncate text-sm text-slate-600 dark:text-slate-400" title={line2}>
          {line2}
        </p>
        <p className="text-sm text-slate-600 dark:text-slate-400">{line3}</p>
      </div>
    </Card>
  )
}
