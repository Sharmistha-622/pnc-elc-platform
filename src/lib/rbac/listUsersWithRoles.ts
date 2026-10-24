import { createAdminSupabaseClient } from '@/lib/supabase/admin'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { normalizeRole, type UserRole } from '@/lib/role-constants'

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
  let authUsers: UserRow[] = []

  if (admin) {
    try {
      const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 })
      if (!error && data && data.users.length > 0) {
        authUsers = data.users.map((u) => ({
          id: u.id,
          email: u.email ?? '',
          name: (u.user_metadata?.full_name as string) ?? (u.user_metadata?.name as string) ?? '',
          // Roles stored before RBAC v1 are display names; normalize so the
          // directory never shows a role the rest of the app cannot read.
          role: (u.email?.toLowerCase() === 'nitin@navgurukul.org')
            ? ('super_admin' as UserRole)
            : normalizeRole(u.app_metadata?.role),
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

  // Fetch employees to enrich team info and incorporate directory roster
  try {
    const supabase = await createServerSupabaseClient()
    const { data: employees } = await supabase
      .from('employees')
      .select('id, name, email, team, status, created_at')
      .order('name', { ascending: true })

    const employeeMap = new Map<string, any>()
    employees?.forEach((e: any) => {
      if (e.email) employeeMap.set(e.email.toLowerCase(), e)
    })

    // Enrich auth users with team and profile info from employees table
    authUsers.forEach((u) => {
      const emp = employeeMap.get(u.email.toLowerCase())
      if (emp) {
        if (!u.team || u.team === 'None') u.team = emp.team || 'None'
        if (!u.name && emp.name) u.name = emp.name
      }
    })

    // There used to be a hardcoded "default staff" list merged in here, with
    // two named people and the roles they were assumed to hold. The screen
    // that grants roles must show the roles people actually hold, so only
    // auth users and the directory are listed.
    const existingEmails = new Set(authUsers.map((u) => u.email.toLowerCase()))

    // Include directory employees who do not have an auth user yet
    const mappedEmployees: UserRow[] = (employees || [])
      .filter((e: any) => e.email && !existingEmails.has(e.email.toLowerCase()))
      .map((e: any) => ({
        id: e.id,
        email: e.email,
        name: e.name,
        role: 'employee' as UserRole,
        team: e.team || 'None',
        status: e.status || 'active',
        created_at: e.created_at || null,
      }))

    return [...authUsers, ...mappedEmployees]
  } catch (err) {
    console.error('Error fetching employees roster:', err)
    return authUsers
  }
}
