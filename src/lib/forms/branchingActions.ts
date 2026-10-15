'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { RULE_FIELD_TYPES, ruleChoices } from '@/lib/forms/branching'

function fail(path: string, message: string): never {
  redirect(`${path}?error=${encodeURIComponent(message)}`)
}

function text(formData: FormData, key: string): string {
  return String(formData.get(key) ?? '').trim()
}

// Shows a section only when an earlier question has one of the chosen answers
export async function setSectionRule(formData: FormData): Promise<void> {
  const formId = text(formData, 'formId')
  const sectionId = text(formData, 'sectionId')
  const fieldId = text(formData, 'fieldId')
  const path = `/data-management/forms/${formId}`

  if (!fieldId) fail(path, 'Choose the question this section depends on')
  const values = formData.getAll(`values_${fieldId}`).map((v) => String(v)).filter(Boolean)
  if (values.length === 0) fail(path, 'Tick at least one answer that shows this section')

  const supabase = await createServerSupabaseClient()
  const { data: field } = await supabase
    .from('form_fields')
    .select('id, field_type, options')
    .eq('id', fieldId)
    .maybeSingle()
  if (!field) fail(path, 'That question no longer exists')
  if (!RULE_FIELD_TYPES.some((t) => t === field.field_type)) {
    fail(path, 'A condition can only use a single select, multi select or yes/no question')
  }
  const allowed = ruleChoices(field).map((c) => c.value)
  if (values.some((v) => !allowed.includes(v))) {
    fail(path, 'One of the ticked answers is not an option of that question')
  }

  const { data: updated, error } = await supabase
    .from('form_sections')
    .update({ show_when: { field_id: fieldId, equals: values } })
    .eq('id', sectionId)
    .select('id')
  if (error) fail(path, error.message)
  if (!updated || updated.length === 0) fail(path, 'Could not save the condition')

  revalidatePath(path)
  redirect(path)
}

export async function clearSectionRule(formData: FormData): Promise<void> {
  const formId = text(formData, 'formId')
  const sectionId = text(formData, 'sectionId')
  const path = `/data-management/forms/${formId}`

  const supabase = await createServerSupabaseClient()
  const { error } = await supabase.from('form_sections').update({ show_when: null }).eq('id', sectionId)
  if (error) fail(path, error.message)

  revalidatePath(path)
  redirect(path)
}
