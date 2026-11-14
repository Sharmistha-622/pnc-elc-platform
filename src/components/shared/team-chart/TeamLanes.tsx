'use client'

import { useEffect, useRef, useState } from 'react'

import { useFitToWidth } from '@/hooks/useFitToWidth'
import type { TeamChartLeader, TeamChartRoot } from '@/lib/org/teamChartTypes'
import { NO_TEAM_HUE } from '@/lib/org/teamPalette'
import type { TeamNode } from '@/lib/org/teamTree'
import { cn } from '@/lib/utils'

import { BranchRow } from './BranchRow'
import { BranchStem } from './BranchStem'
import { LeaderCard } from './LeaderCard'
import { RootCard } from './RootCard'
import { TeamBranch } from './TeamBranch'

interface TeamLanesProps {
  root: TeamChartRoot
  leaders?: TeamChartLeader[]
  /** Top-level teams, with a "No team" lane last when anyone has none. */
  lanes: TeamNode[]
  topLevelTeamCount: number
  peopleCount: number
  isFitted: boolean
  zoom: number
  pan: { x: number; y: number }
  onPanChange: (pan: { x: number; y: number }) => void
  emptyText: string
}

/**
 * The desktop chart: the root card, a connector, and each top-level team side
 * by side, every team drawn by `TeamBranch`. A wide chart scrolls sideways
 * inside its own frame, never the page; "Fit to screen" scales it down to the
 * frame's width instead. Supports click-and-drag panning and zoom.
 */
export const TeamLanes = ({
  root,
  leaders = [],
  lanes,
  topLevelTeamCount,
  peopleCount,
  isFitted,
  zoom,
  pan,
  onPanChange,
  emptyText,
}: TeamLanesProps) => {
  const { containerRef, contentRef, scale: fitScale, width, height } = useFitToWidth<HTMLDivElement, HTMLDivElement>(isFitted)
  const effectiveScale = isFitted ? fitScale : zoom
  const isFitScaled = isFitted && fitScale < 1
  const [isDragging, setIsDragging] = useState(false)
  const dragStartRef = useRef({ mouseX: 0, mouseY: 0, panX: 0, panY: 0 })

  // A chart wider than its frame opens scrolled to the middle, under the root card.
  useEffect(() => {
    const frame = containerRef.current
    if (frame && frame.scrollWidth > frame.clientWidth) {
      frame.scrollLeft = (frame.scrollWidth - frame.clientWidth) / 2
    }
  }, [containerRef])

  useEffect(() => {
    if (!isDragging) return

    const handleMouseMove = (e: MouseEvent) => {
      onPanChange({
        x: dragStartRef.current.panX + (e.clientX - dragStartRef.current.mouseX),
        y: dragStartRef.current.panY + (e.clientY - dragStartRef.current.mouseY),
      })
    }
    const handleMouseUp = () => setIsDragging(false)

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDragging, onPanChange])

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button !== 0) return
    const target = e.target as HTMLElement
    if (target.closest('button, a, input, select, [role="dialog"], [role="menu"], [data-radix-popper-content-wrapper]')) {
      return
    }
    setIsDragging(true)
    dragStartRef.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      panX: pan.x,
      panY: pan.y,
    }
  }

  const hasTransform = pan.x !== 0 || pan.y !== 0 || effectiveScale !== 1

  return (
    <div
      ref={containerRef}
      role="region"
      aria-label="Team chart"
      tabIndex={0}
      onMouseDown={handleMouseDown}
      title="Click and drag to pan"
      className={cn(
        'w-full overflow-auto rounded-xl border border-border bg-muted/30 outline-none focus-visible:ring-2 focus-visible:ring-ring',
        isDragging ? 'cursor-grabbing select-none' : 'cursor-grab',
      )}
    >
      {/* Sized to the scaled box when fitted: a transform alone leaves the layout size unchanged. */}
      <div
        className="mx-auto w-max"
        style={isFitScaled ? { width: width * fitScale, height: height * fitScale } : undefined}
      >
        <div
          ref={contentRef}
          className={cn(
            'w-max p-8',
            isFitted ? 'origin-top-left' : 'origin-top',
            !isDragging && 'transition-transform duration-150 ease-out',
          )}
          style={hasTransform ? { transform: `translate(${pan.x}px, ${pan.y}px) scale(${effectiveScale})` } : undefined}
        >
          <div className="flex flex-col items-center">
            <RootCard root={root} teamCount={topLevelTeamCount} peopleCount={peopleCount} className="w-96" />
            {leaders.length > 0 ? (
              <>
                <BranchStem className={NO_TEAM_HUE.stem} />
                {leaders.length === 1 ? (
                  <LeaderCard leader={leaders[0]} className="w-96" />
                ) : (
                  <BranchRow
                    items={leaders}
                    getKey={(leader) => leader.person.id}
                    renderItem={(leader) => <LeaderCard leader={leader} className="w-80" />}
                    lineClassName={NO_TEAM_HUE.line}
                    stemClassName={NO_TEAM_HUE.stem}
                    gutterClassName="px-4"
                    ariaLabel="Leadership"
                  />
                )}
              </>
            ) : null}
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
            ) : leaders.length === 0 ? (
              <p className="mt-8 text-sm text-slate-600 dark:text-slate-400">{emptyText}</p>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  )
}
