import { describe, it, expect } from 'vitest'
import { dueAt, escalationAt, deadlineState, periodDays, daysLeft } from './deadlines'
import { erasureAnswer, latestRetainUntil, retainedForErasure } from './erasure'
import { acknowledgmentEmail, answerEmail, contactBlock, escalationEmail } from './emails'
import type { PrivacyRequestRow } from './types'

const periods = { grievance_days: 30, access_days: 30, correction_days: 15, erasure_days: 30, nomination_days: 15 }
const received = new Date('2026-11-01T00:00:00Z')

describe('request deadlines', () => {
  it('takes each type\'s period from the settings', () => {
    expect(periodDays('access', periods)).toBe(30)
    expect(periodDays('completion', periods)).toBe(15)
    expect(periodDays('updating', periods)).toBe(15)
    expect(periodDays('nomination', periods)).toBe(15)
    expect(dueAt('correction', received, periods).toISOString()).toBe('2026-11-16T00:00:00.000Z')
  })

  it('never sets a due date beyond 90 days', () => {
    expect(dueAt('grievance', received, { ...periods, grievance_days: 400 }).toISOString()).toBe('2027-01-30T00:00:00.000Z')
  })

  it('escalates at 80% of the period, and is overdue after it', () => {
    const due = dueAt('access', received, periods)
    expect(escalationAt(received, due).toISOString()).toBe('2026-11-25T00:00:00.000Z')
    const row = { received_at: received.toISOString(), due_at: due.toISOString(), status: 'in_progress' }
    expect(deadlineState(row, new Date('2026-11-10T00:00:00Z'))).toBe('on_track')
    expect(deadlineState(row, new Date('2026-11-26T00:00:00Z'))).toBe('escalate')
    expect(deadlineState(row, new Date('2026-12-02T00:00:00Z'))).toBe('overdue')
    expect(deadlineState({ ...row, status: 'answered' }, new Date('2026-12-02T00:00:00Z'))).toBe('closed')
    expect(daysLeft(due.toISOString(), new Date('2026-11-28T00:00:00Z'))).toBe(3)
  })
})

describe('erasure answers', () => {
  const rules = [
    { id: 'statutory_registers', label: 'Wage, attendance and employee registers', period_days: 1825, statutory_ref: 'Code on Wages (Central) Rules 2026, r. 51(4)', floor_days: 1825 },
    { id: 'payroll_tax', label: 'Payroll, TDS and Form 16', period_days: 2920, statutory_ref: 'Income-tax Rules 2026, r. 187(5)', floor_days: 2190 },
    { id: 'letters', label: 'Letters', period_days: 2920, statutory_ref: 'DPDP Act s. 17(1)(a)', floor_days: 0 },
  ]
  const today = new Date('2026-11-07T00:00:00Z')

  it('names the statute and date for what a former employee\'s records must be kept for', () => {
    const items = retainedForErasure('former_employee', rules, { exitDate: '2026-06-30' }, today)
    expect(items.map((i) => i.ruleId)).toEqual(['statutory_registers', 'payroll_tax', 'letters'])
    expect(items[0].retainUntil).toBe('2031-06-29')
    // Tax runs from the end of the financial year of exit (31 March 2027).
    expect(items[1].retainUntil).toBe('2035-03-29')
    expect(latestRetainUntil(items)).toBe('2035-03-29')
    const text = erasureAnswer(items, '2026-12-01')
    expect(text).toContain('Code on Wages (Central) Rules 2026, r. 51(4)')
    expect(text).toContain('until 2031-06-29')
  })

  it('keeps a candidate\'s processing logs for the 1-year floor only', () => {
    const items = retainedForErasure('candidate', rules, { lastProcessedAt: '2026-11-01T00:00:00Z' }, today)
    expect(items).toHaveLength(1)
    expect(items[0].retainUntil).toBe('2027-11-01')
    expect(items[0].statutory_ref).toMatch(/r\. 8\(3\)/)
  })

  it('says plainly when nothing has to be kept', () => {
    expect(erasureAnswer([], '2026-12-01')).toMatch(/No law requires us to keep it/)
  })
})

describe('request emails', () => {
  const ctx = { contact: { name: 'Priya Example', role: 'Privacy & Grievance Officer', email: 'privacy@example.com', phone: '' }, grievanceDays: 30, boardUrl: 'https://example.com/board' }
  const row = {
    id: 'r1', reference: 'PR-00007', request_type: 'erasure', received_at: '2026-11-01T00:00:00Z', due_at: '2026-12-01T00:00:00Z',
    answer: 'We have erased <b>what we can</b>.', statute_cited: 'Income-tax Rules 2026, r. 187(5)', retain_until: '2035-03-29',
  } as unknown as PrivacyRequestRow

  it('carries the privacy contact and the Board route in every message', () => {
    for (const mail of [acknowledgmentEmail(row, ctx), answerEmail(row, ctx)]) {
      expect(mail.body).toContain('privacy@example.com')
      expect(mail.body).toContain('Data Protection Board')
      expect(mail.body).toContain('30 days')
    }
    expect(contactBlock({ ...ctx, contact: { name: '', role: '', email: '', phone: '' } })).toContain('People &amp; Culture')
  })

  it('names the statute in an erasure answer, and escapes what was typed', () => {
    const mail = answerEmail(row, ctx)
    expect(mail.body).toContain('Income-tax Rules 2026, r. 187(5)')
    expect(mail.body).not.toContain('<b>')
  })

  it('tells the escalation contact the reference and due date only', () => {
    const mail = escalationEmail(row, 'https://app.example.com')
    expect(mail.body).toContain('PR-00007')
    expect(mail.body).not.toContain('erased')
  })
})
