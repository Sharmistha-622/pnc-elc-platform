import { createServerSupabaseClient } from '@/lib/supabase/server'

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
}

export async function getEmployees(): Promise<Employee[]> {
  const supabase = await createServerSupabaseClient()

  // Attempt query with exit_date, email, and team text column
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

  return (data || []).map((row: any) => ({
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
  }))
}
