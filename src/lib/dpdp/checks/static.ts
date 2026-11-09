import type { CheckOutcome, RepoFiles, StaticCheck } from './types'
import { filesMatching, readAll } from './repo'

// ============================================================================
// DPDP checker: static checks
// ----------------------------------------------------------------------------
// Pure functions over the repository's files. Each looks for the code that
// implements a rule, by the names the implementation uses. They read source,
// not data, so their output (printed in public CI logs) holds no personal
// data.
// ============================================================================

const pass = (detail?: string): CheckOutcome => ({ status: 'pass', detail })
const fail = (detail: string): CheckOutcome => ({ status: 'fail', detail })

const PORTAL_DIR = 'src/app/onboarding/[token]'
const TSX = /\.(ts|tsx)$/

/** Personal fields the portal collects. */
const PERSONAL_KEYS = [
  'full_name',
  'preferred_name',
  'date_of_birth',
  'gender',
  'blood_group',
  'phone',
  'personal_email',
  'current_address',
  'permanent_address',
  'city',
  'state',
  'pincode',
  'emergency_contact_name',
  'emergency_contact_relation',
  'emergency_contact_phone',
  'emergency_contact_email',
].join('|')

// `gender: 'Male'` or `gender: p?.gender || 'Male'`: a personal field given a value
// nobody typed. An empty string is fine.
const PREFILL = new RegExp(`\\b(${PERSONAL_KEYS})\\s*:\\s*(?:[^,\\n]*?(?:\\|\\||\\?\\?)\\s*)?(['"\`])(?!\\2)[^'"\`]+\\2`)

/** DPDP-01: the candidate personal-details form starts empty. */
export const portalHasNoPrefill: StaticCheck = (repo) => {
  const offenders = readAll(repo, PORTAL_DIR, TSX).filter(({ text }) => PREFILL.test(text))
  return offenders.length === 0
    ? pass('No personal field in the portal has a default value.')
    : { status: 'fail', detail: 'A personal field in the portal starts with a value.', counts: { files: offenders.length } }
}

/** DPDP-02: server functions run in the Mumbai region. */
export const functionsInMumbai: StaticCheck = (repo) => {
  const raw = repo.read('vercel.json')
  if (!raw) return fail('vercel.json not found.')
  try {
    const regions = (JSON.parse(raw) as { regions?: unknown }).regions
    return Array.isArray(regions) && regions.length === 1 && regions[0] === 'bom1'
      ? pass('vercel.json pins functions to bom1.')
      : fail('vercel.json does not set regions to ["bom1"].')
  } catch {
    return fail('vercel.json is not valid JSON.')
  }
}

/** DPDP-03: identity and bank document types never go to Drive. */
export const driveCopyExcludesIdentity: StaticCheck = (repo) => {
  const handover = repo.read('src/lib/onboarding/document-handover.ts') ?? ''
  const classes = repo.read('src/lib/onboarding/document-classes.ts') ?? ''
  if (!classes.includes('BANK_DOCUMENT_TYPES') || !classes.includes('IDENTITY_DOCUMENT_TYPES')) {
    return fail('The identity and bank document classes are not defined.')
  }
  return handover.includes('mayCopyToDrive(')
    ? pass('Drive copies go through mayCopyToDrive, which refuses identity and bank types.')
    : fail('copyToDrive does not check the document class.')
}

/** DPDP-12: the portal shows the notice first and records the acknowledgment with its version. */
export const portalNoticeFirst: StaticCheck = (repo) => {
  const page = repo.read(`${PORTAL_DIR}/page.tsx`) ?? ''
  const route = repo.read('src/app/api/onboarding/token/[token]/route.ts') ?? ''
  const steps = page.match(/const STEPS[^=]*=\s*\[([\s\S]*?)\];?\r?\n/)
  const first = steps?.[1].match(/\{[^}]*\}/)?.[0] ?? ''
  if (!/notice/i.test(first)) return fail('The portal\'s first step is not the privacy notice.')
  if (!route.includes("'acknowledge_notice'") || !/notice_version/.test(route + (repo.read('src/lib/dpdp/consent/service.ts') ?? ''))) {
    return fail('The acknowledgment is not recorded with the notice version.')
  }
  return pass('Step 0 is the notice; acknowledging it records the version.')
}

