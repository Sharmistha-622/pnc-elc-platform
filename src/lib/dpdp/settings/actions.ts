'use server'

import { revalidatePath } from 'next/cache'
import type { z } from 'zod'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { privacyEditor, retentionModeRefusal } from '../access'
import { checklistPasses, isPrivacyNotice, nextVersion, noticeChecklist, type NoticeType } from '../notices'
import { addDays, isoDate } from '../dates'
import { changedEntries, logPrivacyChanges } from './change-log'
import { contactIsSet } from './defaults'
import { toSettings } from './queries'
import {
  attestationSchema,
  breachContactsSchema,
  childrenSchema,
  contactSchema,
  dataCollectionSchema,
  fieldErrors,
  languagesSchema,
  linksStagingSchema,
  noticeDraftSchema,
  periodsSchema,
  processorSchema,
  publishNoticeSchema,
  purposeSchema,
  retentionModeSchema,
  retentionRuleSchema,
} from './schemas'
import type { ActionResult } from './types'

// ============================================================================
// DPDP & Privacy: writes
// ----------------------------------------------------------------------------
// Every export is a server action the browser can call directly, with any
// arguments. Each one checks the caller first (`privacyEditor`, or
// `retentionModeRefusal` for the mode switch), parses its input with the same
// zod schema the form used, writes with the session client (so RLS and the
// table's check constraints apply too) and logs old → new to
// settings_change_log.
// ============================================================================

const PATH = '/manage/settings/dpdp'
const NOT_SAVED = 'The change could not be saved. Try again, or check that the DPDP migration is applied.'

function invalid(error: z.ZodError): ActionResult {
  return { success: false, error: 'Check the highlighted fields.', fieldErrors: fieldErrors(error) }
}

/** Updates fields of the settings row and logs each change. */
async function updateSettingsRow(fields: Record<string, unknown>, actor: string, reason?: string): Promise<ActionResult> {
  const supabase = await createServerSupabaseClient()
  const { data: before, error: readError } = await supabase.from('dpdp_settings').select('*').eq('id', 'default').maybeSingle()
  if (readError || !before) return { success: false, error: NOT_SAVED }

  const { error } = await supabase
    .from('dpdp_settings')
    .update({ ...fields, updated_by: actor })
    .eq('id', 'default')
  if (error) return { success: false, error: NOT_SAVED }

  await logPrivacyChanges(changedEntries('dpdp_settings', '', before as Record<string, unknown>, fields), actor, reason)
  revalidatePath(PATH)
  return { success: true }
}

/** Parses and saves one settings form. The caller has already been checked. */
async function settingsWrite<T extends z.ZodType>(schema: T, input: unknown, actor: string): Promise<ActionResult> {
  const parsed = schema.safeParse(input)
  if (!parsed.success) return invalid(parsed.error)
  return updateSettingsRow(parsed.data as Record<string, unknown>, actor)
}

/** Contact & grievance: the Privacy & Grievance Officer and the Board link. */
export async function updatePrivacyContact(input: unknown): Promise<ActionResult> {
  const caller = await privacyEditor()
  if (!caller.ok) return { success: false, error: caller.error }
  return settingsWrite(contactSchema, input, caller.caller.email ?? caller.caller.userId)
}

/** Contact & grievance: response periods. */
export async function updatePrivacyPeriods(input: unknown): Promise<ActionResult> {
  const caller = await privacyEditor()
  if (!caller.ok) return { success: false, error: caller.error }
  return settingsWrite(periodsSchema, input, caller.caller.email ?? caller.caller.userId)
}

/** Links & staging. */
export async function updateLinksAndStaging(input: unknown): Promise<ActionResult> {
  const caller = await privacyEditor()
  if (!caller.ok) return { success: false, error: caller.error }
  return settingsWrite(linksStagingSchema, input, caller.caller.email ?? caller.caller.userId)
}

/** Children: how guardian consent may be recorded. The age itself is locked. */
export async function updateChildrenSettings(input: unknown): Promise<ActionResult> {
  const caller = await privacyEditor()
  if (!caller.ok) return { success: false, error: caller.error }
  return settingsWrite(childrenSchema, input, caller.caller.email ?? caller.caller.userId)
}

/** Data collection: optional fields and the Drive allow-list. */
export async function updateDataCollection(input: unknown): Promise<ActionResult> {
  const caller = await privacyEditor()
  if (!caller.ok) return { success: false, error: caller.error }
  return settingsWrite(dataCollectionSchema, input, caller.caller.email ?? caller.caller.userId)
}

