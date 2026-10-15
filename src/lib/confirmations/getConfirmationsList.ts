import { createServerSupabaseClient } from '@/lib/supabase/server'

export type ConfirmationListItem = {
  id: string
  status: string
  managerDecision: string | null
  employeeName: string
  employeeType: string
  employeeId?: string
  timelineType?: string
  createdAt?: string
  updatedAt?: string
  rescheduleDate?: string | null
}

export async function getConfirmationsList(): Promise<ConfirmationListItem[]> {
  const supabase = await createServerSupabaseClient()

  const { data, error } = await supabase
    .from('confirmations')
    .select('*, employees(id, name, employee_types(name))')
    .order('created_at', { ascending: false })

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
    employeeType: row.employees?.employee_types?.name || row.timeline_type || 'Unknown',
    employeeId: row.employee_id || row.employees?.id,
    timelineType: row.timeline_type,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    rescheduleDate: row.reschedule_date,
  }))
}