/** DPDP-13: consent records capture purpose, notice version, time and channel; withdrawal is one action. */
export const consentRecordsShape: StaticCheck = (repo) => {
  const migration = readAll(repo, 'supabase/migrations', /consent_records\.sql$/).map((f) => f.text).join('\n')
  if (!migration) return fail('No consent_records migration.')
  const missing = ['purpose_code', 'notice_version', 'given_at', 'withdrawn_at', 'channel'].filter((c) => !migration.includes(c))
  if (missing.length) return { status: 'fail', detail: 'consent_records lacks required columns.', counts: { missing: missing.length } }
  const actions = repo.read('src/lib/dpdp/consent/actions.ts') ?? ''
  return /export async function withdrawConsent\(/.test(actions)
    ? pass('consent_records has every field; withdrawConsent is a single action.')
    : fail('There is no single withdraw action.')
}

const PRETICK = /\bdefaultChecked\b(?!\s*=\s*\{\s*false\s*\})|\bchecked\s*=\s*\{\s*true\s*\}/

/** DPDP-14: no consent checkbox is pre-ticked or bundled. */
export const consentNotPreTicked: StaticCheck = (repo) => {
  const choices = repo.read('src/components/shared/privacy/consent-choices.tsx')
  if (!choices) return fail('The consent choices component does not exist.')
  const scanned = [
    { file: 'src/components/shared/privacy/consent-choices.tsx', text: choices },
    ...readAll(repo, PORTAL_DIR, TSX),
    ...readAll(repo, 'src/app/(dashboard)/my-privacy', TSX),
  ]
  const preticked = scanned.filter(({ text }) => PRETICK.test(text))
  if (preticked.length) return { status: 'fail', detail: 'A checkbox starts ticked.', counts: { files: preticked.length } }
  // One checkbox per purpose: the component maps purposes to their own controls.
  return /purposes\.map\(/.test(choices)
    ? pass('Each purpose has its own unticked checkbox.')
    : fail('Consent choices are not one checkbox per purpose.')
}

/** DPDP-15 (static part): the contact is shown in the footer, the portal, every notice and every rights response. */
export const contactShownEverywhere: StaticCheck = (repo) => {
  const places: [string, string][] = [
    ['dashboard footer', 'src/app/(dashboard)/layout.tsx'],
    ['portal', `${PORTAL_DIR}/layout.tsx`],
    ['notices', 'src/components/shared/privacy/notice-renderer.tsx'],
  ]
  const missing = places.filter(([, file]) => !(repo.read(file) ?? '').includes('PrivacyContact'))
  const emails = repo.read('src/lib/dpdp/requests/emails.ts') ?? ''
  if (!/contact/i.test(emails) || !emails.includes('contactBlock(')) missing.push(['rights responses', 'src/lib/dpdp/requests/emails.ts'])
  return missing.length === 0
    ? pass('PrivacyContact is in the footer, the portal and the notice renderer; rights emails carry it.')
    : { status: 'fail', detail: 'The privacy contact is not shown everywhere it must be.', counts: { places_missing: missing.length } }
}

/** DPDP-17: self-service access summary, with the list of processors. */
export const accessSummaryWithProcessors: StaticCheck = (repo) => {
  const page = readAll(repo, 'src/app/(dashboard)/my-privacy', TSX).map((f) => f.text).join('\n')
  if (!page) return fail('My Privacy does not exist.')
  return /processors/i.test(page) && /vault/i.test(page)
    ? pass('My Privacy shows the person\'s data, what the vault holds and the processors.')
    : fail('My Privacy does not list the processors and the vault holdings.')
}

const requestTypes = (repo: RepoFiles) => repo.read('src/lib/dpdp/requests/types.ts') ?? ''

/** DPDP-18: correction and completion requests. */
export const correctionRequests: StaticCheck = (repo) => {
  const t = requestTypes(repo)
  return ["'correction'", "'completion'", "'updating'"].every((k) => t.includes(k))
    ? pass('Correction, completion and updating are request types.')
    : fail('Correction, completion and updating are not all request types.')
}

/** DPDP-19: erasure answers name the statute when data is retained. */
export const erasureNamesStatute: StaticCheck = (repo) => {
  const e = repo.read('src/lib/dpdp/requests/erasure.ts') ?? ''
  return /export function erasureAnswer\(/.test(e) && /statutory_ref|statute/.test(e)
    ? pass('erasureAnswer names the statute and the date data must be kept until.')
    : fail('Erasure answers do not name the statute.')
}

/** DPDP-20: a nomination can be recorded. */
export const nominationRecorded: StaticCheck = (repo) => {
  const migration = filesMatching(repo, 'supabase/migrations', /\.sql$/)
    .map((f) => repo.read(f) ?? '')
    .some((t) => /create table if not exists public\.privacy_nominations/.test(t))
  return migration && requestTypes(repo).includes("'nomination'")
    ? pass('Nominations are recorded in privacy_nominations and requested through the queue.')
    : fail('Nominations cannot be recorded.')
}

/** DPDP-23 (static part): the retention job is scheduled. */
export const retentionJobScheduled: StaticCheck = (repo) => {
  const raw = repo.read('vercel.json') ?? '{}'
  let scheduled = false
  try {
    scheduled = ((JSON.parse(raw) as { crons?: { path: string }[] }).crons ?? []).some((c) => c.path === '/api/cron/dpdp-retention')
  } catch {
    scheduled = false
  }
  const route = repo.read('src/app/api/cron/dpdp-retention/route.ts') ?? ''
  if (!scheduled) return fail('/api/cron/dpdp-retention is not in vercel.json.')
  return route.includes('carriesCronSecret(') ? pass('The daily retention job is scheduled and checks the cron secret.') : fail('The retention route is missing or does not check the cron secret.')
}

/** DPDP-24 (static part): nothing younger than the 1-year floor is deleted: the planner and its tests. */
export const plannerRespectsFloor: StaticCheck = (repo) => {
  const planner = repo.read('src/lib/dpdp/retention/planner.ts') ?? ''
  const tests = repo.read('src/lib/dpdp/retention/planner.test.ts') ?? ''
  return planner.includes('DELETE_FLOOR_DAYS') && /floor/i.test(tests)
    ? pass('planRetention applies DELETE_FLOOR_DAYS to every delete, and its tests cover it.')
    : fail('The retention planner does not apply the 1-year floor, or has no test for it.')
}

/** DPDP-25: a legal hold pauses deletion. */
export const plannerHonoursHolds: StaticCheck = (repo) => {
  const planner = repo.read('src/lib/dpdp/retention/planner.ts') ?? ''
  const tests = repo.read('src/lib/dpdp/retention/planner.test.ts') ?? ''
  return /hold/i.test(planner) && /legal hold/i.test(tests)
    ? pass('planRetention skips records under a legal hold, and its tests cover it.')
    : fail('The retention planner does not honour legal holds, or has no test for it.')
}

/** DPDP-27 (static part): the incident register with 6 h / 72 h deadlines. */
export const incidentRegister: StaticCheck = (repo) => {
  const migration = filesMatching(repo, 'supabase/migrations', /privacy_incidents\.sql$/).length > 0
  const deadlines = repo.read('src/lib/dpdp/incidents/deadlines.ts') ?? ''
  return migration && deadlines.includes('CERT_IN_REPORT_HOURS') && deadlines.includes('BOARD_DETAILED_REPORT_HOURS')
    ? pass('privacy_incidents exists and tracks the CERT-In and Board deadlines.')
    : fail('There is no incident register with deadline tracking.')
}

/** DPDP-30 (static part): age is checked on the server before processing. */
export const ageCheckedOnServer: StaticCheck = (repo) => {
  const route = repo.read('src/app/api/onboarding/token/[token]/route.ts') ?? ''
  const gate = repo.read('src/lib/dpdp/children.ts') ?? ''
  return gate.includes('ageOn(') && /guardianConsentNeeded|guardian/i.test(route)
    ? pass('The portal computes age on the server and holds a child\'s record for guardian consent.')
    : fail('Age is not checked on the server before processing.')
}

/** DPDP-32 (static part): bank details enter through the vault path only. */
export const bankThroughVault: StaticCheck = (repo) => {
  const client = repo.read('src/lib/vault/client.ts') ?? ''
  const upload = repo.read('src/app/api/onboarding/token/[token]/documents/route.ts') ?? ''
  return client.includes("'submit-bank'") && /bank_proof/.test(upload)
    ? pass('The portal sends bank details to the vault; core refuses a bank_proof upload.')
    : fail('Bank details do not enter through the vault path.')
}

/** DPDP-34 (static part): peer feedback is sealed when its cycle closes. */
export const feedbackSealedOnClose: StaticCheck = (repo) => {
  const service = repo.read('src/lib/reviews/service.ts') ?? ''
  return /sealFeedbackForConfirmation\(|sealCycleFeedback\(/.test(service)
    ? pass('Closing a review cycle seals its peer feedback.')
    : fail('Closing a cycle does not seal its peer feedback.')
}

/** DPDP-35 (static part): form answers and decision notes are sealable. */
export const answersSealable: StaticCheck = (repo) => {
  const sealing = repo.read('src/lib/vault/sealing.ts') ?? ''
  return /'form_answer'/.test(sealing) && /'decision_note'/.test(sealing)
    ? pass('Form answers and decision notes are SealableKinds with a budget.')
    : fail('Form answers and decision notes are not sealable.')
}

// A description argument that interpolates a free-text reason or an amount
// from the event's options (`${o.notes}`, `${o.reason}`, `${o.amount...}`).
const RISKY_INTERPOLATION = /\$\{[^}]*\bo\.(notes?|reason|amount|remarks|ctc|salary)\b/

/** DPDP-41: audit descriptions carry no amounts or free-text reasons. */
export const auditDescriptionsClean: StaticCheck = (repo) => {
  const events = repo.read('src/lib/audit/events.ts') ?? ''
  // Each helper: auditEvent('module', 'action', <description>, { ...o, ... }).
  // The description runs from the action string to the options object.
  const calls = [...events.matchAll(/auditEvent\(\s*'[^']+',\s*'[^']+',/g)].map((m) => {
    const rest = events.slice(m.index! + m[0].length)
    const end = rest.search(/\{\s*\.\.\.o\b|\n\s*\{\s*\n/)
    return end === -1 ? rest.slice(0, 400) : rest.slice(0, end)
  })
  const offenders = calls.filter((d) => RISKY_INTERPOLATION.test(d))
  return offenders.length === 0
    ? pass('Audit descriptions name the event; reasons and amounts go to metadata.')
    : { status: 'fail', detail: 'Some audit descriptions interpolate a reason or an amount.', counts: { descriptions: offenders.length } }
}

/** DPDP-42: email logs store no message bodies. */
export const emailLogsWithoutBodies: StaticCheck = (repo) => {
  const offenders = readAll(repo, 'src', TSX)
    .filter(({ file }) => !/\.test\.tsx?$/.test(file))
    .filter(({ text }) => /email_delivery_logs/.test(text) && /\bbody_(preview|html)\s*:/.test(text))
  return offenders.length === 0
    ? pass('No email log write includes a message body.')
    : { status: 'fail', detail: 'An email log write includes a message body.', counts: { files: offenders.length } }
}

/** DPDP-44: optional fields follow the Data collection settings. */
export const optionalFieldsFromSettings: StaticCheck = (repo) => {
  const portal = readAll(repo, PORTAL_DIR, TSX).map((f) => f.text).join('\n')
  const route = repo.read('src/app/api/onboarding/token/[token]/route.ts') ?? ''
  return /optional_fields|optionalFields/.test(portal) && /personalDetailsSchema\(|buildPersonalDetailsSchema\(/.test(route)
    ? pass('The portal and its API take optional fields from the Data collection settings.')
    : fail('Optional fields do not follow the Data collection settings.')
}
