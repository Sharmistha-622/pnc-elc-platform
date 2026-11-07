import { describe, it, expect } from 'vitest'
import { planRetention, logCutoff, summarise, isHeld, type RetentionCandidate, type PlannerRule, type LegalHold } from './planner'

const today = new Date('2026-11-07T00:00:00Z')
const rules: PlannerRule[] = [
  { id: 'withdrawn_joiner_documents', period_days: 90, consent_period_days: null, action: 'delete' },
  { id: 'rejected_candidates', period_days: 183, consent_period_days: 365, action: 'delete' },
  { id: 'statutory_registers', period_days: 1825, consent_period_days: null, action: 'anonymise' },
  { id: 'posh_case_files', period_days: null, consent_period_days: null, action: 'report_only' },
  { id: 'letters', period_days: 0, consent_period_days: null, action: 'report_only' },
]
const doc = (over: Partial<RetentionCandidate> = {}): RetentionCandidate => ({
  kind: 'withdrawn_documents',
  id: 'd1',
  ruleId: 'withdrawn_joiner_documents',
  clockStart: '2025-01-01T00:00:00Z',
  processedAt: '2024-12-01T00:00:00Z',
  subject: { type: 'candidate', ref: 'c1' },
  ...over,
})

describe('planRetention', () => {
  it('deletes a record whose period and floor have both passed', () => {
    const [p] = planRetention([doc()], rules, [], today)
    expect(p.outcome).toBe('delete')
    expect(p.reason).toBe('due')
  })

  it('never deletes below the 1-year floor, even when the rule\'s period has passed', () => {
    // Withdrawn 100 days ago (past the 90-day period) but processed only 120 days ago.
    const [p] = planRetention([doc({ clockStart: '2026-07-30T00:00:00Z', processedAt: '2026-07-10T00:00:00Z' })], rules, [], today)
    expect(p.outcome).toBe('keep')
    expect(p.reason).toBe('floor')
    expect(p.dueOn).toBe('2027-07-10')
  })

  it('keeps a record whose period has not run', () => {
    const [p] = planRetention([doc({ clockStart: '2026-10-01T00:00:00Z', processedAt: '2024-01-01T00:00:00Z' })], rules, [], today)
    expect(p.reason).toBe('not_due')
  })

  it('skips a record under a legal hold on its person', () => {
    const holds: LegalHold[] = [{ subject_type: 'candidate', subject_ref: 'c1', record_table: null, record_id: null, released_at: null }]
    const [p] = planRetention([doc()], rules, holds, today)
    expect(p.outcome).toBe('keep')
    expect(p.reason).toBe('hold')
  })

  it('skips a record under a legal hold on the record itself, and resumes once released', () => {
    const c = doc({ record: { table: 'onboarding_documents', id: 'd1' } })
    const active: LegalHold = { subject_type: 'record', subject_ref: null, record_table: 'onboarding_documents', record_id: 'd1', released_at: null }
    expect(planRetention([c], rules, [active], today)[0].reason).toBe('hold')
    expect(planRetention([c], rules, [{ ...active, released_at: '2026-11-01T00:00:00Z' }], today)[0].reason).toBe('due')
    expect(isHeld(c, [active])).toBe(true)
  })

  it('uses the longer period when the person consented to it', () => {
    const rejected = doc({ ruleId: 'rejected_candidates', clockStart: '2025-06-01T00:00:00Z', processedAt: '2025-05-01T00:00:00Z' })
    expect(planRetention([rejected], rules, [], today)[0].outcome).toBe('delete')
    const withConsent = { ...rejected, consentExtended: true, clockStart: '2026-01-01T00:00:00Z', processedAt: '2025-05-01T00:00:00Z' }
    expect(planRetention([withConsent], rules, [], today)[0].reason).toBe('not_due')
  })

  it('anonymises where the rule says so, and only reports a report-only rule', () => {
    const register = doc({ ruleId: 'statutory_registers', clockStart: '2020-01-01T00:00:00Z', processedAt: '2019-01-01T00:00:00Z' })
    expect(planRetention([register], rules, [], today)[0].outcome).toBe('anonymise')
    const letter = doc({ ruleId: 'letters', clockStart: '2020-01-01T00:00:00Z', processedAt: '2019-01-01T00:00:00Z' })
    expect(planRetention([letter], rules, [], today)[0].outcome).toBe('report')
  })

  it('keeps a record whose rule has no period yet (counsel decides)', () => {
    expect(planRetention([doc({ ruleId: 'posh_case_files' })], rules, [], today)[0].reason).toBe('no_period')
  })

  it('keeps a record whose clock has not started (still employed)', () => {
    expect(planRetention([doc({ clockStart: null })], rules, [], today)[0].reason).toBe('no_clock')
  })

  it('summarises counts per rule', () => {
    const plan = planRetention([doc(), doc({ id: 'd2', clockStart: '2026-10-01T00:00:00Z' })], rules, [], today)
    expect(summarise(plan).withdrawn_joiner_documents).toMatchObject({ due: 1, not_due: 1 })
  })
})

describe('logCutoff', () => {
  it('purges logs past their period', () => {
    expect(logCutoff(730, today)?.toISOString().slice(0, 10)).toBe('2024-11-07')
  })

  it('never cuts later than one year ago (the floor)', () => {
    expect(logCutoff(30, today)?.toISOString().slice(0, 10)).toBe('2025-11-07')
  })

  it('purges nothing when the rule has no period', () => {
    expect(logCutoff(null, today)).toBeNull()
  })
})
