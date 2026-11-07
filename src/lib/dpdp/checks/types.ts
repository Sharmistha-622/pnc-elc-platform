// ============================================================================
// DPDP checker: shared types
// ----------------------------------------------------------------------------
// One registry (registry.ts), run three ways: `npm run dpdp:check` runs the
// static checks against the repository; the DPDP probe runs the db checks in
// CI; the Compliance checker sub-tab runs the runtime and attestation checks
// against the live settings and counts, and shows the build's static results.
//
// Every title states the rule being met (rules/disclosure.md §3): a failing
// line in a public CI log says what must hold, not how it was broken.
// ============================================================================

export type CheckMode = 'static' | 'db' | 'runtime' | 'attestation'

export type CheckArea =
  | 'Foundations'
  | 'Notice and consent'
  | 'Rights and grievance'
  | 'Retention'
  | 'Security'
  | 'Breach'
  | 'Children'
  | 'Vault'
  | 'Processors'

/** pass = green, warn = amber, fail = red; ci = checked by the CI probe, not here. */
export type OutcomeStatus = 'pass' | 'warn' | 'fail'

export interface CheckOutcome {
  status: OutcomeStatus
  /** Neutral, counts-only explanation: never a name, an email or a value about a person. */
  detail?: string
  counts?: Record<string, number>
}

/** Read access to the repository's files, for static checks. */
export interface RepoFiles {
  /** File contents, or null when the file does not exist. Paths are relative to the repo root. */
  read(path: string): string | null
  /** Files under a directory (recursive), relative to the repo root. */
  list(dir: string): string[]
}

export type StaticCheck = (repo: RepoFiles) => CheckOutcome
export type RuntimeCheck<S> = (snapshot: S, today: Date) => CheckOutcome

export type OverallStatus = 'green' | 'amber' | 'red' | 'ci' | 'not_run'

export interface CheckResult {
  id: string
  title: string
  ref: string
  area: CheckArea
  modes: CheckMode[]
  required: boolean
  howToFix: string
  status: OverallStatus
  /** Outcome per mode that ran. */
  outcomes: Partial<Record<CheckMode, CheckOutcome | 'ci'>>
  lastPassedAt?: string | null
}
