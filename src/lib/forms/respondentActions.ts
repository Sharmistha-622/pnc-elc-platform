'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getCurrentEmployee } from '@/lib/forms/currentEmployee'
import { validateSubmission } from '@/lib/forms/validateSubmission'

function fail(path: string, message: string): never {
  redirect(`${path}?error=${encodeURIComponent(message)}`)
}

export async function saveSubmission(formData: FormData): Promise<void> {
  const requestId = String(formData.get('requestId') ?? '').trim()
  const intent = String(formData.get('intent') ?? 'draft')
  const path = `/my-forms/${requestId}`

  const supabase = await createServerSupabaseClient()
  const { employee } = await getCurrentEmployee(supabase)
  if (!employee) fail('/my-forms', 'Your login is not linked to an employee record')

  const { data: request } = await supabase
    .from('form_requests')
    .select('*')
    .eq('id', requestId)
    .maybeSingle()
  if (!request || request.respondent_employee_id !== employee.id) {
    fail('/my-forms', 'This form is not assigned to you')
  }
  if (request.status === 'cancelled') fail(path, 'This request was cancelled')
  if (request.expires_at && new Date(request.expires_at) < new Date()) {
    fail(path, 'This request has expired')
  }

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
  if (fields.length === 0) fail(path, 'This form has no fields')

  const check = validateSubmission(sections, fields, formData, intent)
  if (!check.ok) fail(path, check.error)

  if (check.pickerIds.length > 0) {
    const { data: found } = await supabase.from('employees').select('id').in('id', check.pickerIds)
    if ((found ?? []).length !== new Set(check.pickerIds).size) {
      fail(path, 'Choose a person from the list')
    }
  }

  const { data: existing } = await supabase
    .from('form_submissions')
    .select('id, status')
    .eq('request_id', requestId)
    .maybeSingle()
  if (existing?.status === 'submitted') fail(path, 'You have already submitted this form')

  let submissionId = existing?.id as string | undefined
  if (!submissionId) {
    const { data: created, error } = await supabase
      .from('form_submissions')
      .insert({
        form_version_id: request.form_version_id,
        request_id: requestId,
        subject_employee_id: request.subject_employee_id,
        respondent_employee_id: employee.id,
      })
      .select('id')
      .single()
    if (error || !created) fail(path, error?.message ?? 'Could not start the form')
    submissionId = created.id as string
  }
  const sid = submissionId as string

  const rows = check.rows.map((r) => ({ submission_id: sid, field_id: r.field_id, value: r.value }))
  const { error: answerError } = await supabase
    .from('form_answers')
    .upsert(rows, { onConflict: 'submission_id,field_id' })
  if (answerError) fail(path, answerError.message)

  if (intent === 'submit') {
    const { data: updated, error: submitError } = await supabase
      .from('form_submissions')
      .update({ status: 'submitted' })
      .eq('id', sid)
      .select('id')
    if (submitError) fail(path, submitError.message)
    if (!updated || updated.length === 0) fail(path, 'Could not submit the form. Please try again.')

    revalidatePath('/my-forms')
    revalidatePath(path)
    redirect(`${path}?submitted=1`)
  }

  revalidatePath(path)
  redirect(`${path}?saved=1`)
}
