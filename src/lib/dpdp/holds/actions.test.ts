import { describe, it, expect, vi, beforeEach } from 'vitest'

// Legal holds, with the guard and the service-role client stubbed: who may
// place and release a hold, and what a valid one needs.

const state = vi.hoisted(() => ({
  guarded: true,
  feature: '' as string,
  inserted: [] as Record<string, unknown>[],
  updated: [] as Record<string, unknown>[],
  releasedRows: [{ id: 'h1' }] as { id: string }[],
}))

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/rbac/guard', () => ({
  guard: vi.fn(async (feature: string) => {
    state.feature = feature
    return state.guarded
      ? { ok: true, caller: { userId: 'u1', email: 'pnc-admin@example.com', role: 'pnc_admin', originalRole: 'pnc_admin' } }
      : { ok: false, error: 'You do not have access to do that.' }
  }),
}))
vi.mock('@/lib/supabase/admin', () => ({
  createAdminSupabaseClient: () => ({
    from: () => ({
      insert: async (row: Record<string, unknown>) => {
        state.inserted.push(row)
        return { error: null }
      },
      update: (patch: Record<string, unknown>) => {
        state.updated.push(patch)
        const chain = { eq: () => chain, is: () => chain, select: async () => ({ data: state.releasedRows, error: null }) }
        return chain
      },
    }),
  }),
}))

import { placeLegalHold, releaseLegalHold } from './actions'

const PERSON = '00000000-0000-4000-8000-0000000000c1'
const future = '2099-01-01'

beforeEach(() => {
  state.guarded = true
  state.inserted = []
  state.updated = []
  state.releasedRows = [{ id: 'h1' }]
})

describe('placeLegalHold', () => {
  it('needs privacy case access', async () => {
    state.guarded = false
    const r = await placeLegalHold({ subject_type: 'employee', subject_ref: PERSON, reason: 'Claim pending', review_date: future })
    expect(r.success).toBe(false)
    expect(state.feature).toBe('privacyCases')
    expect(state.inserted).toHaveLength(0)
  })

  it('places a hold on a person, recording who placed it', async () => {
    const r = await placeLegalHold({ subject_type: 'candidate', subject_ref: PERSON, reason: 'Labour court summons', review_date: future })
    expect(r.success).toBe(true)
    expect(state.inserted[0]).toMatchObject({ subject_type: 'candidate', subject_ref: PERSON, record_table: null, placed_by: 'pnc-admin@example.com' })
  })

  it('places a hold on one record', async () => {
    const r = await placeLegalHold({ subject_type: 'record', record_table: 'privacy_requests', record_id: PERSON, reason: 'Board inquiry', review_date: future })
    expect(r.success).toBe(true)
    expect(state.inserted[0]).toMatchObject({ subject_type: 'record', subject_ref: null, record_table: 'privacy_requests', record_id: PERSON })
  })

  it('refuses a hold with no person, no reason or a past review date', async () => {
    expect((await placeLegalHold({ subject_type: 'employee', reason: 'Claim pending', review_date: future })).success).toBe(false)
    expect((await placeLegalHold({ subject_type: 'employee', subject_ref: PERSON, reason: 'x', review_date: future })).success).toBe(false)
    expect((await placeLegalHold({ subject_type: 'employee', subject_ref: PERSON, reason: 'Claim pending', review_date: '2020-01-01' })).success).toBe(false)
    expect((await placeLegalHold({ subject_type: 'record', record_table: 'employees', record_id: PERSON, reason: 'Claim pending', review_date: future })).success).toBe(false)
    expect(state.inserted).toHaveLength(0)
  })
})

describe('releaseLegalHold', () => {
  it('needs privacy case access and a reason', async () => {
    state.guarded = false
    expect((await releaseLegalHold({ id: PERSON, release_reason: 'Claim settled' })).success).toBe(false)
    state.guarded = true
    expect((await releaseLegalHold({ id: PERSON, release_reason: '' })).success).toBe(false)
    expect(state.updated).toHaveLength(0)
  })

  it('records the release, and says so when it was already released', async () => {
    expect((await releaseLegalHold({ id: PERSON, release_reason: 'Claim settled' })).success).toBe(true)
    expect(state.updated[0]).toMatchObject({ released_by: 'pnc-admin@example.com', release_reason: 'Claim settled' })
    state.releasedRows = []
    const again = await releaseLegalHold({ id: PERSON, release_reason: 'Claim settled' })
    expect(again).toEqual({ success: false, error: 'That hold is already released.' })
  })
})
