'use server'

import { revalidatePath } from 'next/cache'
import { cookies } from 'next/headers'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export async function createOrLinkSelfEmployee(fullName?: string) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user || !user.email) {
    return { success: false, error: 'Not authenticated' }
  }

  const email = user.email.trim().toLowerCase()
  const name =
    fullName?.trim() ||
    (user.user_metadata?.full_name as string) ||
    (user.user_metadata?.name as string) ||
    email.split('@')[0] ||
    'Team Member'

  // First check if an employee with this email already exists
  const { data: existing } = await supabase
    .from('employees')
    .select('id, name')
    .ilike('email', email)
    .maybeSingle()

  if (existing) {
    revalidatePath('/my-forms')
    return { success: true, employee: existing }
  }

  // Create an employee record
  const { data: newEmp, error } = await supabase
    .from('employees')
    .insert({
      name,
      email,
      status: 'active',
      employee_type: 'fte',
      joining_date: new Date().toISOString().split('T')[0],
      team: 'Engineering',
    })
    .select('id, name')
    .single()

  if (error) {
    console.error('Error creating employee profile:', error)
    return { success: false, error: error.message }
  }

  revalidatePath('/my-forms')
  return { success: true, employee: newEmp }
}

export async function linkEmailToExistingEmployee(employeeId: string) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user || !user.email) {
    return { success: false, error: 'Not authenticated' }
  }

  const email = user.email.trim().toLowerCase()

  const { error } = await supabase
    .from('employees')
    .update({ email })
    .eq('id', employeeId)

  if (error) {
    console.error('Error linking employee email:', error)
    return { success: false, error: error.message }
  }

  revalidatePath('/my-forms')
  return { success: true }
}

export async function setDevEmployeeCookie(employeeId: string | null) {
  const cookieStore = await cookies()
  if (employeeId) {
    cookieStore.set('dev-employee-id', employeeId, { path: '/', maxAge: 86400 })
  } else {
    cookieStore.delete('dev-employee-id')
  }
  revalidatePath('/my-forms')
  return { success: true }
}
