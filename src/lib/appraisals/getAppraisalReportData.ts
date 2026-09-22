import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getAppraisalReferenceDate } from './getAppraisalReferenceDate'
import { getAppraisalCohort } from './getAppraisalCohort'

export type TeamCohortBreakdown = {
  team: string
  july: number
  december: number
  total: number
}

export async function getAppraisalReportData() {
  const supabase = createServerSupabaseClient()

  const { data, error } = await supabase
    .from('employees')
    .select('name, joining_date, conversion_date, employee_types(name), teams(name)')

  if (error) {
    console.error('Error fetching report data:', error.message)
    return { teamBreakdown: [], totalEligible: 0, cycleSplit: { july: 0, december: 0 } }
  }

  const teamMap = new Map<string, { july: number; december: number }>()
  let totalEligible = 0
  let julyTotal = 0
  let decemberTotal = 0

  for (const row of data || []) {
    const employeeType = (row as any).employee_types?.name
    const teamName = (row as any).teams?.name || 'Unassigned'

    if (!employeeType) continue

    const referenceDate = getAppraisalReferenceDate({
      employeeType,
      joiningDate: row.joining_date,
      conversionDate: row.conversion_date,
    })

    if (!referenceDate) continue // not eligible

    const cohort = getAppraisalCohort(referenceDate)
    totalEligible++

    if (cohort === 'july') julyTotal++
    else decemberTotal++

    if (!teamMap.has(teamName)) {
      teamMap.set(teamName, { july: 0, december: 0 })
    }
    const teamEntry = teamMap.get(teamName)!
    if (cohort === 'july') teamEntry.july++
    else teamEntry.december++
  }

  const teamBreakdown: TeamCohortBreakdown[] = Array.from(teamMap.entries()).map(
    ([team, counts]) => ({
      team,
      july: counts.july,
      december: counts.december,
      total: counts.july + counts.december,
    })
  )

  return {
    teamBreakdown,
    totalEligible,
    cycleSplit: { july: julyTotal, december: decemberTotal },
  }
}