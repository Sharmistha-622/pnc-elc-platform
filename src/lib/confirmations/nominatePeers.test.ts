import { describe, it, expect, vi } from 'vitest'

const state = vi.hoisted(() => ({
  inserted: [] as Record<string, unknown>[],
  readBack: false,
  emails: [] as { to: string; body: string }[],
}))

vi.mock('@/lib/supabase/server', () => ({
  createServerSupabaseClient: async () => ({
    from: () => ({
      insert: (rows: Record<string, unknown>[]) => {
        state.inserted.push(...rows)
        const result = Promise.resolve({ error: null })
        // A read-back would need the select policy, which PnC Ops does not hold.
        return Object.assign(result, {
          select: () => {
            state.readBack = true
            return result
          },
        })
      },
    }),
  }),
}))
vi.mock('@/lib/email/sendEmail', () => ({
  escapeHtml: (s: string) => s,
  sendEmail: vi.fn(async (_t: string, data: { body: string }, to: string) => {
    state.emails.push({ to, body: data.body })
    return { success: true }
  }),
}))
vi.mock('@/lib/settings/service', () => ({ getNotificationSettings: async () => null }))
vi.mock('@/lib/audit/events', () => ({ auditPeerFeedback: { requested: vi.fn(async () => undefined) } }))
vi.mock('@/lib/audit/subject', () => ({ resolveSubjectFromConfirmation: async () => null }))
vi.mock('@/lib/rbac/guard', () => ({
  guard: async () => ({ ok: true, caller: { role: 'pnc_ops', originalRole: 'pnc_ops', userId: 'u1' } }),
}))
vi.mock('@/lib/auth/allowedEmail', () => ({ isAllowedEmail: () => true }))
vi.mock('./access', () => ({
  confirmationEmployeeId: async () => 'e1',
  mayActOnConfirmationOf: async () => true,
}))

import { nominatePeers } from './nominatePeers'

describe('nominatePeers', () => {
  it('inserts with ids made on the server and reads nothing back', async () => {
    const res = await nominatePeers('c1', [
      { name: 'Peer One', email: 'one@example.org' },
      { name: 'Peer Two', email: 'two@example.org' },
    ])
    expect(state.readBack).toBe(false)
    expect(state.inserted).toHaveLength(2)
    for (const row of state.inserted) expect(row.id).toMatch(/^[0-9a-f-]{36}$/)
    expect(res?.map((r) => r.id)).toEqual(state.inserted.map((r) => r.id))
    // Each peer's link carries the id that was inserted for them.
    expect(state.emails[0].body).toContain(`/feedback/${state.inserted[0].id}`)
    expect(state.emails[1].body).toContain(`/feedback/${state.inserted[1].id}`)
  })
})
