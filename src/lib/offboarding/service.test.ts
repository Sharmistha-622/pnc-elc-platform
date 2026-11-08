import { randomUUID } from 'crypto'
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ============================================================================
// Offboarding against an in-memory database
// ----------------------------------------------------------------------------
// The fake below behaves like Postgres where it matters here: it refuses an
// id that is not a UUID (which is how the old in-memory store lost every
// case), enforces the case foreign key on child rows, and cascades a deleted
// case. Two clients share it, the caller's session and the service role, and
// every write records which one made it.
// ============================================================================

type Row = Record<string, unknown>
type Client = 'session' | 'service'

const db = vi.hoisted(() => ({
  tables: {} as Record<string, Row[]>,
  writes: [] as Array<{ client: string; table: string; op: string }>,
  fail: {} as Record<string, { code: string; message: string }>,
}))

const state = vi.hoisted(() => ({
  caller: null as null | { role: string; originalRole: string; userId: string; email: string },
  self: null as null | { role: string; originalRole: string; userId: string; email: string },
  ownEmployeeId: null as string | null,
  calls: [] as string[],
  endResult: { ok: true, userId: 'u-1' } as { ok: true; userId: string | null } | { ok: false; error: string },
  preExit: [] as Array<Record<string, unknown>>,
}))

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const UUID_COLUMNS = new Set(['id', 'employee_id', 'offboarding_id', 'offboarding_case_id', 'manager_id'])
const CHILDREN = ['offboarding_checklists', 'offboarding_asset_clearances', 'offboarding_ndc', 'offboarding_fnf', 'offboarding_activity_log']

function fake(client: Client) {
  const from = (table: string) => {
    const rows = () => (db.tables[table] ??= [])
    const filters: Array<(r: Row) => boolean> = []
    let op: 'select' | 'insert' | 'update' | 'upsert' | 'delete' = 'select'
    let payload: Row | Row[] | null = null
    let selectCols = '*'
    let count = false
    let orderBy: { col: string; asc: boolean } | null = null

    const failure = () => db.fail[`${table}:${op}`] ?? null
    const withJoins = (r: Row): Row => {
      if (!selectCols.includes('employees(')) return { ...r }
      const person = (db.tables.employees ?? []).find((e) => e.id === r.employee_id)
      return { ...r, employees: person ? { ...person, employee_types: null, teams: null } : null }
    }
    const invalid = (r: Row) =>
      Object.entries(r).some(([k, v]) => UUID_COLUMNS.has(k) && v != null && !UUID.test(String(v)))
    const orphan = (r: Row) =>
      CHILDREN.includes(table) && !(db.tables.offboarding_cases ?? []).some((c) => c.id === r.offboarding_id)

    const run = (): { data: unknown; error: unknown; count?: number } => {
      const err = failure()
      if (err) return { data: null, error: err }
      if (op === 'insert' || op === 'upsert') {
        const list = (Array.isArray(payload) ? payload : [payload]) as Row[]
        if (list.some(invalid)) return { data: null, error: { code: '22P02', message: 'invalid input syntax for type uuid' } }
        if (list.some(orphan)) return { data: null, error: { code: '23503', message: 'foreign key violation' } }
        db.writes.push({ client, table, op })
        const out: Row[] = []
        for (const r of list) {
          const now = new Date().toISOString()
          if (op === 'upsert') {
            const existing = rows().find((x) => x.offboarding_id === r.offboarding_id)
            if (existing) {
              Object.assign(existing, r)
              out.push(existing)
              continue
            }
          }
          const row = { id: randomUUID(), created_at: now, updated_at: now, ...r }
          rows().push(row)
          out.push(row)
        }
        return { data: out.map(withJoins), error: null }
      }
      const matched = rows().filter((r) => filters.every((f) => f(r)))
      if (op === 'update') {
        if (invalid(payload as Row)) return { data: null, error: { code: '22P02', message: 'invalid uuid' } }
        db.writes.push({ client, table, op })
        matched.forEach((r) => Object.assign(r, payload))
        return { data: matched.map(withJoins), error: null }
      }
      if (op === 'delete') {
        db.writes.push({ client, table, op })
        db.tables[table] = rows().filter((r) => !matched.includes(r))
        if (table === 'offboarding_cases') {
          const ids = new Set(matched.map((r) => r.id))
          for (const child of CHILDREN) db.tables[child] = (db.tables[child] ?? []).filter((r) => !ids.has(r.offboarding_id))
        }
        return { data: null, error: null }
      }
      let out = matched.map(withJoins)
      if (orderBy) {
        const { col, asc } = orderBy
        out = [...out].sort((a, b) => String(a[col] ?? '').localeCompare(String(b[col] ?? '')) * (asc ? 1 : -1))
      }
      return count ? { data: null, error: null, count: out.length } : { data: out, error: null }
    }

    const q: Record<string, unknown> = {}
    Object.assign(q, {
      select: (cols = '*', opts?: { count?: string }) => {
        selectCols = cols
        count = Boolean(opts?.count)
        return q
      },
      insert: (rowsIn: Row | Row[]) => ((op = 'insert'), (payload = rowsIn), q),
      upsert: (rowIn: Row) => ((op = 'upsert'), (payload = rowIn), q),
      update: (patch: Row) => ((op = 'update'), (payload = patch), q),
      delete: () => ((op = 'delete'), q),
      eq: (col: string, val: unknown) => (filters.push((r) => r[col] === val), q),
      in: (col: string, vals: unknown[]) => (filters.push((r) => vals.includes(r[col])), q),
      order: (col: string, o?: { ascending?: boolean }) => ((orderBy = { col, asc: o?.ascending !== false }), q),
      limit: () => q,
      range: () => q,
      maybeSingle: async () => {
        const res = run()
        if (res.error) return res
        const list = res.data as Row[]
        return { data: list[0] ?? null, error: null }
      },
      single: async () => {
        const res = run()
        if (res.error) return res
        const list = res.data as Row[]
        return list.length === 1 ? { data: list[0], error: null } : { data: null, error: { code: 'PGRST116', message: 'not one row' } }
      },
      then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) => Promise.resolve(run()).then(resolve, reject),
    })
    return q
  }
  return { from }
}

