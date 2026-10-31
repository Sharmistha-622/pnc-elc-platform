'use server'

import { revalidatePath } from 'next/cache'
import { createAdminSupabaseClient } from '@/lib/supabase/admin'
import { guard } from '@/lib/rbac/guard'
import { readBreakGlassEnabled } from '@/lib/rbac/breakGlassAccess'

// The break-glass switch, for Super Admin alone. Every export is a server
// action the browser can call, so each starts with the guard; `guard` checks
// the original role too, so emulating a Super Admin does not reach it.

const SUPER_ADMIN = ['super_admin'] as const

/** Whether the signed-in user may see and flip the switch. */
export async function canManageBreakGlass(): Promise<boolean> {
  return (await guard(SUPER_ADMIN)).ok
}

export async function getBreakGlassSetting(): Promise<
  { success: true; enabled: boolean } | { success: false; error: string }
> {
  const allowed = await guard(SUPER_ADMIN)
  if (!allowed.ok) return { success: false, error: allowed.error }
  return { success: true, enabled: await readBreakGlassEnabled() }
}

export async function setBreakGlassEnabled(
  enabled: boolean
): Promise<{ success: true; enabled: boolean } | { success: false; error: string }> {
  const allowed = await guard(SUPER_ADMIN)
  if (!allowed.ok) return { success: false, error: allowed.error }
  if (typeof enabled !== 'boolean') return { success: false, error: 'Invalid value' }

  const admin = createAdminSupabaseClient()
  if (!admin) return { success: false, error: 'Unavailable: no service-role key.' }

  const previous = await readBreakGlassEnabled()
  const { error } = await admin.from('break_glass_settings').upsert({
    id: true,
    enabled,
    updated_at: new Date().toISOString(),
    updated_by: allowed.caller.email,
  })
  if (error) {
    console.error('break_glass_settings write failed', error.code)
    return {
      success: false,
      error: 'Could not save. Has supabase/migrations/202610311000_break_glass_settings.sql been applied?',
    }
  }

  // The same log every other settings change goes to (Settings → Audit Log).
  const { error: logError } = await admin.from('settings_change_log').insert({
    table_name: 'break_glass_settings',
    record_id: null,
    setting_key: 'break_glass_enabled',
    old_value: String(previous),
    new_value: String(enabled),
    changed_by: allowed.caller.email ?? 'super_admin',
  })
  if (logError) console.warn('settings_change_log write failed', logError.code)

  revalidatePath('/manage/settings/super-admin')
  revalidatePath('/manage/users')
  return { success: true, enabled }
}
