'use client'

import { createContext, useContext } from 'react'

/** State every team and person on the chart reads, without prop drilling. */
export interface TeamChartState {
  /** Collapsed by the viewer, and not held open by a search match. */
  isCollapsed: (teamId: string) => boolean
  setTeamOpen: (teamId: string, isOpen: boolean) => void
  matchedPeople: ReadonlySet<string>
  matchedTeams: ReadonlySet<string>
  /** The match the search last scrolled to (`p:<id>` or `t:<id>`). */
  activeMatch: string | null
  canOpenProfiles: boolean
}

const TeamChartContext = createContext<TeamChartState | null>(null)

/** Provides chart state to every team and person row below it. */
export const TeamChartProvider = TeamChartContext.Provider

/** The chart's shared state. Must sit under `TeamChartProvider`. */
export const useTeamChart = (): TeamChartState => {
  const state = useContext(TeamChartContext)
  if (!state) throw new Error('useTeamChart must be used inside TeamChartProvider')
  return state
}

/** The data attribute that search uses to find an item and scroll to it. */
export const chartItemId = (kind: 'person' | 'team', id: string) => `${kind === 'person' ? 'p' : 't'}:${id}`
