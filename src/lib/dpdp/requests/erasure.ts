import { DELETE_FLOOR_DAYS } from '../constants'
import { addDays, financialYearEnd, isoDate, parseDate } from '../dates'
import type { RetentionRuleId } from '../types'

// ============================================================================
// Erasure answers (DPDP Act s. 8(7), s. 12(3))
// ----------------------------------------------------------------------------
// When a law requires data to be kept, the answer says what is kept, under
// which statute, and until when; everything else is erased.
// ============================================================================

export interface RuleForErasure {
  id: RetentionRuleId | string
  label: string
  period_days: number | null
  statutory_ref: string
  floor_days: number
}

export interface RetainedItem {
  ruleId: string
  label: string
  statutory_ref: string
  /** `YYYY-MM-DD`, or null while employment continues. */
  retainUntil: string | null
}

/** Rules that a former or current employee's records stay under after an erasure request. */
const STAFF_RULES = ['statutory_registers', 'social_security_registers', 'payroll_tax', 'letters'] as const

/**
 * What must be kept despite an erasure request, and until when.
 * Candidates: the processing logs, for the 1-year floor (r. 8(3)).
 * Staff: the statutory registers, payroll and tax records, and letters, which
 * run from exit (or the end of that financial year for tax).
 */
export function retainedForErasure(
  principal: 'candidate' | 'employee' | 'former_employee' | 'contractor' | 'volunteer',
  rules: RuleForErasure[],
  dates: { exitDate?: string | null; lastProcessedAt?: string | null },
  today: Date,
): RetainedItem[] {
  if (principal === 'candidate' || principal === 'volunteer') {
    const last = parseDate(dates.lastProcessedAt) ?? today
    return [
      {
        ruleId: 'logs',
        label: 'Records of what was done with your data (processing logs)',
        statutory_ref: `${DELETE_FLOOR_DAYS.ref}`,
        retainUntil: isoDate(addDays(last, DELETE_FLOOR_DAYS.value)),
      },
    ]
  }
  const exit = parseDate(dates.exitDate)
  return STAFF_RULES.flatMap((id) => {
    const rule = rules.find((r) => r.id === id)
    if (!rule || rule.period_days === null) return []
    const start = exit ? (id === 'payroll_tax' ? financialYearEnd(exit) : exit) : null
    return [
      {
        ruleId: id,
        label: rule.label,
        statutory_ref: rule.statutory_ref,
        retainUntil: start ? isoDate(addDays(start, rule.period_days)) : null,
      },
    ]
  })
}

/** The latest retain-until date among the items, if any is known. */
export function latestRetainUntil(items: RetainedItem[]): string | null {
  const dates = items.map((i) => i.retainUntil).filter((d): d is string => !!d).sort()
  return dates.length ? dates[dates.length - 1] : null
}

/**
 * The erasure answer: what is erased, and for each record kept, the statute
 * and the date it will be erased.
 */
export function erasureAnswer(items: RetainedItem[], erasedBy: string): string {
  if (items.length === 0) {
    return `We will erase the personal data we hold about you by ${erasedBy}. No law requires us to keep it.`
  }
  const lines = items.map((i) =>
    `- ${i.label}: kept under ${i.statutory_ref}, ${i.retainUntil ? `until ${i.retainUntil}` : 'until the period after you leave has run'}, then erased.`,
  )
  return [
    `We will erase the personal data we are not required to keep by ${erasedBy}.`,
    'A law requires us to keep the following, and we will use it only for that purpose:',
    ...lines,
  ].join('\n')
}
