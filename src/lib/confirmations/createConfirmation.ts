'use server'

import { createServerSupabaseClient } from '@/lib/supabase/server'
import { auditConfirmation } from '@/lib/audit/events'
import { resolveEmployeeSubject } from '@/lib/audit/subject'
import { guard } from '@/lib/rbac/guard'
import { FEATURE_ACCESS } from '@/lib/role-constants'
import { mayActOnConfirmationOf } from './access'

export async function createConfirmation(employeeId: string, timelineType: string) {
  // P&C start confirmations for anyone (`confirmationsInitiate`); a line
  // manager, whatever their role, starts one only for their own report.
  const allowed = await guard('dashboard')
  if (!allowed.ok) return null

  const supabase = await createServerSupabaseClient()
  if (!(await mayActOnConfirmationOf(supabase, allowed.caller, employeeId, FEATURE_ACCESS.confirmationsInitiate))) {
    return null
  }

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

  await auditConfirmation.initiated({
    subject: await resolveEmployeeSubject(employeeId),
    entityId: data.id,
    entityType: 'confirmation',
    metadata: { timeline_type: timelineType },
  })

  return data
}
