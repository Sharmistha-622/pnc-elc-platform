import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// The portal's token route: the notice comes first, then the age check, and a
// joiner under 18 has nothing stored until a guardian's consent is recorded.

const state = vi.hoisted(() => ({
  acknowledged: true,
  guardian: 'not_checked' as string,
  setStatus: [] as string[],
  saved: [] as unknown[],
  signed: [] as Array<{ docType: unknown; signer: unknown; dataUrl: unknown; meta: unknown }>,
}))

vi.mock('@/lib/onboarding/service', () => ({
  getOnboardingByToken: vi.fn(async () => ({ record: { id: 'c1' }, documents: [] })),
  recordPortalVisit: vi.fn(),
  updatePersonalDetails: vi.fn(async (_id: string, details: unknown) => {
    state.saved.push(details)
    return { record: { id: 'c1' }, documents: [] }
  }),
  confirmEmploymentDetails: vi.fn(async () => ({ record: { id: 'c1' }, documents: [] })),
  togglePolicyStatus: vi.fn(),
  signGeneratedDocument: vi.fn(async (_id: string, docType: unknown, signer: unknown, dataUrl: unknown, meta: unknown) => {
    state.signed.push({ docType, signer, dataUrl, meta })
    return { record: { id: 'c1' }, documents: [] }
  }),
  submitCandidateOnboarding: vi.fn(),
  toPortalView: vi.fn((d: unknown) => d),
}))
vi.mock('@/lib/dpdp/portal', () => ({
  getPortalPrivacySettings: vi.fn(async () => ({ optional_fields: {}, notice_languages: ['en'] })),
  getPortalNoticeState: vi.fn(),
}))
vi.mock('@/lib/dpdp/consent/service', () => ({
  hasAcknowledgedLatest: vi.fn(async () => state.acknowledged),
  recordAcknowledgment: vi.fn(),
  setConsent: vi.fn(),
}))
vi.mock('@/lib/dpdp/requests/service', () => ({ createRequest: vi.fn() }))
vi.mock('@/lib/onboarding/personal-details-schema', () => ({
  buildPersonalDetailsSchema: () => ({
    safeParse: (v: Record<string, unknown>) => ({ success: true, data: v }),
  }),
}))
vi.mock('@/lib/dpdp/guardian', () => ({
  GUARDIAN_HOLD_MESSAGE: 'held',
  guardianStatusOf: vi.fn(async () => state.guardian),
  setGuardianStatus: vi.fn(async (_id: string, s: string) => {
    state.setStatus.push(s)
  }),
}))

import { POST } from './route'

const post = (body: Record<string, unknown>) =>
  POST(new NextRequest('http://localhost/api/onboarding/token/t', { method: 'POST', body: JSON.stringify(body) }), {
    params: Promise.resolve({ token: 't' }),
  })

beforeEach(() => {
  state.acknowledged = true
  state.guardian = 'not_checked'
  state.setStatus = []
  state.saved = []
  state.signed = []
})

describe('portal token route: age check', () => {
  it('holds a joiner under 18 and stores none of their details', async () => {
    const res = await post({ action: 'update_personal', personal_details: { full_name: 'Young Example', date_of_birth: '2010-01-01' } })
    expect(res.status).toBe(409)
    expect((await res.json()).guardian).toBe('required')
    expect(state.setStatus).toEqual(['required'])
    expect(state.saved).toHaveLength(0)
  })

  it('saves an adult\'s details and records that no guardian is needed', async () => {
    const res = await post({ action: 'update_personal', personal_details: { full_name: 'Adult Example', date_of_birth: '1995-01-01' } })
    expect(res.status).toBe(200)
    expect(state.setStatus).toEqual(['not_required'])
    expect(state.saved).toHaveLength(1)
  })

  it('refuses every other step while guardian consent is required', async () => {
    state.guardian = 'required'
    const res = await post({ action: 'confirm_employment', confirmed: true })
    expect(res.status).toBe(409)
    const again = await post({ action: 'update_personal', personal_details: { date_of_birth: '1990-01-01' } })
    expect(again.status).toBe(409)
    expect(state.saved).toHaveLength(0)
  })

  it('continues once a guardian has consented', async () => {
    state.guardian = 'given'
    const res = await post({ action: 'update_personal', personal_details: { full_name: 'Young Example', date_of_birth: '2010-01-01' } })
    expect(res.status).toBe(200)
    expect(state.saved).toHaveLength(1)
  })

  it('still asks for the notice first', async () => {
    state.acknowledged = false
    const res = await post({ action: 'update_personal', personal_details: { date_of_birth: '1995-01-01' } })
    expect(res.status).toBe(409)
    expect(state.setStatus).toHaveLength(0)
  })

  it('stores an uploaded signature with method upload and ignores unknown methods (#192)', async () => {
    const uploadRes = await post({
      action: 'sign_document',
      document_type: 'offer_letter',
      signer_name: 'Asha Example',
      signature_data_url: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      method: 'upload',
    })
    expect(uploadRes.status).toBe(200)
    expect(state.signed).toHaveLength(1)
    expect(state.signed[0].dataUrl).toMatch(/^data:image\/png;base64,/)
    expect((state.signed[0].meta as { method: string }).method).toBe('upload')

    const forgedMethodRes = await post({
      action: 'sign_document',
      document_type: 'appointment_letter',
      signer_name: 'Asha Example',
      signature_data_url: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      method: 'forged_method',
    })
    expect(forgedMethodRes.status).toBe(200)
    expect(state.signed).toHaveLength(2)
    expect((state.signed[1].meta as { method: string }).method).toBe('draw')
  })
})