/** Notices: the languages offered. */
export async function updateNoticeLanguages(input: unknown): Promise<ActionResult> {
  const caller = await privacyEditor()
  if (!caller.ok) return { success: false, error: caller.error }
  return settingsWrite(languagesSchema, input, caller.caller.email ?? caller.caller.userId)
}

/** Breach response: contacts. */
export async function updateBreachContacts(input: unknown): Promise<ActionResult> {
  const caller = await privacyEditor()
  if (!caller.ok) return { success: false, error: caller.error }
  return settingsWrite(breachContactsSchema, input, caller.caller.email ?? caller.caller.userId)
}

/** A retention rule's period and action. Never below its floor; a reason is required. */
export async function updateRetentionRule(input: unknown): Promise<ActionResult> {
  const caller = await privacyEditor()
  if (!caller.ok) return { success: false, error: caller.error }
  const id = typeof input === 'object' && input && 'id' in input ? String((input as { id: unknown }).id) : ''

  const supabase = await createServerSupabaseClient()
  const { data: rule } = await supabase.from('dpdp_retention_rules').select('*').eq('id', id).maybeSingle()
  if (!rule) return { success: false, error: 'Unknown retention rule.' }

  const parsed = retentionRuleSchema(Number(rule.floor_days) || 0).safeParse(input)
  if (!parsed.success) return invalid(parsed.error)
  const { reason, period_days, consent_period_days, action } = parsed.data
  const fields = { period_days, consent_period_days, action }
  const actor = caller.caller.email ?? caller.caller.userId

  const { error } = await supabase
    .from('dpdp_retention_rules')
    .update({ ...fields, updated_by: actor })
    .eq('id', id)
  if (error) return { success: false, error: NOT_SAVED }

  await logPrivacyChanges(changedEntries('dpdp_retention_rules', `${id}.`, rule as Record<string, unknown>, fields), actor, reason)
  revalidatePath(PATH)
  return { success: true }
}

/** Dry-run or live. Super Admin only, with a reason. */
export async function setRetentionMode(input: unknown): Promise<ActionResult> {
  const refused = await retentionModeRefusal()
  if (refused) return refused
  const caller = await privacyEditor()
  if (!caller.ok) return { success: false, error: caller.error }
  const parsed = retentionModeSchema.safeParse(input)
  if (!parsed.success) return invalid(parsed.error)
  return updateSettingsRow(
    { retention_mode: parsed.data.mode },
    caller.caller.email ?? caller.caller.userId,
    parsed.data.reason,
  )
}

/** Saves the working draft of a notice (one per type and language). */
export async function saveNoticeDraft(input: unknown): Promise<ActionResult> {
  const caller = await privacyEditor()
  if (!caller.ok) return { success: false, error: caller.error }
  const parsed = noticeDraftSchema.safeParse(input)
  if (!parsed.success) return invalid(parsed.error)
  const { notice_type, language, title, sections } = parsed.data
  const actor = caller.caller.email ?? caller.caller.userId

  const supabase = await createServerSupabaseClient()
  const { data: versions } = await supabase
    .from('dpdp_notices')
    .select('id, version, status')
    .eq('notice_type', notice_type)
    .eq('language', language)
  const draft = (versions ?? []).find((v) => v.status === 'draft')

  const { error } = draft
    ? await supabase.from('dpdp_notices').update({ title, sections }).eq('id', draft.id)
    : await supabase.from('dpdp_notices').insert({
        notice_type,
        language,
        title,
        sections,
        version: nextVersion(versions ?? []),
        created_by: actor,
      })
  if (error) return { success: false, error: NOT_SAVED }
  revalidatePath(PATH)
  return { success: true }
}

/**
 * Publishes a draft as a new, immutable version. The Rule 3 checklist (or the
 * Rule 7 placeholders, for a breach template) must pass, checked here again.
 */
export async function publishNotice(input: unknown): Promise<ActionResult> {
  const caller = await privacyEditor()
  if (!caller.ok) return { success: false, error: caller.error }
  const parsed = publishNoticeSchema.safeParse(input)
  if (!parsed.success) return invalid(parsed.error)
  const actor = caller.caller.email ?? caller.caller.userId

  const supabase = await createServerSupabaseClient()
  const { data: draft } = await supabase.from('dpdp_notices').select('*').eq('id', parsed.data.id).maybeSingle()
  if (!draft || draft.status !== 'draft') return { success: false, error: 'Only a draft can be published.' }

  const { data: settingsRow } = await supabase.from('dpdp_settings').select('*').eq('id', 'default').maybeSingle()
  const type = draft.notice_type as NoticeType
  const checklist = noticeChecklist(type, (draft.sections ?? {}) as Record<string, string>, {
    contactSet: contactIsSet(toSettings(settingsRow as Record<string, unknown> | null)),
  })
  if (!checklistPasses(checklist)) {
    return {
      success: false,
      error: isPrivacyNotice(type)
        ? 'Every Rule 3 element and the privacy contact must be present before publishing.'
        : 'Every required placeholder must appear before publishing.',
    }
  }

  const { error } = await supabase
    .from('dpdp_notices')
    .update({ status: 'published', published_at: new Date().toISOString(), published_by: actor, publish_reason: parsed.data.reason })
    .eq('id', draft.id)
  if (error) return { success: false, error: NOT_SAVED }

  await logPrivacyChanges(
    [{ table: 'dpdp_notices', recordId: draft.id, key: `${type}.${draft.language}.version`, oldValue: draft.version - 1, newValue: draft.version }],
    actor,
    parsed.data.reason,
  )
  revalidatePath(PATH)
  return { success: true }
}

