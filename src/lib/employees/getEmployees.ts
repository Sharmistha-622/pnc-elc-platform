import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createAdminSupabaseClient } from '@/lib/supabase/admin'
import { getSafeAvatarUrl } from '@/lib/avatar'

export type Employee = {
  id: string
  name: string
  email?: string | null
  employee_type: string
  team: string | null
  joining_date: string
  exit_date?: string | null
  confirmation_date: string | null
  status: string
  is_alumni?: boolean | null
  manager_id?: string | null
  user_id?: string | null
  avatar_url?: string | null
  user_role?: string | null
}

export async function getEmployees(): Promise<Employee[]> {
  const supabase = await createServerSupabaseClient()

  // Attempt query with exit_date, email, team, and manager_id
  const withExit = await supabase
    .from('employees')
    .select(`
      id,
      name,
      email,
      team,
      joining_date,
      exit_date,
      is_alumni,
      confirmation_date,
      status,
      manager_id,

      employee_types ( name ),
      teams ( name )
    `)
    .order('name')

  let data: any[] | null = null

  if (withExit.error) {
    // Fallback if exit_date column does not exist
    const fallback = await supabase
      .from('employees')
      .select(`
        id,
        name,
        email,
        team,
        joining_date,
        confirmation_date,
        status,
        manager_id,

        employee_types ( name ),
        teams ( name )
      `)
      .order('name')

    if (fallback.error) {
      console.error('Error fetching employees:', fallback.error)
      return []
    }
    data = fallback.data
  } else {
    data = withExit.data
  }

  // Enrich with auth users: link auth user account, Google avatar URL, and user role
  const userMap = new Map<string, { id: string; avatarUrl: string | null; role: string | null }>()
  const admin = createAdminSupabaseClient()
  if (admin) {
    try {
      const { data: usersData, error: usersError } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
      if (!usersError && usersData?.users) {
        for (const u of usersData.users) {
          if (u.email) {
            userMap.set(u.email.toLowerCase(), {
              id: u.id,
              avatarUrl: getSafeAvatarUrl(u.user_metadata),
              role: (u.email.toLowerCase() === 'nitin@navgurukul.org')
                ? 'super_admin'
                : (u.app_metadata?.role as string) || 'member',
            })
          }
        }
      }
    } catch (err) {
      console.warn('Failed to load auth users for employee enrichment:', err)
    }
  }

  return (data || []).map((row: any) => {
    const userEntry = row.email ? userMap.get(row.email.toLowerCase()) : null

    return {
      id: row.id,
      name: row.name,
      email: row.email || null,
      employee_type: row.employee_types?.name || 'Full-Time',
      team: row.team || row.teams?.name || null,
      joining_date: row.joining_date,
      exit_date: row.exit_date || null,
      confirmation_date: row.confirmation_date,
      status: row.status || 'active',
      is_alumni: row.is_alumni ?? null,
      manager_id: row.manager_id || null,
      user_id: userEntry?.id || null,
      avatar_url: userEntry?.avatarUrl || null,
      user_role: userEntry?.role || null,
    }
  })
}
