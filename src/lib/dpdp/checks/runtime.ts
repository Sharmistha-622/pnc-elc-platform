import { GRIEVANCE_MAX_DAYS } from '../constants'
import { categoriesWithRules } from '../inventory'
import { PRIVACY_NOTICE_TYPES, BREACH_TEMPLATE_TYPES } from '../notices'
import { isIdentityOrBankDocument } from '@/lib/onboarding/document-classes'
import { addHours, isoDate, parseDate } from '../dates'
import type { CheckOutcome, RuntimeCheck } from './types'

// ============================================================================
// DPDP checker: runtime and attestation checks
// ----------------------------------------------------------------------------
// Pure functions over a snapshot of the live settings and counts
// (snapshot.ts). The snapshot holds counts and configuration only: never a
// name, an email or a value about a person. Null means the source could not
// be read (for example, a migration not yet applied).
// ============================================================================

export interface PublishedNotice {
  type: string
  language: string
  version: number
  checklistOk: boolean
}

export interface ComplianceSnapshot {
  settings: {
    contactSet: boolean
    grievanceDays: number
    languages: string[]
    driveTypes: string[]
  } | null
  /** The latest published version of each notice type and language. */
  notices: PublishedNotice[]
  ruleIds: string[]
  /** Rules whose period is blank but whose action deletes or anonymises. */
  rulesWithoutPeriod: string[]
  lastRetentionRunAt: string | null | undefined
  requests: { open: number; overdue: number; pastEscalationNotEscalated: number } | null
  /** Candidates who have entered details without acknowledging the notice. */
  candidatesWithoutAck: number | null
  withdrawnDocumentsPastDeadline: number | null
  minorsWithoutGuardianConsent: number | null
  processors: { active: number; missingDpa: number; missingRegion: number; reviewOverdue: number; reviewMissing: number } | null
  attestations: { code: string; confirmedAt: string | null; nextReviewAt: string | null }[]
  exposed: { identity: number; feedback: number; formAnswer: number; decisionNote: number } | null
  incidents: { open: number; deadlineMissed: number } | null
  auditDescriptionsWithValues: number | null
  coreSalaryValues: number | null
  coreBankProofs: number | null
}

const pass = (detail?: string, counts?: Record<string, number>): CheckOutcome => ({ status: 'pass', detail, counts })
const warn = (detail: string, counts?: Record<string, number>): CheckOutcome => ({ status: 'warn', detail, counts })
const fail = (detail: string, counts?: Record<string, number>): CheckOutcome => ({ status: 'fail', detail, counts })
const unavailable = (what: string) => fail(`${what} could not be read; check that the DPDP migrations are applied.`)

type Check = RuntimeCheck<ComplianceSnapshot>

/** DPDP-03 (runtime): the Drive allow-list holds no identity or bank type. */
export const driveListClean: Check = (s) => {
  if (!s.settings) return unavailable('Settings')
  const bad = s.settings.driveTypes.filter((t) => isIdentityOrBankDocument(t)).length
  return bad === 0 ? pass('The Drive allow-list holds no identity or bank type.') : fail('The Drive allow-list holds identity or bank types.', { types: bad })
}

/** DPDP-10: published notices exist for all three audiences, each with every Rule 3 element. */
export const noticesPublished: Check = (s) => {
  const missing = PRIVACY_NOTICE_TYPES.filter((t) => !s.notices.some((n) => n.type === t && n.language === 'en'))
  const incomplete = s.notices.filter((n) => (PRIVACY_NOTICE_TYPES as readonly string[]).includes(n.type) && !n.checklistOk).length
  if (missing.length) return fail('A notice has no published version in English.', { notices_missing: missing.length })
  if (incomplete) return fail('A published notice lacks a Rule 3 element or the contact.', { versions: incomplete })
  return pass('Candidate, employee and contractor/volunteer notices are published with every Rule 3 element.')
}

/** DPDP-11: notices are available in English and Hindi. */
export const noticesInHindi: Check = (s) => {
  const missing = PRIVACY_NOTICE_TYPES.flatMap((t) => ['en', 'hi'].filter((l) => !s.notices.some((n) => n.type === t && n.language === l)))
  return missing.length === 0 ? pass('Every notice is published in English and Hindi.') : fail('A notice is not yet published in both English and Hindi.', { versions_missing: missing.length })
}

