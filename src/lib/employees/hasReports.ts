import { cache } from 'react'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getCurrentEmployee } from '@/lib/forms/currentEmployee'

/**
 * Whether the signed-in person has anyone reporting to them.
 *
 * Undefined when it could not be told — no employee record, or the lookup
 * failed — so callers fall back to the role rather than hiding a manager's
 * team on an error. Cached per request: the shell's layout and the dashboard
 * page both ask, and it is one count.
 */
export const getHasReports = cache(async (): Promise<boolean | undefined> => {
  const supabase = await createServerSupabaseClient()
  const { employee } = await getCurrentEmployee(supabase)
  if (!employee) return undefined
  const { count, error } = await supabase
    .from('employees')
    .select('id', { count: 'exact', head: true })
    .eq('manager_id', employee.id)
  return error ? undefined : (count ?? 0) > 0
})
