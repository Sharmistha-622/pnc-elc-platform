'use server'

import { revalidatePath } from 'next/cache'
import { createAdminSupabaseClient } from '@/lib/supabase/admin'
import { IMMUTABLE_SUPER_ADMIN_EMAILS } from '@/lib/rbac/getCurrentUserRole'
import { roleLabel, type UserRole } from '@/lib/role-constants'
import { recordAuditEvent } from '@/lib/audit/service'
import { canGrantRole, canSetDepartment, isRoleCode } from '@/lib/rbac/roles'
import { guard } from '@/lib/rbac/guard'
import { isAllowedEmail } from '@/lib/auth/allowedEmail'
import type { UserRow } from '@/lib/rbac/listUsersWithRoles'

const GRANT_REFUSALS: Record<string, string> = {
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

export interface CreateUserInput {
  email: string
  fullName?: string
  role: UserRole
  team?: string
}

export type CreateUserResult = { success: true; user: UserRow } | { success: false; error: string }

/**
 * Creates an account ahead of the person's first sign-in, holding the role
 * and department chosen for it.
 *
 * Sign-in is Google OAuth, and Supabase links that sign-in to this account by
 * its confirmed email, so the role is in place the first time they arrive.
 * No email is sent. An Employee needs no account made for them — anyone on an
 * allowed domain signs in as one — which is why only grantable roles are
 * offered here.
 */
export async function createUserWithRole(input: CreateUserInput): Promise<CreateUserResult> {
  // The users screen's own gate, checked on both roles.
  const allowed = await guard('manageUsers')
  if (!allowed.ok) return { success: false, error: allowed.error }
  const caller = allowed.caller

  const email = (input.email ?? '').trim().toLowerCase()
  if (!isAllowedEmail(email)) {
    return { success: false, error: 'Use an organisation email address.' }
  }
  if (IMMUTABLE_SUPER_ADMIN_EMAILS.includes(email)) {
    return { success: false, error: `${email} is an immutable Super Admin and cannot be modified` }
  }

  const role = input.role
  if (!isRoleCode(role)) return { success: false, error: 'Invalid role selected' }

  // The caller's real role decides, never an emulated one.
  const decision = canGrantRole(caller.originalRole, role, {
    isSelf: email === caller.email?.toLowerCase(),
  })
  if (!decision.ok) {
    return { success: false, error: GRANT_REFUSALS[decision.reason] ?? 'Not allowed' }
  }

  const team = input.team?.trim() || 'None'
  if (team !== 'None' && !canSetDepartment(caller.originalRole)) {
    return { success: false, error: 'Your role can set a user’s role, not their department.' }
  }

  const fullName = input.fullName?.trim() || email.split('@')[0]

  const admin = createAdminSupabaseClient()
  if (!admin) return { success: false, error: 'Adding users is unavailable: no service-role key.' }

  const { data, error } = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
    app_metadata: { role },
    user_metadata: { full_name: fullName, team },
  })
  if (error || !data.user) {
    // An existing account is changed from the list, where the rules about the
    // role it holds now apply. Creating cannot be a way around them.
    const exists = error?.code === 'email_exists' || /already (been )?registered/i.test(error?.message ?? '')
    return {
      success: false,
      error: exists
        ? `${email} already has an account. Change their role from the list instead.`
        : 'The account could not be created. Try again.',
    }
  }

  try {
    await recordAuditEvent({
      subject: { employee_id: data.user.id, employee_email: email, employee_name: fullName },
      actor: {
        actor_email: caller.email,
        actor_name: caller.email ? caller.email.split('@')[0] : 'Admin',
        actor_type: 'pnc',
      },
      module: 'access',
      action: 'access.user.created',
      description: `Added ${fullName} as ${roleLabel(role)}${team !== 'None' ? ` in ${team}` : ''}`,
      changes: [
        { field: 'role', label: 'System Role', from: 'None', to: role },
        ...(team !== 'None' ? [{ field: 'team', label: 'Team / Department', from: 'None', to: team }] : []),
      ],
      metadata: { actor_role: caller.role },
    })
  } catch {
    console.warn('Unified audit trail write non-fatal warning: user created')
  }

  revalidatePath('/manage/users')

  return {
    success: true,
    user: {
      id: data.user.id,
      email,
      name: fullName,
      role,
      team,
      // `email_confirm` confirms the account, which the list reads as active.
      status: 'active',
      created_at: data.user.created_at,
      last_active_at: null,
      avatar: null,
    },
  }
}
