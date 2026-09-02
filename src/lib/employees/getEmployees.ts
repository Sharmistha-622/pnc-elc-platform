import { createServerSupabaseClient } from '@/lib/supabase/server'

export type Employee = {
  id: string
  name: string
  employee_type: string
  joining_date: string
  confirmation_date: string | null
  conversion_date: string | null
  team: string | null
  status: string
}

export async function getEmployees(): Promise<Employee[]> {
  const supabase = createServerSupabaseClient()
  const { data, error } = await supabase
    .from('employees')
    .select('*')
    .order('name')

  if (error) {
    console.error('Error fetching employees:', error)
    return []
  }

  return data as Employee[]
}