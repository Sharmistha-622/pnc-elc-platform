import { describe, it, expect } from 'vitest'
import {
  appraisalPeriods,
  buildIcs,
  confirmationDue,
  dueForAutoReminder,
  dueForEscalation,
  inAppraisalBatch,
  nominationProblem,
  pickMeetingSlot,
  readiness,
  reminderState,
  waitLabel,
  type EmployeeForReview,
} from './engine'
import { DEFAULT_APPRAISAL_CYCLES, DEFAULT_APPRAISAL_RULES, DEFAULT_CONFIRMATION_RULES } from '@/lib/settings/types'

const employee = (over: Partial<EmployeeForReview> = {}): EmployeeForReview => ({
  id: 'e1',
  name: 'Asha Example',
  email: 'asha@example.com',
  typeCode: 'fte',
  status: 'active',
  joiningDate: '2026-07-20',
  conversionDate: null,
  confirmationDate: null,
  managerId: 'm1',
  ...over,
})

describe('confirmationDue', () => {
  // FTE: 3 months from joining. Joined 20 Jul → due 20 Oct.
  it('is upcoming until the lead window opens', () => {
    const r = confirmationDue(employee(), DEFAULT_CONFIRMATION_RULES, new Date('2026-10-12T09:00:00Z'), 7)
    expect(r).toEqual({ state: 'upcoming', dueDate: '2026-10-20', opensOn: '2026-10-13' })
  })

  it('opens inside the lead window and on the due date', () => {
    expect(confirmationDue(employee(), DEFAULT_CONFIRMATION_RULES, new Date('2026-10-13T00:00:00Z'), 7).state).toBe('open_now')
    expect(confirmationDue(employee(), DEFAULT_CONFIRMATION_RULES, new Date('2026-10-20T18:00:00Z'), 7).state).toBe('open_now')
  })

  it('still opens up to 30 days late, then leaves it to PnC', () => {
    expect(confirmationDue(employee(), DEFAULT_CONFIRMATION_RULES, new Date('2026-11-19T00:00:00Z'), 7).state).toBe('open_now')
    expect(confirmationDue(employee(), DEFAULT_CONFIRMATION_RULES, new Date('2026-11-20T00:00:01Z'), 7).state).toBe('overdue_manual')
  })

  it('skips the confirmed, the exited, manual types and types with no rule', () => {
    const now = new Date('2026-10-20T00:00:00Z')
    expect(confirmationDue(employee({ confirmationDate: '2026-10-01' }), DEFAULT_CONFIRMATION_RULES, now, 7).state).toBe('not_eligible')
    expect(confirmationDue(employee({ status: 'exited' }), DEFAULT_CONFIRMATION_RULES, now, 7).state).toBe('not_eligible')
    expect(confirmationDue(employee({ typeCode: 'contractor' }), DEFAULT_CONFIRMATION_RULES, now, 7).state).toBe('not_eligible')
    expect(confirmationDue(employee({ typeCode: 'unknown' }), DEFAULT_CONFIRMATION_RULES, now, 7).state).toBe('not_eligible')
  })

  it('uses each type’s own offset (apprentice tech: 2 months)', () => {
    const r = confirmationDue(employee({ typeCode: 'apprentice_tech' }), DEFAULT_CONFIRMATION_RULES, new Date('2026-09-15T00:00:00Z'), 7)
    expect(r).toEqual({ state: 'open_now', dueDate: '2026-09-20' })
  })
})

