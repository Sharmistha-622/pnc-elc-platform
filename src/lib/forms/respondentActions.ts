'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getCurrentEmployee } from '@/lib/forms/currentEmployee'
import { validateSubmission } from '@/lib/forms/validateSubmission'
import { defaultCtx, onFormSubmitted, selfSubmitBlocker } from '@/lib/reviews/service'

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
    // A self-reflection goes in with the employee's peer nominations: the
    // peers are emailed the moment it is submitted.
    const blocker = await selfSubmitBlocker(supabase, requestId)
    if (blocker) fail(path, blocker)

    const { data: updated, error: submitError } = await supabase
      .from('form_submissions')
      .update({ status: 'submitted' })
      .eq('id', sid)
      .select('id')
    if (submitError) fail(path, submitError.message)
    if (!updated || updated.length === 0) fail(path, 'Could not submit the form. Please try again.')

    // If this form belongs to a review cycle, move the cycle on: record it,
    // send peers their forms after a self-reflection, and check whether the
    // meeting can be set up. The respondent has just been verified as the
    // owner of this request above; the cycle work runs as the service.
    const ctx = defaultCtx(employee.name)
    if (ctx) await onFormSubmitted(ctx, requestId)
    revalidatePath('/my-reviews')

    revalidatePath('/my-forms')
    revalidatePath(path)
    redirect(`${path}?submitted=1`)
  }

  revalidatePath(path)
  redirect(`${path}?saved=1`)
}

/**
 * Saves a draft in the background, for auto-save. Runs the same draft path as
 * the form's own save (same ownership and status checks), but returns a result
 * instead of redirecting, so the page does not reload while someone is typing.
 */
export async function autoSaveDraft(formData: FormData): Promise<{ ok: boolean; error?: string }> {
  formData.set('intent', 'draft')
  try {
    await saveSubmission(formData)
    return { ok: true }
  } catch (err) {
    // saveSubmission always ends in a redirect: `?saved=1` on success,
    // otherwise back to the form or the list with a message.
    const digest = (err as { digest?: unknown } | null)?.digest
    if (typeof digest === 'string' && digest.startsWith('NEXT_REDIRECT')) {
      const target = digest.split(';')[2] ?? ''
      if (target.includes('saved=1')) return { ok: true }
      const match = target.match(/[?&](?:error|message)=([^&]*)/)
      return { ok: false, error: match ? decodeURIComponent(match[1].replace(/\+/g, ' ')) : 'Could not save your answers' }
    }
    return { ok: false, error: 'Could not save your answers' }
  }
}
