import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createAdminSupabaseClient } from '@/lib/supabase/admin'
import { guard } from '@/lib/rbac/guard'
import { getAppraisalReportData, TeamCohortBreakdown } from '@/lib/appraisals/getAppraisalReportData'

export interface ConfirmationReportItem {
  id: string
  status: string
  manager_decision: string | null
  recommendation: string | null
  created_at: string
  employee_name: string
  designation?: string
  team_name?: string
  employee_type?: string
}

export interface OnboardingReportItem {
  id: string
  candidate_name: string
  designation: string
  email: string
  status: string
  department: string | null
  created_at: string
}

export interface EmployeeHeadcountItem {
  id: string
  name: string
  email: string
  designation: string | null
  joining_date: string | null
  employee_type: string
  team_name: string
  location_name: string
}

export interface EmailDeliveryReportItem {
  id: string
  recipient_email: string
  recipient_name: string | null
  template_key: string
  status: string
  delivery_vendor: string | null
  created_at: string
  error_message?: string | null
}

export interface UnifiedReportsData {
  appraisals: {
    totalEligible: number
    cycleSplit: { july: number; december: number }
    teamBreakdown: TeamCohortBreakdown[]
  }
  confirmations: {
    total: number
    completed: number
    pending: number
    items: ConfirmationReportItem[]
  }
  onboarding: {
    total: number
    preJoining: number
    postJoining: number
    statusCounts: Record<string, number>
    items: OnboardingReportItem[]
  }
  headcount: {
    total: number
    byType: Record<string, number>
    byTeam: Record<string, number>
    byLocation: Record<string, number>
    employees: EmployeeHeadcountItem[]
  }
  emails: {
    total: number
    delivered: number
    failed: number
    pending: number
    items: EmailDeliveryReportItem[]
  }
}

