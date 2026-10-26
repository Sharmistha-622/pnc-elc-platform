// ============================================================================
// Review cycles — the rules, as pure functions
// ----------------------------------------------------------------------------
// Who is due, when someone may be reminded, when PnC hears about it, when a
// cycle is ready for its meeting, and which slot the meeting takes. No I/O and
// no clock: every function that depends on time takes `now`, so the whole
// schedule can be tested without freezing one (rules/testing.md).
// ============================================================================

import type { AppraisalCycle, AppraisalRule, ConfirmationRule } from '@/lib/settings/types'
import { calculateAppraisalReferenceDate } from '@/lib/appraisals/getAppraisalReferenceDate'
import { getAppraisalCohortFromCycles } from '@/lib/appraisals/getAppraisalCohort'
import type { ParticipantRow, ReviewCycleSettings } from './types'

const HOUR = 60 * 60 * 1000
const DAY = 24 * HOUR

/**
 * How late a confirmation may be and still be opened automatically.
 *
 * Added so the first run does not mail everyone whose confirmation date was
 * never recorded: anyone further overdue than this is listed on the PnC
 * dashboard as "overdue, not started" and opened by hand.
 */
export const MAX_OVERDUE_DAYS = 30

/** How long after an appraisal month starts its batch can still be opened. */
export const APPRAISAL_OPEN_WINDOW_DAYS = 45

function startOfDayUtc(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
}

function parseDate(value: string | null | undefined): Date | null {
  if (!value) return null
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? null : d
}

export function addOffset(base: Date, value: number, unit: string): Date {
  const d = new Date(base)
  if (unit === 'days') d.setUTCDate(d.getUTCDate() + value)
  else if (unit === 'weeks') d.setUTCDate(d.getUTCDate() + value * 7)
  else d.setUTCMonth(d.getUTCMonth() + value)
  return d
}

export function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

// ----------------------------------------------------------------------------
// Who is due
// ----------------------------------------------------------------------------

export type EmployeeForReview = {
  id: string
  name: string
  email: string | null
  typeCode: string | null
  status: string | null
  joiningDate: string | null
  conversionDate: string | null
  confirmationDate: string | null
  managerId: string | null
}

export type ConfirmationDue =
  | { state: 'not_eligible'; reason: string }
  | { state: 'upcoming'; dueDate: string; opensOn: string }
  | { state: 'open_now'; dueDate: string }
  | { state: 'overdue_manual'; dueDate: string }

/**
 * Where an employee stands for their confirmation, given the rule for their
 * type and today's date. `open_now` is what the daily job opens.
 */
export function confirmationDue(
  employee: EmployeeForReview,
  rules: ConfirmationRule[],
  now: Date,
  leadDays: number
): ConfirmationDue {
  if (employee.status && employee.status !== 'active') return { state: 'not_eligible', reason: 'Not active' }
  if (employee.confirmationDate) return { state: 'not_eligible', reason: 'Already confirmed' }
  const rule = rules.find((r) => r.employee_type_code === employee.typeCode)
  if (!rule || !rule.enabled) return { state: 'not_eligible', reason: 'No confirmation rule for this type' }
  if (rule.trigger_basis === 'manual') return { state: 'not_eligible', reason: 'Started by hand for this type' }

  const baseValue = rule.trigger_basis === 'conversion_date' ? employee.conversionDate : employee.joiningDate
  const base = parseDate(baseValue)
  if (!base) return { state: 'not_eligible', reason: 'No start date' }

  const due = startOfDayUtc(addOffset(base, rule.offset_value, rule.offset_unit))
  const today = startOfDayUtc(now)
  const opens = new Date(due.getTime() - leadDays * DAY)

  if (today < opens) return { state: 'upcoming', dueDate: isoDate(due), opensOn: isoDate(opens) }
  if (today.getTime() - due.getTime() > MAX_OVERDUE_DAYS * DAY) {
    return { state: 'overdue_manual', dueDate: isoDate(due) }
  }
  return { state: 'open_now', dueDate: isoDate(due) }
}

export type AppraisalPeriod = {
  cycleName: string
  periodKey: string
  label: string
  /** First day of the cycle's month. */
  start: string
  /** When the batch's forms are due: the end of that month. */
  dueDate: string
  /** True while the daily job may still open this batch. */
  open: boolean
}

