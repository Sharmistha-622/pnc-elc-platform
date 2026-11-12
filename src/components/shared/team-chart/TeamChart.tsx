'use client'

import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'

import { useCollapsedTeams } from '@/hooks/useCollapsedTeams'
import type { TeamChartData } from '@/lib/org/teamChartTypes'
import { ancestorIds, filterTree, flattenTeams, searchTree, type TeamNode, type TeamPerson } from '@/lib/org/teamTree'

import { NO_TEAM_HUE_INDEX } from './TeamBranch'
import { TeamAccordion } from './TeamAccordion'
import { chartItemId, TeamChartProvider, type TeamChartState } from './TeamChartContext'
import { TeamChartToolbar } from './TeamChartToolbar'
import { TeamLanes } from './TeamLanes'

interface TeamChartProps {
  chart: TeamChartData
  /** "My team" or "Org chart". */
  title: string
  /** `h1` when the chart is the page, `h2` inside a page with its own title. */
  headingLevel?: 'h1' | 'h2'
  /** Shown under the root card when nobody is on the chart. */
  emptyText: string
}

const NO_TEAM_ID = '__no-team__'

/** People with no team, drawn as one more lane at the end. */
const noTeamLane = (people: TeamPerson[]): TeamNode => ({
  id: NO_TEAM_ID,
  name: 'No team',
  parentId: null,
  depth: 1,
  hueIndex: NO_TEAM_HUE_INDEX,
  members: people,
  children: [],
  headcount: people.length,
})

/**
 * The team chart: toolbar, then team lanes on desktop or an accordion below
 * 768px. Holds the viewer's search, team filter, fit-to-screen and collapsed
 * teams (remembered per person in this browser).
 */
export const TeamChart = ({ chart, title, headingLevel = 'h2', emptyText }: TeamChartProps) => {
  const { collapsed, setTeamOpen } = useCollapsedTeams(chart.storageKey)
  const [query, setQuery] = useState('')
  const [filterTeamId, setFilterTeamId] = useState<string | null>(null)
  const [isFitted, setFitted] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const desktopRef = useRef<HTMLDivElement>(null)
  const mobileRef = useRef<HTMLDivElement>(null)
  const deferredQuery = useDeferredValue(query)

  const teamOptions = useMemo(() => flattenTeams(chart.tree.teams), [chart.tree])
  const visibleTree = useMemo(() => filterTree(chart.tree, filterTeamId), [chart.tree, filterTeamId])
  const search = useMemo(() => searchTree(visibleTree, deferredQuery), [visibleTree, deferredQuery])
  const lanes = useMemo(
    () => (visibleTree.unassigned.length > 0 ? [...visibleTree.teams, noTeamLane(visibleTree.unassigned)] : visibleTree.teams),
    [visibleTree],
  )

  // Teams held open whatever the viewer collapsed: those above a search match,
  // and those above the team being filtered to.
  const heldOpen = useMemo(() => {
    const ids = new Set(search.expandIds)
    if (filterTeamId) ancestorIds(chart.tree.teams, filterTeamId).forEach((id) => ids.add(id))
    return ids
  }, [search, filterTeamId, chart.tree])

  const matches = useMemo(
    () => [
      ...search.personIds.map((id) => chartItemId('person', id)),
      ...search.teamIds.map((id) => chartItemId('team', id)),
    ],
    [search],
  )
  const activeMatch = matches.length > 0 ? matches[Math.min(activeIndex, matches.length - 1)] : null

  // Scroll the match into view in whichever layout is showing.
  useEffect(() => {
    if (!activeMatch) return
    const view = [desktopRef.current, mobileRef.current].find((el) => el && el.offsetParent !== null)
    const target = view?.querySelector(`[data-team-chart-item="${CSS.escape(activeMatch)}"]`)
    target?.scrollIntoView({ block: 'center', inline: 'center', behavior: 'smooth' })
  }, [activeMatch])

  const isCollapsed = useCallback((teamId: string) => collapsed.has(teamId) && !heldOpen.has(teamId), [collapsed, heldOpen])

  const state = useMemo<TeamChartState>(
    () => ({
      isCollapsed,
      setTeamOpen,
      matchedPeople: new Set(search.personIds),
      matchedTeams: new Set(search.teamIds),
      activeMatch,
      canOpenProfiles: chart.canOpenProfiles,
    }),
    [isCollapsed, setTeamOpen, search, activeMatch, chart.canOpenProfiles],
  )

  const viewProps = {
    root: chart.root,
    lanes,
    topLevelTeamCount: chart.stats.teams,
    peopleCount: chart.stats.people,
    emptyText,
  }

  return (
    <TeamChartProvider value={state}>
      <div className="flex min-w-0 flex-col gap-4">
        <TeamChartToolbar
          title={title}
          headingLevel={headingLevel}
          stats={chart.stats}
          query={query}
          onQueryChange={(next) => {
            setQuery(next)
            setActiveIndex(0)
          }}
          onNextMatch={() => setActiveIndex((i) => (matches.length > 0 ? (i + 1) % matches.length : 0))}
          matchCount={matches.length}
          activeMatchIndex={Math.min(activeIndex, Math.max(matches.length - 1, 0))}
          teamOptions={teamOptions}
          filterTeamId={filterTeamId}
          onFilterChange={(teamId) => {
            setFilterTeamId(teamId)
            setActiveIndex(0)
          }}
          isFitted={isFitted}
          onFittedChange={setFitted}
        />
        <div ref={desktopRef} className="hidden min-w-0 md:block">
          <TeamLanes {...viewProps} isFitted={isFitted} />
        </div>
        <div ref={mobileRef} className="md:hidden">
          <TeamAccordion {...viewProps} />
        </div>
      </div>
    </TeamChartProvider>
  )
}
