import { CHECKS, PROBE_PATHS, type CheckDefinition } from './registry'
import { attestationOutcome, type ComplianceSnapshot } from './runtime'
import type { CheckMode, CheckOutcome, CheckResult, OverallStatus, RepoFiles } from './types'

// ============================================================================
// DPDP checker: running and combining checks
// ============================================================================

/** The static and db outcomes of one check, as `npm run dpdp:check` produces them. */
export interface StaticResult {
  id: string
  outcomes: Partial<Record<'static' | 'db', CheckOutcome>>
}

export interface StaticReport {
  generatedAt: string
  results: StaticResult[]
}

/** A db check holds when the probe CI runs contains every named check. */
export function probeOutcome(def: CheckDefinition, repo: RepoFiles): CheckOutcome {
  const probe = PROBE_PATHS.map((p) => repo.read(p) ?? '').join('\n')
  const missing = (def.probe ?? []).filter((name) => !probe.includes(`'${name}'`))
  return missing.length === 0
    ? { status: 'pass', detail: 'Held by the DPDP probe in CI.' }
    : { status: 'fail', detail: 'The DPDP probe does not check this yet.', counts: { probe_checks_missing: missing.length } }
}

/** Runs every static and db check against the repository. */
export function runStatic(repo: RepoFiles, generatedAt: string, checks: CheckDefinition[] = CHECKS): StaticReport {
  return {
    generatedAt,
    results: checks
      .filter((c) => c.static || c.probe)
      .map((c) => {
        const outcomes: StaticResult['outcomes'] = {}
        if (c.static) {
          try {
            outcomes.static = c.static(repo)
          } catch {
            outcomes.static = { status: 'fail', detail: 'The check could not run.' }
          }
        }
        if (c.probe) outcomes.db = probeOutcome(c, repo)
        return { id: c.id, outcomes }
      }),
  }
}

const RANK: Record<CheckOutcome['status'], number> = { pass: 0, warn: 1, fail: 2 }

/** The worst of a set of outcomes. */
export function worst(outcomes: CheckOutcome[]): CheckOutcome['status'] | null {
  if (outcomes.length === 0) return null
  return outcomes.reduce((w, o) => (RANK[o.status] > RANK[w] ? o.status : w), 'pass' as CheckOutcome['status'])
}

/** Green, amber or red from the modes that ran; `not_run` when none did. */
export function overall(outcomes: Partial<Record<CheckMode, CheckOutcome | 'ci'>>): OverallStatus {
  const ran = Object.values(outcomes).filter((o): o is CheckOutcome => !!o && o !== 'ci')
  const w = worst(ran)
  if (w === null) return Object.values(outcomes).includes('ci') ? 'ci' : 'not_run'
  return w === 'fail' ? 'red' : w === 'warn' ? 'amber' : 'green'
}

/**
 * Everything the checker tab shows: the build's static and db results, plus
 * the runtime and attestation checks against the live snapshot.
 */
export function evaluateAll(
  snapshot: ComplianceSnapshot,
  today: Date,
  staticReport: StaticReport | null,
  lastPassed: Record<string, string | null> = {},
  checks: CheckDefinition[] = CHECKS,
): CheckResult[] {
  const statics = new Map((staticReport?.results ?? []).map((r) => [r.id, r.outcomes]))
  return checks.map((c) => {
    const outcomes: CheckResult['outcomes'] = {}
    const fromBuild = statics.get(c.id)
    if (c.static) outcomes.static = fromBuild?.static ?? { status: 'warn', detail: 'No static result in this build.' }
    if (c.probe) outcomes.db = fromBuild?.db ?? 'ci'
    if (c.runtime) {
      try {
        outcomes.runtime = c.runtime(snapshot, today)
      } catch {
        outcomes.runtime = { status: 'fail', detail: 'The check could not run.' }
      }
    }
    if (c.attestations) outcomes.attestation = attestationOutcome(c.attestations, snapshot.attestations, today)
    return {
      id: c.id,
      title: c.title,
      ref: c.ref,
      area: c.area,
      modes: c.modes,
      required: c.required,
      howToFix: c.howToFix,
      status: overall(outcomes),
      outcomes,
      lastPassedAt: lastPassed[c.id] ?? null,
    }
  })
}

export interface Score {
  green: number
  amber: number
  red: number
  other: number
  total: number
  /** Green share of the checks that ran, 0–100. */
  percent: number
}

export function scoreOf(results: CheckResult[]): Score {
  const count = (s: OverallStatus) => results.filter((r) => r.status === s).length
  const green = count('green')
  const amber = count('amber')
  const red = count('red')
  const ran = green + amber + red
  return { green, amber, red, other: results.length - ran, total: results.length, percent: ran ? Math.round((green / ran) * 100) : 0 }
}

const csvCell = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v)

/** The report as CSV: check by check, counts only. */
export function toCsv(results: CheckResult[]): string {
  const header = ['id', 'title', 'ref', 'area', 'status', 'static', 'db', 'runtime', 'attestation', 'detail', 'last_passed_at']
  const outcome = (o: CheckOutcome | 'ci' | undefined) => (o === undefined ? '' : o === 'ci' ? 'ci' : o.status)
  const lines = results.map((r) =>
    [
      r.id,
      r.title,
      r.ref,
      r.area,
      r.status,
      outcome(r.outcomes.static),
      outcome(r.outcomes.db),
      outcome(r.outcomes.runtime),
      outcome(r.outcomes.attestation),
      Object.values(r.outcomes)
        .filter((o): o is CheckOutcome => !!o && o !== 'ci' && o.status !== 'pass')
        .map((o) => [o.detail, o.counts ? JSON.stringify(o.counts) : ''].filter(Boolean).join(' '))
        .join(' | '),
      r.lastPassedAt ?? '',
    ]
      .map((v) => csvCell(String(v)))
      .join(','),
  )
  return [header.join(','), ...lines].join('\n')
}
