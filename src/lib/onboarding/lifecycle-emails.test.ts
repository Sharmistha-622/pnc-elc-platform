import { beforeEach, describe, expect, it, vi } from 'vitest'
import { EMAIL_TEMPLATE_ALLOWLIST, isForbiddenEmailVariable } from '@/lib/email/templates'

const state = vi.hoisted(() => ({
  row: null as Record<string, unknown> | null,
  docs: [] as Record<string, unknown>[],
  updates: [] as Record<string, unknown>[],
  activityLogs: [] as Record<string, unknown>[],
  sentEmails: [] as { template: string; data: Record<string, string>; to: string }[],
  pncMailbox: 'pnc-alerts@example.org' as string | null,
  validityDays: 5,
  sendShouldFail: false,
}))

function table(name: string) {
  const q: Record<string, unknown> = {}
  Object.assign(q, {
    select: () => q,
    eq: () => q,
    in: () => q,
    order: () => q,
    upsert: async () => ({ error: null }),
    update: (patch: Record<string, unknown>) => {
      if (name === 'onboarding_records') state.updates.push(patch)
      return { eq: async () => ({ error: null }) }
    },
    insert: async (payload: Record<string, unknown>) => {
      if (name === 'onboarding_activity_log') state.activityLogs.push(payload)
      return { error: null }
    },
    maybeSingle: async () => {
      if (name === 'onboarding_records') return { data: state.row, error: null }
      if (name === 'review_cycle_settings') {
        return {
          data: { pnc_notification_email: state.pncMailbox },
          error: null,
        }
      }
      return { data: null, error: null }
    },
    then: (resolve: (v: unknown) => void) => {
      if (name === 'onboarding_documents') return resolve({ data: state.docs, error: null })
      return resolve({ data: [], error: null })
    },
  })
  return q
}

vi.mock('./db', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./db')>()),
  onboardingDb: () => ({ from: table }),
}))

vi.mock('@/lib/dpdp/portal', () => ({
  getPortalPrivacySettings: async () => ({ invitation_validity_days: state.validityDays }),
  getDriveCopyTypes: async () => [],
}))

vi.mock('@/lib/email/sendEmail', () => ({
  escapeHtml: (s: string) => s,
  sendEmail: vi.fn(async (template: string, data: Record<string, string>, to: string) => {
    if (state.sendShouldFail) {
      return { success: false, error: 'simulated mail failure' }
    }
    state.sentEmails.push({ template, data, to })
    return { success: true, messageId: 'msg-1' }
  }),
}))

vi.mock('@/lib/audit/events', () => ({
  auditOnboarding: {
    invitationSent: vi.fn(async () => undefined),
    detailsConfirmed: vi.fn(async () => undefined),
    correctionRequested: vi.fn(async () => undefined),
    detailsSubmitted: vi.fn(async () => undefined),
    documentReviewed: vi.fn(async () => undefined),
    statusChanged: vi.fn(async () => undefined),
    accountProvisioned: vi.fn(async () => undefined),
  },
  auditLetters: {
    signed: vi.fn(async () => undefined),
  },
}))

import {
  confirmEmploymentDetails,
  submitCandidateOnboarding,
  updateOnboardingStatus,
  verifyOrRejectDocument,
} from './service'

const CANDIDATE_ID = '22222222-2222-4222-8222-222222222222'

function baseRecord(over: Record<string, unknown> = {}) {
  return {
    id: CANDIDATE_ID,
    candidate_name: 'Kiran Verma',
    personal_email: 'kiran.verma@example.org',
    designation: 'Curriculum Associate',
    department: 'Academics',
    joining_date: '2026-12-01',
    manager_name: 'Riya Kapoor',
    buddy_name: 'Devansh Joshi',
    location: 'Dharamshala Campus',
    status: 'in_progress',
    joiner_status: 'offer_accepted',
    progress_percentage: 80,
    invitation_token: 'oldtokenoldtoken-kiran-verma',
    invitation_expires_at: '2026-11-14T00:00:00.000Z',
    is_alumni: false,
    ctc: '600000',
    ctc_amount: 600000,
    ctc_frequency: 'annual',
    ...over,
  }
}

