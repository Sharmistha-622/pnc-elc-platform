import { createServerSupabaseClient } from '@/lib/supabase/server'
import { guard } from '@/lib/rbac/guard'
import { isTeamScoped, myReporteeIds } from './access'

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
  const allowed = await guard('confirmations')
  if (!allowed.ok) return []

  const supabase = await createServerSupabaseClient()

  let query = supabase.from('confirmations').select('*, employees(id, name, employee_types(name))')

  // A line manager's view of the pipeline is their own team. The matrix
  // scopes their performance access to `own_team`, and every row here carries
  // a manager decision.
  if (isTeamScoped(allowed.caller)) {
    const reportees = await myReporteeIds(supabase)
    if (reportees.length === 0) return []
    query = query.in('employee_id', reportees)
  }

  const { data, error } = await query.order('created_at', { ascending: false })

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