export async function getUnifiedReportsData(): Promise<UnifiedReportsData> {
  const supabase = await createServerSupabaseClient()
  // Candidate records are closed to user sessions at the database (see
  // 202610241000_lockdown_rls.sql): the onboarding API redacts CTC per role,
  // and a direct table grant would let a session read around that. The
  // funnel below reads them with the service-role client, so it checks the
  // role itself first rather than trusting the page it was called from.
  const access = await guard('reports')
  const onboardingDb = access.ok ? createAdminSupabaseClient() : null

  // 1. Appraisals data
  let appraisalsData = {
    totalEligible: 0,
    cycleSplit: { july: 0, december: 0 },
    teamBreakdown: [] as TeamCohortBreakdown[],
  }
  try {
    appraisalsData = await getAppraisalReportData()
  } catch (err) {
    console.error('Error fetching appraisal report data:', err)
  }

  // 2. Confirmations data
  const confirmationItems: ConfirmationReportItem[] = []
  let confCompleted = 0
  let confPending = 0
  try {
    const { data: confRows, error } = await supabase
      .from('confirmations')
      .select('id, status, manager_decision, recommendation, created_at, employees(name, designation, teams(name), employee_types(name))')
      .order('created_at', { ascending: false })
      .limit(100)

    if (!error && confRows) {
      for (const row of confRows as any[]) {
        const emp = row.employees || {}
        const isComplete = row.status === 'confirmed' || row.manager_decision === 'confirm'
        if (isComplete) confCompleted++
        else confPending++

        confirmationItems.push({
          id: row.id,
          status: row.status || 'pending',
          manager_decision: row.manager_decision,
          recommendation: row.recommendation,
          created_at: row.created_at,
          employee_name: emp.name || 'Unknown Employee',
          designation: emp.designation,
          team_name: emp.teams?.name || 'Unassigned',
          employee_type: emp.employee_types?.name || 'Standard',
        })
      }
    }
  } catch (err) {
    console.error('Error fetching confirmations report data:', err)
  }

  // 3. Onboarding data
  const onboardingItems: OnboardingReportItem[] = []
  const onboardingStatusCounts: Record<string, number> = {}
  let onbPreJoining = 0
  let onbPostJoining = 0
  try {
    if (!onboardingDb) throw new Error('Onboarding funnel unavailable for this role')
    // `personal_email`, not `email`: there is no `email` column, so this query
    // failed and the funnel has always rendered empty. It also selected the
    // invitation token — the candidate portal's only credential — and sent it
    // to every role on this screen.
    const { data: onbRows, error } = await onboardingDb
      .from('onboarding_records')
      .select('id, candidate_name, designation, personal_email, status, department, created_at')
      .order('created_at', { ascending: false })
      .limit(100)

    if (!error && onbRows) {
      for (const row of onbRows) {
        const status = row.status || 'draft'
        onboardingStatusCounts[status] = (onboardingStatusCounts[status] || 0) + 1

        if (['draft', 'invited', 'in_progress', 'submitted', 'under_review'].includes(status)) {
          onbPreJoining++
        } else {
          onbPostJoining++
        }

        onboardingItems.push({
          id: row.id,
          candidate_name: row.candidate_name,
          designation: row.designation,
          email: row.personal_email,
          status,
          department: row.department,
          created_at: row.created_at,
        })
      }
    }
  } catch (err) {
    console.error('Error fetching onboarding report data:', err)
  }

  // 4. Headcount & Demographics data
  const headcountEmployees: EmployeeHeadcountItem[] = []
  const byType: Record<string, number> = {}
  const byTeam: Record<string, number> = {}
  const byLocation: Record<string, number> = {}
  try {
    const { data: empRows, error } = await supabase
      .from('employees')
      .select('id, name, email, designation, joining_date, employee_types(name), teams(name), locations(name)')
      .order('name', { ascending: true })

    if (!error && empRows) {
      for (const row of empRows as any[]) {
        const typeName = row.employee_types?.name || 'Unclassified'
        const teamName = row.teams?.name || 'Unassigned'
        const locationName = row.locations?.name || 'Remote / Unassigned'

        byType[typeName] = (byType[typeName] || 0) + 1
        byTeam[teamName] = (byTeam[teamName] || 0) + 1
        byLocation[locationName] = (byLocation[locationName] || 0) + 1

        headcountEmployees.push({
          id: row.id,
          name: row.name,
          email: row.email,
          designation: row.designation,
          joining_date: row.joining_date,
          employee_type: typeName,
          team_name: teamName,
          location_name: locationName,
        })
      }
    }
  } catch (err) {
    console.error('Error fetching employee headcount data:', err)
  }

  // 5. Email Logs data
  const emailItems: EmailDeliveryReportItem[] = []
  let emailsDelivered = 0
  let emailsFailed = 0
  let emailsPending = 0
  try {
    const { data: emailRows, error } = await supabase
      .from('email_delivery_logs')
      .select('id, recipient_email, recipient_name, template_key, status, delivery_vendor, created_at, error_message')
      .order('created_at', { ascending: false })
      .limit(100)

    if (!error && emailRows) {
      for (const row of emailRows) {
        const status = (row.status || '').toLowerCase()
        if (status === 'delivered' || status === 'sent') emailsDelivered++
        else if (status === 'failed' || status === 'bounced') emailsFailed++
        else emailsPending++

        emailItems.push({
          id: row.id,
          recipient_email: row.recipient_email,
          recipient_name: row.recipient_name,
          template_key: row.template_key,
          status: row.status,
          delivery_vendor: row.delivery_vendor,
          created_at: row.created_at,
          error_message: row.error_message,
        })
      }
    }
  } catch (err) {
    console.error('Error fetching email report data:', err)
  }

  return {
    appraisals: appraisalsData,
    confirmations: {
      total: confirmationItems.length,
      completed: confCompleted,
      pending: confPending,
      items: confirmationItems,
    },
    onboarding: {
      total: onboardingItems.length,
      preJoining: onbPreJoining,
      postJoining: onbPostJoining,
      statusCounts: onboardingStatusCounts,
      items: onboardingItems,
    },
    headcount: {
      total: headcountEmployees.length,
      byType,
      byTeam,
      byLocation,
      employees: headcountEmployees,
    },
    emails: {
      total: emailItems.length,
      delivered: emailsDelivered,
      failed: emailsFailed,
      pending: emailsPending,
      items: emailItems,
    },
  }
}
