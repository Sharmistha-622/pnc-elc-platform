'use client'

import type { TeamChartLeader, TeamChartRoot } from '@/lib/org/teamChartTypes'
import type { TeamNode } from '@/lib/org/teamTree'

import { LeaderCard } from './LeaderCard'
import { RootCard } from './RootCard'
import { TeamAccordionItem } from './TeamAccordionItem'

interface TeamAccordionProps {
  root: TeamChartRoot
  leaders?: TeamChartLeader[]
  lanes: TeamNode[]
  topLevelTeamCount: number
  peopleCount: number
  emptyText: string
}

/**
 * The chart below 768px: the same tree as an indented list of collapsible
 * teams, people listed inside each.
 */
export const TeamAccordion = ({ root, leaders = [], lanes, topLevelTeamCount, peopleCount, emptyText }: TeamAccordionProps) => (
  <div className="flex flex-col gap-3">
    <RootCard root={root} teamCount={topLevelTeamCount} peopleCount={peopleCount} className="p-4" />
    {leaders.length > 0 ? (
      <div className="flex flex-col gap-2" aria-label="Leadership">
        {leaders.map((leader) => (
          <LeaderCard key={leader.person.id} leader={leader} className="p-4" />
        ))}
      </div>
    ) : null}
    {lanes.length > 0 ? (
      <ul className="flex flex-col gap-2" aria-label="Teams">
        {lanes.map((team) => (
          <TeamAccordionItem key={team.id} team={team} />
        ))}
      </ul>
    ) : leaders.length === 0 ? (
      <p className="text-sm text-slate-600 dark:text-slate-400">{emptyText}</p>
    ) : null}
  </div>
)
