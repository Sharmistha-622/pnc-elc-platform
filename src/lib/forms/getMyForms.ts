import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getCurrentEmployee } from '@/lib/forms/currentEmployee'

export type MyFormItem = {
  requestId: string
  formName: string
  aboutName: string | null
  status: 'Not started' | 'In progress' | 'Submitted' | 'Expired' | 'Cancelled' | 'Closed'
  assignedAt: string
  submittedAt: string | null
  canOpen: boolean
}

export type MyFormsResult = {
  signedIn: boolean
  employee: { id: string; name: string } | null
  items: MyFormItem[]
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)))
}

export async function getMyForms(): Promise<MyFormsResult> {
  const supabase = await createServerSupabaseClient()
  const { email, employee } = await getCurrentEmployee(supabase)
  if (!email) return { signedIn: false, employee: null, items: [] }
  if (!employee) return { signedIn: true, employee: null, items: [] }

  const { data: requestRows } = await supabase
    .from('form_requests')
    .select('id, status, expires_at, created_at, subject_employee_id, form_version_id')
    .eq('respondent_employee_id', employee.id)
    .order('created_at', { ascending: false })
  const requests = (requestRows ?? []) as any[]
  if (requests.length === 0) return { signedIn: true, employee, items: [] }

  const { data: versionRows } = await supabase
    .from('form_versions')
    .select('id, form_id')
    .in('id', unique(requests.map((r) => r.form_version_id)))
  const versions = (versionRows ?? []) as any[]

  const { data: formRows } = await supabase
    .from('forms')
    .select('id, name, archived_at')
    .in('id', unique(versions.map((v) => v.form_id)))
  const forms = (formRows ?? []) as any[]

  const { data: subjectRows } = await supabase
    .from('directory')
    .select('id, name')
    .in('id', unique(requests.map((r) => r.subject_employee_id ?? '')))
  const subjects = (subjectRows ?? []) as any[]

  const { data: submissionRows } = await supabase
    .from('form_submissions')
    .select('request_id, status, submitted_at')
    .in('request_id', requests.map((r) => r.id as string))
  const submissions = (submissionRows ?? []) as any[]

  const items: MyFormItem[] = requests.map((r) => {
    const version = versions.find((v) => v.id === r.form_version_id)
    const form = forms.find((f) => f.id === version?.form_id)
    const subject = subjects.find((s) => s.id === r.subject_employee_id)
    const submission = submissions.find((s) => s.request_id === r.id)

    let status: MyFormItem['status']
    if (submission?.status === 'submitted') status = 'Submitted'
    else if (r.status === 'cancelled') status = 'Cancelled'
    else if (r.expires_at && new Date(r.expires_at) < new Date()) status = 'Expired'
    else if (form?.archived_at) status = 'Closed'
    else if (submission) status = 'In progress'
    else status = 'Not started'

    return {
      requestId: r.id,
      formName: form?.name ?? 'Form',
      aboutName: subject?.name ?? null,
      status,
      assignedAt: r.created_at,
      submittedAt: submission?.submitted_at ?? null,
      canOpen: status === 'Not started' || status === 'In progress' || status === 'Submitted',
    }
  })

  return { signedIn: true, employee, items }
}