/**
 * The appraisal batches around `now`: this year's and next year's for each
 * active cycle. A batch opens `leadDays` before its month and stays open for
 * `APPRAISAL_OPEN_WINDOW_DAYS` after it starts.
 */
export function appraisalPeriods(cycles: AppraisalCycle[], now: Date, leadDays: number): AppraisalPeriod[] {
  const today = startOfDayUtc(now)
  const out: AppraisalPeriod[] = []
  for (const cycle of cycles) {
    if (!cycle.is_active) continue
    for (const year of [today.getUTCFullYear() - 1, today.getUTCFullYear(), today.getUTCFullYear() + 1]) {
      const start = new Date(Date.UTC(year, cycle.cycle_month - 1, 1))
      const due = new Date(Date.UTC(year, cycle.cycle_month, 0))
      const opensAt = start.getTime() - leadDays * DAY
      const closesAt = start.getTime() + APPRAISAL_OPEN_WINDOW_DAYS * DAY
      out.push({
        cycleName: cycle.name,
        periodKey: `appraisal:${cycle.name}-${year}`,
        label: `${cycle.display_name || cycle.name} ${year}`,
        start: isoDate(start),
        dueDate: isoDate(due),
        open: today.getTime() >= opensAt && today.getTime() < closesAt,
      })
    }
  }
  return out.sort((a, b) => a.start.localeCompare(b.start))
}

/**
 * True when the employee belongs in this appraisal batch: eligible by their
 * type's rule, their reference date has passed by the time the batch starts,
 * and that date falls in the batch's cohort months.
 */
export function inAppraisalBatch(
  employee: EmployeeForReview,
  rules: AppraisalRule[],
  cycles: AppraisalCycle[],
  period: AppraisalPeriod
): boolean {
  if (employee.status && employee.status !== 'active') return false
  if (!employee.joiningDate) return false
  const rule = rules.find((r) => r.employee_type_code === employee.typeCode)
  if (!rule || !rule.eligible) return false
  const reference = calculateAppraisalReferenceDate(rule, {
    joiningDate: employee.joiningDate,
    conversionDate: employee.conversionDate,
  })
  if (!reference) return false
  if (startOfDayUtc(reference) > new Date(`${period.start}T00:00:00Z`)) return false
  return getAppraisalCohortFromCycles(reference, cycles) === period.cycleName
}

// ----------------------------------------------------------------------------
// Reminders and escalation
// ----------------------------------------------------------------------------

type ReminderFields = Pick<ParticipantRow, 'status' | 'invited_at' | 'last_reminded_at' | 'reminder_count' | 'escalated_at'>

export type ReminderState =
  | { canRemind: true; nextAt: Date }
  | { canRemind: false; reason: 'answered' | 'not_invited' | 'cooling_down'; nextAt: Date | null; waitMs: number }

/**
 * Whether someone may be reminded now. The same clock governs the automatic
 * reminder, PnC's button and the employee's own button: one reminder per
 * `reminder_interval_hours`, counted from the last reminder or, before the
 * first one, from the invitation itself.
 */
export function reminderState(p: ReminderFields, now: Date, intervalHours: number): ReminderState {
  if (p.status === 'submitted' || p.status === 'cancelled') {
    return { canRemind: false, reason: 'answered', nextAt: null, waitMs: 0 }
  }
  if (p.status !== 'invited') return { canRemind: false, reason: 'not_invited', nextAt: null, waitMs: 0 }
  const base = parseDate(p.last_reminded_at) ?? parseDate(p.invited_at)
  if (!base) return { canRemind: true, nextAt: now }
  const nextAt = new Date(base.getTime() + intervalHours * HOUR)
  if (now >= nextAt) return { canRemind: true, nextAt }
  return { canRemind: false, reason: 'cooling_down', nextAt, waitMs: nextAt.getTime() - now.getTime() }
}

/** The daily job reminds until the escalation count is reached, then stops. */
export function dueForAutoReminder(p: ReminderFields, now: Date, settings: Pick<ReviewCycleSettings, 'reminder_interval_hours' | 'reminders_before_escalation'>): boolean {
  if (p.escalated_at) return false
  if (p.reminder_count >= settings.reminders_before_escalation) return false
  return reminderState(p, now, settings.reminder_interval_hours).canRemind
}

