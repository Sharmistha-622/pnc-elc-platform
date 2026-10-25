'use server'

import { createServerSupabaseClient } from '@/lib/supabase/server'
import { auditConfirmation } from '@/lib/audit/events'
import { resolveEmployeeSubject } from '@/lib/audit/subject'
import { guard } from '@/lib/rbac/guard'
import { confirmationEmployeeId } from './access'

export async function approveConfirmation(confirmationId: string, employeeId: string) {
  // The final call on a confirmation is P&C's. A manager records a decision
  // through `updateManagerDecision`, and does not approve: managers hold
  // `performance: edit` for their team, which is why this cannot simply ask
  // the matrix for that.
  const allowed = await guard(['super_admin', 'pnc_admin'])
  if (!allowed.ok) return { success: false, error: allowed.error }

  const supabase = await createServerSupabaseClient()
  const today = new Date().toISOString().split('T')[0]

  // The employee whose record is stamped comes from the confirmation itself.
  // Taken from the caller, it would let one approval write a confirmation date
  // onto anyone in the directory.
  const subjectId = await confirmationEmployeeId(supabase, confirmationId)
  if (!subjectId) return { success: false, error: 'Confirmation not found' }
  if (employeeId && employeeId !== subjectId) {
    return { success: false, error: 'That confirmation is for a different employee.' }
  }

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
    .eq('id', subjectId)

  if (employeeError) {
    console.error('Error updating employee confirmation_date:', employeeError.message)
    return { success: false, error: employeeError.message }
  }

  await auditConfirmation.approved({
    subject: await resolveEmployeeSubject(subjectId),
    entityId: confirmationId,
    entityType: 'confirmation',
    metadata: { confirmation_date: today },
  })

  return { success: true, confirmationDate: today }
}
