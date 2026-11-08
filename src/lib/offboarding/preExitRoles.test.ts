import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'

// The pre-exit job with the account write, the audit trail and the database
// stubbed: which exits it acts on, what it records, and what it reports.

const state = vi.hoisted(() => ({
  cases: [] as Array<Record<string, unknown>>,
  casesError: null as null | { message: string },
  reportees: {} as Record<string, number>,
  results: {} as Record<string, unknown>,
  ended: [] as string[],
  audits: [] as Array<{ action: string; opts: { metadata?: Record<string, unknown> } & Record<string, unknown> }>,
  statusFilter: [] as string[],
}))

vi.mock('@/lib/supabase/admin', () => ({ createAdminSupabaseClient: () => null }))
vi.mock('@/lib/rbac/endPlatformAccess', () => ({
  endRoleBeforeExit: vi.fn(async (email: string | null) => {
    state.ended.push(String(email))
    return (
      state.results[String(email)] ?? { ok: true, outcome: 'ended', userId: `u-${email}`, previousRole: 'pnc_admin' }
    )
  }),
}))
vi.mock('@/lib/audit/events', () => ({
  auditEvent: vi.fn(async (_module: string, action: string, _description: string, opts: Record<string, unknown>) => {
    state.audits.push({ action, opts })
  }),
}))

import { runPreExitRoleEnding, applyPreExitRoleRule, lastWorkingDayOf, OPEN_EXIT_STATUSES } from './preExitRoles'

function fakeDb() {
  return {
    from: (table: string) => {
      if (table === 'offboarding_cases') {
        return {
          select: () => ({
            in: (_col: string, statuses: string[]) => {
              state.statusFilter = statuses
              return {
                order: () => ({
                  range: async () => ({ data: state.casesError ? null : state.cases, error: state.casesError }),
                }),
              }
            },
          }),
        }
      }
      // employees: the active-reportee count for one manager.
      return {
        select: () => ({
          eq: (_col: string, managerId: string) => ({
            eq: async () => ({ count: state.reportees[managerId] ?? 0, error: null }),
          }),
        }),
      }
    },
  } as unknown as SupabaseClient
}

function exitCase(id: string, email: string, lwd: string, extra: Record<string, unknown> = {}) {
  return {
    id,
    employee_id: `e-${id}`,
    proposed_lwd: lwd,
    actual_lwd: null,
    status: 'notice_period',
    employees: { name: `Person ${id}`, email },
    ...extra,
  }
}

// 00:30 IST on Tuesday 17 November 2026, when the job runs.
const now = new Date('2026-11-16T19:00:00Z')

beforeEach(() => {
  state.cases = []
  state.casesError = null
  state.reportees = {}
  state.results = {}
  state.ended = []
  state.audits = []
  state.statusFilter = []
})

describe('lastWorkingDayOf', () => {
  it('prefers the confirmed last working day over the proposed one', () => {
    expect(lastWorkingDayOf({ proposed_lwd: '2026-11-20', actual_lwd: '2026-11-27' })).toBe('2026-11-27')
    expect(lastWorkingDayOf({ proposed_lwd: '2026-11-20', actual_lwd: null })).toBe('2026-11-20')
    expect(lastWorkingDayOf({})).toBeNull()
  })
})