describe('appraisal batches', () => {
  it('opens a batch 14 days before its month and closes it 45 days after', () => {
    const at = (iso: string) =>
      appraisalPeriods(DEFAULT_APPRAISAL_CYCLES, new Date(iso), 14).find((p) => p.periodKey === 'appraisal:december-2026')!
    expect(at('2026-11-16T00:00:00Z').open).toBe(false)
    expect(at('2026-11-17T00:00:00Z').open).toBe(true)
    expect(at('2027-01-14T00:00:00Z').open).toBe(true)
    expect(at('2027-01-15T00:00:00Z').open).toBe(false)
    expect(at('2026-11-17T00:00:00Z')).toMatchObject({ start: '2026-12-01', dueDate: '2026-12-31', label: 'December Cycle 2026' })
  })

  it('puts an FTE in the batch of their reference month once it has passed', () => {
    const december = appraisalPeriods(DEFAULT_APPRAISAL_CYCLES, new Date('2026-11-20T00:00:00Z'), 14).find(
      (p) => p.periodKey === 'appraisal:december-2026'
    )!
    const july = appraisalPeriods(DEFAULT_APPRAISAL_CYCLES, new Date('2026-06-20T00:00:00Z'), 14).find(
      (p) => p.periodKey === 'appraisal:july-2026'
    )!
    // Joined Jan 2026 → reference Jul 2026 (Apr–Sep → July batch). Too late
    // for July 2026 (reference after the 1st), in time for July 2027 only.
    const joinedJan = employee({ joiningDate: '2026-01-10' })
    expect(inAppraisalBatch(joinedJan, DEFAULT_APPRAISAL_RULES, DEFAULT_APPRAISAL_CYCLES, july)).toBe(false)
    expect(inAppraisalBatch(joinedJan, DEFAULT_APPRAISAL_RULES, DEFAULT_APPRAISAL_CYCLES, december)).toBe(false)
    // Joined Apr 2025 → reference Oct 2025 → December batch.
    const joinedApr = employee({ joiningDate: '2025-04-01' })
    expect(inAppraisalBatch(joinedApr, DEFAULT_APPRAISAL_RULES, DEFAULT_APPRAISAL_CYCLES, december)).toBe(true)
    expect(inAppraisalBatch(joinedApr, DEFAULT_APPRAISAL_RULES, DEFAULT_APPRAISAL_CYCLES, july)).toBe(false)
  })

  it('leaves out ineligible types and interns who have not converted', () => {
    const december = appraisalPeriods(DEFAULT_APPRAISAL_CYCLES, new Date('2026-11-20T00:00:00Z'), 14).find(
      (p) => p.periodKey === 'appraisal:december-2026'
    )!
    expect(inAppraisalBatch(employee({ typeCode: 'apprentice_tech', joiningDate: '2025-04-01' }), DEFAULT_APPRAISAL_RULES, DEFAULT_APPRAISAL_CYCLES, december)).toBe(false)
    expect(inAppraisalBatch(employee({ typeCode: 'intern', joiningDate: '2025-04-01' }), DEFAULT_APPRAISAL_RULES, DEFAULT_APPRAISAL_CYCLES, december)).toBe(false)
    expect(inAppraisalBatch(employee({ typeCode: 'intern', joiningDate: '2025-01-01', conversionDate: '2025-11-01' }), DEFAULT_APPRAISAL_RULES, DEFAULT_APPRAISAL_CYCLES, december)).toBe(true)
  })
})

describe('the 24-hour reminder clock', () => {
  const settings = { reminder_interval_hours: 24, reminders_before_escalation: 2 }
  const invited = {
    status: 'invited' as const,
    invited_at: '2026-10-26T09:00:00Z',
    last_reminded_at: null,
    reminder_count: 0,
    escalated_at: null,
  }

  it('waits 24 hours after the invitation before the first reminder', () => {
    const early = reminderState(invited, new Date('2026-10-27T03:00:00Z'), 24)
    expect(early).toMatchObject({ canRemind: false, reason: 'cooling_down' })
    expect(early.canRemind === false && waitLabel(early.waitMs)).toBe('6h')
    expect(reminderState(invited, new Date('2026-10-27T09:00:00Z'), 24).canRemind).toBe(true)
  })

  it('counts from the last reminder, manual or automatic', () => {
    const reminded = { ...invited, last_reminded_at: '2026-10-28T10:30:00Z', reminder_count: 1 }
    const r = reminderState(reminded, new Date('2026-10-28T15:00:00Z'), 24)
    expect(r.canRemind).toBe(false)
    expect(r.canRemind === false && waitLabel(r.waitMs)).toBe('19h 30m')
  })

  it('never reminds someone who answered or was only nominated', () => {
    const now = new Date('2026-11-30T00:00:00Z')
    expect(reminderState({ ...invited, status: 'submitted' }, now, 24)).toMatchObject({ canRemind: false, reason: 'answered' })
    expect(reminderState({ ...invited, status: 'nominated', invited_at: null }, now, 24)).toMatchObject({ canRemind: false, reason: 'not_invited' })
  })

  it('reminds twice, then escalates once, a day after the last reminder', () => {
    const second = { ...invited, reminder_count: 2, last_reminded_at: '2026-10-28T09:00:00Z' }
    expect(dueForAutoReminder(second, new Date('2026-10-30T09:00:00Z'), settings)).toBe(false)
    expect(dueForEscalation(second, new Date('2026-10-29T08:59:00Z'), settings)).toBe(false)
    expect(dueForEscalation(second, new Date('2026-10-29T09:00:00Z'), settings)).toBe(true)
    expect(dueForEscalation({ ...second, escalated_at: '2026-10-29T09:00:00Z' }, new Date('2026-11-05T09:00:00Z'), settings)).toBe(false)
  })
})

