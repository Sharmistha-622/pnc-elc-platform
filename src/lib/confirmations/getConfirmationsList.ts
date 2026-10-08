import { createServerSupabaseClient } from '@/lib/supabase/server'

export type ConfirmationListItem = {
  id: string
  status: string
  managerDecision: string | null
  employeeName: string
  employeeType: string
}

export async function getConfirmationsList(): Promise<ConfirmationListItem[]> {
  const supabase = await createServerSupabaseClient()

  const { data, error } = await supabase
    .from('confirmations')
    .select('*, employees(name, employee_types(name))')

  if (error) {
    console.error('Error fetching confirmations list:', error.message)
    return []
  }

  return (data || []).map((row: any) => ({
    id: row.id,
    status: row.status,
    managerDecision:
      row.manager_decision === null || row.manager_decision === undefined
        ? null
        : String(row.manager_decision),
    employeeName: row.employees?.name || 'Unknown',
    employeeType: row.employees?.employee_types?.name || 'Unknown',
  }))
}