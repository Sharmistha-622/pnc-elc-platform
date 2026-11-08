import type { SupabaseClient } from '@supabase/supabase-js'

// ============================================================================
// Writing a department onto the employee record
// ----------------------------------------------------------------------------
// SERVER ONLY, and deliberately not a 'use server' file: it writes with the
// service-role client the caller passes in, so callers check who may set a
// department first (`updateUserAllocations`, `createUserWithRole`).
//
// The service-role client because the directory is `general: edit` for PnC
// only: a Platform Admin's session would be refused by the database, and an
// update refused by RLS changes zero rows without an error.
// ============================================================================

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export type DepartmentSyncResult = { ok: true } | { ok: false; error: string }

/**
 * Sets the department on the employee record with this email, or with this
 * id when it is an employee id. `team` takes the department's name (null for
 * none), which is what every screen reads (`departmentOf`); `team_id` is set
 * when the older `teams` table has a row of that name, and cleared otherwise.
 *
 * Succeeds without a change when there is no employee record to update.
 */
export async function syncEmployeeDepartment(
  admin: SupabaseClient,
  target: { email: string; employeeId?: string | null; department: string | null },
): Promise<DepartmentSyncResult> {
  const email = target.email.trim().toLowerCase()
  const department = target.department && target.department !== 'None' ? target.department.trim() : null

  try {
    let teamId: string | null = null
    if (department) {
      const { data: teamRecord } = await admin.from('teams').select('id').ilike('name', department).maybeSingle()
      teamId = (teamRecord as { id?: string } | null)?.id ?? null
    }

    const byId = target.employeeId && UUID.test(target.employeeId) ? `,id.eq.${target.employeeId}` : ''
    const { error } = await admin
      .from('employees')
      .update({ team: department, team_id: teamId, updated_at: new Date().toISOString() })
      .or(`email.ilike.${email}${byId}`)
    if (error) {
      console.error('Employee department sync failed', { code: (error as { code?: string }).code ?? null })
      return { ok: false, error: 'The employee record could not be updated.' }
    }
    return { ok: true }
  } catch {
    console.error('Employee department sync failed')
    return { ok: false, error: 'The employee record could not be updated.' }
  }
}
