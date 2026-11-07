import { DELETE_FLOOR_DAYS } from '../constants'
import { addDays, isoDate, parseDate } from '../dates'
import type { RetentionAction } from '../types'

// ============================================================================
// Retention: the planner
// ----------------------------------------------------------------------------
// Pure. Given candidate records, the retention rules, the active legal holds
// and today's date, it decides what happens to each record. It never deletes:
// the executor acts on its plan, and only in live mode.
//
// A record is due when both have passed:
//   - its rule's period, from the rule's clock start (or the longer period
//     with consent, where the person consented, e.g. the talent pool); and
//   - the 1-year floor from when it was processed (DELETE_FLOOR_DAYS, DPDP
//     Rules r. 8(3)), applied to every delete and anonymisation.
// A record under a legal hold is never due (DPDP Act s. 17(1)(a)).
// ============================================================================

export interface PlannerRule {
  id: string
  period_days: number | null
  consent_period_days: number | null
  action: RetentionAction
}

export interface RetentionCandidate {
  /** Which source produced it, e.g. 'withdrawn_documents'. */
  kind: string
  id: string
  ruleId: string
  /** When the rule's clock started (exit, withdrawal, decision...); null if it has not. */
  clockStart: string | null
  /** When the data was processed (collected or last changed). */
  processedAt: string
  subject?: { type: 'employee' | 'candidate'; ref: string }
  record?: { table: string; id: string }
  /** The person consented to the longer period (talent pool). */
  consentExtended?: boolean
}

export interface LegalHold {
  subject_type: 'employee' | 'candidate' | 'record'
  subject_ref: string | null
  record_table: string | null
  record_id: string | null
  released_at: string | null
}

export type PlanOutcome = 'delete' | 'anonymise' | 'report' | 'keep'
export type KeepReason = 'not_due' | 'floor' | 'hold' | 'no_period' | 'no_clock' | 'no_rule'

export interface PlannedAction {
  candidate: RetentionCandidate
  outcome: PlanOutcome
  reason: KeepReason | 'due'
  /** When the record becomes due, if known. */
  dueOn: string | null
}

/** Whether an active hold covers this record or its person. */
export function isHeld(c: RetentionCandidate, holds: LegalHold[]): boolean {
  return holds.some(
    (h) =>
      !h.released_at &&
      ((c.subject && h.subject_type === c.subject.type && h.subject_ref === c.subject.ref) ||
        (c.record && h.subject_type === 'record' && h.record_table === c.record.table && h.record_id === c.record.id)),
  )
}

export function planRetention(
  records: RetentionCandidate[],
  rules: PlannerRule[],
  holds: LegalHold[],
  today: Date,
): PlannedAction[] {
  const byId = new Map(rules.map((r) => [r.id, r]))
  return records.map((c) => {
    const rule = byId.get(c.ruleId)
    if (!rule) return { candidate: c, outcome: 'keep', reason: 'no_rule', dueOn: null }
    const period = c.consentExtended && rule.consent_period_days !== null ? rule.consent_period_days : rule.period_days
    if (period === null) return { candidate: c, outcome: 'keep', reason: 'no_period', dueOn: null }
    if (isHeld(c, holds)) return { candidate: c, outcome: 'keep', reason: 'hold', dueOn: null }

    const clock = parseDate(c.clockStart)
    const processed = parseDate(c.processedAt)
    if (!clock || !processed) return { candidate: c, outcome: 'keep', reason: 'no_clock', dueOn: null }

    const periodEnds = addDays(clock, period)
    const floorEnds = addDays(processed, DELETE_FLOOR_DAYS.value)
    const dueOn = isoDate(periodEnds > floorEnds ? periodEnds : floorEnds)

    if (today < periodEnds) return { candidate: c, outcome: 'keep', reason: 'not_due', dueOn }
    if (today < floorEnds) return { candidate: c, outcome: 'keep', reason: 'floor', dueOn }
    const outcome: PlanOutcome = rule.action === 'report_only' ? 'report' : rule.action
    return { candidate: c, outcome, reason: 'due', dueOn }
  })
}

/**
 * The cutoff for purging a log table: rows older than this go. Never later
 * than one year ago, whatever the rule's period says.
 */
export function logCutoff(periodDays: number | null, today: Date): Date | null {
  if (periodDays === null) return null
  return addDays(today, -Math.max(periodDays, DELETE_FLOOR_DAYS.value))
}

export interface RuleCounts {
  due: number
  deleted: number
  anonymised: number
  reported: number
  held: number
  under_floor: number
  not_due: number
}

/** Counts per rule: what goes into retention_runs. Counts only. */
export function summarise(plan: PlannedAction[]): Record<string, RuleCounts> {
  const out: Record<string, RuleCounts> = {}
  for (const p of plan) {
    const c = (out[p.candidate.ruleId] ??= { due: 0, deleted: 0, anonymised: 0, reported: 0, held: 0, under_floor: 0, not_due: 0 })
    if (p.reason === 'due') c.due++
    if (p.reason === 'hold') c.held++
    if (p.reason === 'floor') c.under_floor++
    if (p.reason === 'not_due') c.not_due++
    if (p.outcome === 'report') c.reported++
  }
  return out
}
