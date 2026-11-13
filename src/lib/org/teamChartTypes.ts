import type { TeamPerson, TeamTree, TeamTreeStats } from './teamTree'

// The team chart's data, as the server loaders (`getTeamChart.ts`) hand it to
// the client chart. Types only, so client components can import them without
// pulling in server code.

/** The card at the top of the chart. */
export type TeamChartRoot =
  | {
      kind: 'person'
      person: TeamPerson
      teamName: string | null
      directReports: number
    }
  | { kind: 'org'; name: string }

/** Everything the chart needs, as plain props. */
export interface TeamChartData {
  root: TeamChartRoot
  tree: TeamTree
  stats: TeamTreeStats
  /** Whether rows link to `/employees/[id]/profile`. */
  canOpenProfiles: boolean
  /** Where this viewer's collapsed teams are remembered in the browser. */
  storageKey: string
  /** Shown above the chart when it is incomplete, e.g. before a migration. */
  notice: string | null
}

export type TeamChartResult = { ok: true; chart: TeamChartData } | { ok: false; error: string }
