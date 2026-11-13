'use client'

import { useEffect } from 'react'

import { useFitToWidth } from '@/hooks/useFitToWidth'
import type { TeamChartRoot } from '@/lib/org/teamChartTypes'
import { NO_TEAM_HUE } from '@/lib/org/teamPalette'
import type { TeamNode } from '@/lib/org/teamTree'

import { BranchRow } from './BranchRow'
import { BranchStem } from './BranchStem'
import { RootCard } from './RootCard'
import { TeamBranch } from './TeamBranch'

interface TeamLanesProps {
  root: TeamChartRoot
  /** Top-level teams, with a "No team" lane last when anyone has none. */
  lanes: TeamNode[]
  topLevelTeamCount: number
  peopleCount: number
  isFitted: boolean
  emptyText: string
}

/**
 * The desktop chart: the root card, a connector, and each top-level team side
 * by side, every team drawn by `TeamBranch`. A wide chart scrolls sideways
 * inside its own frame, never the page; "Fit to screen" scales it down to the
 * frame's width instead.
 */
export const TeamLanes = ({ root, lanes, topLevelTeamCount, peopleCount, isFitted, emptyText }: TeamLanesProps) => {
  const { containerRef, contentRef, scale, width, height } = useFitToWidth<HTMLDivElement, HTMLDivElement>(isFitted)
  const isScaled = scale < 1

  // A chart wider than its frame opens scrolled to the middle, under the root card.
  useEffect(() => {
    const frame = containerRef.current
    if (frame && frame.scrollWidth > frame.clientWidth) {
      frame.scrollLeft = (frame.scrollWidth - frame.clientWidth) / 2
    }
  }, [containerRef])

  return (
    <div
      ref={containerRef}
      role="region"
      aria-label="Team chart"
      tabIndex={0}
      className="w-full overflow-x-auto rounded-xl border border-border bg-muted/30 outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {/* Sized to the scaled box: a transform alone leaves the layout size unchanged. */}
      <div
        className="mx-auto w-max"
        style={isScaled ? { width: width * scale, height: height * scale } : undefined}
      >
        <div
          ref={contentRef}
          className="w-max origin-top-left p-8"
          style={isScaled ? { transform: `scale(${scale})` } : undefined}
        >
          <div className="flex flex-col items-center">
            <RootCard root={root} teamCount={topLevelTeamCount} peopleCount={peopleCount} className="w-96" />
            {lanes.length > 0 ? (
              <>
                <BranchStem className={NO_TEAM_HUE.stem} />
                <BranchRow
                  items={lanes}
                  getKey={(team) => team.id}
                  renderItem={(team) => <TeamBranch team={team} />}
                  lineClassName={NO_TEAM_HUE.line}
                  stemClassName={NO_TEAM_HUE.stem}
                  gutterClassName="px-4"
                  ariaLabel="Teams"
                />
              </>
            ) : (
              <p className="mt-8 text-sm text-slate-600 dark:text-slate-400">{emptyText}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
