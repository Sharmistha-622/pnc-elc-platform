'use client'

import { ChevronUp } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { NO_TEAM_HUE, panelTint, teamHue } from '@/lib/org/teamPalette'
import type { TeamNode } from '@/lib/org/teamTree'
import { cn } from '@/lib/utils'

import { BranchRow } from './BranchRow'
import { BranchStem } from './BranchStem'
import { PersonRow } from './PersonRow'
import { chartItemId, useTeamChart } from './TeamChartContext'
import { TeamCountPill } from './TeamCountPill'

/** A palette slot below zero marks the "No team" lane. */
export const NO_TEAM_HUE_INDEX = -1

/**
 * One team, by one rule at every depth:
 *  - no sub-teams: a lane, header on the left, people stacked below;
 *  - sub-teams: a panel with a centred header, its own people (a lead, say)
 *    under it, then a connector down to its sub-teams side by side, each
 *    drawn by this same component.
 * Collapsing hides everything under the header and spells out the count.
 */
export const TeamBranch = ({ team }: { team: TeamNode }) => {
  const { isCollapsed, setTeamOpen, matchedTeams, activeMatch } = useTeamChart()
  const hue = team.hueIndex < 0 ? NO_TEAM_HUE : teamHue(team.hueIndex)
  const isOpen = !isCollapsed(team.id)
  const isParent = team.children.length > 0
  const itemId = chartItemId('team', team.id)
  const headingId = `team-chart-heading-${team.id}`

  return (
    <Collapsible open={isOpen} onOpenChange={(open) => setTeamOpen(team.id, open)} asChild>
      <section
        aria-labelledby={headingId}
        className={cn('rounded-xl border p-3', panelTint(hue, team.depth), hue.border, isParent ? 'min-w-80' : 'w-72')}
      >
        <div className="flex items-center gap-2">
          {isParent ? <span className="size-8 shrink-0" aria-hidden="true" /> : null}
          <div className={cn('flex min-w-0 flex-1 items-center gap-2', isParent && 'justify-center')}>
            <h3
              id={headingId}
              data-team-chart-item={itemId}
              className={cn(
                'truncate rounded-md px-1 text-sm font-semibold',
                hue.header,
                matchedTeams.has(team.id) && cn('ring-2', hue.match),
                activeMatch === itemId && 'ring-offset-2 ring-offset-background',
              )}
              title={team.name}
            >
              {team.name}
            </h3>
            <TeamCountPill count={team.headcount} hue={hue} isCollapsed={!isOpen} />
          </div>
          <CollapsibleTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className={cn('size-8 shrink-0 hover:bg-background/60', hue.header)}
              aria-label={`${isOpen ? 'Collapse' : 'Expand'} ${team.name}`}
            >
              <ChevronUp className={cn('transition-transform', !isOpen && 'rotate-180')} aria-hidden="true" />
            </Button>
          </CollapsibleTrigger>
        </div>

        <CollapsibleContent>
          {team.members.length > 0 ? (
            <ul className={cn('mt-3 flex flex-col gap-2', isParent && 'mx-auto w-72')} aria-label={`People in ${team.name}`}>
              {team.members.map((person) => (
                <li key={person.id}>
                  <PersonRow person={person} teamName={team.name} hue={hue} />
                </li>
              ))}
            </ul>
          ) : null}

          {isParent ? (
            <div className="mt-3 flex flex-col items-center">
              <BranchStem className={hue.stem} />
              <BranchRow
                items={team.children}
                getKey={(child) => child.id}
                renderItem={(child) => <TeamBranch team={child} />}
                lineClassName={hue.line}
                stemClassName={hue.stem}
                gutterClassName="px-2"
                ariaLabel={`Sub-teams of ${team.name}`}
              />
            </div>
          ) : null}
        </CollapsibleContent>
      </section>
    </Collapsible>
  )
}
