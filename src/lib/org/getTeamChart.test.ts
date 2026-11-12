import { beforeEach, describe, expect, it, vi } from 'vitest'

import { flattenTeams } from './teamTree'

// Made-up people only: the repository is public.

type Row = Record<string, unknown>

const PERSON = ['id', 'name', 'email', 'status', 'manager_id', 'team', 'team_id', 'employee_type_id']
const TEAM_TREE_PERSON = ['department_id', 'designation']

/** Columns each table has, before or after migration 202611111500_team_tree. */
const schema = (isMigrated: boolean): Record<string, Set<string>> => ({
  directory: new Set([...PERSON, ...(isMigrated ? TEAM_TREE_PERSON : [])]),
  employees: new Set([...PERSON, ...(isMigrated ? TEAM_TREE_PERSON : [])]),
  departments: new Set(['id', 'name', ...(isMigrated ? ['parent_id'] : [])]),
  employee_types: new Set(['id', 'name']),
  general_settings: new Set(['key', 'value']),
})

const PEOPLE: Row[] = [
  { id: 'me', name: 'Asha Rao', email: 'asha@example.com', status: 'active', manager_id: null, team: 'CEO Office', department_id: 'ceo', designation: 'Head', employee_type_id: 'fte' },
  { id: 'a', name: 'Dev Malhotra', email: 'dev@example.com', status: 'active', manager_id: 'me', team: 'Platform Dev', department_id: 'platform', designation: 'Engineering Lead', employee_type_id: 'fte' },
  { id: 'b', name: 'Ritika Das', email: 'ritika@example.com', status: 'active', manager_id: 'me', team: 'pnc', department_id: 'pnc', designation: null, employee_type_id: 'intern' },
  { id: 'c', name: 'Tanvi Joshi', email: null, status: 'active', manager_id: 'a', team: 'Platform Dev', department_id: 'platform', designation: null, employee_type_id: null },
  { id: 'x', name: 'Om Sheikh', email: null, status: 'exited', manager_id: 'me', team: 'PnC', department_id: 'pnc', designation: null, employee_type_id: null },
]

const DATA: Record<string, Row[]> = {
  directory: PEOPLE,
  employees: PEOPLE,
  departments: [
    { id: 'ceo', name: 'CEO Office', parent_id: null },
    { id: 'platform', name: 'Platform Dev', parent_id: 'ceo' },
    { id: 'pnc', name: 'PnC', parent_id: null },
  ],
  employee_types: [
    { id: 'fte', name: 'Full-Time Employee (FTE)' },
    { id: 'intern', name: 'Intern' },
  ],
  general_settings: [{ key: 'organization_name', value: 'Example Org' }],
}

/**
 * A stand-in for the Supabase client that answers like PostgREST: selecting a
 * column the table does not have fails with Postgres' 42703.
 */
const fakeDb = (isMigrated: boolean) => {
  const tables = schema(isMigrated)
  return {
    from: (table: string) => ({
      select: (columns: string) => {
        const wanted = columns.split(',').map((c) => c.trim())
        const filters: [string, unknown][] = []
        const run = () => {
          if (wanted.some((c) => !tables[table].has(c))) return { data: null, error: { code: '42703' } }
          const rows = DATA[table].filter((row) => filters.every(([col, val]) => row[col] === val))
          return { data: rows.map((row) => Object.fromEntries(wanted.map((c) => [c, row[c] ?? null]))), error: null }
        }
        const query = {
          eq: (column: string, value: unknown) => {
            filters.push([column, value])
            return query
          },
          maybeSingle: async () => {
            const result = run()
            return { data: result.data?.[0] ?? null, error: result.error }
          },
          then: (resolve: (value: ReturnType<typeof run>) => unknown, reject?: (reason: unknown) => unknown) =>
            Promise.resolve(run()).then(resolve, reject),
        }
        return query
      },
    }),
  }
}

let isMigrated = true

vi.mock('@/lib/rbac/guard', () => ({
  guard: vi.fn(async () => ({ ok: true, caller: { userId: 'u-1', role: 'super_admin', originalRole: 'super_admin' } })),
}))
vi.mock('@/lib/forms/currentEmployee', () => ({
  getCurrentEmployee: vi.fn(async () => ({ email: 'asha@example.com', employee: { id: 'me', name: 'Asha Rao' } })),
}))
vi.mock('@/lib/supabase/admin', () => ({ createAdminSupabaseClient: vi.fn(() => null) }))
vi.mock('@/lib/supabase/server', () => ({ createServerSupabaseClient: vi.fn(async () => fakeDb(isMigrated)) }))

const { getMyTeamChart, getOrgChart } = await import('./getTeamChart')

describe('getMyTeamChart', () => {
  beforeEach(() => {
    isMigrated = true
  })

  it('places the whole reporting line in nested teams, leaving out people who have left', async () => {
    const result = await getMyTeamChart()
    if (!result.ok) throw new Error(result.error)
    const { chart } = result
    expect(chart.notice).toBeNull()
    expect(chart.tree.teams.map((t) => t.name)).toEqual(['CEO Office', 'PnC'])
    expect(flattenTeams(chart.tree.teams).find((t) => t.id === 'platform')?.members.map((m) => m.name)).toEqual([
      'Dev Malhotra',
      'Tanvi Joshi',
    ])
    expect(chart.stats).toEqual({ people: 4, teams: 2, subTeams: 1 })
    expect(chart.root).toMatchObject({ kind: 'person', teamName: 'CEO Office', directReports: 2 })
  })

  it('uses the designation, else the employment type', async () => {
    const result = await getMyTeamChart()
    if (!result.ok) throw new Error(result.error)
    const people = flattenTeams(result.chart.tree.teams).flatMap((t) => t.members)
    expect(people.find((p) => p.id === 'a')?.subtitle).toBe('Engineering Lead')
    expect(people.find((p) => p.id === 'b')?.subtitle).toBe('Intern')
    expect(people.find((p) => p.id === 'c')?.subtitle).toBe('Team member')
  })

  it('falls back to flat departments, with a notice, before the team-tree migration', async () => {
    isMigrated = false
    const result = await getMyTeamChart()
    if (!result.ok) throw new Error(result.error)
    const { chart } = result
    expect(chart.notice).toMatch(/database update/)
    // No nesting yet: Platform Dev stands on its own, and CEO Office, with
    // none of these reports directly in it, is left out.
    expect(chart.tree.teams.map((t) => t.name)).toEqual(['Platform Dev', 'PnC'])
    expect(flattenTeams(chart.tree.teams).every((t) => t.depth === 1)).toBe(true)
    // "pnc" in lower case still finds the PnC department.
    expect(chart.tree.teams.find((t) => t.id === 'pnc')?.members.map((m) => m.name)).toEqual(['Ritika Das'])
  })
})

describe('getOrgChart', () => {
  beforeEach(() => {
    isMigrated = true
  })

  it('shows everyone active, under the organisation', async () => {
    const result = await getOrgChart()
    if (!result.ok) throw new Error(result.error)
    expect(result.chart.root).toEqual({ kind: 'org', name: 'Example Org' })
    expect(result.chart.stats.people).toBe(4)
  })

  it('falls back before the team-tree migration too', async () => {
    isMigrated = false
    const result = await getOrgChart()
    if (!result.ok) throw new Error(result.error)
    expect(result.chart.notice).toMatch(/database update/)
    expect(result.chart.stats.people).toBe(4)
  })
})
