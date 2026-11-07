import type { RetentionRuleId } from './types'

// ============================================================================
// DPDP: locked legal values
// ----------------------------------------------------------------------------
// Values the law fixes. The DPDP & Privacy settings screen shows each one with
// a lock and its reference, and no screen can change it. The database repeats
// the numbers as check constraints (202611071010_dpdp_settings.sql), so a
// direct SQL write cannot break them either; change both together.
//
// Every value is counsel-to-confirm until NavGurukul's counsel signs off
// (docs/dpdp/legal-blueprint.md, "Caveats and items for legal counsel").
// ============================================================================

export interface LockedValue<T> {
  value: T
  label: string
  /** Section, rule or direction the value comes from. */
  ref: string
}

/** The date the Act's main duties apply from (DPDP Rules r. 1(4)). */
export const MAIN_DUTIES_FROM: LockedValue<string> = {
  value: '2027-05-13',
  label: 'Main DPDP duties apply from',
  ref: 'DPDP Rules 2025, r. 1(4); G.S.R. 846(E)',
}

/**
 * Minimum retention of personal data, traffic data and processing logs.
 * Applied to every hard delete: nothing younger than this is deleted.
 */
export const DELETE_FLOOR_DAYS: LockedValue<number> = {
  value: 365,
  label: 'Nothing is deleted before it is one year old',
  ref: 'DPDP Rules 2025, r. 6(1)(e) and r. 8(3)',
}

/** Logs specifically: the same floor, named for the log settings. */
export const LOG_RETENTION_FLOOR_DAYS: LockedValue<number> = {
  value: 365,
  label: 'Processing, access and audit logs kept at least',
  ref: 'DPDP Rules 2025, r. 6(1)(e) and r. 8(3)',
}

/** The longest grievance response period the platform may publish. */
export const GRIEVANCE_MAX_DAYS: LockedValue<number> = {
  value: 90,
  label: 'Grievance response period may not exceed',
  ref: 'DPDP Rules 2025, r. 14(3)',
}

/** Detailed breach report to the Data Protection Board, from awareness. */
export const BOARD_DETAILED_REPORT_HOURS: LockedValue<number> = {
  value: 72,
  label: 'Detailed breach report to the Board within',
  ref: 'DPDP Rules 2025, r. 7(2)(b)',
}

/** Incident report to CERT-In, from noticing. In force now. */
export const CERT_IN_REPORT_HOURS: LockedValue<number> = {
  value: 6,
  label: 'Report a cyber incident to CERT-In within',
  ref: 'CERT-In Directions under IT Act s. 70B(6), 28 April 2022, direction (ii)',
}

/** Below this age a person is a child: verifiable parental consent first. */
export const CHILD_AGE_YEARS: LockedValue<number> = {
  value: 18,
  label: 'A child is anyone under',
  ref: 'DPDP Act 2023, s. 2(f) and s. 9; DPDP Rules 2025, r. 10',
}

/**
 * Statutory minimum periods: a retention rule's period can be raised but never
 * set below these. Rules not listed have no statutory floor (the 1-year delete
 * floor still applies to every delete).
 */
export const STATUTORY_FLOORS: Partial<Record<RetentionRuleId, LockedValue<number>>> = {
  logs: { value: 365, label: 'Logs', ref: 'DPDP Rules 2025, r. 6(1)(e), r. 8(3)' },
  statutory_registers: {
    value: 1825,
    label: 'Wage, attendance and employee registers',
    ref: 'Code on Wages (Central) Rules 2026, r. 51(4)',
  },
  social_security_registers: {
    value: 1825,
    label: 'EPF, ESI and Social Security registers; gratuity',
    ref: 'Code on Social Security (Central) Rules 2026, r. 53(1)(e); ESI (General) Regulations 32, 66, 102-A',
  },
  payroll_tax: {
    value: 2190,
    label: 'Payroll, TDS and Form 16',
    ref: 'Income-tax Rules 2026, r. 187(5) (registered NPO)',
  },
}

/** The floor for a rule, in days: its statutory floor, or 0. */
export function statutoryFloorDays(rule: RetentionRuleId): number {
  return STATUTORY_FLOORS[rule]?.value ?? 0
}

/** The Rule 3 elements a published notice must carry (r. 3(a)–(c)). */
export const RULE_3_ELEMENTS = [
  { key: 'data_items', label: 'An itemised description of the personal data', ref: 'r. 3(b)(i)' },
  { key: 'purposes', label: 'The specified purposes, and what they enable', ref: 'r. 3(b)(ii)' },
  { key: 'withdraw_how', label: 'How to withdraw consent, as easily as it was given', ref: 'r. 3(c)(i); s. 6(4)' },
  { key: 'rights_how', label: 'How to exercise your rights, and which identifier to give', ref: 'r. 3(c)(ii); r. 14(1)' },
  { key: 'complaint_how', label: 'How to complain to the Data Protection Board', ref: 'r. 3(c)(iii); s. 13(3)' },
] as const

/** The Rule 7 elements every message to an affected person must carry. */
export const RULE_7_ELEMENTS = [
  { key: 'description', label: 'Description: nature, extent and timing', ref: 'r. 7(1)(a)' },
  { key: 'consequences', label: 'Likely consequences for you', ref: 'r. 7(1)(b)' },
  { key: 'mitigation', label: 'Measures taken to mitigate the risk', ref: 'r. 7(1)(c)' },
  { key: 'safety_steps', label: 'Steps you can take to protect yourself', ref: 'r. 7(1)(d)' },
  { key: 'contact', label: 'The contact of a person who can answer', ref: 'r. 7(1)(e)' },
] as const

/** Placeholders a breach template uses for the Rule 7 elements. */
export const RULE_7_PLACEHOLDERS: Record<(typeof RULE_7_ELEMENTS)[number]['key'], string> = {
  description: '{{description}}',
  consequences: '{{consequences}}',
  mitigation: '{{mitigation}}',
  safety_steps: '{{safety_steps}}',
  contact: '{{contact}}',
}