vi.mock('@/lib/supabase/server', () => ({ createServerSupabaseClient: async () => fake('session') }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminSupabaseClient: () => fake('service') }))
vi.mock('@/lib/logs/writer', () => ({ logWriter: () => fake('service') }))
vi.mock('next/cache', () => ({ revalidatePath: () => {} }))
vi.mock('@/lib/email/sendEmail', () => ({ sendEmail: async () => ({ success: true }) }))
vi.mock('@/lib/settings/access', () => ({ platformConfigRefusal: async () => null }))
vi.mock('@/lib/forms/currentEmployee', () => ({
  getCurrentEmployee: async () => ({ email: null, employee: state.ownEmployeeId ? { id: state.ownEmployeeId, name: 'Self' } : null }),
}))
vi.mock('@/lib/rbac/guard', async () => {
  const actual = await vi.importActual<typeof import('@/lib/rbac/guard')>('@/lib/rbac/guard')
  const refuse = { ok: false, error: 'You do not have access to do that.' }
  return {
    maySeeSalary: actual.maySeeSalary,
    guard: async (feature: unknown) => {
      if (feature === 'self') return state.self ? { ok: true, caller: state.self } : refuse
      return state.caller ? { ok: true, caller: state.caller } : refuse
    },
    guardResource: async () =>
      state.caller && ['super_admin', 'pnc_admin', 'fin_admin'].includes(state.caller.role)
        ? { ok: true, caller: state.caller }
        : refuse,
  }
})
vi.mock('@/lib/rbac/endPlatformAccess', () => ({
  endPlatformAccess: async () => {
    state.calls.push('endPlatformAccess')
    return state.endResult
  },
}))
vi.mock('@/lib/offboarding/preExitRoles', async () => {
  const actual = await vi.importActual<typeof import('./preExitRoles')>('./preExitRoles')
  return {
    lastWorkingDayOf: actual.lastWorkingDayOf,
    applyPreExitRoleRule: async (exit: Record<string, unknown>) => {
      state.preExit.push(exit)
      return { due: false, ended: false, failed: false, activeReportees: 0 }
    },
  }
})
vi.mock('@/lib/audit/events', () => {
  const record = (label: string) => async () => {
    state.calls.push(label)
  }
  return {
    auditOffboarding: new Proxy({}, { get: (_t, key) => record(`offboarding.${String(key)}`) }),
    auditAccess: new Proxy({}, { get: (_t, key) => record(`access.${String(key)}`) }),
  }
})
vi.mock('@/lib/integrations/assets', () => ({ assetIntegrationService: { getEmployeeAssignedAssets: async () => null } }))
vi.mock('@/lib/integrations/attendance', () => ({ attendanceIntegrationService: { getEmployeeAttendanceSummary: async () => null } }))
vi.mock('@/lib/integrations/leave', () => ({ leaveIntegrationService: { getEmployeeLeaveSummary: async () => null } }))

