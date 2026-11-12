import { describe, it, expect, vi } from 'vitest'

const MIGRATION_EMPLOYEES_COLUMNS = new Set([
  'id',
  'name',
  'employee_type',
  'joining_date',
  'confirmation_date',
  'conversion_date',
  'contractor_duration_months',
  'appraisal_eligible',
  'pf_epf_applicable',
  'pf_epf_opted_out',
  'team',
  'manager_id',
  'status',
  'created_at',
  'updated_at',
  'email',
  'employee_type_id',
  'appraisal_eligibility_id',
  'pf_eligibility_id',
  'team_id',
  'exit_date',
  'employee_code',
  'is_alumni',
])

const ALLOWED_EMPLOYEE_RELATIONS = new Set(['teams(name)', 'employee_types(name)'])

function extractEmployeeTokens(selectClause: string): string[] {
  const tokens: string[] = []
  let current = ''
  let depth = 0
  for (const ch of selectClause) {
    if (ch === '(') depth++
    if (ch === ')') depth--
    if (ch === ',' && depth === 0) {
      if (current.trim()) tokens.push(current.trim())
      current = ''
    } else {
      current += ch
    }
  }
  if (current.trim()) tokens.push(current.trim())
  return tokens
}

vi.mock('@/lib/rbac/guard', () => ({
  guard: vi.fn(async () => ({
    ok: true,
    caller: { userId: 'u-exec', email: 'exec@example.org', role: 'exec_view' },
  })),
}))

vi.mock('@/lib/appraisals/getAppraisalReportData', () => ({
  getAppraisalReportData: vi.fn(async () => ({
    totalEligible: 0,
    cycleSplit: { july: 0, december: 0 },
    teamBreakdown: [],
  })),
}))

vi.mock('@/lib/supabase/admin', () => ({
  createAdminSupabaseClient: vi.fn(() => ({
    from: () => ({
      select: () => ({
        order: () => ({
          limit: async () => ({ data: [], error: null }),
        }),
      }),
    }),
  })),
}))

vi.mock('@/lib/supabase/server', () => ({
  createServerSupabaseClient: vi.fn(async () => ({
    from: (table: string) => ({
      select: (cols: string) => {
        if (table === 'employees') {
          const tokens = extractEmployeeTokens(cols)
          const invalid = tokens.filter(
            (t) => !MIGRATION_EMPLOYEES_COLUMNS.has(t) && !ALLOWED_EMPLOYEE_RELATIONS.has(t)
          )
          return {
            order: async () => {
              if (invalid.length > 0) {
                return { data: null, error: { message: `Unknown columns: ${invalid.join(', ')}` } }
              }
              return {
                data: [
                  {
                    id: 'emp-1',
                    name: 'Meera Example',
                    email: 'meera@example.org',
                    joining_date: '2026-01-15',
                    is_alumni: true,
                    team: 'Engineering',
                    employee_types: { name: 'FTE' },
                    teams: { name: 'Engineering' },
                  },
                  {
                    id: 'emp-2',
                    name: 'Rohan Example',
                    email: 'rohan@example.org',
                    joining_date: '2026-03-01',
                    is_alumni: false,
                    team: 'Operations',
                    employee_types: { name: 'FTE' },
                    teams: { name: 'Operations' },
                  },
                ],
                error: null,
              }
            },
          }
        }
        if (table === 'confirmations') {
          const match = cols.match(/employees\((.+)\)/)
          const empCols = match ? extractEmployeeTokens(match[1]) : []
          const invalid = empCols.filter(
            (t) => !MIGRATION_EMPLOYEES_COLUMNS.has(t) && !ALLOWED_EMPLOYEE_RELATIONS.has(t)
          )
          return {
            order: () => ({
              limit: async () => {
                if (invalid.length > 0) {
                  return { data: null, error: { message: `Unknown columns: ${invalid.join(', ')}` } }
                }
                return {
                  data: [
                    {
                      id: 'conf-1',
                      status: 'pending',
                      manager_decision: null,
                      recommendation: null,
                      created_at: '2026-10-01T00:00:00.000Z',
                      employees: {
                        name: 'Meera Example',
                        team: 'Engineering',
                        teams: { name: 'Engineering' },
                        employee_types: { name: 'FTE' },
                      },
                    },
                  ],
                  error: null,
                }
              },
            }),
          }
        }
        return {
          order: () => ({
            limit: async () => ({ data: [], error: null }),
          }),
        }
      },
    }),
  })),
}))

import {
  CONFIRMATIONS_REPORT_SELECT,
  HEADCOUNT_EMPLOYEES_SELECT,
  getUnifiedReportsData,
} from './getReportsData'

describe('Reports employee column selects', () => {
  it('pins headcount employee columns to those created by migrations', () => {
    const tokens = extractEmployeeTokens(HEADCOUNT_EMPLOYEES_SELECT)
    expect(tokens.length).toBeGreaterThan(0)
    for (const token of tokens) {
      expect(
        MIGRATION_EMPLOYEES_COLUMNS.has(token) || ALLOWED_EMPLOYEE_RELATIONS.has(token),
        `Unexpected column or relation "${token}" in HEADCOUNT_EMPLOYEES_SELECT`
      ).toBe(true)
    }
    expect(tokens).not.toContain('designation')
    expect(tokens).not.toContain('locations(name)')
  })

  it('pins confirmations nested employee columns to those created by migrations', () => {
    const match = CONFIRMATIONS_REPORT_SELECT.match(/employees\((.+)\)/)
    expect(match).not.toBeNull()
    const tokens = extractEmployeeTokens(match![1])
    for (const token of tokens) {
      expect(
        MIGRATION_EMPLOYEES_COLUMNS.has(token) || ALLOWED_EMPLOYEE_RELATIONS.has(token),
        `Unexpected column or relation "${token}" in CONFIRMATIONS_REPORT_SELECT`
      ).toBe(true)
    }
    expect(tokens).not.toContain('designation')
  })

  it('returns non-empty byTeam and confirmations on a schema built from migrations', async () => {
    const data = await getUnifiedReportsData()
    expect(data.headcount.byTeam).toEqual({
      Engineering: 1,
      Operations: 1,
    })
    expect(data.headcount.byLocation).toEqual({})
    expect(data.confirmations.total).toBe(1)
    expect(data.confirmations.items[0].team_name).toBe('Engineering')
  })
})
