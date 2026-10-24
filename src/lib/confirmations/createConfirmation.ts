'use server'

import { createServerSupabaseClient } from '@/lib/supabase/server'
import { auditConfirmation } from '@/lib/audit/events'
import { resolveEmployeeSubject } from '@/lib/audit/subject'
import { guard } from '@/lib/rbac/guard'
import { isTeamScoped, managesEmployee } from './access'

export async function createConfirmation(employeeId: string, timelineType: string) {
  // Starting a confirmation is `confirmationsInitiate`, and a line manager
  // starts one only for someone who reports to them.
  const allowed = await guard('confirmationsInitiate')
  if (!allowed.ok) return null

  const supabase = await createServerSupabaseClient()
  if (isTeamScoped(allowed.caller) && !(await managesEmployee(supabase, employeeId))) return null

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