/** Throws away a working draft. Published versions cannot be deleted. */
export async function discardNoticeDraft(id: string): Promise<ActionResult> {
  const caller = await privacyEditor()
  if (!caller.ok) return { success: false, error: caller.error }
  if (typeof id !== 'string' || !/^[0-9a-f-]{36}$/i.test(id)) return { success: false, error: 'Unknown draft.' }
  const supabase = await createServerSupabaseClient()
  const { error } = await supabase.from('dpdp_notices').delete().eq('id', id).eq('status', 'draft')
  if (error) return { success: false, error: NOT_SAVED }
  revalidatePath(PATH)
  return { success: true }
}

/** Adds or updates a consent purpose. */
export async function savePurpose(input: unknown): Promise<ActionResult> {
  const caller = await privacyEditor()
  if (!caller.ok) return { success: false, error: caller.error }
  const parsed = purposeSchema.safeParse(input)
  if (!parsed.success) return invalid(parsed.error)
  return upsertByCode('dpdp_consent_purposes', parsed.data, caller.caller.email ?? caller.caller.userId)
}

/** Adds or updates a processor in the register. */
export async function saveProcessor(input: unknown): Promise<ActionResult> {
  const caller = await privacyEditor()
  if (!caller.ok) return { success: false, error: caller.error }
  const parsed = processorSchema.safeParse(input)
  if (!parsed.success) return invalid(parsed.error)
  const row = {
    ...parsed.data,
    dpa_date: parsed.data.dpa_date || null,
    next_review_date: parsed.data.next_review_date || null,
  }
  return upsertByCode('dpdp_processors', row, caller.caller.email ?? caller.caller.userId)
}

async function upsertByCode(
  table: 'dpdp_consent_purposes' | 'dpdp_processors',
  row: Record<string, unknown> & { code: string },
  actor: string,
): Promise<ActionResult> {
  const supabase = await createServerSupabaseClient()
  const { data: before } = await supabase.from(table).select('*').eq('code', row.code).maybeSingle()
  const { error } = before
    ? await supabase.from(table).update({ ...row, updated_by: actor, updated_at: new Date().toISOString() }).eq('code', row.code)
    : await supabase.from(table).insert({ ...row, updated_by: actor })
  if (error) return { success: false, error: NOT_SAVED }
  await logPrivacyChanges(changedEntries(table, `${row.code}.`, (before ?? {}) as Record<string, unknown>, row), actor)
  revalidatePath(PATH)
  return { success: true }
}

/** Records that a person confirmed an owner attestation, and when to review it next. */
export async function confirmAttestation(input: unknown): Promise<ActionResult> {
  const caller = await privacyEditor()
  if (!caller.ok) return { success: false, error: caller.error }
  const parsed = attestationSchema.safeParse(input)
  if (!parsed.success) return invalid(parsed.error)
  const actor = caller.caller.email ?? caller.caller.userId

  const supabase = await createServerSupabaseClient()
  const { data: before } = await supabase.from('dpdp_attestations').select('*').eq('code', parsed.data.code).maybeSingle()
  if (!before) return { success: false, error: 'Unknown attestation.' }

  const now = new Date()
  const fields = {
    confirmed_by: actor,
    confirmed_at: now.toISOString(),
    next_review_at: isoDate(addDays(now, Number(before.review_interval_days) || 90)),
    evidence_note: parsed.data.evidence_note,
  }
  const { error } = await supabase.from('dpdp_attestations').update(fields).eq('code', parsed.data.code)
  if (error) return { success: false, error: NOT_SAVED }
  await logPrivacyChanges(changedEntries('dpdp_attestations', `${parsed.data.code}.`, before as Record<string, unknown>, fields), actor)
  revalidatePath(PATH)
  return { success: true }
}
