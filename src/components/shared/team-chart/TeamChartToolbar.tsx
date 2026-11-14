'use client'

import { Maximize2, Minimize2, RotateCcw, Search, ZoomIn, ZoomOut } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { TeamNode, TeamTreeStats } from '@/lib/org/teamTree'
import { cn } from '@/lib/utils'

const ALL_TEAMS = 'all'
// Indents sub-teams in the filter list; written out so Tailwind sees them.
const INDENT = ['pl-2', 'pl-6', 'pl-10', 'pl-14'] as const

interface TeamChartToolbarProps {
  title: string
  /** `h1` when the chart is the page, `h2` inside a page with its own title. */
  headingLevel: 'h1' | 'h2'
  stats: TeamTreeStats
  query: string
  onQueryChange: (query: string) => void
  /** Enter in the search box: scroll to the next match. */
  onNextMatch: () => void
  matchCount: number
  activeMatchIndex: number
  teamOptions: TeamNode[]
  filterTeamId: string | null
  onFilterChange: (teamId: string | null) => void
  isFitted: boolean
  onFittedChange: (isFitted: boolean) => void
  zoom: number
  minZoom: number
  maxZoom: number
  onZoomIn: () => void
  onZoomOut: () => void
  onResetView: () => void
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

/** Title, counts, search, team filter and "Fit to screen" for the team chart. */
export const TeamChartToolbar = ({
  title,
  headingLevel: Heading,
  stats,
  query,
  onQueryChange,
  onNextMatch,
  matchCount,
  activeMatchIndex,
  teamOptions,
  filterTeamId,
  onFilterChange,
  isFitted,
  onFittedChange,
  zoom,
  minZoom,
  maxZoom,
  onZoomIn,
  onZoomOut,
  onResetView,
}: TeamChartToolbarProps) => {
  const hasQuery = query.trim() !== ''
  const status = !hasQuery ? '' : matchCount === 0 ? 'No matches' : `${activeMatchIndex + 1} of ${matchCount}`

  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div className="min-w-0">
        <Heading className="text-2xl font-semibold tracking-tight text-foreground">{title}</Heading>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          {plural(stats.people, 'person', 'people')} · {plural(stats.teams, 'team', 'teams')} ·{' '}
          {plural(stats.subTeams, 'sub-team', 'sub-teams')}
        </p>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative sm:w-80">
          <Search
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-500"
            aria-hidden="true"
          />
          <Input
            type="search"
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                onNextMatch()
              }
            }}
            placeholder="Search people, teams or roles"
            aria-label="Search people, teams or roles"
            aria-describedby="team-chart-search-status"
            className={cn('pl-9', hasQuery && 'pr-24')}
          />
          <span
            id="team-chart-search-status"
            aria-live="polite"
            className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-xs text-slate-600 dark:text-slate-400"
          >
            {status}
          </span>
        </div>

        <div className="flex gap-2">
          <Select
            value={filterTeamId ?? ALL_TEAMS}
            onValueChange={(value) => onFilterChange(value === ALL_TEAMS ? null : value)}
          >
            <SelectTrigger className="w-full sm:w-48" aria-label="Show one team">
              <SelectValue placeholder="All teams" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_TEAMS}>All teams</SelectItem>
              {teamOptions.map((team) => (
                <SelectItem key={team.id} value={team.id} className={INDENT[Math.min(team.depth, INDENT.length) - 1]}>
                  {team.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="hidden items-center gap-1 rounded-md border border-input bg-background px-1 md:inline-flex">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-7"
              disabled={!isFitted && zoom <= minZoom}
              aria-label="Zoom out"
              title="Zoom out"
              onClick={onZoomOut}
            >
              <ZoomOut className="size-3.5" aria-hidden="true" />
            </Button>
            <span className="min-w-10 text-center font-mono text-xs text-muted-foreground tabular-nums">
              {isFitted ? 'Fit' : `${Math.round(zoom * 100)}%`}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-7"
              disabled={!isFitted && zoom >= maxZoom}
              aria-label="Zoom in"
              title="Zoom in"
              onClick={onZoomIn}
            >
              <ZoomIn className="size-3.5" aria-hidden="true" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-7"
              aria-label="Reset view"
              title="Reset view (100%)"
              onClick={onResetView}
            >
              <RotateCcw className="size-3.5" aria-hidden="true" />
            </Button>
          </div>

          <Button
            type="button"
            variant="outline"
            size="icon"
            className="hidden shrink-0 md:inline-flex"
            aria-pressed={isFitted}
            aria-label={isFitted ? 'Show actual size' : 'Fit to screen'}
            title={isFitted ? 'Show actual size' : 'Fit to screen'}
            onClick={() => onFittedChange(!isFitted)}
          >
            {isFitted ? <Minimize2 aria-hidden="true" /> : <Maximize2 aria-hidden="true" />}
          </Button>
        </div>
      </div>
    </div>
  )
}