describe('readiness for the meeting', () => {
  const p = (role: 'self' | 'peer' | 'manager', status: 'nominated' | 'invited' | 'submitted' | 'cancelled') => ({ role, status })

  it('needs the self-review, the manager review and most peers', () => {
    const base = [p('self', 'submitted'), p('manager', 'submitted'), p('peer', 'submitted'), p('peer', 'submitted'), p('peer', 'submitted'), p('peer', 'invited'), p('peer', 'invited')]
    expect(readiness(base, 0.6)).toMatchObject({ peersAsked: 5, peersDone: 3, peersNeeded: 3, ready: true })
    expect(readiness(base.slice(0, 5).concat([p('peer', 'invited'), p('peer', 'invited'), p('peer', 'invited')]), 0.6).ready).toBe(false)
    expect(readiness([p('self', 'submitted'), p('manager', 'invited'), p('peer', 'submitted')], 0.6).ready).toBe(false)
    expect(readiness([p('self', 'invited'), p('manager', 'submitted'), p('peer', 'submitted')], 0.6).ready).toBe(false)
  })

  it('ignores nominated and cancelled peers', () => {
    const r = readiness([p('self', 'submitted'), p('manager', 'submitted'), p('peer', 'nominated'), p('peer', 'cancelled'), p('peer', 'submitted')], 1)
    expect(r).toMatchObject({ peersAsked: 1, peersDone: 1, ready: true })
  })
})

describe('nominations', () => {
  const opts = { subjectId: 's', managerId: 'm', min: 2, max: 3, activeIds: new Set(['a', 'b', 'c', 'd', 'm', 's']) }
  it('enforces the settings bounds and refuses self, manager, duplicates and strangers', () => {
    expect(nominationProblem(['a', 'b'], opts)).toBeNull()
    expect(nominationProblem(['a'], opts)).toMatch(/at least 2/)
    expect(nominationProblem(['a', 'b', 'c', 'd'], opts)).toMatch(/at most 3/)
    expect(nominationProblem(['a', 's'], opts)).toMatch(/yourself/)
    expect(nominationProblem(['a', 'm'], opts)).toMatch(/manager/)
    expect(nominationProblem(['a', 'a'], opts)).toMatch(/once/)
    expect(nominationProblem(['a', 'zz'], opts)).toMatch(/active colleagues/)
  })
})

describe('meeting slot', () => {
  it('takes the first free working-hours slot two working days out, in IST', () => {
    // Friday 30 Oct 2026, 16:00 IST. Two working days on: Tuesday 3 Nov.
    const slot = pickMeetingSlot({ from: new Date('2026-10-30T10:30:00Z'), leadWorkingDays: 2, durationMinutes: 30, busy: [] })
    expect(slot?.start.toISOString()).toBe('2026-11-03T04:30:00.000Z') // 10:00 IST
    expect(slot?.end.toISOString()).toBe('2026-11-03T05:00:00.000Z')
  })

  it('steps around busy blocks', () => {
    const slot = pickMeetingSlot({
      from: new Date('2026-10-30T10:30:00Z'),
      leadWorkingDays: 2,
      durationMinutes: 60,
      busy: [{ start: '2026-11-03T04:30:00Z', end: '2026-11-03T05:30:00Z' }],
    })
    expect(slot?.start.toISOString()).toBe('2026-11-03T05:30:00.000Z') // 11:00 IST
  })

  it('never books a weekend or after 17:00 IST', () => {
    const allDayTuesday = { start: '2026-11-03T04:30:00Z', end: '2026-11-03T11:30:00Z' }
    const slot = pickMeetingSlot({ from: new Date('2026-10-30T10:30:00Z'), leadWorkingDays: 2, durationMinutes: 30, busy: [allDayTuesday] })
    expect(slot?.start.toISOString()).toBe('2026-11-04T04:30:00.000Z')
  })
})

describe('calendar invite', () => {
  it('is a REQUEST with every attendee, escaped and folded', () => {
    const ics = buildIcs({
      uid: 'review-1@elc',
      sequence: 0,
      start: new Date('2026-11-03T04:30:00Z'),
      end: new Date('2026-11-03T05:00:00Z'),
      summary: 'Confirmation review: Asha, Example',
      description: 'Line one\nLine two; with a semicolon',
      organizer: { name: 'ELC', email: 'elc@example.com' },
      attendees: [
        { name: 'Asha', email: 'asha@example.com' },
        { name: 'Manager', email: 'manager@example.com' },
      ],
      now: new Date('2026-10-30T10:30:00Z'),
    })
    expect(ics).toContain('METHOD:REQUEST')
    expect(ics).toContain('DTSTART:20261103T043000Z')
    expect(ics).toContain('SUMMARY:Confirmation review: Asha\\, Example')
    expect(ics).toContain('DESCRIPTION:Line one\\nLine two\\; with a semicolon')
    expect(ics.match(/ATTENDEE/g)).toHaveLength(2)
    expect(ics.split('\r\n').every((line) => line.length <= 75)).toBe(true)
  })
})
