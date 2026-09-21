import { createServerSupabaseClient } from '@/lib/supabase/server'

export async function getProfileData(employeeId: string) {
  const supabase = createServerSupabaseClient()

  const [profileResult, relationTypesResult, idProofTypesResult, employeeResult] = await Promise.all([
    supabase.from('employee_profiles').select('*').eq('employee_id', employeeId).maybeSingle(),
    supabase.from('relationship_types').select('*').order('name'),
    supabase.from('id_proof_types').select('*').order('name'),
    supabase.from('employees').select('name').eq('id', employeeId).single(),
  ])

  return {
    profile: profileResult.data,
    relationshipTypes: relationTypesResult.data || [],
    idProofTypes: idProofTypesResult.data || [],
    employeeName: employeeResult.data?.name || 'Unknown',
  }
}