describe('runPreExitRoleEnding', () => {
  it('reads open exits only', async () => {
    await runPreExitRoleEnding(fakeDb(), now)
    expect(state.statusFilter).toEqual([...OPEN_EXIT_STATUSES])
    expect(state.statusFilter).not.toContain('completed')
    expect(state.statusFilter).not.toContain('cancelled')
  })

  it('ends the role of everyone within 72 hours of their last day, and no one else', async () => {
    state.cases = [
      exitCase('due-today', 'a@example.com', '2026-11-20'), // the 72 hours started at midnight
      exitCase('due-earlier', 'b@example.com', '2026-11-18'),
      exitCase('past-lwd', 'c@example.com', '2026-11-10', { status: 'settlement_pending' }),
      exitCase('tomorrow', 'd@example.com', '2026-11-21'), // starts at midnight tonight
      exitCase('extended', 'e@example.com', '2026-11-20', { actual_lwd: '2026-12-31' }),
    ]
    const report = await runPreExitRoleEnding(fakeDb(), now)
    expect(state.ended).toEqual(['a@example.com', 'b@example.com', 'c@example.com'])
    expect(report).toEqual({ checked: 5, due: 3, ended: 3, failed: 0, reporteesToReassign: 0 })
  })

  it('records each removal with the old role and the reportees left to reassign', async () => {
    state.cases = [exitCase('x', 'x@example.com', '2026-11-19')]
    state.reportees['e-x'] = 2
    const report = await runPreExitRoleEnding(fakeDb(), now)
    expect(report.reporteesToReassign).toBe(2)
    expect(state.audits).toHaveLength(1)
    const { action, opts } = state.audits[0]
    expect(action).toBe('access.role.ended_before_exit')
    expect(opts).toMatchObject({
      subject: { employee_id: 'e-x', employee_email: 'x@example.com', employee_name: 'Person x' },
      actorType: 'system',
      entityType: 'offboarding_case',
      entityId: 'x',
      changes: [{ field: 'role', from: 'pnc_admin', to: 'employee' }],
      metadata: { last_working_day: '2026-11-19', active_reportees: 2, trigger: 'daily job' },
    })
  })

  it('records nothing when there was no stored role to remove', async () => {
    state.cases = [exitCase('y', 'y@example.com', '2026-11-19')]
    state.results['y@example.com'] = { ok: true, outcome: 'no_stored_role', userId: 'u-y', previousRole: null }
    const report = await runPreExitRoleEnding(fakeDb(), now)
    expect(report).toEqual({ checked: 1, due: 1, ended: 0, failed: 0, reporteesToReassign: 0 })
    expect(state.audits).toHaveLength(0)
  })

  it('counts a failure and carries on with the rest', async () => {
    state.cases = [exitCase('bad', 'bad@example.com', '2026-11-19'), exitCase('ok', 'ok@example.com', '2026-11-19')]
    state.results['bad@example.com'] = { ok: false, error: 'Could not remove the role.' }
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {})
    const report = await runPreExitRoleEnding(fakeDb(), now)
    expect(report).toMatchObject({ due: 2, ended: 1, failed: 1 })
    // The log names the case, never the person.
    expect(JSON.stringify(errors.mock.calls)).not.toContain('bad@example.com')
    errors.mockRestore()
  })

  it('throws when the exits cannot be read', async () => {
    state.casesError = { message: 'boom' }
    await expect(runPreExitRoleEnding(fakeDb(), now)).rejects.toThrow('Could not read open exits')
  })
})

describe('applyPreExitRoleRule', () => {
  const exit = {
    caseId: 'c1',
    employeeId: 'e1',
    employeeEmail: 'leaving@example.com',
    employeeName: 'Leaving Person',
    lastWorkingDay: '2026-11-17',
  }

  it('acts on an exit opened inside the window', async () => {
    const result = await applyPreExitRoleRule({ ...exit, status: 'settlement_pending' }, { now, trigger: 'exit opened', db: fakeDb() })
    expect(result).toMatchObject({ due: true, ended: true })
    expect(state.audits[0].opts.metadata?.trigger).toBe('exit opened')
  })

  it('leaves a closed or cancelled exit alone', async () => {
    for (const status of ['completed', 'cancelled']) {
      const result = await applyPreExitRoleRule({ ...exit, status }, { now, trigger: 'exit dates changed', db: fakeDb() })
      expect(result.due, status).toBe(false)
    }
    expect(state.ended).toEqual([])
  })

  it('does nothing before the window opens', async () => {
    const result = await applyPreExitRoleRule(
      { ...exit, lastWorkingDay: '2026-12-31' },
      { now, trigger: 'exit opened', db: fakeDb() }
    )
    expect(result.due).toBe(false)
    expect(state.ended).toEqual([])
  })
})
