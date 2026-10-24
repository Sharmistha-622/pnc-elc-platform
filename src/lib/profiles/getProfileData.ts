import { createServerSupabaseClient } from '@/lib/supabase/server'
import { profileAccess } from './access'

export type EmployeeDetail = {
  id: string
  name: string
  email: string | null
  joining_date: string
  exit_date?: string | null
  status: string
  employee_type: string
  team: string | null
}

export async function getProfileData(employeeId: string) {
  // `employee_profiles` is identity data and loads only for the person or the
  // roles that handle ID documents. A directory role without identity access
  // still gets the general row, and is told why the rest is missing.
  const access = await profileAccess(employeeId)
  if (!access.general && !access.identity) {
    return {
      profile: null,
      relationshipTypes: [],
      idProofTypes: [],
      employee: null,
      employeeName: 'Employee',
      canViewIdentity: false,
    }
  }

  const supabase = await createServerSupabaseClient()

  // Query employee with safe fallback if exit_date doesn't exist
  const getEmployee = async () => {
    const withExit = await supabase
      .from('employees')
      .select(`
        id,
        name,
        email,
        joining_date,
        exit_date,
        status,
        employee_types ( name ),
        teams ( name )
      `)
      .eq('id', employeeId)
      .maybeSingle()

    if (withExit.error) {
      const fallback = await supabase
        .from('employees')
        .select(`
          id,
          name,
          email,
          joining_date,
          status,
          employee_types ( name ),
          teams ( name )
        `)
        .eq('id', employeeId)
        .maybeSingle()

      return fallback.data
    }
    return withExit.data
  }

  const [profileResult, relationTypesResult, idProofTypesResult, employeeData] = await Promise.all([
    access.identity
      ? supabase.from('employee_profiles').select('*').eq('employee_id', employeeId).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase.from('relationship_types').select('*').order('name'),
    supabase.from('id_proof_types').select('*').order('name'),
    getEmployee(),
  ])

  const employee: EmployeeDetail | null = employeeData
    ? {
        id: employeeData.id,
        name: employeeData.name,
        email: employeeData.email || null,
        joining_date: employeeData.joining_date,
        exit_date: (employeeData as any).exit_date || null,
        status: employeeData.status || 'active',
        employee_type: (employeeData.employee_types as any)?.name || 'Full-Time',
        team: (employeeData.teams as any)?.name || null,
      }
    : null

  return {
    profile: profileResult.data,
    relationshipTypes: relationTypesResult.data || [],
    idProofTypes: idProofTypesResult.data || [],
    employee,
    employeeName: employee?.name || 'Employee',
    canViewIdentity: access.identity,
  }
}