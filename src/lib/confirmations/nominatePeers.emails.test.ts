import { describe, it, expect, vi, beforeEach } from 'vitest'

// A colleague picked from the directory is emailed at the address on their
// record, looked up by the server; the browser holds no colleagues' emails.

const state = vi.hoisted(() => ({
  inserted: [] as Record<string, unknown>[],
  emailedTo: [] as string[],
  admin: true,
  people: [
    { id: 'p1', email: 'one@navgurukul.org', status: 'active' },
    { id: 'p2', email: 'two@navgurukul.org', status: 'exited' },
  ],
}))

function insertChain(rows: Record<string, unknown>[]) {
  state.inserted.push(...rows)
  const result = Promise.resolve({ data: rows.map((r, i) => ({ id: `f${i}`, ...r })), error: null })
  return Object.assign(result, { select: () => result })
}

vi.mock('@/lib/supabase/server', () => ({
  createServerSupabaseClient: async () => ({ from: () => ({ insert: insertChain }) }),
}))
vi.mock('@/lib/supabase/admin', () => ({
  createAdminSupabaseClient: () =>
    state.admin
      ? {
          from: () => ({
            select: () => ({
              in: async (_c: string, ids: string[]) => ({ data: state.people.filter((p) => ids.includes(p.id)), error: null }),
            }),
          }),
        }
      : null,
}))
vi.mock('@/lib/email/sendEmail', () => ({
  escapeHtml: (s: string) => s,
  sendEmail: vi.fn(async (_t: string, _d: unknown, to: string) => {
    state.emailedTo.push(to)
    return { success: true }
  }),
}))
vi.mock('@/lib/settings/service', () => ({ getNotificationSettings: async () => null }))
vi.mock('@/lib/audit/events', () => ({ auditPeerFeedback: { requested: vi.fn(async () => undefined) } }))
vi.mock('@/lib/audit/subject', () => ({ resolveSubjectFromConfirmation: async () => null }))
vi.mock('@/lib/rbac/guard', () => ({
  guard: async () => ({ ok: true, caller: { role: 'employee', originalRole: 'employee', userId: 'u1' } }),
}))
vi.mock('./access', () => ({ confirmationEmployeeId: async () => 'e1', mayActOnConfirmationOf: async () => true }))

import { nominatePeers } from './nominatePeers'

beforeEach(() => {
  state.inserted.length = 0
  state.emailedTo.length = 0
  state.admin = true
})

describe('nominatePeers and colleagues picked from the directory', () => {
  it("emails a picked colleague at their record's address, not one the browser sent", async () => {
    await nominatePeers('c1', [{ name: 'Peer One', employeeId: 'p1', email: 'attacker@navgurukul.org' }])
    expect(state.inserted[0]).toMatchObject({ peer_employee_id: 'p1', peer_email: 'one@navgurukul.org' })
    expect(state.emailedTo).toEqual(['one@navgurukul.org'])
  })

  it('keeps the address typed for a peer who was not picked', async () => {
    await nominatePeers('c1', [{ name: 'Typed Peer', email: 'typed@navgurukul.org' }])
    expect(state.inserted[0]).toMatchObject({ peer_employee_id: null, peer_email: 'typed@navgurukul.org' })
  })

  it('emails nobody for a picked colleague who has left, or when the server cannot look them up', async () => {
    await nominatePeers('c1', [{ name: 'Gone', employeeId: 'p2' }])
    expect(state.inserted[0]).toMatchObject({ peer_email: null })
    state.admin = false
    await nominatePeers('c1', [{ name: 'Peer One', employeeId: 'p1', email: 'one@navgurukul.org' }])
    expect(state.emailedTo).toEqual([])
  })
})
