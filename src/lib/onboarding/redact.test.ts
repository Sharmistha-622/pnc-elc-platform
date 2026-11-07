import { describe, it, expect } from 'vitest'
import { redactSalary, redactRecordSalary, redactPortalToken, withoutPortalToken } from './redact'
import type { FullOnboardingData } from './types'

const full = {
  record: { id: 'r1', candidate_name: 'A Candidate', invitation_token: 'portal-token-r1', ctc: '₹60,000 / month', ctc_amount: 60000, ctc_frequency: 'monthly' },
  employmentDetails: { id: 'e1', ctc: '₹60,000 / month', ctc_amount: 60000, designation: 'Associate' },
  documents: [],
  policies: [],
  generatedDocuments: [
    { id: 'g1', document_type: 'offer_letter', status: 'signed', content: '<p>CTC ₹60,000</p>', generated_content: { ctc: 60000 } },
  ],
  activityLogs: [],
  provisioning: null,
  salaryStructure: { ctc_monthly: 60000, ctc_annual: 720000 },
} as unknown as FullOnboardingData

describe('redactSalary', () => {
  const out = redactSalary(full)
  const json = JSON.stringify(out)

  it('leaves no salary figure anywhere in the payload', () => {
    expect(json).not.toContain('60000')
    expect(json).not.toContain('60,000')
    expect(json).not.toContain('720000')
  })

  it('keeps what a reviewer without salary access needs', () => {
    expect(out.record.candidate_name).toBe('A Candidate')
    expect(out.employmentDetails?.designation).toBe('Associate')
    expect(out.generatedDocuments[0]).toMatchObject({ document_type: 'offer_letter', status: 'signed' })
  })

  it('does not mutate the original', () => {
    expect(full.record.ctc_amount).toBe(60000)
  })
})

describe('redactRecordSalary', () => {
  it('strips the figure from a list row', () => {
    expect(redactRecordSalary(full.record)).not.toHaveProperty('ctc_amount')
  })
})

describe('withoutPortalToken', () => {
  it('drops the invitation token and keeps the rest', () => {
    const row = { id: 'r1', candidate_name: 'A Candidate', invitation_token: 'secret-token' }
    const out = withoutPortalToken(row)
    expect(out).toEqual({ id: 'r1', candidate_name: 'A Candidate' })
    expect(row.invitation_token).toBe('secret-token')
  })
})

describe('redactPortalToken', () => {
  it('leaves no token in a full record, for any caller', () => {
    const out = redactPortalToken(full)
    expect(JSON.stringify(out)).not.toContain(full.record.invitation_token)
    expect(out.record.id).toBe(full.record.id)
  })
})