import * as offboarding from './service'

const LEAVER = '10000000-0000-4000-8000-0000000000a1'
const OTHER = '10000000-0000-4000-8000-0000000000a2'
const PNC_ADMIN = { role: 'pnc_admin', originalRole: 'pnc_admin', userId: 'u-pa', email: 'pa@example.com' }
const PNC_OPS = { role: 'pnc_ops', originalRole: 'pnc_ops', userId: 'u-po', email: 'po@example.com' }
const EMPLOYEE = { role: 'employee', originalRole: 'employee', userId: 'u-e', email: 'leaver@example.com' }

const exitInput = (overrides: Record<string, unknown> = {}) =>
  ({
    employee_id: LEAVER,
    employee_name: 'From the browser',
    employee_email: 'spoofed@example.com',
    employee_designation: '',
    employee_department: '',
    employee_type: '',
    exit_type: 'resignation',
    initiated_date: '2026-11-01',
    initiated_by: 'Typed by the browser',
    proposed_lwd: '2026-12-15',
    notice_period_days: 30,
    reason: 'Higher studies',
    ...overrides,
  }) as Parameters<typeof offboarding.initiateOffboardingCase>[0]

async function openCase(overrides: Record<string, unknown> = {}): Promise<string> {
  const res = await offboarding.initiateOffboardingCase(exitInput(overrides))
  expect(res.success, res.error).toBe(true)
  return res.caseId!
}

const rowsOf = (table: string, caseId?: string) =>
  (db.tables[table] ?? []).filter((r) => caseId === undefined || r.offboarding_id === caseId)

beforeEach(() => {
  db.tables = {
    employees: [
      { id: LEAVER, name: 'Lee Leaver', email: 'leaver@example.com', team: 'Finance', employee_type: 'fte', status: 'active', manager_id: OTHER },
      { id: OTHER, name: 'Mia Manager', email: 'mia@example.com', team: 'Finance', employee_type: 'fte', status: 'active' },
    ],
    offboarding_settings: [
      {
        id: randomUUID(),
        default_notice_period_days: 30,
        standard_fnf_timeline_days: 30,
        standard_hold_period_days: 7,
        clearance_reminder_frequency_days: 2,
        escalation_threshold_days: 5,
        require_all_ndc_before_fnf: true,
        require_asset_clearance_before_closure: true,
        allow_immediate_relieving: true,
        updated_at: '2026-10-01T00:00:00Z',
      },
    ],
  }
  db.writes = []
  db.fail = {}
  state.caller = PNC_ADMIN
  state.self = null
  state.ownEmployeeId = null
  state.calls = []
  state.endResult = { ok: true, userId: 'u-1' }
  state.preExit = []
})

