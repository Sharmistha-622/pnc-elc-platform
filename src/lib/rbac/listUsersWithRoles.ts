import { createAdminSupabaseClient } from '@/lib/supabase/admin'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import type { UserRole } from '@/lib/role-constants'

export type UserRow = { id: string; email: string; name: string; role: UserRole | null }

export async function listUsersWithRoles(): Promise<UserRow[]> {
  const admin = createAdminSupabaseClient()
  if (admin) {
    try {
      const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 })
      if (!error && data && data.users.length > 0) {
        return data.users.map((u) => ({
          id: u.id,
          email: u.email ?? '',
          name: (u.user_metadata?.full_name as string) ?? (u.user_metadata?.name as string) ?? '',
          role: (u.app_metadata?.role as UserRole | undefined) ?? null,
        }))
      }
    } catch (err) {
      console.warn('Auth admin listUsers failed, falling back to directory roster:', err)
    }
  }

  // Fallback for environments without SUPABASE_SERVICE_ROLE_KEY (e.g. local development)
  try {
    const supabase = await createServerSupabaseClient()
    const { data: employees } = await supabase
      .from('employees')
      .select('id, name, email')
      .order('name', { ascending: true })

    const teamMembers: UserRow[] = [
      {
        id: 'usr-nitin',
        email: 'nitin@navgurukul.org',
        name: 'Nitin Sudarshan',
        role: 'Super Admin',
      },
      {
        id: 'usr-sharmistha',
        email: 'sharmisthamazumdar24@navgurukul.org',
        name: 'Sharmistha Mazumdar',
        role: 'Admin',
      },
    ]

    const mappedEmployees: UserRow[] = (employees || [])
      .filter((e: any) => e.email && !teamMembers.some((tm) => tm.email === e.email))
      .map((e: any) => ({
        id: e.id,
        email: e.email,
        name: e.name,
        role: 'Employee' as UserRole,
      }))

    return [...teamMembers, ...mappedEmployees]
  } catch (err) {
    console.error('Error fetching fallback users:', err)
    return []
  }
}
