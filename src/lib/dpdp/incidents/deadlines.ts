import { BOARD_DETAILED_REPORT_HOURS, CERT_IN_REPORT_HOURS } from '../constants'
import { addHours, parseDate } from '../dates'

// ============================================================================
// Incidents: the deadlines (pure)
// ----------------------------------------------------------------------------
// From when the incident was noticed: CERT-In within CERT_IN_REPORT_HOURS
// (6 h, CERT-In Directions 2022) for a reportable cyber incident, and the
// Board's detailed report within BOARD_DETAILED_REPORT_HOURS (72 h, DPDP
// Rules r. 7(2)(b)) for a personal data breach. The database sets the same
// deadlines on the row (202611071050_privacy_incidents.sql); these drive the
// countdowns.
// ============================================================================

export function incidentDeadlines(
  detectedAt: Date,
  flags: { personalData: boolean; certinReportable: boolean },
): { certinDueAt: Date | null; boardReportDueAt: Date | null } {
  return {
    certinDueAt: flags.certinReportable ? addHours(detectedAt, CERT_IN_REPORT_HOURS.value) : null,
    boardReportDueAt: flags.personalData ? addHours(detectedAt, BOARD_DETAILED_REPORT_HOURS.value) : null,
  }
}

export type CountdownState = 'not_required' | 'done' | 'done_late' | 'on_track' | 'due_soon' | 'overdue'

export interface Countdown {
  state: CountdownState
  /** Minutes until the deadline (negative once passed); null when not required or done. */
  minutesLeft: number | null
}

/** Where one deadline stands. "Due soon" is the last quarter of its window. */
export function countdown(due: string | null, done: string | null, now: Date, windowHours: number): Countdown {
  const dueAt = parseDate(due)
  if (!dueAt) return { state: 'not_required', minutesLeft: null }
  const doneAt = parseDate(done)
  if (doneAt) return { state: doneAt <= dueAt ? 'done' : 'done_late', minutesLeft: null }
  const minutesLeft = Math.floor((dueAt.getTime() - now.getTime()) / 60000)
  if (minutesLeft < 0) return { state: 'overdue', minutesLeft }
  return { state: minutesLeft <= (windowHours * 60) / 4 ? 'due_soon' : 'on_track', minutesLeft }
}

export const certinCountdown = (i: { certin_due_at: string | null; certin_reported_at: string | null }, now: Date) =>
  countdown(i.certin_due_at, i.certin_reported_at, now, CERT_IN_REPORT_HOURS.value)

export const boardCountdown = (i: { board_report_due_at: string | null; board_report_at: string | null }, now: Date) =>
  countdown(i.board_report_due_at, i.board_report_at, now, BOARD_DETAILED_REPORT_HOURS.value)

/** "3 h 20 min left", "overdue by 2 h 5 min". */
export function describeLeft(minutes: number): string {
  const abs = Math.abs(minutes)
  const h = Math.floor(abs / 60)
  const m = abs % 60
  const text = h > 0 ? `${h} h${m ? ` ${m} min` : ''}` : `${m} min`
  return minutes < 0 ? `overdue by ${text}` : `${text} left`
}
