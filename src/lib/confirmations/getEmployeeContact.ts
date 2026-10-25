'use server'

import { createServerSupabaseClient } from '@/lib/supabase/server'
import { guard } from '@/lib/rbac/guard'

// Looks up an employee's name and email by UUID, for auto-filling the confirmation form
export async function getEmployeeContact(employeeId: string) {
  // A server action, so it answers to the gate of the form it serves.
  const allowed = await guard('confirmationsInitiate')
  if (!allowed.ok) return null

  const id = employeeId.trim()
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null

  const supabase = await createServerSupabaseClient()
  const { data } = await supabase
    .from('employees')
    .select('name, email')
    .eq('id', id)
    .maybeSingle()

  return data ?? null
}
