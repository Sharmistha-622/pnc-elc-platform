'use server'

import { revalidatePath } from 'next/cache'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getCurrentUserRole } from '@/lib/rbac/getCurrentUserRole'
import { getCurrentEmployee } from '@/lib/forms/currentEmployee'
import { guardResource } from '@/lib/rbac/guard'
import { accessFor } from '@/lib/rbac/roles'

export interface EmployeeProfileData {
  id: string
  name: string
  email: string | null
  team: string | null
  employeeType: string | null
  status: string
  joiningDate: string | null
  confirmationDate: string | null
  role: string
  manager: {
    id: string
    name: string
    email: string | null
    team: string | null
  } | null
  reportees: {
    id: string
    name: string
    email: string | null
    team: string | null
    employeeType: string | null
    status: string
    joiningDate: string | null
  }[]
}

export async function getMyProfileData(): Promise<{
  signedIn: boolean
  userEmail: string | null
  profile: EmployeeProfileData | null
  allEmployees: { id: string; name: string; email: string | null; team: string | null }[]
}> {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  const userRole = await getCurrentUserRole()

  if (!user || !user.email) {
    return { signedIn: false, userEmail: null, profile: null, allEmployees: [] }
  }

  // Get matching employee
  const { employee: matchedEmployee } = await getCurrentEmployee(supabase)

  // Fetch all employees for dropdowns
  const { data: allEmpRows } = await supabase
    .from('employees')
    .select('id, name, email, team, teams(name)')
    .order('name', { ascending: true })

  const allEmployees = (allEmpRows || []).map((e: any) => ({
    id: e.id,
    name: e.name,
    email: e.email ?? null,
    team: (e as any).teams?.name || (e as any).team || null,
  }))

  if (!matchedEmployee) {
    return {
      signedIn: true,
      userEmail: user.email,
      profile: null,
      allEmployees,
    }
  }

  // Fetch full employee record with manager & reportees
  const { data: empRecord } = await supabase
    .from('employees')
    .select(`
      id,
      name,
      email,
      team,
      status,
      joining_date,
      confirmation_date,
      employee_type,
      manager_id,
      teams(name),
      employee_types(name)
    `)
    .eq('id', matchedEmployee.id)
    .single()

  if (!empRecord) {
    return {
      signedIn: true,
      userEmail: user.email,
      profile: null,
      allEmployees,
    }
  }

  // Fetch Manager info if assigned
  let managerInfo: EmployeeProfileData['manager'] = null
  if (empRecord.manager_id) {
    const { data: mgr } = await supabase
      .from('employees')
      .select('id, name, email, team, teams(name)')
      .eq('id', empRecord.manager_id)
      .maybeSingle()

    if (mgr) {
      managerInfo = {
        id: mgr.id,
        name: mgr.name,
        email: mgr.email ?? null,
        team: (mgr as any).teams?.name || (mgr as any).team || null,
      }
    }
  }

  // Fetch Direct Reportees
  const { data: reporteeRows } = await supabase
    .from('employees')
    .select(`
      id,
      name,
      email,
      team,
      status,
      joining_date,
      employee_type,
      teams(name),
      employee_types(name)
    `)
    .eq('manager_id', empRecord.id)
    .order('name', { ascending: true })

  const reportees = (reporteeRows || []).map((r: any) => ({
    id: r.id,
    name: r.name,
    email: r.email ?? null,
    team: (r as any).teams?.name || (r as any).team || null,
    employeeType: (r as any).employee_types?.name || (r as any).employee_type || 'FTE',
    status: r.status || 'active',
    joiningDate: r.joining_date ?? null,
  }))

  const profile: EmployeeProfileData = {
    id: empRecord.id,
    name: empRecord.name,
    email: empRecord.email ?? user.email,
    team: (empRecord as any).teams?.name || (empRecord as any).team || 'None',
    employeeType: (empRecord as any).employee_types?.name || (empRecord as any).employee_type || 'FTE',
    status: empRecord.status || 'active',
    joiningDate: empRecord.joining_date ?? null,
    confirmationDate: empRecord.confirmation_date ?? null,
    role: userRole.role || 'Member',
    manager: managerInfo,
    reportees,
  }

  return {
    signedIn: true,
    userEmail: user.email,
    profile,
    allEmployees: allEmployees.filter((e) => e.id !== empRecord.id),
  }
}

export async function updateReportingManager(employeeId: string, managerId: string | null) {
  // The reporting line decides who holds `manager` over whom, and with it who
  // reads that person's feedback and records their confirmation. So it is set
  // by those who edit general data org-wide. `employee` also has general
  // `edit`, scoped to their own record, which `guardResource` alone would
  // pass; without the scope check anyone could make themselves anyone's
  // manager.
  const allowed = await guardResource('general', 'edit')
  if (
    !allowed.ok ||
    accessFor(allowed.caller.role, 'general').scope !== 'all' ||
    accessFor(allowed.caller.originalRole, 'general').scope !== 'all'
  ) {
    return { success: false, error: 'Only People & Culture can change a reporting line.' }
  }

  const supabase = await createServerSupabaseClient()

  if (employeeId === managerId) {
    return { success: false, error: 'An employee cannot be their own manager' }
  }

  const { error } = await supabase
    .from('employees')
    .update({ manager_id: managerId })
    .eq('id', employeeId)

  if (error) {
    console.error('Error updating manager:', error)
    return { success: false, error: error.message }
  }

  revalidatePath('/profile')
  revalidatePath('/my-team')
  revalidatePath('/employees')
  return { success: true }
}
