'use server'

import { createServerSupabaseClient } from '@/lib/supabase/server'
import { auditConfirmation } from '@/lib/audit/events'
import { resolveEmployeeSubject } from '@/lib/audit/subject'
import { guard } from '@/lib/rbac/guard'
import { confirmationEmployeeId, mayActOnConfirmationOf } from './access'

export async function updateManagerDecision(
  confirmationId: string,
  decision: 'yes' | 'no',
  rescheduleDate?: string
) {
  // The decision is the reporting manager's — whatever role they hold — or
  // P&C's on their behalf. Anyone else who can open the screen (Exec View,
  // PnC Ops) holds no write on someone else's report's performance.
  const allowed = await guard('dashboard')
  if (!allowed.ok) return null
  if (decision !== 'yes' && decision !== 'no') return null

  const supabase = await createServerSupabaseClient()
  const subjectId = await confirmationEmployeeId(supabase, confirmationId)
  if (!(await mayActOnConfirmationOf(supabase, allowed.caller, subjectId, ['super_admin', 'pnc_admin']))) {
    return null
  }

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

  const subject = await resolveEmployeeSubject(data.employee_id)
  if (decision === 'yes') {
    await auditConfirmation.managerDecision({
      subject,
      entityId: confirmationId,
      entityType: 'confirmation',
      decision: 'Confirm employment',
    })
  } else {
    await auditConfirmation.extended({
      subject,
      entityId: confirmationId,
      entityType: 'confirmation',
      until: rescheduleDate,
      reason: 'Manager deferred confirmation',
    })
  }

  return data
}
