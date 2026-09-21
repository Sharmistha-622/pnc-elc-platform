import { createServerSupabaseClient } from '@/lib/supabase/server'

export type Employee = {
  id: string
  name: string
  employee_type: string
  team: string | null
  joining_date: string
  confirmation_date: string | null
  status: string
}

export async function getEmployees(): Promise<Employee[]> {
  const supabase = createServerSupabaseClient()
  const { data, error } = await supabase
    .from('employees')
    .select(`
      id,
      name,
      joining_date,
      confirmation_date,
      status,
      employee_types ( name ),
      teams ( name )
    `)
    .order('name')

  if (error) {
    console.error('Error fetching employees:', error)
    return []
  }

  return (data || []).map((row: any) => ({
    id: row.id,
    name: row.name,
    employee_type: row.employee_types?.name || 'unknown',
    team: row.teams?.name || null,
    joining_date: row.joining_date,
    confirmation_date: row.confirmation_date,
    status: row.status,
  }))
}