import { describe, it, expect } from 'vitest'
import * as R from './runtime'
import type { ComplianceSnapshot } from './runtime'
import { RETENTION_RULE_IDS } from '../types'

const today = new Date('2026-11-07T10:00:00Z')

/** A snapshot where everything holds. Each test breaks one thing. */
function good(): ComplianceSnapshot {
  const notices = ['candidate', 'employee', 'contractor_volunteer'].flatMap((type) =>
    ['en', 'hi'].map((language) => ({ type, language, version: 1, checklistOk: true })),
  )
  const breach = ['breach_individual', 'breach_board', 'breach_certin'].map((type) => ({ type, language: 'en', version: 1, checklistOk: true }))
  return {
    settings: { contactSet: true, grievanceDays: 30, languages: ['en', 'hi'], driveTypes: ['resume'] },
    notices: [...notices, ...breach],
    ruleIds: [...RETENTION_RULE_IDS],
    rulesWithoutPeriod: [],
    lastRetentionRunAt: '2026-11-07T02:00:00Z',
    requests: { open: 2, overdue: 0, pastEscalationNotEscalated: 0 },
    candidatesWithoutAck: 0,
    withdrawnDocumentsPastDeadline: 0,
    minorsWithoutGuardianConsent: 0,
    processors: { active: 5, missingDpa: 0, missingRegion: 0, reviewOverdue: 0, reviewMissing: 0 },
    attestations: [{ code: 'repository_visibility', confirmedAt: '2026-11-01T00:00:00Z', nextReviewAt: '2027-01-30' }],
    exposed: { identity: 0, feedback: 0, formAnswer: 0, decisionNote: 0 },
    incidents: { open: 0, deadlineMissed: 0 },
    auditDescriptionsWithValues: 0,
    coreSalaryValues: null,
    coreBankProofs: 0,
  }
}

const cases: { name: string; check: (s: ComplianceSnapshot, d: Date) => { status: string }; breakIt: (s: ComplianceSnapshot) => void; expected?: string }[] = [
  { name: 'DPDP-03 Drive list', check: R.driveListClean, breakIt: (s) => { s.settings!.driveTypes = ['aadhaar'] } },
  { name: 'DPDP-10 notices published', check: R.noticesPublished, breakIt: (s) => { s.notices = s.notices.filter((n) => n.type !== 'employee') } },
  { name: 'DPDP-10 Rule 3 elements', check: R.noticesPublished, breakIt: (s) => { s.notices[0].checklistOk = false } },
  { name: 'DPDP-11 Hindi', check: R.noticesInHindi, breakIt: (s) => { s.notices = s.notices.filter((n) => n.language !== 'hi') } },
  { name: 'DPDP-12 acknowledgments', check: R.candidatesAcknowledged, breakIt: (s) => { s.candidatesWithoutAck = 3 }, expected: 'warn' },
  { name: 'DPDP-15 contact', check: R.contactSet, breakIt: (s) => { s.settings!.contactSet = false } },
  { name: 'DPDP-16 grievance', check: R.grievancePublished, breakIt: (s) => { s.settings!.grievanceDays = 120 } },
  { name: 'DPDP-21 overdue requests', check: R.requestsOnTime, breakIt: (s) => { s.requests!.overdue = 1 } },
  { name: 'DPDP-21 escalation', check: R.requestsOnTime, breakIt: (s) => { s.requests!.pastEscalationNotEscalated = 1 }, expected: 'warn' },
  { name: 'DPDP-22 rules', check: R.categoriesHaveRules, breakIt: (s) => { s.ruleIds = s.ruleIds.filter((r) => r !== 'payroll_tax') } },
  { name: 'DPDP-22 periods', check: R.categoriesHaveRules, breakIt: (s) => { s.rulesWithoutPeriod = ['letters'] } },
  { name: 'DPDP-23 recent run', check: R.retentionRanRecently, breakIt: (s) => { s.lastRetentionRunAt = '2026-11-05T00:00:00Z' } },
  { name: 'DPDP-23 never run', check: R.retentionRanRecently, breakIt: (s) => { s.lastRetentionRunAt = null } },
  { name: 'DPDP-26 withdrawn purge', check: R.withdrawnPurged, breakIt: (s) => { s.withdrawnDocumentsPastDeadline = 2 } },
  { name: 'DPDP-28 breach templates', check: R.breachTemplatesReady, breakIt: (s) => { s.notices = s.notices.filter((n) => n.type !== 'breach_certin') } },
  { name: 'DPDP-30 minors', check: R.minorsHeld, breakIt: (s) => { s.minorsWithoutGuardianConsent = 1 } },
  { name: 'DPDP-31 DPA', check: R.processorsComplete, breakIt: (s) => { s.processors!.missingDpa = 1 } },
  { name: 'DPDP-31 review overdue', check: R.processorsComplete, breakIt: (s) => { s.processors!.reviewOverdue = 1 }, expected: 'warn' },
  { name: 'DPDP-32 bank proofs', check: R.noBankProofInCore, breakIt: (s) => { s.coreBankProofs = 4 } },
  { name: 'DPDP-33 salary in core', check: R.noSalaryInCore, breakIt: (s) => { s.coreSalaryValues = 9 } },
  { name: 'DPDP-34 feedback sealing', check: R.feedbackSealed, breakIt: (s) => { s.exposed!.feedback = 1 } },
  { name: 'DPDP-35 answers sealing', check: R.answersSealed, breakIt: (s) => { s.exposed!.decisionNote = 1 } },
  { name: 'DPDP-36 budgets', check: R.nothingOverBudget, breakIt: (s) => { s.exposed!.identity = 1 } },
  { name: 'DPDP-41 audit rows', check: R.auditRowsClean, breakIt: (s) => { s.auditDescriptionsWithValues = 5 }, expected: 'warn' },
  { name: 'DPDP-44 settings readable', check: R.optionalFieldSettings, breakIt: (s) => { s.settings = null } },
]

describe('runtime checks', () => {
  for (const c of cases) {
    it(`${c.name}: passes`, () => expect(c.check(good(), today).status).toBe('pass'))
    it(`${c.name}: ${c.expected ?? 'fail'}s when broken`, () => {
      const s = good()
      c.breakIt(s)
      expect(c.check(s, today).status).toBe(c.expected ?? 'fail')
    })
  }

  it('reports an unreadable source as red with a neutral reason', () => {
    const s = good()
    s.requests = null
    const outcome = R.requestsOnTime(s, today)
    expect(outcome.status).toBe('fail')
    expect(outcome.detail).toMatch(/could not be read/)
  })
})

describe('attestationOutcome', () => {
  const rows = [
    { code: 'a', confirmedAt: '2026-10-01T00:00:00Z', nextReviewAt: '2026-12-30' },
    { code: 'b', confirmedAt: '2026-07-01T00:00:00Z', nextReviewAt: '2026-09-29' },
    { code: 'c', confirmedAt: null, nextReviewAt: null },
  ]
  it('passes when every attestation is confirmed and current', () => expect(R.attestationOutcome(['a'], rows, today).status).toBe('pass'))
  it('is amber when one is due for review', () => expect(R.attestationOutcome(['a', 'b'], rows, today).status).toBe('warn'))
  it('is red when one was never confirmed', () => expect(R.attestationOutcome(['a', 'c'], rows, today).status).toBe('fail'))
  it('is red for an attestation not in the table', () => expect(R.attestationOutcome(['zzz'], rows, today).status).toBe('fail'))
})
