import { describe, it, expect, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { runRetention } from './executor'
import { LOG_TABLES } from './sources'

// A small stand-in for the service-role client: canned rows per table, and a
// record of every delete and purge call so the tests can see what live mode did.
type Call = { table: string; op: 'select' | 'delete'; filters: [string, string, unknown][] }

function fakeDb(rows: Record<string, unknown[]>, opts: { purgeResult?: number; failTable?: string } = {}) {
  const calls: Call[] = []
  const rpcs: { fn: string; args: Record<string, unknown> }[] = []
  const builder = (table: string) => {
    const call: Call = { table, op: 'select', filters: [] }
    calls.push(call)
    const self: Record<string, unknown> = {}
    const chain = (name: string) => (col: string, val?: unknown) => {
      call.filters.push([name, col, val])
      return self
    }
    for (const f of ['eq', 'neq', 'not', 'is', 'in', 'lt']) self[f] = chain(f)
    self.select = (_cols?: string, o?: { head?: boolean }) => {
      if (o?.head) call.filters.push(['head', '', true])
      return self
    }
    self.delete = () => {
      call.op = 'delete'
      return self
    }
    self.then = (resolve: (v: unknown) => unknown) => {
      if (opts.failTable === table) return Promise.resolve({ data: null, error: { message: 'x' }, count: null }).then(resolve)
      const head = call.filters.some(([n]) => n === 'head')
      if (call.op === 'delete') {
        const ids = (call.filters.find(([n, c]) => n === 'in' && c === 'id')?.[2] as string[]) ?? []
        return Promise.resolve({ data: ids.map((id) => ({ id })), error: null }).then(resolve)
      }
      const data = rows[table] ?? []
      return Promise.resolve({ data: head ? null : data, count: head ? 2 : null, error: null }).then(resolve)
    }
    return self
  }
  const db = {
    from: builder,
    rpc: (fn: string, args: Record<string, unknown>) => {
      rpcs.push({ fn, args })
      return Promise.resolve({ data: opts.purgeResult ?? 3, error: null })
    },
  }
  return { db: db as unknown as SupabaseClient, calls, rpcs }
}

const today = new Date('2026-11-07T00:00:00Z')
const RULES = [
  { id: 'logs', period_days: 730, consent_period_days: null, action: 'delete' },
  { id: 'withdrawn_joiner_documents', period_days: 90, consent_period_days: null, action: 'delete' },
  { id: 'privacy_records', period_days: 2555, consent_period_days: null, action: 'delete' },
  { id: 'letters', period_days: 2920, consent_period_days: null, action: 'delete' },
  { id: 'employment_records', period_days: 2920, consent_period_days: null, action: 'delete' },
  { id: 'dependant_nominee', period_days: 1825, consent_period_days: null, action: 'delete' },
]
const withdrawnDoc = (id: string, joiner: string, uploaded: string) => ({
  id,
  onboarding_id: joiner,
  uploaded_at: uploaded,
  created_at: uploaded,
  onboarding_records: { withdrawn_at: '2025-01-15T00:00:00Z', updated_at: '2025-01-15T00:00:00Z' },
})
const base = {
  dpdp_retention_rules: RULES,
  dpdp_legal_holds: [],
  onboarding_documents: [
    withdrawnDoc('d-old', 'j1', '2025-01-01T00:00:00Z'),
    // Withdrawn long ago, but uploaded 100 days ago: under the 1-year floor.
    withdrawnDoc('d-new', 'j1', '2026-07-30T00:00:00Z'),
  ],
  privacy_requests: [],
  privacy_nominations: [],
  privacy_incidents: [],
  employees: [],
}

describe('runRetention', () => {
  it('deletes nothing in dry-run mode and reports what is due', async () => {
    const { db, calls, rpcs } = fakeDb(base)
    const purgeDocuments = vi.fn()
    const report = await runRetention(db, 'dry_run', today, { purgeDocuments })
    expect(purgeDocuments).not.toHaveBeenCalled()
    expect(rpcs).toHaveLength(0)
    expect(calls.some((c) => c.op === 'delete')).toBe(false)
    expect(report.counts.withdrawn_joiner_documents).toMatchObject({ due: 1, under_floor: 1, deleted: 0 })
    // Every log table is counted by date.
    expect(report.counts.logs.due).toBe(LOG_TABLES.length * 2)
    expect(report.status).toBe('ok')
  })

  it('in live mode purges only the documents that are due, never one under the floor', async () => {
    const { db } = fakeDb(base)
    const purgeDocuments = vi.fn().mockResolvedValue({ purged: 1, errors: [] })
    const report = await runRetention(db, 'live', today, { purgeDocuments })
    expect(purgeDocuments).toHaveBeenCalledTimes(1)
    expect(purgeDocuments).toHaveBeenCalledWith('j1', ['d-old'], expect.any(String))
    expect(report.counts.withdrawn_joiner_documents.deleted).toBe(1)
  })

  it('leaves a held joiner\'s documents alone', async () => {
    const { db } = fakeDb({
      ...base,
      dpdp_legal_holds: [{ subject_type: 'candidate', subject_ref: 'j1', record_table: null, record_id: null, released_at: null }],
    })
    const purgeDocuments = vi.fn()
    const report = await runRetention(db, 'live', today, { purgeDocuments })
    expect(purgeDocuments).not.toHaveBeenCalled()
    expect(report.counts.withdrawn_joiner_documents.held).toBe(2)
  })

  it('purges logs through dpdp_purge_rows with a cutoff at least a year back', async () => {
    const { db, rpcs } = fakeDb(base)
    await runRetention(db, 'live', today, { purgeDocuments: vi.fn().mockResolvedValue({ purged: 0, errors: [] }) })
    const logCalls = rpcs.filter((r) => r.args.p_table !== 'consent_records')
    expect(logCalls.map((r) => r.args.p_table)).toEqual([...LOG_TABLES])
    for (const r of rpcs) {
      expect(r.fn).toBe('dpdp_purge_rows')
      expect(new Date(r.args.p_before as string).getTime()).toBeLessThanOrEqual(new Date('2025-11-07T00:00:00Z').getTime())
    }
    expect(rpcs.find((r) => r.args.p_table === 'employee_audit_log')?.args.p_before).toBe('2024-11-07T00:00:00.000Z')
  })

  it('deletes closed rights requests past the privacy-records period', async () => {
    const { db, calls } = fakeDb({
      ...base,
      onboarding_documents: [],
      privacy_requests: [
        { id: 'r-old', principal_type: 'employee', principal_ref: 'e1', closed_at: '2018-01-01T00:00:00Z', updated_at: '2018-01-01T00:00:00Z' },
        { id: 'r-new', principal_type: 'employee', principal_ref: 'e2', closed_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' },
      ],
    })
    const report = await runRetention(db, 'live', today, { purgeDocuments: vi.fn() })
    const del = calls.find((c) => c.table === 'privacy_requests' && c.op === 'delete')
    expect(del?.filters).toContainEqual(['in', 'id', ['r-old']])
    expect(report.counts.privacy_records.deleted).toBeGreaterThanOrEqual(1)
  })

  it('counts exited people for manual erasure and the vault rules as instructions, with no names', async () => {
    const { db } = fakeDb({
      ...base,
      onboarding_documents: [],
      employees: [{ id: 'e1', exit_date: '2017-01-01', updated_at: '2017-01-01T00:00:00Z' }],
    })
    const report = await runRetention(db, 'dry_run', today, { purgeDocuments: vi.fn() })
    expect(report.instructions.manual).toEqual([
      { rule: 'dependant_nominee', people: 1 },
      { rule: 'employment_records', people: 1 },
      { rule: 'letters', people: 1 },
    ])
    expect(report.instructions.drive.folders_due).toBe(1)
    expect(report.instructions.vault.some((v) => v.rule === 'feedback_text' && v.tables.includes('feedback'))).toBe(true)
    expect(JSON.stringify(report)).not.toContain('e1')
  })

  it('reports a partial run when a purge fails', async () => {
    const { db } = fakeDb(base, { failTable: 'audit_log' })
    const report = await runRetention(db, 'dry_run', today, { purgeDocuments: vi.fn() })
    expect(report.status).toBe('partial')
    expect(report.counts.logs.errors).toBe(1)
  })
})
