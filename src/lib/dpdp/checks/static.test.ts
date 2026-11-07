import { describe, it, expect } from 'vitest'
import { memoryRepo } from './repo'
import * as S from './static'
import type { StaticCheck } from './types'

// One passing and one failing fixture per static check.

const PORTAL = 'src/app/onboarding/[token]/page.tsx'
const ROUTE = 'src/app/api/onboarding/token/[token]/route.ts'

const cases: { name: string; check: StaticCheck; passes: Record<string, string>; fails: Record<string, string> }[] = [
  {
    name: 'DPDP-01 portal has no prefilled personal values',
    check: S.portalHasNoPrefill,
    passes: { [PORTAL]: "const empty = { full_name: '', date_of_birth: '', gender: '' }" },
    fails: { [PORTAL]: "setForm({ date_of_birth: p?.date_of_birth || '1999-05-15', gender: 'Male' })" },
  },
  {
    name: 'DPDP-02 functions in Mumbai',
    check: S.functionsInMumbai,
    passes: { 'vercel.json': '{"regions":["bom1"],"crons":[]}' },
    fails: { 'vercel.json': '{"crons":[]}' },
  },
  {
    name: 'DPDP-03 Drive copies refuse identity and bank types',
    check: S.driveCopyExcludesIdentity,
    passes: {
      'src/lib/onboarding/document-handover.ts': 'if (!mayCopyToDrive(type.name, allowed)) return null',
      'src/lib/onboarding/document-classes.ts': 'export const IDENTITY_DOCUMENT_TYPES = []; export const BANK_DOCUMENT_TYPES = []',
    },
    fails: {
      'src/lib/onboarding/document-handover.ts': 'await uploadFile(doc)',
      'src/lib/onboarding/document-classes.ts': 'export const IDENTITY_DOCUMENT_TYPES = []; export const BANK_DOCUMENT_TYPES = []',
    },
  },
  {
    name: 'DPDP-12 notice first, acknowledged with its version',
    check: S.portalNoticeFirst,
    passes: {
      [PORTAL]: "const STEPS = [\n  { id: 0, title: 'Privacy Notice' },\n  { id: 1, title: 'Personal Information' },\n];\n",
      [ROUTE]: "if (action === 'acknowledge_notice') { record({ notice_version: v }) }",
    },
    fails: {
      [PORTAL]: "const STEPS = [\n  { id: 1, title: 'Personal Information' },\n];\n",
      [ROUTE]: "if (action === 'update_personal') {}",
    },
  },
  {
    name: 'DPDP-13 consent records shape and single withdrawal',
    check: S.consentRecordsShape,
    passes: {
      'supabase/migrations/202611071020_consent_records.sql': 'purpose_code notice_version given_at withdrawn_at channel',
      'src/lib/dpdp/consent/actions.ts': 'export async function withdrawConsent(id: string) {}',
    },
    fails: { 'supabase/migrations/202611071020_consent_records.sql': 'purpose_code given_at' },
  },
  {
    name: 'DPDP-14 no pre-ticked or bundled consent',
    check: S.consentNotPreTicked,
    passes: { 'src/components/shared/privacy/consent-choices.tsx': 'purposes.map((p) => <Checkbox checked={chosen.includes(p.code)} />)' },
    fails: { 'src/components/shared/privacy/consent-choices.tsx': 'purposes.map((p) => <Checkbox defaultChecked />)' },
  },
  {
    name: 'DPDP-15 contact shown everywhere',
    check: S.contactShownEverywhere,
    passes: {
      'src/app/(dashboard)/layout.tsx': '<PrivacyContact />',
      'src/app/onboarding/[token]/layout.tsx': '<PrivacyContact />',
      'src/components/shared/privacy/notice-renderer.tsx': '<PrivacyContact />',
      'src/lib/dpdp/requests/emails.ts': 'const contact = contactBlock(settings)',
    },
    fails: { 'src/app/(dashboard)/layout.tsx': '<SidebarInset />' },
  },
  {
    name: 'DPDP-17 access summary with processors',
    check: S.accessSummaryWithProcessors,
    passes: { 'src/app/(dashboard)/my-privacy/page.tsx': '<VaultHoldings /><Processors processors={processors} />' },
    fails: { 'src/app/(dashboard)/my-privacy/page.tsx': '<Profile />' },
  },
  {
    name: 'DPDP-18 correction requests',
    check: S.correctionRequests,
    passes: { 'src/lib/dpdp/requests/types.ts': "['access', 'correction', 'completion', 'updating']" },
    fails: { 'src/lib/dpdp/requests/types.ts': "['access']" },
  },
  {
    name: 'DPDP-19 erasure names the statute',
    check: S.erasureNamesStatute,
    passes: { 'src/lib/dpdp/requests/erasure.ts': 'export function erasureAnswer(rules) { return rules.map((r) => r.statutory_ref) }' },
    fails: { 'src/lib/dpdp/requests/erasure.ts': 'export function erase() {}' },
  },
  {
    name: 'DPDP-20 nomination recorded',
    check: S.nominationRecorded,
    passes: {
      'supabase/migrations/202611071030_privacy_requests.sql': 'create table if not exists public.privacy_nominations (',
      'src/lib/dpdp/requests/types.ts': "['nomination']",
    },
    fails: { 'src/lib/dpdp/requests/types.ts': "['nomination']" },
  },
  {
    name: 'DPDP-23 retention job scheduled',
    check: S.retentionJobScheduled,
    passes: {
      'vercel.json': '{"crons":[{"path":"/api/cron/dpdp-retention","schedule":"15 21 * * *"}]}',
      'src/app/api/cron/dpdp-retention/route.ts': 'if (!carriesCronSecret(h)) return 401',
    },
    fails: { 'vercel.json': '{"crons":[]}' },
  },
  {
    name: 'DPDP-24 planner applies the floor',
    check: S.plannerRespectsFloor,
    passes: {
      'src/lib/dpdp/retention/planner.ts': 'DELETE_FLOOR_DAYS',
      'src/lib/dpdp/retention/planner.test.ts': "it('never deletes below the floor')",
    },
    fails: { 'src/lib/dpdp/retention/planner.ts': 'export function planRetention() {}' },
  },
  {
    name: 'DPDP-25 planner honours holds',
    check: S.plannerHonoursHolds,
    passes: {
      'src/lib/dpdp/retention/planner.ts': 'if (held(record, holds)) skip',
      'src/lib/dpdp/retention/planner.test.ts': "it('skips a record under a legal hold')",
    },
    fails: { 'src/lib/dpdp/retention/planner.ts': 'delete everything' },
  },
  {
    name: 'DPDP-27 incident register',
    check: S.incidentRegister,
    passes: {
      'supabase/migrations/202611071050_privacy_incidents.sql': 'create table',
      'src/lib/dpdp/incidents/deadlines.ts': 'CERT_IN_REPORT_HOURS BOARD_DETAILED_REPORT_HOURS',
    },
    fails: { 'src/lib/dpdp/incidents/deadlines.ts': 'CERT_IN_REPORT_HOURS' },
  },
  {
    name: 'DPDP-30 age checked on the server',
    check: S.ageCheckedOnServer,
    passes: { 'src/lib/dpdp/children.ts': 'ageOn(dob, today)', [ROUTE]: 'guardianConsentNeeded(details)' },
    fails: { [ROUTE]: 'updatePersonalDetails(id, body)' },
  },
  {
    name: 'DPDP-32 bank details through the vault',
    check: S.bankThroughVault,
    passes: { 'src/lib/vault/client.ts': "call('submit-bank', form)", 'src/app/api/onboarding/token/[token]/documents/route.ts': "if (type === 'bank_proof') refuse()" },
    fails: { 'src/lib/vault/client.ts': "call('seal-document', x)" },
  },
  {
    name: 'DPDP-34 feedback sealed on close',
    check: S.feedbackSealedOnClose,
    passes: { 'src/lib/reviews/service.ts': 'await sealCycleFeedback(ctx, cycle)' },
    fails: { 'src/lib/reviews/service.ts': "stage: 'closed'" },
  },
  {
    name: 'DPDP-35 answers sealable',
    check: S.answersSealable,
    passes: { 'src/lib/vault/sealing.ts': "type SealableKind = 'identity_document' | 'feedback' | 'form_answer' | 'decision_note'" },
    fails: { 'src/lib/vault/sealing.ts': "type SealableKind = 'identity_document' | 'feedback'" },
  },
  {
    name: 'DPDP-41 audit descriptions clean',
    check: S.auditDescriptionsClean,
    passes: { 'src/lib/audit/events.ts': "x: (o) => auditEvent('m', 'a.b', `Status changed to ${o.to}.`, { ...o, metadata: { note: o.note } })" },
    fails: { 'src/lib/audit/events.ts': "x: (o) => auditEvent('m', 'a.b', `Changed${o.note ? ` — ${o.note}` : '.'}`, { ...o })" },
  },
  {
    name: 'DPDP-42 email logs without bodies',
    check: S.emailLogsWithoutBodies,
    passes: { 'src/lib/email/sendEmail.ts': "db.from('email_delivery_logs').insert({ subject, status })" },
    fails: { 'src/lib/email/sendEmail.ts': "db.from('email_delivery_logs').insert({ subject, body_preview: text })" },
  },
  {
    name: 'DPDP-44 optional fields from settings',
    check: S.optionalFieldsFromSettings,
    passes: { [PORTAL]: 'const rules = data.optional_fields', [ROUTE]: 'buildPersonalDetailsSchema(settings)' },
    fails: { [PORTAL]: 'const form = {}', [ROUTE]: 'update(body)' },
  },
]

describe('static checks', () => {
  for (const c of cases) {
    it(`${c.name}: passes`, () => {
      expect(c.check(memoryRepo(c.passes)).status).toBe('pass')
    })
    it(`${c.name}: fails`, () => {
      expect(c.check(memoryRepo(c.fails)).status).toBe('fail')
    })
  }
})
