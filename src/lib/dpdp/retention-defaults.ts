import { statutoryFloorDays } from './constants'
import type { ClockStart, RetentionAction, RetentionRuleId } from './types'

// ============================================================================
// Retention rules: the seeded defaults
// ----------------------------------------------------------------------------
// The starting values of `dpdp_retention_rules`, seeded by
// 202611071010_dpdp_settings.sql. After that the table is the source of truth
// and PnC Admin edits it in Settings (never below `floorDays`). Every rule is
// marked "counsel to confirm" in the UI.
//
// A period runs from the rule's clock start. Whatever the period, nothing is
// deleted before it is a year old (DELETE_FLOOR_DAYS), and a legal hold pauses
// every rule for its person or record.
// ============================================================================

export interface RetentionRuleDefault {
  id: RetentionRuleId
  label: string
  clockStart: ClockStart
  /** Days after the clock starts. Null: no default, counsel decides. */
  periodDays: number | null
  /** Longer period that applies with the principal's consent (talent pool). */
  consentPeriodDays: number | null
  action: RetentionAction
  /** Statutory minimum for `periodDays`; locked. 0 when there is none. */
  floorDays: number
  ref: string
  note: string
}

const Y = 365

export const RETENTION_DEFAULTS: readonly RetentionRuleDefault[] = [
  {
    id: 'logs',
    label: 'Processing, access and audit logs',
    clockStart: 'event',
    periodDays: 2 * Y,
    consentPeriodDays: null,
    action: 'delete',
    floorDays: statutoryFloorDays('logs'),
    ref: 'DPDP Rules r. 6(1)(e), r. 8(3); CERT-In Directions 2022 (180 days)',
    note: '1 year hot + 1 year cold.',
  },
  {
    id: 'rejected_candidates',
    label: 'Rejected candidate data',
    clockStart: 'role_closed',
    periodDays: 183,
    consentPeriodDays: Y,
    action: 'delete',
    floorDays: 0,
    ref: 'DPDP Act s. 8(7)',
    note: '6 months; 12 months with talent-pool consent. The 1-year floor applies to the logs about them.',
  },
  {
    id: 'withdrawn_joiner_documents',
    label: "Withdrawn joiners' documents",
    clockStart: 'withdrawal',
    periodDays: 90,
    consentPeriodDays: null,
    action: 'delete',
    floorDays: 0,
    ref: 'DPDP Act s. 8(7); docs/rbac.md decision #6',
    note: '90 days after withdrawal, and never before the file is a year old.',
  },
  {
    id: 'bgv_raw_report',
    label: 'Background verification raw report',
    clockStart: 'confirmation',
    periodDays: 0,
    consentPeriodDays: null,
    action: 'delete',
    floorDays: 0,
    ref: 'DPDP Act s. 8(7)',
    note: 'At confirmation, or 12 months after collection, whichever is later. Only the result flag is kept.',
  },
  {
    id: 'statutory_registers',
    label: 'Wage, attendance and employee registers',
    clockStart: 'last_entry',
    periodDays: 5 * Y,
    consentPeriodDays: null,
    action: 'anonymise',
    floorDays: statutoryFloorDays('statutory_registers'),
    ref: 'Code on Wages (Central) Rules 2026, r. 51(4)',
    note: 'The clock runs from the last entry, not from the financial year end.',
  },
  {
    id: 'social_security_registers',
    label: 'EPF, ESI and Social Security registers; gratuity',
    clockStart: 'last_entry',
    periodDays: 5 * Y,
    consentPeriodDays: null,
    action: 'delete',
    floorDays: statutoryFloorDays('social_security_registers'),
    ref: 'Code on Social Security (Central) Rules 2026, r. 53(1)(e); ESI (General) Regs. 32, 66, 102-A',
    note: 'Gratuity: the whole service plus 5 years after payment.',
  },
  {
    id: 'payroll_tax',
    label: 'Payroll, TDS and Form 16',
    clockStart: 'fy_end',
    periodDays: 8 * Y,
    consentPeriodDays: null,
    action: 'anonymise',
    floorDays: statutoryFloorDays('payroll_tax'),
    ref: 'Income-tax Rules 2026, r. 187(5); Companies Act 2013 s. 128(5); FCRA Rules 2011 r. 17(7)',
    note: '8 years from the end of the financial year covers all three regimes.',
  },
  {
    id: 'letters',
    label: 'Offer, confirmation, appraisal and experience letters',
    clockStart: 'exit',
    periodDays: 8 * Y,
    consentPeriodDays: null,
    action: 'delete',
    floorDays: 0,
    ref: 'DPDP Act s. 8(7), s. 17(1)(a)',
    note: 'Partly inside wage and tax records; kept for legal claims.',
  },
  {
    id: 'feedback_text',
    label: 'Raw peer and manager feedback text',
    clockStart: 'decision',
    periodDays: 2 * Y,
    consentPeriodDays: null,
    action: 'delete',
    floorDays: 0,
    ref: 'DPDP Act s. 8(7), s. 8(3)',
    note: 'The decision itself is kept with the employment record.',
  },
  {
    id: 'medical_certificates',
    label: 'Medical certificates',
    clockStart: 'decision',
    periodDays: Y,
    consentPeriodDays: null,
    action: 'delete',
    floorDays: 0,
    ref: 'DPDP Act s. 8(7); Code on Social Security r. 53 (register entry 5 years)',
    note: 'The certificate goes; the leave register entry follows the register rule.',
  },
  {
    id: 'dependant_nominee',
    label: 'Dependant and nominee data',
    clockStart: 'exit',
    periodDays: 5 * Y,
    consentPeriodDays: null,
    action: 'delete',
    floorDays: 0,
    ref: 'Code on Social Security 2020 (gratuity and PF claims)',
    note: '',
  },
  {
    id: 'posh_case_files',
    label: 'POSH case files',
    clockStart: 'none',
    periodDays: null,
    consentPeriodDays: null,
    action: 'report_only',
    floorDays: 0,
    ref: 'POSH Act 2013 (no statutory period)',
    note: 'No default: counsel decides. Kept under legal hold until then.',
  },
  {
    id: 'employment_records',
    label: 'Employment workflow records (confirmations, reviews, exits)',
    clockStart: 'exit',
    periodDays: 8 * Y,
    consentPeriodDays: null,
    action: 'delete',
    floorDays: 0,
    ref: 'DPDP Act s. 8(7), s. 17(1)(a)',
    note: 'Aligned with the letters rule.',
  },
  {
    id: 'privacy_records',
    label: 'Consent records, rights requests and incidents',
    clockStart: 'closure',
    periodDays: 7 * Y,
    consentPeriodDays: null,
    action: 'delete',
    floorDays: 0,
    ref: 'DPDP Act s. 6(10) (proof of consent), s. 8(6); DPDP Rules r. 8(3)',
    note: 'Evidence that a notice was given, a consent recorded or a request answered.',
  },
]

export const RETENTION_DEFAULTS_BY_ID: Record<RetentionRuleId, RetentionRuleDefault> = Object.fromEntries(
  RETENTION_DEFAULTS.map((r) => [r.id, r]),
) as Record<RetentionRuleId, RetentionRuleDefault>