/**
 * PnC is told once, one interval after the last automatic reminder went
 * unanswered.
 */
export function dueForEscalation(p: ReminderFields, now: Date, settings: Pick<ReviewCycleSettings, 'reminder_interval_hours' | 'reminders_before_escalation'>): boolean {
  if (p.status !== 'invited' || p.escalated_at) return false
  if (p.reminder_count < settings.reminders_before_escalation) return false
  return reminderState(p, now, settings.reminder_interval_hours).canRemind
}

/** "5h 12m", "45m", "under a minute". */
export function waitLabel(ms: number): string {
  if (ms <= 0) return 'now'
  const minutes = Math.ceil(ms / 60000)
  if (minutes < 1) return 'under a minute'
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h === 0) return `${m}m`
  return m === 0 ? `${h}h` : `${h}h ${m}m`
}

// ----------------------------------------------------------------------------
// Readiness
// ----------------------------------------------------------------------------

export type Readiness = {
  selfDone: boolean
  managerDone: boolean
  peersAsked: number
  peersDone: number
  peersNeeded: number
  ready: boolean
}

/**
 * Enough is in for the meeting: the employee's own review, the manager's, and
 * at least `ratio` of the peers who were asked. Peers merely nominated (not
 * yet sent their form) and cancelled requests do not count either way.
 */
export function readiness(participants: Pick<ParticipantRow, 'role' | 'status'>[], ratio: number): Readiness {
  const live = participants.filter((p) => p.status !== 'cancelled')
  const selfDone = live.some((p) => p.role === 'self' && p.status === 'submitted')
  const managerDone = live.some((p) => p.role === 'manager' && p.status === 'submitted')
  const peers = live.filter((p) => p.role === 'peer' && p.status !== 'nominated')
  const peersDone = peers.filter((p) => p.status === 'submitted').length
  const peersNeeded = Math.ceil(peers.length * Math.min(Math.max(ratio, 0), 1))
  return {
    selfDone,
    managerDone,
    peersAsked: peers.length,
    peersDone,
    peersNeeded,
    ready: selfDone && managerDone && peersDone >= peersNeeded,
  }
}

// ----------------------------------------------------------------------------
// Nominations
// ----------------------------------------------------------------------------

/**
 * Checks a set of nominated peers. Returns the problem, or null.
 *
 * Nobody may review themselves, and the manager already has their own form,
 * so neither may be nominated as a peer.
 */
export function nominationProblem(
  peerIds: string[],
  opts: { subjectId: string; managerId: string | null; min: number; max: number; activeIds: Set<string> }
): string | null {
  const unique = new Set(peerIds)
  if (unique.size !== peerIds.length) return 'Each colleague can be nominated once.'
  if (unique.has(opts.subjectId)) return 'You cannot nominate yourself.'
  if (opts.managerId && unique.has(opts.managerId)) return 'Your manager reviews you separately; nominate someone else.'
  for (const id of unique) if (!opts.activeIds.has(id)) return 'Choose active colleagues from the list.'
  if (unique.size < opts.min) return `Nominate at least ${opts.min} ${opts.min === 1 ? 'colleague' : 'colleagues'}.`
  if (unique.size > opts.max) return `Nominate at most ${opts.max} colleagues.`
  return null
}

// ----------------------------------------------------------------------------
// The meeting
// ----------------------------------------------------------------------------

/** India Standard Time, which has no daylight saving. */
const IST_OFFSET_MINUTES = 330
const WORK_START_MINUTES = 10 * 60
const WORK_END_MINUTES = 17 * 60
const SLOT_STEP_MINUTES = 30
const SEARCH_WORKING_DAYS = 15

export type Busy = { start: string; end: string }

function istParts(d: Date): { y: number; m: number; day: number; dow: number } {
  const shifted = new Date(d.getTime() + IST_OFFSET_MINUTES * 60000)
  return { y: shifted.getUTCFullYear(), m: shifted.getUTCMonth(), day: shifted.getUTCDate(), dow: shifted.getUTCDay() }
}

function istAt(y: number, m: number, day: number, minutes: number): Date {
  return new Date(Date.UTC(y, m, day) + (minutes - IST_OFFSET_MINUTES) * 60000)
}

