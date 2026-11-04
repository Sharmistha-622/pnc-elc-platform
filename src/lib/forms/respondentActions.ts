'use server'

import { guard } from '@/lib/rbac/guard'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getCurrentEmployee } from '@/lib/forms/currentEmployee'
import { validateSubmission } from '@/lib/forms/validateSubmission'
import { defaultCtx, onFormSubmitted, selfSubmitBlocker } from '@/lib/reviews/service'

type Persisted =
  | { ok: true; path: string; submitted: boolean }
  | { ok: false; path: string; error: string }

/**
 * Checks the caller owns the request and writes their answers, as a draft or
 * as a submission. Returns rather than redirecting, so the manual save and the
 * background auto-save share one path with the same ownership and status
 * checks. Not exported: callable only through the actions below.
 */
async function persistSubmission(formData: FormData, intent: 'draft' | 'submit'): Promise<Persisted> {
  const requestId = String(formData.get('requestId') ?? '').trim()
  const path = `/my-forms/${requestId}`
  const refuse = (where: string, error: string): Persisted => ({ ok: false, path: where, error })

  const supabase = await createServerSupabaseClient()
  // Independent reads: who is signed in, and the request. Ownership is
  // compared once both are back.
  const [{ employee }, { data: request }] = await Promise.all([
    getCurrentEmployee(supabase),
    supabase.from('form_requests').select('*').eq('id', requestId).maybeSingle(),
  ])
  if (!employee) return refuse('/my-forms', 'Your login is not linked to an employee record')
  if (!request || request.respondent_employee_id !== employee.id) {
    return refuse('/my-forms', 'This form is not assigned to you')
  }
  if (request.status === 'cancelled') return refuse(path, 'This request was cancelled')
  if (request.expires_at && new Date(request.expires_at) < new Date()) {
    return refuse(path, 'This request has expired')
  }

  const [{ data: sectionRows }, { data: fieldRows }, { data: existing }] = await Promise.all([
    supabase
      .from('form_sections')
      .select('*')
      .eq('form_version_id', request.form_version_id)
      .order('order_index', { ascending: true }),
    supabase
      .from('form_fields')
      .select('*')
      .eq('form_version_id', request.form_version_id)
      .order('order_index', { ascending: true }),
    supabase.from('form_submissions').select('id, status').eq('request_id', requestId).maybeSingle(),
  ])
  const sections = (sectionRows ?? []) as any[]
  const fields = (fieldRows ?? []) as any[]
  if (fields.length === 0) return refuse(path, 'This form has no fields')
  if (existing?.status === 'submitted') return refuse(path, 'You have already submitted this form')

  const check = validateSubmission(sections, fields, formData, intent)
  if (!check.ok) return refuse(path, check.error)

  if (check.pickerIds.length > 0) {
    const { data: found } = await supabase.from('employees').select('id').in('id', check.pickerIds)
    if ((found ?? []).length !== new Set(check.pickerIds).size) {
      return refuse(path, 'Choose a person from the list')
    }
  }

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
    if (created) {
      submissionId = created.id as string
    } else if (error?.code === '23505') {
      // A save that started at the same moment created it first (one
      // submission per request). Use that one.
      const { data: again } = await supabase
        .from('form_submissions')
        .select('id, status')
        .eq('request_id', requestId)
        .maybeSingle()
      if (again?.status === 'submitted') return refuse(path, 'You have already submitted this form')
      submissionId = again?.id as string | undefined
    }
    if (!submissionId) return refuse(path, 'Could not start the form. Please try again.')
  }
  const sid = submissionId as string

  if (check.rows.length > 0) {
    const rows = check.rows.map((r) => ({ submission_id: sid, field_id: r.field_id, value: r.value }))
    const { error: answerError } = await supabase
      .from('form_answers')
      .upsert(rows, { onConflict: 'submission_id,field_id' })
    if (answerError) return refuse(path, 'Could not save your answers. Please try again.')
  }

  if (intent === 'submit') {
    // A self-reflection goes in with the employee's peer nominations: the
    // peers are emailed the moment it is submitted.
    const blocker = await selfSubmitBlocker(supabase, requestId)
    if (blocker) return refuse(path, blocker)

    const { data: updated, error: submitError } = await supabase
      .from('form_submissions')
      .update({ status: 'submitted' })
      .eq('id', sid)
      .select('id')
    if (submitError || !updated || updated.length === 0) {
      return refuse(path, 'Could not submit the form. Please try again.')
    }

    // If this form belongs to a review cycle, move the cycle on: record it,
    // send peers their forms after a self-reflection, and check whether the
    // meeting can be set up. The respondent has just been verified as the
    // owner of this request above; the cycle work runs as the service.
    const ctx = defaultCtx(employee.name)
    if (ctx) await onFormSubmitted(ctx, requestId)
    return { ok: true, path, submitted: true }
  }

  return { ok: true, path, submitted: false }
}

export async function saveSubmission(formData: FormData): Promise<void> {
  const intent = String(formData.get('intent') ?? 'draft') === 'submit' ? 'submit' : 'draft'
  const result = await persistSubmission(formData, intent)
  if (!result.ok) redirect(`${result.path}?error=${encodeURIComponent(result.error)}`)

  if (result.submitted) {
    revalidatePath('/my-reviews')
    revalidatePath('/my-forms')
    revalidatePath(result.path)
    redirect(`${result.path}?submitted=1`)
  }
  revalidatePath(result.path)
  redirect(`${result.path}?saved=1`)
}

/**
 * Saves a draft in the background, for auto-save. Same checks as the form's
 * own save, but it returns a result and revalidates nothing: the page the
 * respondent is typing into already shows what was saved, so re-rendering it
 * every few seconds would only cost a full server render per keystroke pause.
 */
export async function autoSaveDraft(formData: FormData): Promise<{ ok: boolean; error?: string }> {
  // Signed-in staff only; persistSubmission then checks the form is theirs.
  const allowed = await guard('self')
  if (!allowed.ok) return { ok: false, error: allowed.error }
  const result = await persistSubmission(formData, 'draft')
  return result.ok ? { ok: true } : { ok: false, error: result.error }
}
