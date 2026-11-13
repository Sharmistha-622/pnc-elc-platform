import React from 'react'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { PageBanner } from '@/components/shared/page-banner'
import { UserCheck, ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { guard } from '@/lib/rbac/guard'
import { isTeamScoped, myReporteeIds } from '@/lib/confirmations/access'
import { resolveConfirmationGuidelines } from '@/lib/confirmations/guidelines'
import { loadSettings } from '@/lib/reviews/service'
import { getPeerFeedbackSettings } from '@/lib/settings/service'
import { NewConfirmationClient } from './new-confirmation-client'
import { departmentOf } from '@/lib/employees/department'

export default async function NewConfirmationPage() {
  const allowed = await guard('confirmationsInitiate')
  if (!allowed.ok) redirect('/confirmations')

  const supabase = await createServerSupabaseClient()
  const teamScoped = isTeamScoped(allowed.caller)
  let reporteeIds: string[] | null = null

  if (teamScoped) {
    reporteeIds = await myReporteeIds(supabase)
  }

  // Fetch active employees awaiting probation confirmation (confirmation_date IS NULL)
  let query = supabase
    .from('employees')
    .select('id, name, email, employee_type, joining_date, conversion_date, confirmation_date, manager_id, team, employee_types(code, name), teams(name)')
    .eq('status', 'active')
    .is('confirmation_date', null)
    .order('name', { ascending: true })

  if (teamScoped && reporteeIds) {
    query = query.in('id', reporteeIds.length > 0 ? reporteeIds : ['00000000-0000-0000-0000-000000000000'])
  }

  const { data: rows } = await query

  // Exclude employees who already have an active/pending confirmation cycle
  const { data: activeConfirmations } = await supabase
    .from('confirmations')
    .select('employee_id')
    .in('status', ['pending', 'in_progress'])

  const { data: activeReviewCycles } = await supabase
    .from('review_cycles')
    .select('employee_id')
    .eq('kind', 'confirmation')
    .not('stage', 'in', '("closed","cancelled")')

  const inFlightIds = new Set([
    ...(activeConfirmations || []).map((c) => c.employee_id),
    ...(activeReviewCycles || []).map((c) => c.employee_id),
  ])

  const eligibleEmployees = (rows || [])
    .filter((r: any) => !inFlightIds.has(r.id))
    .map((r: any) => ({
      id: r.id,
      name: r.name,
      email: r.email || null,
      employeeType: r.employee_types?.name || r.employee_type || 'Full-Time Employee (FTE)',
      employeeTypeCode: (r.employee_types?.code || r.employee_type || 'fte').toLowerCase(),
      team: departmentOf(r),
      joiningDate: r.joining_date || null,
      conversionDate: r.conversion_date || null,
    }))

  // Active colleagues for peer suggestions, from the directory: names, team
  // and type, not their records. A picked colleague's email is looked up by
  // the server when they are nominated (nominatePeers).
  const { data: allActiveRows } = await supabase
    .from('directory')
    .select('id, name, team, team_id, employee_type_id')
    .eq('status', 'active')
    .order('name', { ascending: true })
  const [{ data: teamRows }, { data: typeRows }, reviewSettings, peerSettings] = await Promise.all([
    supabase.from('teams').select('id, name'),
    supabase.from('employee_types').select('id, name'),
    loadSettings(supabase),
    getPeerFeedbackSettings(),
  ])
  const guidelines = resolveConfirmationGuidelines({ reviewSettings, peerSettings })
  const teamName = new Map(((teamRows ?? []) as { id: string; name: string }[]).map((t) => [t.id, t.name]))
  const typeName = new Map(((typeRows ?? []) as { id: string; name: string }[]).map((t) => [t.id, t.name]))

  const directoryEmployees = (allActiveRows || []).map((r: any) => ({
    id: r.id,
    name: r.name,
    email: null,
    employeeType: (r.employee_type_id && typeName.get(r.employee_type_id)) || 'Employee',
    team: departmentOf({ team: r.team, teams: r.team_id ? { name: teamName.get(r.team_id) ?? null } : null } as Parameters<typeof departmentOf>[0]),
  }))

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 md:p-6 lg:p-8 max-w-7xl mx-auto w-full pb-20 animate-in fade-in duration-300">
      <PageBanner
        title="Start Confirmation Process"
        description="Initiate probation evaluation for eligible team members awaiting confirmation."
        icon={<UserCheck className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />}
        actions={
          <Link href="/confirmations">
            <Button variant="outline" size="sm" className="h-8 rounded-lg text-xs gap-1.5 font-semibold">
              <ArrowLeft className="h-3.5 w-3.5" />
              Back to Confirmations
            </Button>
          </Link>
        }
      />

      <NewConfirmationClient
        employees={eligibleEmployees}
        directoryEmployees={directoryEmployees}
        guidelines={guidelines}
      />
    </div>
  )
}
