import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const createOnboardingRecord = vi.fn(async () => ({ record: { id: 'r1' } }))

vi.mock('@/lib/onboarding/service', () => ({
  getAllOnboardingRecords: vi.fn(),
  getAllFullOnboardingData: vi.fn(),
  createOnboardingRecord: (...args: unknown[]) => createOnboardingRecord(...(args as [])),
}))
vi.mock('@/lib/rbac/guard', () => ({
  guard: async () => ({ ok: true, caller: { userId: 'u1', email: 'pnc@example.com', role: 'pnc_admin' } }),
  maySeeSalary: () => true,
}))

const { POST } = await import('./route')

const post = (body: Record<string, unknown>) =>
  POST(new NextRequest('http://localhost/api/onboarding', { method: 'POST', body: JSON.stringify(body) }))

const CANDIDATE = { candidate_name: 'Test Candidate', personal_email: 'candidate@example.com', designation: 'Associate', ctc_amount: 50000 }

describe('POST /api/onboarding: alumni status is mandatory', () => {
  beforeEach(() => createOnboardingRecord.mockClear())

  it.each([
    ['missing', {}],
    ['null', { is_alumni: null }],
    ['a string', { is_alumni: 'no' }],
  ])('refuses a candidate whose alumni status is %s, and creates nothing', async (_label, extra) => {
    const res = await post({ ...CANDIDATE, ...extra })
    expect(res.status).toBe(400)
    expect(await res.json()).toMatchObject({ success: false, error: expect.stringContaining('alumnus') })
    expect(createOnboardingRecord).not.toHaveBeenCalled()
  })

  it.each([true, false])('creates the candidate when the answer is %s', async (isAlumni) => {
    const res = await post({ ...CANDIDATE, is_alumni: isAlumni })
    expect(res.status).toBe(200)
    expect(createOnboardingRecord).toHaveBeenCalledWith(expect.objectContaining({ is_alumni: isAlumni }), undefined)
  })
})

describe('POST /api/onboarding: the offered CTC is typed, never assumed', () => {
  beforeEach(() => createOnboardingRecord.mockClear())

  it.each([
    ['missing', { ctc_amount: undefined }],
    ['zero', { ctc_amount: 0 }],
    ['text', { ctc_amount: '60000' }],
  ])('refuses a candidate whose CTC is %s', async (_label, extra) => {
    const res = await post({ ...CANDIDATE, is_alumni: false, ...extra })
    expect(res.status).toBe(400)
    expect(createOnboardingRecord).not.toHaveBeenCalled()
  })
})
