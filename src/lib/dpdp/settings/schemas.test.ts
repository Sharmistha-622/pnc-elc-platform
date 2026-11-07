import { describe, it, expect } from 'vitest'
import {
  contactSchema,
  periodsSchema,
  linksStagingSchema,
  dataCollectionSchema,
  retentionRuleSchema,
  retentionModeSchema,
  languagesSchema,
  noticeDraftSchema,
  purposeSchema,
} from './schemas'
import { DEFAULT_OPTIONAL_FIELDS } from '../optional-fields'

describe('DPDP settings validation', () => {
  it('caps the grievance period at 90 days', () => {
    const base = { grievance_days: 30, access_days: 30, correction_days: 15, erasure_days: 30, nomination_days: 15 }
    expect(periodsSchema.safeParse(base).success).toBe(true)
    expect(periodsSchema.safeParse({ ...base, grievance_days: 91 }).success).toBe(false)
    expect(periodsSchema.safeParse({ ...base, grievance_days: 0 }).success).toBe(false)
  })

  it('keeps links and sealing budgets inside their limits', () => {
    expect(linksStagingSchema.safeParse({ invitation_validity_days: 7, staging_budget_document_days: 14, staging_budget_feedback_days: 30 }).success).toBe(true)
    expect(linksStagingSchema.safeParse({ invitation_validity_days: 7, staging_budget_document_days: 15, staging_budget_feedback_days: 30 }).success).toBe(false)
    expect(linksStagingSchema.safeParse({ invitation_validity_days: 31, staging_budget_document_days: 14, staging_budget_feedback_days: 30 }).success).toBe(false)
  })

  it('accepts a blank contact but not a malformed one', () => {
    const blank = { contact_name: '', contact_role: '', contact_email: '', contact_phone: '', escalation_name: '', escalation_email: '', board_complaint_url: '', request_identifier: 'Work email' }
    expect(contactSchema.safeParse(blank).success).toBe(true)
    expect(contactSchema.safeParse({ ...blank, contact_email: 'not-an-email' }).success).toBe(false)
    expect(contactSchema.safeParse({ ...blank, contact_email: 'privacy@example.com' }).success).toBe(true)
    expect(contactSchema.safeParse({ ...blank, board_complaint_url: 'javascript:alert(1)' }).success).toBe(false)
  })

  it('never lets a retention period go below its floor', () => {
    const schema = retentionRuleSchema(1825)
    expect(schema.safeParse({ id: 'statutory_registers', period_days: 1825, consent_period_days: null, action: 'anonymise', reason: 'counsel advice' }).success).toBe(true)
    expect(schema.safeParse({ id: 'statutory_registers', period_days: 1000, consent_period_days: null, action: 'anonymise', reason: 'counsel advice' }).success).toBe(false)
  })

  it('keeps a blank period blank instead of turning it into zero days', () => {
    const parsed = retentionRuleSchema(0).parse({ id: 'posh_case_files', period_days: '', consent_period_days: null, action: 'report_only', reason: 'counsel decides' })
    expect(parsed.period_days).toBeNull()
    const fromNull = retentionRuleSchema(0).parse({ id: 'posh_case_files', period_days: null, consent_period_days: null, action: 'report_only', reason: 'counsel decides' })
    expect(fromNull.period_days).toBeNull()
  })

  it('requires a reason for retention changes and the mode switch', () => {
    expect(retentionRuleSchema(0).safeParse({ id: 'letters', period_days: 3000, consent_period_days: null, action: 'delete', reason: '' }).success).toBe(false)
    expect(retentionModeSchema.safeParse({ mode: 'live', reason: '' }).success).toBe(false)
    expect(retentionModeSchema.safeParse({ mode: 'live', reason: 'Counsel signed off on the schedule' }).success).toBe(true)
  })

  it('refuses identity and bank documents in the Drive list', () => {
    const ok = { optional_fields: DEFAULT_OPTIONAL_FIELDS, drive_copy_document_types: ['resume'] }
    expect(dataCollectionSchema.safeParse(ok).success).toBe(true)
    expect(dataCollectionSchema.safeParse({ ...ok, drive_copy_document_types: ['resume', 'aadhaar'] }).success).toBe(false)
    expect(dataCollectionSchema.safeParse({ ...ok, drive_copy_document_types: ['bank_proof'] }).success).toBe(false)
  })

  it('never requires a field that is not collected', () => {
    const fields = { ...DEFAULT_OPTIONAL_FIELDS, blood_group: { collect: false, required: true } }
    expect(dataCollectionSchema.safeParse({ optional_fields: fields, drive_copy_document_types: [] }).success).toBe(false)
  })

  it('always offers English', () => {
    expect(languagesSchema.safeParse({ notice_languages: ['en', 'hi'] }).success).toBe(true)
    expect(languagesSchema.safeParse({ notice_languages: ['hi'] }).success).toBe(false)
    expect(languagesSchema.safeParse({ notice_languages: ['en', 'xx'] }).success).toBe(false)
  })

  it('validates notice drafts and purposes', () => {
    expect(noticeDraftSchema.safeParse({ notice_type: 'employee', language: 'hi', title: 'Notice', sections: { data_items: 'x' } }).success).toBe(true)
    expect(noticeDraftSchema.safeParse({ notice_type: 'unknown', language: 'en', title: 'Notice', sections: {} }).success).toBe(false)
    expect(purposeSchema.safeParse({ code: 'Talent Pool', label: 'Talent pool', description: '', principal_types: ['candidate'], lawful_basis: 'consent', required: false, active: true, sort_order: 1 }).success).toBe(false)
  })
})