describe('opening an exit', () => {
  it('saves the case and everything under it, with UUIDs, so any server can read it back', async () => {
    const caseId = await openCase()
    expect(caseId).toMatch(UUID)
    expect(rowsOf('offboarding_cases')).toHaveLength(1)
    expect(rowsOf('offboarding_checklists', caseId)).toHaveLength(5)
    expect(rowsOf('offboarding_ndc', caseId)).toHaveLength(4)
    expect(rowsOf('offboarding_asset_clearances', caseId)).toHaveLength(1)
    expect(rowsOf('offboarding_fnf', caseId)).toHaveLength(1)

    const full = await offboarding.getOffboardingById(caseId)
    expect(full?.caseRecord).toMatchObject({
      id: caseId,
      status: 'notice_period',
      employee_name: 'Lee Leaver',
      employee_email: 'leaver@example.com',
      employee_department: 'Finance',
      manager_name: 'Mia Manager',
      initiated_by: 'pa@example.com',
    })
    expect(full?.checklist.map((c) => c.title)[0]).toBe('Knowledge Handover Documentation & Repository Transfer')
    expect(full?.ndc.map((n) => n.department)).toEqual(['manager', 'it_admin', 'finance', 'pnc'])
    expect(full?.activityLogs.map((l) => l.action)).toContain('Exit Formally Initiated')
    expect((await offboarding.getAllOffboardingCases()).map((c) => c.id)).toEqual([caseId])
  })

  it('takes the person from the directory, not from what the browser sends', async () => {
    const caseId = await openCase()
    const [row] = rowsOf('offboarding_cases')
    expect(row).not.toHaveProperty('employee_email')
    expect((await offboarding.getOffboardingById(caseId))?.caseRecord.employee_email).toBe('leaver@example.com')
  })

  it('writes the activity log with the service role, and checks the 72-hour rule', async () => {
    const caseId = await openCase()
    expect(db.writes.filter((w) => w.table === 'offboarding_activity_log').every((w) => w.client === 'service')).toBe(true)
    expect(state.preExit[0]).toMatchObject({ caseId, employeeEmail: 'leaver@example.com', lastWorkingDay: '2026-12-15' })
  })

  it('writes the F&F row for a caller without salary access, and the rest through their session', async () => {
    state.caller = PNC_OPS
    const caseId = await openCase()
    const writer = (table: string) => db.writes.find((w) => w.table === table && w.op === 'insert')?.client
    expect(writer('offboarding_fnf')).toBe('service')
    expect(writer('offboarding_cases')).toBe('session')
    expect(writer('offboarding_checklists')).toBe('session')
    // And they see where it stands, without the figures.
    const full = await offboarding.getOffboardingById(caseId)
    expect(full?.fnf.status).toBe('awaiting_clearance')
    expect(full?.fnf.remarks).toBeNull()
  })

  it('saves nothing when part of it cannot be saved', async () => {
    db.fail['offboarding_ndc:insert'] = { code: '42501', message: 'denied' }
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const res = await offboarding.initiateOffboardingCase(exitInput())
    expect(res).toEqual({ success: false, error: 'The exit could not be saved. Try again.' })
    expect(rowsOf('offboarding_cases')).toHaveLength(0)
    expect(rowsOf('offboarding_checklists')).toHaveLength(0)
  })

  it('refuses an exit without a person, a valid date or a reason', async () => {
    expect((await offboarding.initiateOffboardingCase(exitInput({ employee_id: 'emp-1' }))).success).toBe(false)
    expect((await offboarding.initiateOffboardingCase(exitInput({ proposed_lwd: '15/12/2026' }))).success).toBe(false)
    expect((await offboarding.initiateOffboardingCase(exitInput({ reason: ' ' }))).success).toBe(false)
    expect(rowsOf('offboarding_cases')).toHaveLength(0)
  })

  it('refuses a caller without offboarding access', async () => {
    state.caller = null
    expect((await offboarding.initiateOffboardingCase(exitInput())).success).toBe(false)
    expect(await offboarding.getAllOffboardingCases()).toEqual([])
  })
})

