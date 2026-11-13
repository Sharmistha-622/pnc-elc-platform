'use client'

import { ChevronRight } from 'lucide-react'

import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { NO_TEAM_HUE, panelTint, teamHue } from '@/lib/org/teamPalette'
import type { TeamNode } from '@/lib/org/teamTree'
import { cn } from '@/lib/utils'

import { PersonRow } from './PersonRow'
import { chartItemId, useTeamChart } from './TeamChartContext'
import { TeamCountPill } from './TeamCountPill'

/** One team in the mobile list, its people and sub-teams inside it. */
export const TeamAccordionItem = ({ team }: { team: TeamNode }) => {
  const { isCollapsed, setTeamOpen, matchedTeams, activeMatch } = useTeamChart()
  const hue = team.hueIndex < 0 ? NO_TEAM_HUE : teamHue(team.hueIndex)
  const isOpen = !isCollapsed(team.id)
  const itemId = chartItemId('team', team.id)

  return (
    <li>
      <Collapsible open={isOpen} onOpenChange={(open) => setTeamOpen(team.id, open)}>
        <div className={cn('rounded-lg border', panelTint(hue, team.depth), hue.border)}>
          <CollapsibleTrigger asChild>
            <button
              type="button"
              data-team-chart-item={itemId}
              className={cn(
                'flex min-h-11 w-full items-center gap-2 rounded-lg px-3 py-2 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring',
                matchedTeams.has(team.id) && cn('ring-2', hue.match),
                activeMatch === itemId && 'ring-offset-2 ring-offset-background',
              )}
            >
              <ChevronRight
                className={cn('size-4 shrink-0 transition-transform', hue.header, isOpen && 'rotate-90')}
                aria-hidden="true"
              />
              <span className={cn('min-w-0 flex-1 truncate text-sm font-semibold', hue.header)}>{team.name}</span>
              <TeamCountPill count={team.headcount} hue={hue} isCollapsed={!isOpen} />
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <ul className="flex flex-col gap-2 px-2 pb-2" aria-label={`${team.name}: people and sub-teams`}>
              {team.members.map((person) => (
                <li key={person.id}>
                  <PersonRow person={person} teamName={team.name} hue={hue} />
                </li>
              ))}
              {team.children.map((child) => (
                <TeamAccordionItem key={child.id} team={child} />
              ))}
            </ul>
          </CollapsibleContent>
        </div>
      </Collapsible>
    </li>
  )
}
