'use client'

import Link from 'next/link'

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Card } from '@/components/ui/card'
import type { TeamChartLeader } from '@/lib/org/teamChartTypes'
import { initialsOf } from '@/lib/org/teamTree'
import { cn } from '@/lib/utils'

import { chartItemId, useTeamChart } from './TeamChartContext'

interface LeaderCardProps {
  leader: TeamChartLeader
  className?: string
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

/**
 * Top-level leader card placed between the organisation root card and the
 * team lanes on an org chart, matching the RootCard person layout.
 */
export const LeaderCard = ({ leader, className }: LeaderCardProps) => {
  const { canOpenProfiles, matchedPeople, activeMatch } = useTeamChart()
  const { person, teamName, directReports } = leader
  const itemId = chartItemId('person', person.id)
  const isMatch = matchedPeople.has(person.id)
  const isActive = activeMatch === itemId
  const line2 = [person.subtitle, teamName].filter(Boolean).join(' – ')
  const line3 = plural(directReports, 'direct report', 'direct reports')

  const card = (
    <Card
      data-team-chart-item={itemId}
      className={cn(
        'flex-row items-center gap-4 p-5 shadow-md transition-shadow',
        canOpenProfiles && 'hover:ring-2 hover:ring-ring',
        isMatch && 'ring-2 ring-primary',
        isActive && 'ring-offset-2 ring-offset-background',
        className,
      )}
    >
      <Avatar className="size-13">
        {person.avatarUrl ? <AvatarImage src={person.avatarUrl} alt="" className="object-cover" /> : null}
        <AvatarFallback className="bg-foreground text-base font-semibold text-background">
          {initialsOf(person.name)}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0">
        <p className="truncate text-lg font-semibold text-foreground" title={person.name}>
          {person.name}
        </p>
        <p className="truncate text-sm text-slate-600 dark:text-slate-400" title={line2}>
          {line2}
        </p>
        <p className="text-sm text-slate-600 dark:text-slate-400">{line3}</p>
      </div>
    </Card>
  )

  if (!canOpenProfiles) return card

  return (
    <Link href={`/employees/${person.id}/profile`} className="block rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring">
      {card}
    </Link>
  )
}

