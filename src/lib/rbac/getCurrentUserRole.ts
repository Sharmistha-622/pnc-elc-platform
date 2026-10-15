import { cookies } from 'next/headers'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import type { UserRole } from '@/lib/role-constants'

export const IMMUTABLE_SUPER_ADMIN_EMAILS = ['nitin@navgurukul.org']

export async function getCurrentUserRole() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  const cookieStore = await cookies()
  const devOverride = cookieStore.get('dev-role-override')?.value as UserRole | undefined

  const email = user?.email?.toLowerCase() ?? null
  const isImmutableSuperAdmin = email ? IMMUTABLE_SUPER_ADMIN_EMAILS.includes(email) : false

  const rawRole = (user?.app_metadata?.role as UserRole | undefined) ?? null
  const originalRole: UserRole | null = isImmutableSuperAdmin ? 'Super Admin' : rawRole

  // Only admin-style roles (Super Admin, Admin) are permitted to emulate/override roles
  const isAdminActor = originalRole === 'Super Admin' || originalRole === 'Admin'
  const effectiveRole = (isAdminActor && devOverride) ? devOverride : (originalRole || (user ? 'Employee' : 'Super Admin'))

  return {
    userId: user?.id ?? null,
    email: user?.email ?? null,
    role: effectiveRole,
    originalRole: originalRole || (user ? 'Employee' : 'Super Admin'),
    isEmulating: Boolean(isAdminActor && devOverride && devOverride !== originalRole),
  }
}
