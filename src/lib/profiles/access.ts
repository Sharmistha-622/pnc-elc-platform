import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getCurrentUserRole } from '@/lib/rbac/getCurrentUserRole'
import { getCurrentEmployee } from '@/lib/forms/currentEmployee'
import { passes } from '@/lib/rbac/guard'
import { canHandleDocuments } from '@/lib/documents/access'

// Not a 'use server' module: a helper for the profile actions and pages, and
// not something the browser should be able to call on its own.

export type ProfileAccess = {
  /** Name, team, email: the directory row. */
  general: boolean
  /** `employee_profiles`: ID numbers, addresses, phone and emergency contact. */
  identity: boolean
}

/**
 * What the signed-in user may see of this employee's profile.
 *
 * Identity data is the person's own, or handled by the roles that verify ID
 * documents (`canHandleDocuments`, identity `edit` org-wide). Fin Admin, Fin
 * Ops and Exec View reach the directory but hold `identity: none`, so they get
 * the general row and nothing from `employee_profiles`. Both the effective
 * and the original role must qualify: emulation narrows, never widens.
 */
export async function profileAccess(employeeId: string): Promise<ProfileAccess> {
  const resolved = await getCurrentUserRole()
  if (!resolved.userId || !resolved.role || !resolved.originalRole) {
    return { general: false, identity: false }
  }

  const supabase = await createServerSupabaseClient()
  const { employee } = await getCurrentEmployee(supabase)
  const own = Boolean(employee && employee.id === employeeId)

  return {
    general: own || passes(resolved, 'employees'),
    identity:
      own || (canHandleDocuments(resolved.role) && canHandleDocuments(resolved.originalRole)),
  }
}
