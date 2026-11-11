import { describe, it, expect, vi, beforeEach } from 'vitest'

// Which tables each client was asked for, and what the fake rows hold.
const state = vi.hoisted(() => ({
  role: 'pnc_ops' as string,
  sessionTables: [] as string[],
  adminTables: [] as string[],
  admin: true,
  rows: [
    { id: 'f1', peer_name: 'Peer One', response_status: 'submitted', submitted_at: '2026-11-01', feedback_text: 'Always late to standups' },
    { id: 'f2', peer_name: 'Peer Two', response_status: 'submitted', submitted_at: '2026-11-02', feedback_text: 'Great teammate' },
  ],
}))

function client(record: string[]) {
  return {
    from(table: string) {
      record.push(table)
      const result =
        table === 'confirmations'
          ? { data: { employee_id: 'e1', employees: { name: 'R', employee_types: { name: 'FTE' } } }, error: null }
          : table === 'peer_feedback_status'
            ? { data: state.rows.map(({ feedback_text: _t, ...status }) => status), error: null }
            : { data: state.rows, error: null }
      const chain = {
        select: () => chain,
        eq: () => chain,
        single: async () => result,
        then: (resolve: (v: unknown) => void) => resolve(result),
      }
      return chain
    },
  }
}

vi.mock('@/lib/supabase/server', () => ({ createServerSupabaseClient: async () => client(state.sessionTables) }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminSupabaseClient: () => (state.admin ? client(state.adminTables) : null) }))
vi.mock('@/lib/settings/service', () => ({
  getActiveRedFlagKeywords: async () => ['late'],
  getPeerFeedbackSettings: async () => ({ red_flag_response_threshold: 0.5 }),
}))
vi.mock('@/lib/rbac/guard', () => ({
  guard: async () => ({ ok: true, caller: { role: state.role, originalRole: state.role, userId: 'u1' } }),
}))

import { getCompiledFeedback } from './getCompiledFeedback'

beforeEach(() => {
  state.sessionTables.length = 0
  state.adminTables.length = 0
  state.admin = true
})

describe('getCompiledFeedback for a status-only reader (PnC Ops)', () => {
  beforeEach(() => {
    state.role = 'pnc_ops'
  })

  it('reads statuses from peer_feedback_status, never the feedback table, through the session', async () => {
    const report = await getCompiledFeedback('c1')
    expect(state.sessionTables).toContain('peer_feedback_status')
    expect(state.sessionTables).not.toContain('peer_feedback')
    expect(report?.peers.map((p) => p.peerName)).toEqual(['Peer One', 'Peer Two'])
    expect(report?.totalSubmitted).toBe(2)
  })

  it('returns no text, and says only that a flagged term exists', async () => {
    const report = await getCompiledFeedback('c1')
    expect(report?.responses).toBeNull()
    expect(report?.redFlag).toBe(true)
    expect(report?.redFlagReason).toBe('Submitted feedback contains a flagged term')
    expect(JSON.stringify(report)).not.toMatch(/late to standups|Great teammate|"late"/)
  })

  it('raises no keyword flag without the service key, rather than reading text another way', async () => {
    state.admin = false
    const report = await getCompiledFeedback('c1')
    expect(report?.redFlag).toBe(false)
    expect(state.sessionTables).not.toContain('peer_feedback')
  })
})

describe('getCompiledFeedback for a text reader (PnC Admin)', () => {
  it('reads the feedback rows and returns the text, detached from names', async () => {
    state.role = 'pnc_admin'
    const report = await getCompiledFeedback('c1')
    expect(state.sessionTables).toContain('peer_feedback')
    expect(state.adminTables).toHaveLength(0)
    expect(report?.responses).toEqual(['Always late to standups', 'Great teammate'])
    expect(report?.redFlagReason).toBe('Feedback contains flagged term: "late"')
  })
})
