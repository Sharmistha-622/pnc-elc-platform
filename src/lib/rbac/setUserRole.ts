'use server'

import { revalidatePath } from 'next/cache'
import { createAdminSupabaseClient } from '@/lib/supabase/admin'
import { guard } from '@/lib/rbac/guard'
import { normalizeRole, type UserRole } from '@/lib/role-constants'
import { canGrantRole, isRoleCode } from '@/lib/rbac/roles'
import { IMMUTABLE_SUPER_ADMIN_EMAILS } from '@/lib/rbac/resolveRole'

const REFUSALS: Record<string, string> = {
  role_is_automatic:
    'That role is assigned by the joiner lifecycle or the reporting line and cannot be set by hand.',
  only_super_admin_may_grant: 'Only a Super Admin can grant this role.',
  platform_admin_may_grant_platform_ops_only:
    'Platform Admin can grant Platform Ops only, and can never grant access to sensitive data.',
  may_grant_own_group_roles_only:
    'PnC Admin can grant PnC Admin and PnC Ops only; Fin Admin can grant Fin Admin and Fin Ops only.',
  owner_role_is_not_grantable: 'The owner role cannot be granted in the app.',
  cannot_change_own_role: "You can't change your own role.",
}

export async function setUserRole(targetUserId: string, role: UserRole) {
  // The users screen's own gate, checked on both roles, before anything else.
  const allowed = await guard('manageUsers')
  if (!allowed.ok) return { success: false, error: allowed.error }
  const caller = allowed.caller

  if (!isRoleCode(role)) return { success: false, error: 'Invalid role' }

  // The real role decides, never an emulated one: impersonating a Super Admin
  // must not let anyone grant like one.
  const decision = canGrantRole(caller.originalRole, role, {
    isSelf: targetUserId === caller.userId,
  })
  if (!decision.ok) {
    return { success: false, error: REFUSALS[decision.reason] ?? 'Not allowed' }
  }

  const admin = createAdminSupabaseClient()
  if (!admin) return { success: false, error: 'Role changes are unavailable: no service-role key.' }

  const { data: target, error: lookupError } = await admin.auth.admin.getUserById(targetUserId)
  if (lookupError || !target.user) return { success: false, error: 'User not found' }

  if (IMMUTABLE_SUPER_ADMIN_EMAILS.includes(target.user.email?.toLowerCase() ?? '')) {
    return {
      success: false,
      error: `${target.user.email} is an immutable Super Admin and cannot be modified`,
    }
  }

  // Taking a sensitive role away is as restricted as giving one: whoever can
  // grant the role someone currently holds is who may change it.
  const currentRole = normalizeRole(target.user.app_metadata?.role)
  if (currentRole) {
    const overCurrent = canGrantRole(caller.originalRole, currentRole, {})
    if (!overCurrent.ok && overCurrent.reason !== 'role_is_automatic') {
      return { success: false, error: 'Only a Super Admin can change this user’s role.' }
    }
  }

  const { error } = await admin.auth.admin.updateUserById(targetUserId, {
    app_metadata: { ...target.user.app_metadata, role },
  })
  if (error) return { success: false, error: error.message }

  revalidatePath('/manage/users')
  revalidatePath('/manage/roles')
  return { success: true }
}
