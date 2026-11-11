import { describe, it, expect, vi, beforeEach } from 'vitest'

// Super Admin's reveal of who wrote which peer review: refused to everyone
// else, refused without a reason, logged before anything is shown, and not
// shown at all if the log cannot be written.

const state = vi.hoisted(() => ({
  role: 'super_admin' as string,
  me: null as { id: string } | null,
  logged: [] as Record<string, unknown>[],
  logOk: true,
}))

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/rbac/guard', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/rbac/guard')>()),
  guard: vi.fn(async (allowed: readonly string[] | string) => {
    const list = typeof allowed === 'string' ? [] : allowed
    return list.includes(state.role)
      ? { ok: true, caller: { role: state.role, originalRole: state.role, userId: 'u1', email: 'sa@example.org' } }
      : { ok: false, error: 'You do not have access to do that.' }
  }),
}))
vi.mock('@/lib/supabase/server', () => ({
  createServerSupabaseClient: async () => ({
    from: (table: string) => {
      const row = table === 'review_cycles' ? { id: CYCLE, employee_id: 'ravi', manager_id: 'meera' } : { manager_id: 'meera' }
      const q = { select: () => q, eq: () => q, maybeSingle: async () => ({ data: row, error: null }) }
      return q
    },
  }),
}))
vi.mock('@/lib/forms/currentEmployee', () => ({ getCurrentEmployee: async () => ({ employee: state.me }) }))
vi.mock('@/lib/supabase/admin', () => ({
  createAdminSupabaseClient: () => ({
    from: (table: string) => ({
      select: () => ({
        eq: async () => ({ data: [], error: null }),
        in: async () => ({
          data: table === 'employees' ? [{ id: 'p1', name: 'Asha' }, { id: 'p2', name: 'Bilal' }, { id: 'p3', name: 'Chen' }] : [],
          error: null,
        }),
      }),
    }),
  }),
}))
vi.mock('./service', () => ({
  cancelCycle: vi.fn(), closeCycle: vi.fn(), defaultCtx: vi.fn(), loadSettings: vi.fn(), openCycle: vi.fn(),
  recordDecision: vi.fn(), remind: vi.fn(), runAutomation: vi.fn(), scheduleMeeting: vi.fn(),
  setNominations: vi.fn(), withdrawParticipant: vi.fn(), whoIsDue: vi.fn(),
}))
vi.mock('./queries', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./queries')>()),
  loadSubmittedReviews: vi.fn(async () => ({
    self: null,
    manager: null,
    peers: ['p2', 'p1', 'p3'].map((id) => ({
      employeeId: id,
      block: { title: 'Peer review', submittedAt: null, answers: [{ label: 'Strengths', value: `answer by ${id}` }] },
    })),
  })),
}))
vi.mock('@/lib/audit/events', () => ({
  auditPeerFeedback: {
    reviewersRevealed: vi.fn(async (o: Record<string, unknown>) => {
      state.logged.push(o)
      return state.logOk
    }),
  },
}))
vi.mock('@/lib/audit/subject', () => ({ resolveEmployeeSubject: async (id: string) => ({ employee_id: id }) }))
vi.mock('@/lib/settings/access', () => ({ platformConfigRefusal: async () => null }))
vi.mock('@/lib/logs/writer', () => ({ logWriter: () => null }))

const CYCLE = '11111111-1111-4111-8111-111111111111'
import { revealPeerReviewers } from './actions'

beforeEach(() => {
  state.role = 'super_admin'
  state.me = null
  state.logged.length = 0
  state.logOk = true
})

describe('revealPeerReviewers', () => {
  const REASON = 'Two answers look copied from each other'

  it('shows Super Admin who wrote which peer review, and logs the reason', async () => {
    const res = await revealPeerReviewers(CYCLE, REASON)
    expect(res).toEqual({
      ok: true,
      reviews: [
        { reviewer: 'Asha', answers: [{ label: 'Strengths', value: 'answer by p1' }] },
        { reviewer: 'Bilal', answers: [{ label: 'Strengths', value: 'answer by p2' }] },
        { reviewer: 'Chen', answers: [{ label: 'Strengths', value: 'answer by p3' }] },
      ],
    })
    expect(state.logged).toHaveLength(1)
    expect(state.logged[0]).toMatchObject({ entityId: CYCLE, reason: REASON, peerCount: 3, actorEmail: 'sa@example.org' })
  })

  it('refuses every other role, before logging anything', async () => {
    for (const role of ['pnc_admin', 'exec_view', 'pnc_ops', 'manager', 'employee']) {
      state.role = role
      expect((await revealPeerReviewers(CYCLE, REASON)).ok).toBe(false)
    }
    expect(state.logged).toHaveLength(0)
  })

  it('refuses a missing or short reason', async () => {
    expect((await revealPeerReviewers(CYCLE, '')).ok).toBe(false)
    expect((await revealPeerReviewers(CYCLE, 'because')).ok).toBe(false)
    expect(state.logged).toHaveLength(0)
  })

  it('refuses Super Admin on their own review, or one they manage', async () => {
    state.me = { id: 'ravi' }
    expect((await revealPeerReviewers(CYCLE, REASON)).ok).toBe(false)
    state.me = { id: 'meera' }
    expect((await revealPeerReviewers(CYCLE, REASON)).ok).toBe(false)
    expect(state.logged).toHaveLength(0)
  })

  it('shows nothing when the reveal cannot be logged', async () => {
    state.logOk = false
    const res = await revealPeerReviewers(CYCLE, REASON)
    expect(res.ok).toBe(false)
    expect(JSON.stringify(res)).not.toMatch(/Asha|answer by/)
  })
})