/** DPDP-12 (runtime): no candidate has entered details without acknowledging the notice. */
export const candidatesAcknowledged: Check = (s) => {
  if (s.candidatesWithoutAck === null) return unavailable('Consent records')
  return s.candidatesWithoutAck === 0
    ? pass('Every candidate with details on file acknowledged the notice first.')
    : warn('Some candidates entered details before acknowledging a notice (records from before the notice step).', { candidates: s.candidatesWithoutAck })
}

/** DPDP-15 (runtime): the privacy contact is set. */
export const contactSet: Check = (s) => {
  if (!s.settings) return unavailable('Settings')
  return s.settings.contactSet ? pass('The Privacy & Grievance Officer has a name and an email.') : fail('The privacy contact is blank. Set it under Contact & grievance.')
}

/** DPDP-16 (runtime): the grievance period is published and at most 90 days. */
export const grievancePublished: Check = (s) => {
  if (!s.settings) return unavailable('Settings')
  if (s.settings.grievanceDays < 1 || s.settings.grievanceDays > GRIEVANCE_MAX_DAYS.value) return fail('The grievance period is outside 1 to 90 days.')
  return s.notices.some((n) => n.type === 'employee')
    ? pass(`The grievance period is ${s.settings.grievanceDays} days, shown with every notice.`)
    : warn('The period is set, but no employee notice is published to show it.')
}

/** DPDP-21: the request queue tracks deadlines and escalates; nothing is overdue. */
export const requestsOnTime: Check = (s) => {
  if (!s.requests) return unavailable('Rights requests')
  if (s.requests.overdue > 0) return fail('Rights requests are past their due date.', { overdue: s.requests.overdue })
  if (s.requests.pastEscalationNotEscalated > 0) return warn('Requests past 80% of their period have not been escalated yet.', { requests: s.requests.pastEscalationNotEscalated })
  return pass('No rights request is overdue.', { open: s.requests.open })
}

/** DPDP-22: every inventory category has a retention rule, and every rule has a period or is report-only. */
export const categoriesHaveRules: Check = (s) => {
  const needed = new Set([...categoriesWithRules().values()].flatMap((set) => [...set]))
  const missing = [...needed].filter((id) => !s.ruleIds.includes(id))
  if (missing.length) return fail('An inventory category maps to a retention rule that is not in the settings.', { rules_missing: missing.length })
  if (s.rulesWithoutPeriod.length) return fail('A rule that deletes or anonymises has no period.', { rules: s.rulesWithoutPeriod.length })
  return pass('Every category in the inventory has a retention rule with a period.')
}

/** DPDP-23 (runtime): the retention job ran in the last 26 hours. */
export const retentionRanRecently: Check = (s, today) => {
  if (s.lastRetentionRunAt === undefined) return unavailable('Retention runs')
  const last = parseDate(s.lastRetentionRunAt)
  if (!last) return fail('The retention job has not run yet.')
  return addHours(last, 26) >= today ? pass(`Last run ${isoDate(last)}.`) : fail('The retention job has not run in the last 26 hours.')
}

/** DPDP-26: withdrawn joiners' documents are purged on schedule. */
export const withdrawnPurged: Check = (s) => {
  if (s.withdrawnDocumentsPastDeadline === null) return unavailable('Onboarding documents')
  return s.withdrawnDocumentsPastDeadline === 0
    ? pass('No withdrawn joiner\'s document is past its purge date.')
    : fail('Withdrawn joiners\' documents are past their purge date.', { documents: s.withdrawnDocumentsPastDeadline })
}

/** DPDP-28: every breach template is published with its Rule 7 elements. */
export const breachTemplatesReady: Check = (s) => {
  const missing = BREACH_TEMPLATE_TYPES.filter((t) => !s.notices.some((n) => n.type === t && n.language === 'en'))
  const incomplete = s.notices.filter((n) => (BREACH_TEMPLATE_TYPES as readonly string[]).includes(n.type) && !n.checklistOk).length
  if (missing.length) return fail('A breach template is not published.', { templates_missing: missing.length })
  if (incomplete) return fail('A breach template lacks a required placeholder.', { templates: incomplete })
  return pass('Templates for affected people, the Board and CERT-In are published with every element.')
}

/** DPDP-30 (runtime): no child's record is processed without guardian consent. */
export const minorsHeld: Check = (s) => {
  if (s.minorsWithoutGuardianConsent === null) return unavailable('Guardian consent')
  return s.minorsWithoutGuardianConsent === 0
    ? pass('Every under-18 record past the notice step has guardian consent.')
    : fail('Under-18 records await guardian consent but have moved past the notice step.', { records: s.minorsWithoutGuardianConsent })
}