describe('working the exit', () => {
  it('changes only the fields a checklist item may have, and records who from the session', async () => {
    const caseId = await openCase()
    const item = rowsOf('offboarding_checklists', caseId)[0]
    const res = await offboarding.updateChecklistItem(caseId, item.id as string, {
      status: 'completed',
      completed_by: 'Someone else',
      offboarding_id: OTHER,
      title: 'Renamed',
    } as never)
    expect(res).toEqual({ success: true })
    expect(item).toMatchObject({ status: 'completed', completed_by: 'pa@example.com', offboarding_id: caseId })
    expect(item.title).not.toBe('Renamed')
    expect(item.completed_at).toEqual(expect.any(String))
  })

  it('will not touch an item through another case', async () => {
    const caseId = await openCase()
    const otherCase = await openCase({ employee_id: OTHER })
    const item = rowsOf('offboarding_checklists', caseId)[0]
    const res = await offboarding.updateChecklistItem(otherCase, item.id as string, { status: 'completed' })
    expect(res).toEqual({ success: false, error: 'Checklist item not found' })
    expect(item.status).toBe('pending')
  })

  it('clears the IT sign-off once every asset is back', async () => {
    const caseId = await openCase()
    const asset = rowsOf('offboarding_asset_clearances', caseId)[0]
    expect((await offboarding.updateAssetClearance(caseId, asset.id as string, { return_status: 'returned' })).success).toBe(true)
    const it_admin = rowsOf('offboarding_ndc', caseId).find((n) => n.department === 'it_admin')
    expect(it_admin).toMatchObject({ status: 'cleared', cleared_by: 'pa@example.com' })
  })

  it('readies F&F once every department has cleared, written by the service role', async () => {
    state.caller = PNC_OPS
    const caseId = await openCase()
    for (const department of ['manager', 'it_admin', 'finance', 'pnc']) {
      expect((await offboarding.updateNDCDepartment(caseId, department, { status: 'cleared' })).success).toBe(true)
    }
    const fnf = rowsOf('offboarding_fnf', caseId)[0]
    expect(fnf).toMatchObject({ status: 'computation_pending', blocked_reasons: [] })
    expect(db.writes.filter((w) => w.table === 'offboarding_fnf' && w.op === 'update').every((w) => w.client === 'service')).toBe(true)
  })

  it('lists the departments still to clear as F&F blockers', async () => {
    const caseId = await openCase()
    await offboarding.updateNDCDepartment(caseId, 'manager', { status: 'cleared' })
    expect(rowsOf('offboarding_fnf', caseId)[0].blocked_reasons).toEqual([
      'IT & Asset Operations: pending',
      'Finance & Accounts: pending',
      'People & Culture: pending',
    ])
  })

  it('keeps F&F changes to roles that may write salary, and to the settlement fields', async () => {
    const caseId = await openCase()
    state.caller = PNC_OPS
    expect((await offboarding.updateFnFDetails(caseId, { status: 'processed' })).success).toBe(false)
    state.caller = PNC_ADMIN
    const res = await offboarding.updateFnFDetails(caseId, { status: 'processed', payable_days: 12, offboarding_id: OTHER } as never)
    expect(res.success).toBe(true)
    expect(rowsOf('offboarding_fnf', caseId)[0]).toMatchObject({ status: 'processed', payable_days: 12, processed_by: 'pa@example.com' })
    expect(rowsOf('offboarding_fnf', OTHER)).toHaveLength(0)
  })

  it('moves the last working day and checks the 72-hour rule against the new one', async () => {
    const caseId = await openCase()
    state.preExit = []
    expect((await offboarding.updateExitDates(caseId, '2026-11-20', null, 'Agreed early release')).success).toBe(true)
    expect(rowsOf('offboarding_cases')[0].proposed_lwd).toBe('2026-11-20')
    expect(state.preExit[0]).toMatchObject({ lastWorkingDay: '2026-11-20' })
    expect((await offboarding.updateExitDates(caseId, 'soon')).success).toBe(false)
  })

  it('lists a generated document, read back from the activity log', async () => {
    const caseId = await openCase()
    const res = await offboarding.generateExitDocument(caseId, 'ndc')
    expect(res.success).toBe(true)
    const full = await offboarding.getOffboardingById(caseId)
    expect(full?.documents).toEqual([
      expect.objectContaining({ id: res.document!.id, document_type: 'ndc', document_name: 'No Dues Certificate — Lee Leaver.pdf' }),
    ])
  })
})

