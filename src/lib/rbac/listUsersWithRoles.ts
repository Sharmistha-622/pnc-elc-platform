import { createAdminSupabaseClient } from '@/lib/supabase/admin'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import type { UserRole } from '@/lib/role-constants'

export type UserRow = {
  id: string
  email: string
  name: string
  role: UserRole | null
  team?: string | null
  status?: string | null
  created_at?: string | null
  last_active_at?: string | null
  avatar?: string | null
}

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
          role: (u.email?.toLowerCase() === 'nitin@navgurukul.org')
            ? ('Super Admin' as UserRole)
            : ((u.app_metadata?.role as UserRole | undefined) ?? null),
          team: (u.user_metadata?.team as string) ?? null,
          status: u.confirmed_at ? 'active' : 'invited',
          created_at: u.created_at,
          last_active_at: u.last_sign_in_at,
          avatar: (u.user_metadata?.avatar_url as string) ?? (u.user_metadata?.picture as string) ?? null,
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
      .select('id, name, email, team, status, created_at')
      .order('name', { ascending: true })

    const teamMembers: UserRow[] = [
      {
        id: 'usr-nitin',
        email: 'nitin@navgurukul.org',
        name: 'Nitin Sudarshan',
        role: 'Super Admin',
        team: "CEO's Office",
        status: 'active',
      },
      {
        id: 'usr-sharmistha',
        email: 'sharmisthamazumdar24@navgurukul.org',
        name: 'Sharmistha Mazumdar',
        role: 'Admin',
        team: 'PnC',
        status: 'active',
      },
    ]

    const mappedEmployees: UserRow[] = (employees || [])
      .filter((e: any) => e.email && !teamMembers.some((tm) => tm.email.toLowerCase() === e.email.toLowerCase()))
      .map((e: any) => ({
        id: e.id,
        email: e.email,
        name: e.name,
        role: 'Employee' as UserRole,
        team: e.team || 'None',
        status: e.status || 'active',
        created_at: e.created_at || null,
      }))

    return [...teamMembers, ...mappedEmployees]
  } catch (err) {
    console.error('Error fetching fallback users:', err)
    return []
  }
}
