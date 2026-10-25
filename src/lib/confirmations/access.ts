import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getCurrentEmployee } from '@/lib/forms/currentEmployee'
import { accessFor } from '@/lib/rbac/roles'
import { passes, type Guarded } from '@/lib/rbac/guard'
import { FEATURE_ACCESS } from '@/lib/role-constants'

// ============================================================================
// Who may do what with a confirmation
// ----------------------------------------------------------------------------
// Not a 'use server' module: these are helpers for the actions and pages in
// this folder, and none of them should be callable from the browser.
//
// The feature lists in `role-constants.ts` say which roles reach
// confirmations at all. What they cannot say is that a line manager reaches
// only their own reports, or that PnC Ops sees whether feedback arrived but
// never what it says. Those two rules live here.
// ============================================================================

type Db = Awaited<ReturnType<typeof createServerSupabaseClient>>

type Roles = Pick<Guarded, 'role' | 'originalRole'>

/**
 * True when the caller reaches confirmations as a line manager, and so only
 * for the people who report to them.
 *
 * Either role counts. A Super Admin viewing the app as Manager is scoped
 * exactly as a real Manager is, because emulation exists to see less.
 */
export function isTeamScoped(caller: Roles): boolean {
  return caller.role === 'manager' || caller.originalRole === 'manager'
}

/**
 * True when the caller may read what peers wrote, not only whether they wrote.
 *
 * Taken from the matrix: `status_only` (PnC Ops) and `outcomes_only` (Fin
 * Admin, or an employee about themselves) see that feedback exists, never its
 * text. Both roles must allow it, like every guard.
 */
export function mayReadFeedbackText(caller: Roles): boolean {
  return [caller.role, caller.originalRole].every((role) => {
    const access = accessFor(role, 'performance')
    return access.level !== 'none' && access.qualifier !== 'status_only' && access.qualifier !== 'outcomes_only'
  })
}

/** Ids of the employees whose `manager_id` is the signed-in user's employee id. */
export async function myReporteeIds(supabase: Db): Promise<string[]> {
  const { employee } = await getCurrentEmployee(supabase)
  if (!employee) return []
  const { data } = await supabase.from('employees').select('id').eq('manager_id', employee.id)
  return ((data ?? []) as { id: string }[]).map((row) => row.id)
}

/** True when `employeeId` reports to the signed-in user. */
export async function managesEmployee(supabase: Db, employeeId: string | null | undefined): Promise<boolean> {
  if (!employeeId) return false
  const { employee } = await getCurrentEmployee(supabase)
  if (!employee) return false
  const { data } = await supabase
    .from('employees')
    .select('id')
    .eq('id', employeeId)
    .eq('manager_id', employee.id)
    .maybeSingle()
  return Boolean(data)
}

/**
 * The employee a confirmation is about, read from the record.
 *
 * Never taken from the caller: an action handed a confirmation id and an
 * employee id separately cannot trust that the two belong together.
 */
export async function confirmationEmployeeId(supabase: Db, confirmationId: string): Promise<string | null> {
  const { data } = await supabase
    .from('confirmations')
    .select('employee_id')
    .eq('id', confirmationId)
    .maybeSingle()
  return (data?.employee_id as string | undefined) ?? null
}

/**
 * True when the signed-in user is the peer this feedback request was sent to.
 *
 * Matched on the employee id when the nomination carried one, and otherwise on
 * the address the request was emailed to, since a peer can be nominated by
 * email alone.
 */
export async function isNominatedPeer(
  supabase: Db,
  request: { peer_employee_id?: string | null; peer_email?: string | null }
): Promise<boolean> {
  const { email, employee } = await getCurrentEmployee(supabase)
  if (request.peer_employee_id && employee?.id === request.peer_employee_id) return true
  return Boolean(
    request.peer_email && email && request.peer_email.trim().toLowerCase() === email.trim().toLowerCase()
  )
}

/**
 * True when the caller may act on this employee's confirmation.
 *
 * Either they run the process for everyone (`roles`, minus the team-scoped
 * `manager`), or they are this employee's line manager — whatever their role.
 * A user holds one role, so an executive or a PnC Ops lead with direct
 * reports does not hold `manager`: the reporting line, not the role, is what
 * makes them someone's manager. Before this check existed they were refused
 * the decision on their own report while the dashboard listed it for them.
 */
export async function mayActOnConfirmationOf(
  supabase: Db,
  caller: Guarded,
  employeeId: string | null | undefined,
  roles: readonly string[]
): Promise<boolean> {
  if (!isTeamScoped(caller) && passes(caller, roles as typeof FEATURE_ACCESS.dashboard)) return true
  return managesEmployee(supabase, employeeId)
}

