import { createServerSupabaseClient } from '@/lib/supabase/server'

type Db = Awaited<ReturnType<typeof createServerSupabaseClient>>

// Finds the employee record that matches the signed-in Google account (by email).
// The session is the only input: nothing the browser sends can change the answer.
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

  // There used to be a `dev-employee-id` cookie fallback here. Any signed-in
  // user could set it to any employee's id and be treated as that person by
  // every caller of this function — their forms, their profile, their team.
  // Who you are comes from the session and nothing else.
  return {
    email,
    employee: null,
  }
}
