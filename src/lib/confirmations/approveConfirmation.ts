'use server'

import { createServerSupabaseClient } from '@/lib/supabase/server'

export async function approveConfirmation(confirmationId: string, employeeId: string) {
  const supabase = createServerSupabaseClient()
  const today = new Date().toISOString().split('T')[0]

  // Update the confirmations table status
  const { error: confirmationError } = await supabase
    .from('confirmations')
    .update({ status: 'approved' })
    .eq('id', confirmationId)

  if (confirmationError) {
    console.error('Error approving confirmation:', confirmationError.message)
    return { success: false, error: confirmationError.message }
  }

  // Write confirmation_date back onto the employee record
  const { error: employeeError } = await supabase
    .from('employees')
    .update({ confirmation_date: today })
    .eq('id', employeeId)

  if (employeeError) {
    console.error('Error updating employee confirmation_date:', employeeError.message)
    return { success: false, error: employeeError.message }
  }

  return { success: true, confirmationDate: today }
}