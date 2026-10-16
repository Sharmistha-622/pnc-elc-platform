import { cookies } from 'next/headers'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { resolveRole, IMMUTABLE_SUPER_ADMIN_EMAILS } from '@/lib/rbac/resolveRole'

export { IMMUTABLE_SUPER_ADMIN_EMAILS }

export async function getCurrentUserRole() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  const cookieStore = await cookies()
  const devOverride = cookieStore.get('dev-role-override')?.value

  // An anonymous visitor resolves to a null role, not to Super Admin.
  return resolveRole(user, devOverride)
}