describe('closing the exit', () => {
  async function readyCase(): Promise<string> {
    const caseId = await openCase()
    const asset = rowsOf('offboarding_asset_clearances', caseId)[0]
    await offboarding.updateAssetClearance(caseId, asset.id as string, { return_status: 'returned' })
    for (const department of ['manager', 'finance', 'pnc']) await offboarding.updateNDCDepartment(caseId, department, { status: 'cleared' })
    state.calls = []
    return caseId
  }

  it('marks the employee exited, closes the case, ends their access, then records the revocation', async () => {
    const caseId = await readyCase()
    expect(await offboarding.closeOffboardingCase(caseId, 'Typed by the browser', '2026-12-15')).toEqual({ success: true })
    expect(db.tables.employees.find((e) => e.id === LEAVER)).toMatchObject({ status: 'exited', exit_date: '2026-12-15' })
    expect(rowsOf('offboarding_cases')[0]).toMatchObject({ status: 'completed', exit_closed_by: 'pa@example.com' })
    const ended = state.calls.indexOf('endPlatformAccess')
    expect(ended).toBeGreaterThan(state.calls.indexOf('offboarding.statusChanged'))
    expect(state.calls.indexOf('access.revoked')).toBeGreaterThan(ended)
    expect((await offboarding.getOffboardingById(caseId))?.documents.map((d) => d.document_type)).toEqual(['experience_letter'])
  })

  it('refuses while an asset is outstanding or a department has not cleared', async () => {
    const caseId = await openCase()
    expect((await offboarding.closeOffboardingCase(caseId)).error).toMatch(/Outstanding assets/)
    const asset = rowsOf('offboarding_asset_clearances', caseId)[0]
    await offboarding.updateAssetClearance(caseId, asset.id as string, { return_status: 'returned' })
    expect((await offboarding.closeOffboardingCase(caseId)).error).toMatch(/No Dues Certificate/)
    expect(state.calls).not.toContain('endPlatformAccess')
  })

  it('reports a failure to end access instead of recording a revocation, and retries on a second close', async () => {
    const caseId = await readyCase()
    state.endResult = { ok: false, error: 'Could not close the account.' }
    const first = await offboarding.closeOffboardingCase(caseId)
    expect(first.success).toBe(false)
    expect(state.calls).not.toContain('access.revoked')

    state.endResult = { ok: true, userId: 'u-1' }
    state.calls = []
    expect((await offboarding.closeOffboardingCase(caseId)).success).toBe(true)
    expect(state.calls).toEqual(['endPlatformAccess', 'access.revoked'])
  })

  it('stops before touching the account when the employee record cannot be updated', async () => {
    const caseId = await readyCase()
    db.fail['employees:update'] = { code: '42501', message: 'denied' }
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const res = await offboarding.closeOffboardingCase(caseId)
    expect(res.success).toBe(false)
    expect(state.calls).not.toContain('endPlatformAccess')
    expect(rowsOf('offboarding_cases')[0].status).toBe('notice_period')
  })

  it('answers "Case not found" for an id that is not a case', async () => {
    expect(await offboarding.closeOffboardingCase('off-case-abc')).toEqual({ success: false, error: 'Case not found' })
    expect(await offboarding.closeOffboardingCase(randomUUID())).toEqual({ success: false, error: 'Case not found' })
  })
})

