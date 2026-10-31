'use server'

import { breakGlassCaller } from '@/lib/rbac/breakGlassAccess'
import { BREAK_GLASS_GRANTABLE_ROLES } from '@/lib/rbac/breakGlass'
import { updateUserAllocations } from '@/lib/rbac/updateUserAllocations'
import { isRoleCode, type RoleCode } from '@/lib/rbac/roles'

// The header's "Switch my role" for break-glass accounts. A real change of
// the caller's own role, not a preview: it goes through
// `updateUserAllocations`, so the same rules, refusals and audit trail apply
// as on the users screen. Never to or from Super Admin.

const REFUSED = 'You do not have access to do that.'

export type OwnRoleSwitch =
  | { available: false }
  | { available: true; current: RoleCode; options: RoleCode[] }

/** Whether the caller may switch their own role here, and to what. */
export async function getOwnRoleSwitch(): Promise<OwnRoleSwitch> {
  const caller = await breakGlassCaller()
  if (!caller || caller.originalRole === 'super_admin') return { available: false }
  return { available: true, current: caller.originalRole, options: [...BREAK_GLASS_GRANTABLE_ROLES] }
}

export async function switchOwnRole(
  newRole: string
): Promise<{ success: boolean; error?: string }> {
  const caller = await breakGlassCaller()
  if (!caller) return { success: false, error: REFUSED }
  if (caller.originalRole === 'super_admin') {
    return { success: false, error: 'A Super Admin changes roles on the users screen.' }
  }
  if (!isRoleCode(newRole) || !BREAK_GLASS_GRANTABLE_ROLES.includes(newRole)) {
    return { success: false, error: 'Break-glass access cannot grant that role.' }
  }

  // The target is the session's own account; nothing in the request names it.
  const res = await updateUserAllocations({
    targetUserId: caller.userId,
    targetEmail: '',
    newRole,
    reason: 'Switched own role from the header (break-glass)',
  })
  return { success: res.success, error: 'error' in res ? res.error : undefined }
}
