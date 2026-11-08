// ============================================================================
// An employee's department
// ----------------------------------------------------------------------------
// `employees.team` holds the department's name, exactly as Data Management →
// Departments lists it. It is what the import, onboarding, Users & Roles and
// the dashboard panels all write and read.
//
// `employees.team_id` points at the older `teams` table, which nothing
// manages and which holds few of the department names. It is filled only when
// a matching row happens to exist, so it is a fallback for records written
// before `team` was, never the answer on its own.
// ============================================================================

type TeamsJoin = { name?: string | null } | { name?: string | null }[] | null | undefined

/** The department an employee record is in, or null. */
export function departmentOf(
  row: { team?: string | null; teams?: TeamsJoin } | null | undefined,
): string | null {
  const text = typeof row?.team === 'string' ? row.team.trim() : ''
  if (text && text !== 'None') return text
  const joined = Array.isArray(row?.teams) ? row?.teams[0] : row?.teams
  const legacy = typeof joined?.name === 'string' ? joined.name.trim() : ''
  return legacy || null
}