describe('resignations', () => {
  async function submit(source: 'platform' | 'pnc' = 'pnc') {
    const res = await offboarding.submitResignationRequest({
      employee_id: LEAVER,
      source,
      resignation_date: '2026-11-01',
      proposed_lwd: '2026-12-15',
      notice_period_days: 30,
      reason: 'Higher studies',
    })
    expect(res.success, res.error).toBe(true)
    return res.request!
  }

  it('saves a resignation PnC logs as accepted on their side, waiting for the manager', async () => {
    const req = await submit('pnc')
    expect(req.id).toMatch(UUID)
    expect(req).toMatchObject({ status: 'manager_pending', pnc_decision: 'accepted', employee_name: 'Lee Leaver' })
    expect((await offboarding.getAllResignationRequests()).map((r) => r.id)).toEqual([req.id])
  })

  it('lets an employee resign themselves, through the platform only', async () => {
    state.caller = null
    state.self = EMPLOYEE
    state.ownEmployeeId = LEAVER
    expect((await submit('platform')).status).toBe('submitted')
    const asPnc = await offboarding.submitResignationRequest({
      employee_id: LEAVER, source: 'pnc', resignation_date: '2026-11-01', proposed_lwd: '2026-12-15', notice_period_days: 30, reason: 'x',
    })
    expect(asPnc.success).toBe(false)
    const forSomeoneElse = await offboarding.submitResignationRequest({
      employee_id: OTHER, source: 'platform', resignation_date: '2026-11-01', proposed_lwd: '2026-12-15', notice_period_days: 30, reason: 'x',
    })
    expect(forSomeoneElse.success).toBe(false)
  })

  it('opens the exit once the manager and PnC have both accepted, and links it', async () => {
    const req = await submit('pnc')
    const res = await offboarding.submitReviewDecision(req.id, 'manager', 'accepted')
    expect(res.success, res.error).toBe(true)
    expect(res.request?.status).toBe('resignation_accepted')
    const caseId = res.request?.offboarding_case_id
    expect(caseId).toMatch(UUID)
    expect(rowsOf('offboarding_cases').map((c) => c.id)).toEqual([caseId])
    expect((db.tables.resignation_requests ?? [])[0]).toMatchObject({ status: 'resignation_accepted', offboarding_case_id: caseId })
    // Decided is decided.
    expect((await offboarding.submitReviewDecision(req.id, 'pnc', 'on_hold')).success).toBe(false)
  })

  it('does not save the decision when the exit cannot be opened', async () => {
    const req = await submit('pnc')
    db.fail['offboarding_cases:insert'] = { code: '42501', message: 'denied' }
    vi.spyOn(console, 'error').mockImplementation(() => {})
    expect((await offboarding.submitReviewDecision(req.id, 'manager', 'accepted')).success).toBe(false)
    expect((db.tables.resignation_requests ?? [])[0].status).toBe('manager_pending')
  })

  it("takes the employee's own answer to a retention offer, and only theirs, only while it is open", async () => {
    const req = await submit('platform')
    // Before any offer, there is nothing to answer.
    state.caller = null
    state.self = EMPLOYEE
    state.ownEmployeeId = LEAVER
    expect((await offboarding.respondToRetention(req.id, 'declined_withdrawal')).success).toBe(false)
    expect(rowsOf('offboarding_cases')).toHaveLength(0)

    state.caller = PNC_ADMIN
    await offboarding.submitReviewDecision(req.id, 'manager', 'retention_proposed')
    await offboarding.submitReviewDecision(req.id, 'pnc', 'retention_proposed')
    expect((db.tables.resignation_requests ?? [])[0].status).toBe('withdrawal_proposed')

    state.caller = null
    state.ownEmployeeId = OTHER
    expect((await offboarding.respondToRetention(req.id, 'declined_withdrawal')).success).toBe(false)

    state.ownEmployeeId = LEAVER
    db.writes = []
    const res = await offboarding.respondToRetention(req.id, 'declined_withdrawal')
    expect(res.success, res.error).toBe(true)
    expect(res.request?.status).toBe('resignation_accepted')
    expect(rowsOf('offboarding_cases')).toHaveLength(1)
    expect(db.writes.find((w) => w.table === 'resignation_requests')?.client).toBe('service')
  })

  it('resolves only a real disagreement', async () => {
    const req = await submit('platform')
    expect((await offboarding.resolveDisagreement(req.id, 'accepted')).success).toBe(false)
    await offboarding.submitReviewDecision(req.id, 'manager', 'accepted')
    await offboarding.submitReviewDecision(req.id, 'pnc', 'retention_proposed')
    expect((db.tables.resignation_requests ?? [])[0].status).toBe('decision_pending')
    const res = await offboarding.resolveDisagreement(req.id, 'accepted')
    expect(res.success).toBe(true)
    expect(res.request?.offboarding_case_id).toMatch(UUID)
  })
})

describe('settings', () => {
  it('updates the one policy row instead of adding another', async () => {
    expect((await offboarding.updateOffboardingSettings({ standard_hold_period_days: 10, id: 'x' } as never)).success).toBe(true)
    expect(db.tables.offboarding_settings).toHaveLength(1)
    expect(db.tables.offboarding_settings[0].standard_hold_period_days).toBe(10)
    expect((await offboarding.getOffboardingSettings()).standard_hold_period_days).toBe(10)
  })
})
