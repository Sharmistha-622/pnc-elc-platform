import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getCurrentEmployee } from '@/lib/forms/currentEmployee'

export type FormFillState =
  | { state: 'signed_out' }
  | { state: 'no_employee' }
  | { state: 'not_found' }
  | { state: 'not_yours' }
  | {
      state: 'ok'
      requestId: string
      formName: string
      subjectName: string | null
      sections: any[]
      fields: any[]
      answers: Map<string, unknown>
      employees: { id: string; name: string }[]
      employeeNames: Map<string, string>
      submitted: boolean
      submittedAt: string | null
      expired: boolean
      cancelled: boolean
      closed: boolean
    }

export async function getFormFill(requestId: string): Promise<FormFillState> {
  const supabase = await createServerSupabaseClient()
  const { email, employee } = await getCurrentEmployee(supabase)
  if (!email) return { state: 'signed_out' }
  if (!employee) return { state: 'no_employee' }

  const { data: request } = await supabase
    .from('form_requests')
    .select('*')
    .eq('id', requestId)
    .maybeSingle()
  if (!request) return { state: 'not_found' }
  if (request.respondent_employee_id !== employee.id) return { state: 'not_yours' }

  // Records the first time the form is opened (best effort, never blocks the page)
  await supabase.rpc('open_form_request', { p_request_id: requestId })

  const { data: version } = await supabase
    .from('form_versions')
    .select('id, form_id')
    .eq('id', request.form_version_id)
    .maybeSingle()
  const { data: form } = version
    ? await supabase.from('forms').select('name, archived_at').eq('id', version.form_id).maybeSingle()
    : { data: null }

  const { data: sectionRows } = await supabase
    .from('form_sections')
    .select('*')
    .eq('form_version_id', request.form_version_id)
    .order('order_index', { ascending: true })
  const { data: fieldRows } = await supabase
    .from('form_fields')
    .select('*')
    .eq('form_version_id', request.form_version_id)
    .order('order_index', { ascending: true })
  const sections = (sectionRows ?? []) as any[]
  const fields = (fieldRows ?? []) as any[]

  const { data: submission } = await supabase
    .from('form_submissions')
    .select('id, status, submitted_at')
    .eq('request_id', requestId)
    .maybeSingle()

  const answers = new Map<string, unknown>()
  if (submission) {
    const { data: answerRows } = await supabase
      .from('form_answers')
      .select('field_id, value')
      .eq('submission_id', submission.id)
    for (const a of (answerRows ?? []) as any[]) answers.set(a.field_id, a.value)
  }

  // Everyone, so the employee picker can offer every employee. Names only,
  // from the directory: a session reads full records for itself and its reports.
  const { data: employeeRows } = await supabase
    .from('directory')
    .select('id, name')
    .order('name', { ascending: true })
  const employees = ((employeeRows ?? []) as any[]).map((e) => ({
    id: e.id as string,
    name: e.name as string,
  }))
  const employeeNames = new Map<string, string>(employees.map((e) => [e.id, e.name]))

  const submitted = submission?.status === 'submitted'
  return {
    state: 'ok',
    requestId,
    formName: form?.name ?? 'Form',
    subjectName: request.subject_employee_id
      ? employeeNames.get(request.subject_employee_id) ?? null
      : null,
    sections,
    fields,
    answers,
    employees,
    employeeNames,
    submitted,
    submittedAt: submission?.submitted_at ?? null,
    expired: Boolean(request.expires_at && new Date(request.expires_at) < new Date()),
    cancelled: request.status === 'cancelled',
    closed: Boolean(form?.archived_at) && !submitted,
  }
}
