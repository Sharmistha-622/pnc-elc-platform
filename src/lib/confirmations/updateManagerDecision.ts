'use server'

import { createServerSupabaseClient } from '@/lib/supabase/server'

export async function updateManagerDecision(
  confirmationId: string,
  decision: 'yes' | 'no',
  rescheduleDate?: string
) {
  const supabase = await createServerSupabaseClient()

  const updateData: {
    manager_decision: string
    status: string
    reschedule_date?: string
  } = {
    manager_decision: decision,
    status: decision === 'yes' ? 'approved' : 'rescheduled',
  }

  if (decision === 'no' && rescheduleDate) {
    updateData.reschedule_date = rescheduleDate
  }

  const { data, error } = await supabase
    .from('confirmations')
    .update(updateData)
    .eq('id', confirmationId)
    .select()
    .single()

  if (error) {
    console.error('Error updating manager decision:', error.message, error.details, error.hint)
    return null
  }

  return data
}