import { describe, it, expect, vi, beforeEach } from 'vitest'

// The portal link's validity window: refused without an end date or past it,
// and every send of the invitation issues a new link with a new end date.

const state = vi.hoisted(() => ({
  row: null as Record<string, unknown> | null,
  updates: [] as Record<string, unknown>[],
  sentWith: [] as string[],
  sendOk: true,
  validityDays: 7,
}))

function table(name: string) {
  const q: Record<string, unknown> = {}
  Object.assign(q, {
    select: () => q,
    eq: () => q,
    in: () => q,
    order: () => q,
    update: (patch: Record<string, unknown>) => {
      if (name === 'onboarding_records') state.updates.push(patch)
      return { eq: async () => ({ error: null }) }
    },
    insert: async () => ({ error: null }),
    maybeSingle: async () => ({ data: name === 'onboarding_records' ? state.row : null, error: null }),
    then: (resolve: (v: unknown) => void) => resolve({ data: [], error: null }),
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
vi.mock('./invitation-email', () => ({
  sendInvitationEmail: vi.fn(async (record: { invitation_token: string }) => {
    state.sentWith.push(record.invitation_token)
    return state.sendOk ? { sent: true } : { sent: false, error: 'mail down' }
  }),
}))
vi.mock('@/lib/audit/events', () => ({ auditOnboarding: { invitationSent: vi.fn(async () => undefined) } }))

import { portalLink, sendOnboardingInvitation } from './service'

const NOW = new Date('2026-11-11T12:00:00Z')
const record = (over: Record<string, unknown> = {}) => ({
  id: '11111111-1111-4111-8111-111111111111',
  candidate_name: 'Asha Kumari',
  personal_email: 'asha@example.org',
  status: 'invited',
  joiner_status: 'offer_pending',
  invitation_token: 'oldtokenoldtoken-asha-kumari',
  invitation_expires_at: '2026-11-15T00:00:00Z',
  ...over,
})

beforeEach(() => {
  state.row = record()
  state.updates.length = 0
  state.sentWith.length = 0
  state.sendOk = true
  state.validityDays = 7
})

describe('portalLink', () => {
  it('opens a link before its end date', async () => {
    expect(await portalLink('oldtokenoldtoken-asha-kumari', NOW)).toEqual({ state: 'open', id: record().id })
  })

  it('refuses a link past its end date', async () => {
    state.row = record({ invitation_expires_at: '2026-11-10T00:00:00Z' })
    expect((await portalLink('oldtokenoldtoken-asha-kumari', NOW)).state).toBe('expired')
  })

  it('refuses a link that was never given an end date', async () => {
    state.row = record({ invitation_expires_at: null })
    expect((await portalLink('oldtokenoldtoken-asha-kumari', NOW)).state).toBe('expired')
  })

  it('keeps a closed record unknown, whatever its date', async () => {
    state.row = record({ joiner_status: 'withdrawn' })
    expect((await portalLink('oldtokenoldtoken-asha-kumari', NOW)).state).toBe('unknown')
    state.row = null
    expect((await portalLink('no-such-token', NOW)).state).toBe('unknown')
  })
})

describe('sendOnboardingInvitation', () => {
  it('emails a new link, then saves it with an end date from the setting', async () => {
    state.validityDays = 3
    const before = Date.now()
    await sendOnboardingInvitation(record().id)
    const saved = state.updates.find((u) => 'invitation_token' in u)!
    expect(state.sentWith).toEqual([saved.invitation_token])
    expect(saved.invitation_token).not.toBe(record().invitation_token)
    expect(saved.invitation_token).toMatch(/^[a-km-np-z2-9]{16}-asha-kumari$/)
    const days = (new Date(saved.invitation_expires_at as string).getTime() - before) / 86_400_000
    expect(days).toBeGreaterThan(2.99)
    expect(days).toBeLessThan(3.01)
  })

  it('keeps the old link when the email fails', async () => {
    state.sendOk = false
    await expect(sendOnboardingInvitation(record().id)).rejects.toThrow('mail down')
    expect(state.updates.some((u) => 'invitation_token' in u)).toBe(false)
  })
})
