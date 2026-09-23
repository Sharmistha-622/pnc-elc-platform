'use server'

import { createServerSupabaseClient } from '@/lib/supabase/server'

export async function createConfirmation(employeeId: string, timelineType: string) {
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase
    .from('confirmations')
    .insert({
      employee_id: employeeId,
      timeline_type: timelineType,
      status: 'pending',
    })
    .select()
    .single()

  if (error) {
    console.error('Error creating confirmation:', error.message, error.details, error.hint)
    return null
  }

  return data
}