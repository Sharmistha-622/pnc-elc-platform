import { getSafeAvatarUrl } from '@/lib/avatar'
import { getCurrentEmployee } from '@/lib/forms/currentEmployee'
import { guard } from '@/lib/rbac/guard'
import { canAccessRoute } from '@/lib/role-constants'
import { createAdminSupabaseClient } from '@/lib/supabase/admin'
import { createServerSupabaseClient } from '@/lib/supabase/server'

import {
  buildTeamTree,
  departmentIdByName,
  personSubtitle,
  reportingLine,
  treeStats,
  type TeamPerson,
  type TeamRecord,
} from './teamTree'
import type { TeamChartResult } from './teamChartTypes'

// ============================================================================
// Loading the team chart
// ----------------------------------------------------------------------------
// SERVER ONLY. Two charts share one shape:
//
//   My team (`getMyTeamChart`): the viewer and everyone below them in the
//   reporting line, at any depth. Read from `public.directory`, which every
//   staff session may read; it shows a colleague's email only to themselves,
//   their manager and their direct reports, so indirect reports come back
//   with no email, and so no photo (photos are matched by email).
//
//   Org chart (`getOrgChart`): everyone active, for Super Admin and PnC Admin.
//   Read from `employees`, which RLS opens to those roles in full.
//
// Each is a handful of queries in parallel (people, departments, employment
// types), never one per team. Only general data leaves the server: name,
// designation, team, work email when allowed, and photo.
//
// Until migration 202611111500_team_tree is applied to a database, the
// columns it adds (`department_id`, `designation`, `departments.parent_id`)
// do not exist there. The chart then falls back to flat teams, placing people
// by their department name, and says so, rather than failing.
// ============================================================================

interface PersonRow {
  id: string
  name: string
  email: string | null
  status: string | null
  manager_id: string | null
  department_id: string | null
  designation: string | null
  employee_type_id: string | null
}

const PERSON_COLUMNS = 'id, name, email, status, manager_id, department_id, designation, employee_type_id'
const LEGACY_PERSON_COLUMNS = 'id, name, email, status, manager_id, team, employee_type_id'
const LOAD_FAILED = 'The team chart could not be loaded. Try again in a moment.'
const PENDING_MIGRATION =
  'Sub-teams and designations will appear once the database update for team charts is applied. Until then, everyone is shown in their department.'
const DEFAULT_ORG_NAME = 'NavGurukul'

// Postgres "undefined column", and PostgREST's "column not in the schema cache".
const MISSING_COLUMN = new Set(['42703', 'PGRST204'])

type Db = Awaited<ReturnType<typeof createServerSupabaseClient>>
type QueryError = { code?: string } | null

interface ChartRows {
  people: PersonRow[]
  teams: TeamRecord[]
  /** Set when the database predates the team-tree migration. */
  notice: string | null
}

/**
 * People and teams for a chart, from `directory` (every staff session) or
 * `employees` (org-wide roles, active people only). Null on a failure other
 * than the team-tree columns being absent.
 */
const loadChartRows = async (
  supabase: Db,
  source: 'directory' | 'employees',
): Promise<{ rows: ChartRows | null; error: QueryError }> => {
  const people = (columns: string) => {
    const query = supabase.from(source).select(columns)
    return source === 'employees' ? query.eq('status', 'active') : query
  }

  const [current, departments] = await Promise.all([
    people(PERSON_COLUMNS),
    supabase.from('departments').select('id, name, parent_id'),
  ])
  const isPendingMigration = MISSING_COLUMN.has(current.error?.code ?? '') || MISSING_COLUMN.has(departments.error?.code ?? '')
  if (!isPendingMigration) {
    const error = current.error ?? departments.error
    if (error) return { rows: null, error }
    return {
      rows: {
        people: (current.data ?? []) as unknown as PersonRow[],
        teams: (departments.data ?? []).map((r) => ({ id: r.id, name: r.name, parentId: r.parent_id })),
        notice: null,
      },
      error: null,
    }
  }

  const [legacy, legacyDepartments] = await Promise.all([
    people(LEGACY_PERSON_COLUMNS),
    supabase.from('departments').select('id, name'),
  ])
  const error = legacy.error ?? legacyDepartments.error
  if (error) return { rows: null, error }
  const teams: TeamRecord[] = (legacyDepartments.data ?? []).map((r) => ({ id: r.id, name: r.name, parentId: null }))
  const idFor = departmentIdByName(teams)
  const rows = (legacy.data ?? []) as unknown as (Omit<PersonRow, 'department_id' | 'designation'> & { team: string | null })[]
  return {
    rows: {
      people: rows.map(({ team, ...row }) => ({ ...row, department_id: idFor(team), designation: null })),
      teams,
      notice: PENDING_MIGRATION,
    },
    error: null,
  }
}

const toPerson = (row: PersonRow, typeNames: Map<string, string>, avatars: Map<string, string>): TeamPerson => ({
  id: row.id,
  name: row.name,
  departmentId: row.department_id,
  subtitle: personSubtitle(row.designation, row.employee_type_id ? typeNames.get(row.employee_type_id) : null),
  email: row.email,
  avatarUrl: row.email ? avatars.get(row.email.toLowerCase()) ?? null : null,
  managerId: row.manager_id,
})

