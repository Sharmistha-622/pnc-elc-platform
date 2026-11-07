import { createAdminSupabaseClient } from '@/lib/supabase/admin'
import type { Guarded } from '@/lib/rbac/guard'
import type { Principal } from './service'

/**
 * The signed-in staff member as a principal: their employee record, found by
 * the session's email. Never taken from the request. Null when the account
 * has no employee record.
 */
export async function staffPrincipal(caller: Pick<Guarded, 'email'>): Promise<Principal | null> {
  const email = caller.email?.trim().toLowerCase()
  const admin = createAdminSupabaseClient()
  if (!email || !admin) return null
  const { data } = await admin.from('employees').select('id, employee_type').ilike('email', email).eq('status', 'active').limit(1).maybeSingle()
  if (!data) return null
  // Contractors and volunteers are principals in their own right (s. 7(i) is read narrowly).
  const type = data.employee_type === 'contractor' ? 'contractor' : 'employee'
  return { type, ref: data.id as string }
}
