import { createAdminSupabaseClient } from '@/lib/supabase/admin'
import type { UserRole } from '@/lib/role-constants'

export type UserRow = { id: string; email: string; name: string; role: UserRole | null }

export async function listUsersWithRoles(): Promise<UserRow[]> {
  const admin = createAdminSupabaseClient()
  const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 })
  if (error) {
    console.error('Error listing users:', error.message)
    return []
  }
  return data.users.map((u) => ({
    id: u.id,
    email: u.email ?? '',
    name: (u.user_metadata?.full_name as string) ?? '',
    role: (u.app_metadata?.role as UserRole | undefined) ?? null,
  }))
}
