import { describe, it, expect, vi, beforeEach } from 'vitest'

// Recording a guardian's consent, with the guard, settings and the
// service-role client stubbed.

const state = vi.hoisted(() => ({
  guarded: true,
  held: true,
  consentError: null as null | { message: string },
  updates: [] as { patch: Record<string, unknown>; filters: [string, unknown][] }[],
  consents: [] as Record<string, unknown>[],
  logs: [] as Record<string, unknown>[],
}))

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/rbac/guard', () => ({
  guard: vi.fn(async () =>
    state.guarded
      ? { ok: true, caller: { userId: 'u1', email: 'pnc-admin@example.com', role: 'pnc_admin', originalRole: 'pnc_admin' } }
      : { ok: false, error: 'You do not have access to do that.' },
  ),
}))
vi.mock('../settings/queries', () => ({ readDpdpSettings: vi.fn(async () => ({ guardian_methods: ['document_check'] })) }))
vi.mock('@/lib/supabase/admin', () => ({
  createAdminSupabaseClient: () => ({
    from: (table: string) => ({
      update: (patch: Record<string, unknown>) => {
        const u = { patch, filters: [] as [string, unknown][] }
        state.updates.push(u)
        const chain = {
          eq: (c: string, v: unknown) => {
            u.filters.push([c, v])
            return chain
          },
          select: async () => ({ data: state.held ? [{ id: 'c1' }] : [], error: null }),
          then: (r: (v: unknown) => unknown) => Promise.resolve({ error: null }).then(r),
        }
        return chain
      },
      insert: async (row: Record<string, unknown>) => {
        if (table === 'consent_records') {
          if (state.consentError) return { error: state.consentError }
          state.consents.push(row)
        } else state.logs.push(row)
        return { error: null }
      },
    }),
  }),
}))

import { recordGuardianConsent, confirmAdultAge } from './actions'

const ID = '00000000-0000-4000-8000-0000000000c1'
const valid = { onboarding_id: ID, method: 'document_check', channel: 'in_person', evidence_note: "Checked the mother's identity document" }

beforeEach(() => {
  state.guarded = true
  state.held = true
  state.consentError = null
  state.updates = []
  state.consents = []
  state.logs = []
})

describe('recordGuardianConsent', () => {
  it('needs privacy case access', async () => {
    state.guarded = false
    expect((await recordGuardianConsent(valid)).success).toBe(false)
    expect(state.updates).toHaveLength(0)
  })

  it('records a guardian consent record and opens the portal again', async () => {
    const r = await recordGuardianConsent(valid)
    expect(r.success).toBe(true)
    expect(state.updates[0].patch).toEqual({ guardian_consent_status: 'given' })
    expect(state.updates[0].filters).toContainEqual(['guardian_consent_status', 'required'])
    expect(state.consents[0]).toMatchObject({ principal_type: 'candidate', principal_ref: ID, record_type: 'guardian', method: 'document_check', recorded_by: 'pnc-admin@example.com' })
    expect(state.logs[0]).toMatchObject({ action: 'Guardian Consent Recorded' })
  })

  it('refuses a method the settings do not allow', async () => {
    const r = await recordGuardianConsent({ ...valid, method: 'employee_attestation' })
    expect(r.success).toBe(false)
    expect(state.updates).toHaveLength(0)
  })

  it('refuses a joiner who is not waiting', async () => {
    state.held = false
    expect(await recordGuardianConsent(valid)).toEqual({ success: false, error: 'This joiner is not waiting for guardian consent.' })
    expect(state.consents).toHaveLength(0)
  })

  it('puts the hold back if the consent record cannot be written', async () => {
    state.consentError = { message: 'x' }
    expect((await recordGuardianConsent(valid)).success).toBe(false)
    expect(state.updates.at(-1)?.patch).toEqual({ guardian_consent_status: 'required' })
  })
})

describe('confirmAdultAge', () => {
  it('clears the hold so the joiner enters their date of birth again', async () => {
    const r = await confirmAdultAge({ onboarding_id: ID, evidence_note: 'Birth certificate shows 18 or over' })
    expect(r.success).toBe(true)
    expect(state.updates[0].patch).toEqual({ guardian_consent_status: 'not_required' })
    expect(state.logs[0]).toMatchObject({ action: 'Age Confirmed' })
  })
})
