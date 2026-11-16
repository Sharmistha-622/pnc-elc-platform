import { describe, it, expect, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'

// Closing a confirmation review seals its written peer feedback into the
// vault; a failed seal is noted on the timeline and never undoes the close.

vi.mock('@/lib/audit/events', () => ({ auditEvent: vi.fn(async () => null) }))
vi.mock('@/lib/email/sendEmail', () => ({ sendEmail: vi.fn(), sendCalendarInvite: vi.fn(), escapeHtml: (s: string) => s }))
vi.mock('@/lib/vault/seal-service', () => ({ sealFeedbackForConfirmation: vi.fn(), sealReviewCycleRecords: vi.fn() }))
vi.mock('@/lib/integrations/calendar-availability.server', () => ({ calendarAvailabilityService: {} }))

import { closeCycle, type Ctx } from './service'

function fakeDb(rows: Record<string, Record<string, unknown>[]>) {
  const writes: { table: string; op: string; value: unknown }[] = []
  const from = (table: string) => {
    let op = 'select'
    let value: unknown = null
    const self: Record<string, unknown> = {}
    for (const f of ['select', 'eq', 'neq', 'in', 'not', 'is', 'order', 'limit']) self[f] = () => self
    self.update = (v: unknown) => ((op = 'update'), (value = v), self)
    self.insert = (v: unknown) => ((op = 'insert'), (value = v), self)
    self.maybeSingle = () => Promise.resolve({ data: (rows[table] ?? [])[0] ?? null, error: null })
    self.then = (resolve: (v: unknown) => unknown) => {
      if (op !== 'select') writes.push({ table, op, value })
      return Promise.resolve({ data: op === 'select' ? (rows[table] ?? []) : null, error: null }).then(resolve)
    }
    return self
  }
  return { db: { from } as unknown as SupabaseClient, writes }
}

const cycle = {
  id: 'cy1', kind: 'confirmation', stage: 'decision_recorded', employee_id: 'e1', manager_id: 'm1',
  confirmation_id: 'conf1', appraisal_id: null, period_label: 'Confirmation 2026', meeting_start: null,
}
const rows = {
  review_cycles: [cycle],
  review_decisions: [{ cycle_id: 'cy1', decision: 'confirm', decided_by: 'm1' }],
  employees: [{ id: 'e1', name: 'Person Example', email: 'person@example.com' }],
  review_participants: [],
}

const ctx = (db: SupabaseClient, sealFeedback?: Ctx['sealFeedback']): Ctx => ({
  db, now: new Date('2026-11-07T10:00:00Z'), mail: { send: vi.fn() } as never, appUrl: 'http://localhost', actor: 'pnc@example.com', sealFeedback,
})

describe('closing a confirmation review', () => {
  it('seals its peer feedback into the vault', async () => {
    const { db } = fakeDb(rows)
    const seal = vi.fn().mockResolvedValue({ sealed: 3, failed: 0, errors: [] })
    const result = await closeCycle(ctx(db, seal), 'cy1', { outcome: 'accepted', note: '' })
    expect(result.ok).toBe(true)
    expect(seal).toHaveBeenCalledWith('conf1', { corePersonId: 'e1', cycle: 'Confirmation 2026', event: 'cycle_closed' })
  })

  it('still closes, and notes it on the timeline, when a seal fails', async () => {
    const { db, writes } = fakeDb(rows)
    const seal = vi.fn().mockResolvedValue({ sealed: 1, failed: 2, errors: ['x', 'y'] })
    const result = await closeCycle(ctx(db, seal), 'cy1', { outcome: 'accepted', note: '' })
    expect(result.ok).toBe(true)
    expect(writes.some((w) => w.table === 'review_cycles' && (w.value as { stage?: string }).stage === 'closed')).toBe(true)
    expect(writes.some((w) => w.table === 'review_events' && (w.value as { kind?: string }).kind === 'seal_failed')).toBe(true)
  })

  it('does not seal when PnC returns the decision', async () => {
    const { db } = fakeDb(rows)
    const seal = vi.fn()
    await closeCycle(ctx(db, seal), 'cy1', { outcome: 'returned', note: 'Look again at the attendance point.' })
    expect(seal).not.toHaveBeenCalled()
  })
})