/**
 * Photos for the people whose email the caller may already see. Account
 * metadata is read with the service-role client, after the caller's guard,
 * and only the photo URL of a listed email is kept.
 */
const avatarsFor = async (emails: (string | null)[]): Promise<Map<string, string>> => {
  const wanted = new Set(emails.filter((e): e is string => Boolean(e)).map((e) => e.toLowerCase()))
  const avatars = new Map<string, string>()
  const admin = createAdminSupabaseClient()
  if (!admin || wanted.size === 0) return avatars
  try {
    const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
    if (error) {
      console.error('team chart: photos unavailable', { code: error.code ?? null })
      return avatars
    }
    for (const user of data.users) {
      const email = user.email?.toLowerCase()
      if (!email || !wanted.has(email)) continue
      const url = getSafeAvatarUrl(user.user_metadata)
      if (url) avatars.set(email, url)
    }
  } catch {
    console.error('team chart: photos unavailable')
  }
  return avatars
}

/**
 * The viewer's team chart: everyone below them in the reporting line, placed
 * in their teams. Indirect reports carry no email (the directory's rule).
 */
export const getMyTeamChart = async (): Promise<TeamChartResult> => {
  const gate = await guard('myTeam')
  if (!gate.ok) return { ok: false, error: gate.error }

  const supabase = await createServerSupabaseClient()
  const { employee } = await getCurrentEmployee(supabase)
  if (!employee) {
    return { ok: false, error: 'No employee record matches your account, so there is no team to show.' }
  }

  const [loaded, types] = await Promise.all([
    loadChartRows(supabase, 'directory'),
    supabase.from('employee_types').select('id, name'),
  ])
  const failed = loaded.error ?? types.error
  if (failed || !loaded.rows) {
    console.error('team chart: load failed', { code: failed?.code ?? null })
    return { ok: false, error: LOAD_FAILED }
  }

  const { people: rows, teams, notice } = loaded.rows
  const viewer = rows.find((r) => r.id === employee.id)
  // Walk through everyone, so a report whose manager has left still counts,
  // then show only people who are still here.
  const line = reportingLine(
    rows.map((r) => ({ ...r, managerId: r.manager_id })),
    employee.id,
  ).people.filter((r) => r.status !== 'exited')

  const typeNames = new Map((types.data ?? []).map((t: { id: string; name: string }) => [t.id, t.name]))
  const avatars = await avatarsFor([viewer?.email ?? null, ...line.map((r) => r.email)])
  const tree = buildTeamTree(teams, line.map((r) => toPerson(r, typeNames, avatars)))

  const viewerRow: PersonRow = viewer ?? {
    id: employee.id,
    name: employee.name,
    email: null,
    status: 'active',
    manager_id: null,
    department_id: null,
    designation: null,
    employee_type_id: null,
  }

  return {
    ok: true,
    chart: {
      root: {
        kind: 'person',
        person: toPerson(viewerRow, typeNames, avatars),
        teamName: teams.find((t) => t.id === viewerRow.department_id)?.name ?? null,
        directReports: line.filter((r) => r.manager_id === employee.id).length,
      },
      tree,
      stats: treeStats(tree, 1),
      canOpenProfiles: canAccessRoute(gate.caller.role, '/employees/x/profile'),
      storageKey: `team-chart:my-team:${gate.caller.userId}`,
      notice,
    },
  }
}

/** Everyone in the organisation, placed in their teams. Super Admin and PnC Admin. */
export const getOrgChart = async (): Promise<TeamChartResult> => {
  const gate = await guard('orgChart')
  if (!gate.ok) return { ok: false, error: gate.error }

  const supabase = await createServerSupabaseClient()
  const [loaded, types, orgName] = await Promise.all([
    loadChartRows(supabase, 'employees'),
    supabase.from('employee_types').select('id, name'),
    supabase.from('general_settings').select('value').eq('key', 'organization_name').maybeSingle(),
  ])
  const failed = loaded.error ?? types.error
  if (failed || !loaded.rows) {
    console.error('org chart: load failed', { code: failed?.code ?? null })
    return { ok: false, error: LOAD_FAILED }
  }

  const { people: rows, teams, notice } = loaded.rows
  const typeNames = new Map((types.data ?? []).map((t: { id: string; name: string }) => [t.id, t.name]))
  const avatars = await avatarsFor(rows.map((r) => r.email))
  const tree = buildTeamTree(
    teams,
    rows.map((r) => toPerson(r, typeNames, avatars)),
  )
  const configuredName = (orgName.data as { value?: unknown } | null)?.value

  return {
    ok: true,
    chart: {
      root: { kind: 'org', name: typeof configuredName === 'string' && configuredName.trim() ? configuredName.trim() : DEFAULT_ORG_NAME },
      tree,
      stats: treeStats(tree),
      canOpenProfiles: canAccessRoute(gate.caller.role, '/employees/x/profile'),
      storageKey: `team-chart:org:${gate.caller.userId}`,
      notice,
    },
  }
}
