import { createServerSupabaseClient } from '@/lib/supabase/server'

type Db = Awaited<ReturnType<typeof createServerSupabaseClient>>

// Finds the employee record that matches the signed-in Google account (by email)
export async function getCurrentEmployee(supabase: Db) {
  const { data } = await supabase.auth.getUser()
  const email = data.user?.email ?? null
  if (!email) return { email: null, employee: null as { id: string; name: string } | null }

  const escaped = email.replace(/[\\%_]/g, '\\$&')
  const { data: rows } = await supabase
    .from('employees')
    .select('id, name')
    .ilike('email', escaped)
    .limit(1)

  const found = ((rows ?? []) as any[])[0]
  if (found) {
    return {
      email,
      employee: { id: found.id as string, name: found.name as string },
    }
  }

  // Check if a dev-employee-id cookie was set
  try {
    const { cookies } = await import('next/headers')
    const cookieStore = await cookies()
    const devEmpId = cookieStore.get('dev-employee-id')?.value
    if (devEmpId) {
      const { data: devRows } = await supabase
        .from('employees')
        .select('id, name')
        .eq('id', devEmpId)
        .limit(1)
      const devFound = ((devRows ?? []) as any[])[0]
      if (devFound) {
        return {
          email,
          employee: { id: devFound.id as string, name: devFound.name as string },
        }
      }
    }
  } catch {
    // Ignore cookie read error
  }

  return {
    email,
    employee: null,
  }
}
