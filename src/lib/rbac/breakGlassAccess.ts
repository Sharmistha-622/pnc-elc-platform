import { redirect } from 'next/navigation'
import { createAdminSupabaseClient } from '@/lib/supabase/admin'
import { getCurrentUserRole } from '@/lib/rbac/getCurrentUserRole'
import { passes, type Guarded } from '@/lib/rbac/guard'
import { isBreakGlassEmail } from '@/lib/rbac/breakGlass'
import type { ResolvedRole } from '@/lib/rbac/resolveRole'
import type { Feature } from '@/lib/role-constants'

// SERVER ONLY. Deliberately not a 'use server' file: nothing here may be
// callable from the browser.

function isTableMissing(error: { message?: string; code?: string } | null): boolean {
  if (!error) return false
  return error.code === '42P01' || (error.message ?? '').includes('Could not find the table')
}

/**
 * Whether the Super Admin switch is on.
 *
 * On when the row or table is missing (the default the switch ships with, so
 * it works before the migration is applied). Off on any other failure,
 * including a missing service-role key: an unreadable switch must not open
 * access.
 *
 * Reads with the service-role client, because the table is closed to
 * sessions. Callers must have checked who is asking first.
 */
export async function readBreakGlassEnabled(): Promise<boolean> {
  const admin = createAdminSupabaseClient()
  if (!admin) return false
  try {
    const { data, error } = await admin
      .from('break_glass_settings')
      .select('enabled')
      .eq('id', true)
      .maybeSingle()
    if (error) return isTableMissing(error)
    return data ? data.enabled === true : true
  } catch {
    return false
  }
}

/**
 * The caller, when they are a break-glass account and the switch is on;
 * otherwise null.
 *
 * Identity comes from the session only. An emulating caller is refused:
 * emulation exists to see less, never more.
 */
export async function breakGlassCaller(
  resolved?: ResolvedRole
): Promise<Guarded | null> {
  const caller = resolved ?? (await getCurrentUserRole())
  if (!caller.userId || !caller.role || !caller.originalRole || caller.isEmulating) return null
  if (!isBreakGlassEmail(caller.email)) return null
  if (!(await readBreakGlassEnabled())) return null
  return caller as Guarded
}

/**
 * `requireFeature`, widened for break-glass accounts.
 *
 * Admits whoever `requireFeature(feature)` admits, and a break-glass account
 * with the switch on. `breakGlass` is true whenever the caller holds
 * break-glass access, so the screen can offer what it allows.
 *
 * `layout-gates.test.ts` reads this as the `feature` gate; the extra admission
 * is by account, not by role, and the middleware makes the same exception for
 * the same screen only (`isBreakGlassRoute`).
 */
export async function requireFeatureOrBreakGlass(feature: Feature) {
  const resolved = await getCurrentUserRole()
  if (!resolved.userId) redirect('/login')
  if (!resolved.role || !resolved.originalRole) redirect('/')
  const breakGlass = (await breakGlassCaller(resolved)) !== null
  if (!breakGlass && !passes(resolved, feature)) redirect('/')
  return { ...(resolved as Guarded), breakGlass }
}