beforeEach(() => {
  state.row = baseRecord()
  state.docs = [
    {
      id: 'doc-pan-1',
      onboarding_id: CANDIDATE_ID,
      document_type: 'PAN Card',
      document_type_key: 'pan_card',
      file_name: 'pan.pdf',
      status: 'uploaded',
      is_required: true,
      sort_order: 1,
    },
  ]
  state.updates.length = 0
  state.activityLogs.length = 0
  state.sentEmails.length = 0
  state.pncMailbox = 'pnc-alerts@example.org'
  state.validityDays = 5
  state.sendShouldFail = false
})

describe('Onboarding lifecycle emails (#151)', () => {
  it('Candidate submits: sends one email to the candidate and one to the PnC mailbox', async () => {
    await submitCandidateOnboarding(CANDIDATE_ID)

    expect(state.sentEmails).toHaveLength(2)
    expect(state.sentEmails[0].template).toBe('onboarding_submitted_candidate')
    expect(state.sentEmails[0].to).toBe('kiran.verma@example.org')
    expect(state.sentEmails[0].data.candidate_name).toBe('Kiran Verma')

    expect(state.sentEmails[1].template).toBe('onboarding_submitted_pnc')
    expect(state.sentEmails[1].to).toBe('pnc-alerts@example.org')
    expect(state.sentEmails[1].data.review_url).toContain(`/onboarding/review/${CANDIDATE_ID}`)
  })

  it('Candidate submits: skips the PnC email and logs the skip when no PnC mailbox is set', async () => {
    state.pncMailbox = ''
    await submitCandidateOnboarding(CANDIDATE_ID)

    expect(state.sentEmails).toHaveLength(1)
    expect(state.sentEmails[0].template).toBe('onboarding_submitted_candidate')
    expect(state.sentEmails[0].to).toBe('kiran.verma@example.org')
    expect(state.activityLogs.some((l) => l.action === 'PnC Notification Skipped')).toBe(true)
  })

  it('Document rejected: issues a fresh portal link with a new end date and sends one email to the candidate', async () => {
    state.validityDays = 6
    const before = Date.now()

    await verifyOrRejectDocument(
      CANDIDATE_ID,
      'doc-pan-1',
      'rejected',
      'Name on scan is cropped; please upload a full image.',
      'PnC Reviewer'
    )

    expect(state.sentEmails).toHaveLength(1)
    const mail = state.sentEmails[0]
    expect(mail.template).toBe('onboarding_document_rejected')
    expect(mail.to).toBe('kiran.verma@example.org')
    expect(mail.data.document_type).toBe('PAN Card')
    expect(mail.data.rejection_reason).toContain('Name on scan is cropped')

    const tokenUpdate = state.updates.find((u) => 'invitation_token' in u)!
    expect(tokenUpdate).toBeDefined()
    expect(tokenUpdate.invitation_token).not.toBe('oldtokenoldtoken-kiran-verma')
    expect(mail.data.portal_link).toContain(String(tokenUpdate.invitation_token))

    const days =
      (new Date(tokenUpdate.invitation_expires_at as string).getTime() - before) / 86_400_000
    expect(days).toBeGreaterThan(5.99)
    expect(days).toBeLessThan(6.01)
  })

  it('Changes requested: issues a fresh portal link with a new end date and sends one email to the candidate', async () => {
    state.validityDays = 4
    const before = Date.now()

    await updateOnboardingStatus(
      CANDIDATE_ID,
      'changes_requested',
      'Please update your emergency contact phone number.'
    )

    expect(state.sentEmails).toHaveLength(1)
    const mail = state.sentEmails[0]
    expect(mail.template).toBe('onboarding_changes_requested')
    expect(mail.to).toBe('kiran.verma@example.org')
    expect(mail.data.reviewer_note).toBe('Please update your emergency contact phone number.')

    const tokenUpdate = state.updates.find((u) => 'invitation_token' in u)!
    expect(tokenUpdate).toBeDefined()
    expect(tokenUpdate.invitation_token).not.toBe('oldtokenoldtoken-kiran-verma')
    expect(mail.data.portal_link).toContain(String(tokenUpdate.invitation_token))

    const days =
      (new Date(tokenUpdate.invitation_expires_at as string).getTime() - before) / 86_400_000
    expect(days).toBeGreaterThan(3.99)
    expect(days).toBeLessThan(4.01)
  })

  it('Approved / set up: sends one email to the candidate with Day-1 expectations and no login credentials', async () => {
    await updateOnboardingStatus(CANDIDATE_ID, 'approved', 'All checks passed.')

    expect(state.sentEmails).toHaveLength(1)
    const mail = state.sentEmails[0]
    expect(mail.template).toBe('onboarding_approved')
    expect(mail.to).toBe('kiran.verma@example.org')
    expect(mail.data.manager_name).toBe('Riya Kapoor')
    expect(mail.data.buddy_name).toBe('Devansh Joshi')
    expect(JSON.stringify(mail.data)).not.toMatch(/password|pin|600000/i)
  })

  it('Request Correction on the terms step: sends one email to the PnC mailbox and skips when no mailbox is set', async () => {
    await confirmEmploymentDetails(
      CANDIDATE_ID,
      false,
      true,
      'Joining date should be 15 December 2026.'
    )

    expect(state.sentEmails).toHaveLength(1)
    const mail = state.sentEmails[0]
    expect(mail.template).toBe('onboarding_correction_requested')
    expect(mail.to).toBe('pnc-alerts@example.org')
    expect(mail.data.candidate_name).toBe('Kiran Verma')
    expect(mail.data.correction_notes).toBe('Joining date should be 15 December 2026.')
    expect(mail.data.review_url).toContain(`/onboarding/review/${CANDIDATE_ID}`)

    // When PnC mailbox is empty, skip and log
    state.sentEmails.length = 0
    state.activityLogs.length = 0
    state.pncMailbox = null

    await confirmEmploymentDetails(
      CANDIDATE_ID,
      false,
      true,
      'Please check reporting manager.'
    )
    expect(state.sentEmails).toHaveLength(0)
    expect(state.activityLogs.some((l) => l.action === 'PnC Notification Skipped')).toBe(true)
  })

  it('never fails the triggering action when an email send fails, and forbids salary/ID variables in all onboarding templates', async () => {
    state.sendShouldFail = true

    await expect(submitCandidateOnboarding(CANDIDATE_ID)).resolves.toBeTruthy()
    await expect(
      verifyOrRejectDocument(CANDIDATE_ID, 'doc-pan-1', 'rejected', 'Blurry scan')
    ).resolves.toBeTruthy()
    await expect(
      updateOnboardingStatus(CANDIDATE_ID, 'changes_requested', 'Fix address')
    ).resolves.toBeTruthy()
    await expect(updateOnboardingStatus(CANDIDATE_ID, 'approved')).resolves.toBeTruthy()
    await expect(
      confirmEmploymentDetails(CANDIDATE_ID, false, true, 'Typo in title')
    ).resolves.toBeTruthy()

    const onboardingKeys = [
      'onboarding_invitation',
      'onboarding_submitted_candidate',
      'onboarding_submitted_pnc',
      'onboarding_document_rejected',
      'onboarding_changes_requested',
      'onboarding_approved',
      'onboarding_correction_requested',
    ]
    for (const key of onboardingKeys) {
      const vars = EMAIL_TEMPLATE_ALLOWLIST[key]
      expect(vars).toBeDefined()
      for (const v of vars) {
        expect(isForbiddenEmailVariable(v)).toBe(false)
      }
    }
  })
})
