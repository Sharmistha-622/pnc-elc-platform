import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getAppraisalReferenceDate } from './getAppraisalReferenceDate'
import { getAppraisalCohort } from './getAppraisalCohort'

export type AppraisalCohortEntry = {
  employeeId: string
  name: string
  employeeType: string
  referenceDate: string
  cohort: 'july' | 'december'
}

export async function getAppraisalCohortView(): Promise<AppraisalCohortEntry[]> {
  const supabase = await createServerSupabaseClient()

  const { data, error } = await supabase
    .from('employees')
    .select('id, name, joining_date, conversion_date, employee_types(name)')
    .in('employee_types.name', ['intern', 'fte', 'ftc'])

  if (error) {
    console.error('Error fetching employees for appraisal cohort:', error.message)
    return []
  }

  const results: AppraisalCohortEntry[] = []

  for (const row of data || []) {
    const employeeType = (row as any).employee_types?.name
    if (!employeeType) continue

    const referenceDate = getAppraisalReferenceDate({
      employeeType,
      joiningDate: row.joining_date,
      conversionDate: row.conversion_date,
    })

    if (!referenceDate) continue // not eligible, or missing conversion_date for an intern

    results.push({
      employeeId: row.id,
      name: row.name,
      employeeType,
      referenceDate: referenceDate.toISOString().split('T')[0],
      cohort: getAppraisalCohort(referenceDate),
    })
  }

  return results
}