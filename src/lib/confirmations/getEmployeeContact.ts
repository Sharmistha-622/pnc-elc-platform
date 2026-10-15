'use server'

import { createServerSupabaseClient } from '@/lib/supabase/server'

// Looks up an employee's name and email by UUID, for auto-filling the confirmation form
export async function getEmployeeContact(employeeId: string) {
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
