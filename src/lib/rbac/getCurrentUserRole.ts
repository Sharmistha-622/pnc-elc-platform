import { createServerSupabaseClient } from '@/lib/supabase/server'
import type { UserRole } from '@/lib/role-constants'

export async function getCurrentUserRole() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  return {
    userId: user?.id ?? null,
    email: user?.email ?? null,
    role: (user?.app_metadata?.role as UserRole | undefined) ?? null,
  }
}