/** DPDP-31: the processor register is complete, with DPA status and region; reviews are on time. */
export const processorsComplete: Check = (s) => {
  if (!s.processors) return unavailable('The processor register')
  const p = s.processors
  if (p.active === 0) return fail('The processor register is empty.')
  if (p.missingDpa > 0 || p.missingRegion > 0) return fail('A processor lacks a DPA or a hosting region.', { missing_dpa: p.missingDpa, missing_region: p.missingRegion })
  if (p.reviewOverdue > 0 || p.reviewMissing > 0) return warn('A processor review is overdue or not scheduled.', { overdue: p.reviewOverdue, unscheduled: p.reviewMissing })
  return pass('Every processor has a DPA, a region and a review date.', { processors: p.active })
}

/** DPDP-32 (runtime): no bank proof sits in core. */
export const noBankProofInCore: Check = (s) => {
  if (s.coreBankProofs === null) return unavailable('Onboarding documents')
  return s.coreBankProofs === 0 ? pass('No bank proof is stored in core.') : fail('Bank proofs are stored in core.', { files: s.coreBankProofs })
}

/** DPDP-33 (runtime): no salary figure is stored in core. */
export const noSalaryInCore: Check = (s) => {
  if (s.coreSalaryValues === null) return pass('Core has no salary columns.')
  return s.coreSalaryValues === 0 ? pass('No salary figure is stored in core.') : fail('Salary figures are stored in core.', { values: s.coreSalaryValues })
}

const exposedCheck = (key: keyof NonNullable<ComplianceSnapshot['exposed']>, what: string): Check => (s) => {
  if (!s.exposed) return unavailable('The exposure list')
  return s.exposed[key] === 0 ? pass(`No ${what} is past its sealing budget.`) : fail(`${what} is past its sealing budget.`, { records: s.exposed[key] })
}

/** DPDP-34 (runtime). */
export const feedbackSealed = exposedCheck('feedback', 'peer feedback')
/** DPDP-35 (runtime). */
export const answersSealed: Check = (s) => {
  if (!s.exposed) return unavailable('The exposure list')
  const n = s.exposed.formAnswer + s.exposed.decisionNote
  return n === 0 ? pass('No form answer or decision note is past its sealing budget.') : fail('Form answers or decision notes are past their sealing budget.', { records: n })
}

/** DPDP-36: no staged record is past its sealing budget. */
export const nothingOverBudget: Check = (s) => {
  if (!s.exposed) return unavailable('The exposure list')
  const total = s.exposed.identity + s.exposed.feedback + s.exposed.formAnswer + s.exposed.decisionNote
  return total === 0 ? pass('No staged record is past its sealing budget.') : fail('Staged records are past their sealing budget.', { records: total })
}

/** DPDP-41 (runtime): no audit description carries an amount or an identity number. */
export const auditRowsClean: Check = (s) => {
  if (s.auditDescriptionsWithValues === null) return unavailable('The audit log')
  return s.auditDescriptionsWithValues === 0
    ? pass('No audit description holds an amount or an identity number.')
    : warn('Older audit descriptions hold amounts or numbers; new events no longer write them.', { rows: s.auditDescriptionsWithValues })
}

/** DPDP-44 (runtime): the settings that drive optional fields can be read. */
export const optionalFieldSettings: Check = (s) =>
  s.settings ? pass('The portal reads its optional fields from Data collection.') : unavailable('Settings')

/**
 * An attestation check: every listed attestation confirmed and not overdue.
 * Overdue is amber; never confirmed is red.
 */
export function attestationOutcome(
  codes: string[],
  attestations: ComplianceSnapshot['attestations'],
  today: Date,
): CheckOutcome {
  const rows = codes.map((c) => attestations.find((a) => a.code === c))
  const unconfirmed = rows.filter((r) => !r?.confirmedAt).length
  const overdue = rows.filter((r) => r?.confirmedAt && r.nextReviewAt && r.nextReviewAt < isoDate(today)).length
  if (unconfirmed > 0) return fail('An owner attestation is not confirmed yet.', { unconfirmed, of: codes.length })
  if (overdue > 0) return warn('An owner attestation is due for review.', { overdue, of: codes.length })
  return pass('Confirmed, and not yet due for review.', { confirmed: codes.length })
}