/**
 * The first free slot, in working hours (10:00–17:00 IST, Monday to Friday),
 * at least `leadWorkingDays` working days after `from`, that overlaps none of
 * the busy blocks. Null if nothing is free in the next three weeks.
 */
export function pickMeetingSlot(opts: {
  from: Date
  leadWorkingDays: number
  durationMinutes: number
  busy: Busy[]
}): { start: Date; end: Date } | null {
  const busy = opts.busy
    .map((b) => ({ start: new Date(b.start).getTime(), end: new Date(b.end).getTime() }))
    .filter((b) => Number.isFinite(b.start) && Number.isFinite(b.end))

  let { y, m, day } = istParts(opts.from)
  let workingDaysSkipped = 0
  let searched = 0
  // Walk forward a day at a time in IST.
  for (let i = 0; i < 60 && searched < SEARCH_WORKING_DAYS; i++) {
    const midnight = istAt(y, m, day, 0)
    const dow = istParts(new Date(midnight.getTime() + 60000)).dow
    const isWorkday = dow !== 0 && dow !== 6
    if (isWorkday && i > 0) workingDaysSkipped++
    if (isWorkday && workingDaysSkipped >= opts.leadWorkingDays) {
      searched++
      for (let t = WORK_START_MINUTES; t + opts.durationMinutes <= WORK_END_MINUTES; t += SLOT_STEP_MINUTES) {
        const start = istAt(y, m, day, t)
        const end = new Date(start.getTime() + opts.durationMinutes * 60000)
        if (start.getTime() <= opts.from.getTime()) continue
        const clash = busy.some((b) => start.getTime() < b.end && end.getTime() > b.start)
        if (!clash) return { start, end }
      }
    }
    const next = new Date(Date.UTC(y, m, day + 1))
    y = next.getUTCFullYear()
    m = next.getUTCMonth()
    day = next.getUTCDate()
  }
  return null
}

// ----------------------------------------------------------------------------
// Calendar invite
// ----------------------------------------------------------------------------

function icsDate(d: Date): string {
  return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
}

function icsText(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n')
}

/** Lines longer than 75 octets are folded, as RFC 5545 requires. */
function fold(line: string): string {
  if (line.length <= 74) return line
  const parts: string[] = []
  let rest = line
  parts.push(rest.slice(0, 74))
  rest = rest.slice(74)
  while (rest.length > 0) {
    parts.push(' ' + rest.slice(0, 73))
    rest = rest.slice(73)
  }
  return parts.join('\r\n')
}

/**
 * An iCalendar REQUEST, which Gmail and Outlook show as an invitation with
 * Yes / No / Maybe. Re-sending the same `uid` with a higher `sequence` moves
 * the meeting rather than adding a second one.
 */
export function buildIcs(opts: {
  uid: string
  sequence: number
  start: Date
  end: Date
  summary: string
  description: string
  organizer: { name: string; email: string }
  attendees: { name: string; email: string }[]
  now: Date
}): string {
  const lines = [
    'BEGIN:VCALENDAR',
    'PRODID:-//NavGurukul//ELC Reviews//EN',
    'VERSION:2.0',
    'CALSCALE:GREGORIAN',
    'METHOD:REQUEST',
    'BEGIN:VEVENT',
    `UID:${opts.uid}`,
    `SEQUENCE:${opts.sequence}`,
    `DTSTAMP:${icsDate(opts.now)}`,
    `DTSTART:${icsDate(opts.start)}`,
    `DTEND:${icsDate(opts.end)}`,
    `SUMMARY:${icsText(opts.summary)}`,
    `DESCRIPTION:${icsText(opts.description)}`,
    `ORGANIZER;CN=${icsText(opts.organizer.name)}:mailto:${opts.organizer.email}`,
    ...opts.attendees.map(
      (a) => `ATTENDEE;CN=${icsText(a.name)};ROLE=REQ-PARTICIPANT;PARTSTAT=NEEDS-ACTION;RSVP=TRUE:mailto:${a.email}`
    ),
    'STATUS:CONFIRMED',
    'TRANSP:OPAQUE',
    'END:VEVENT',
    'END:VCALENDAR',
  ]
  return lines.map(fold).join('\r\n') + '\r\n'
}
