import { createServerSupabaseClient } from '@/lib/supabase/server'
import { guard } from '@/lib/rbac/guard'
import { isTeamScoped, managesEmployee } from './access'

export async function getConfirmation(confirmationId: string) {
  const allowed = await guard('confirmations')
  if (!allowed.ok) return null

  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase
    .from('confirmations')
    .select('*, employees(name, employee_type, joining_date, email)')
    .eq('id', confirmationId)
    .single()

  if (error) {
    console.error('Error fetching confirmation:', error.message)
    return null
  }

  // A line manager opens confirmations for their own reports only.
  if (isTeamScoped(allowed.caller) && !(await managesEmployee(supabase, data.employee_id))) return null

  return data
}