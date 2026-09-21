import { createServerSupabaseClient } from '@/lib/supabase/server'

export async function getConfirmation(confirmationId: string) {
  const supabase = createServerSupabaseClient()
  const { data, error } = await supabase
    .from('confirmations')
    .select('*, employees(name, employee_type, joining_date, email)')
    .eq('id', confirmationId)
    .single()

  if (error) {
    console.error('Error fetching confirmation:', error.message)
    return null
  }

  return data
}