import { createAdminSupabaseClient } from '@/lib/supabase/admin'

// ============================================================================
// DPDP & Privacy changes, into settings_change_log
// ----------------------------------------------------------------------------
// Every saved value is logged old → new, with who and, where the form asks,
// why. Written with the service-role client, after the action's own guard:
// session inserts into settings_change_log are open to the platform editors
// only, and PnC Admin edits privacy settings too.
// ============================================================================

export interface ChangeEntry {
  table: string
  /** A uuid row id, when the row has one (notices). */
  recordId?: string | null
  key: string
  oldValue: unknown
  newValue: unknown
}

export function stringifyValue(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'string') return value
  return JSON.stringify(value)
}

/** The fields that differ between two versions of a row, as log entries. */
export function changedEntries(
  table: string,
  keyPrefix: string,
  before: Record<string, unknown>,
  after: Record<string, unknown>,
  recordId: string | null = null,
): ChangeEntry[] {
  return Object.keys(after)
    .filter((k) => stringifyValue(before[k]) !== stringifyValue(after[k]))
    .map((k) => ({ table, recordId, key: `${keyPrefix}${k}`, oldValue: before[k], newValue: after[k] }))
}

/** Writes the entries. Returns false if the log could not be written. */
export async function logPrivacyChanges(entries: ChangeEntry[], actor: string, reason?: string | null): Promise<boolean> {
  if (entries.length === 0) return true
  const admin = createAdminSupabaseClient()
  if (!admin) return false
  const { error } = await admin.from('settings_change_log').insert(
    entries.map((e) => ({
      table_name: e.table,
      record_id: e.recordId ?? null,
      setting_key: e.key,
      old_value: stringifyValue(e.oldValue),
      new_value: stringifyValue(e.newValue),
      changed_by: actor,
      reason: reason ?? null,
    })),
  )
  return !error
}
