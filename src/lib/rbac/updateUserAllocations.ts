'use server'

import { revalidatePath } from 'next/cache'
import { randomUUID } from 'crypto'
import { createAdminSupabaseClient } from '@/lib/supabase/admin'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { IMMUTABLE_SUPER_ADMIN_EMAILS } from '@/lib/rbac/getCurrentUserRole'
import { DEFAULT_ROLE, normalizeRole, type UserRole } from '@/lib/role-constants'
import { recordAuditEvent } from '@/lib/audit/service'
import { canGrantRole, isRoleCode } from '@/lib/rbac/roles'
import { guard } from '@/lib/rbac/guard'

const GRANT_REFUSALS: Record<string, string> = {
  role_is_automatic:
    'That role is assigned by the joiner lifecycle or the reporting line and cannot be set by hand.',
  only_super_admin_may_grant: 'Only a Super Admin can grant this role.',
  platform_admin_may_grant_platform_ops_only:
    'Platform Admin can grant Platform Ops only, and can never grant access to sensitive data.',
  owner_role_is_not_grantable: 'The owner role cannot be granted in the app.',
  cannot_change_own_role: "You can't change your own role.",
}

export interface UpdateAllocationsInput {
  targetUserId: string
  /** Ignored: the target's email is looked up from `targetUserId`. */
  targetEmail: string
  targetName?: string
  newRole: UserRole
  newTeam: string
  /** Ignored: the target's current role is looked up from `targetUserId`. */
  currentRole?: UserRole | null
  /** Ignored: the target's current team is looked up from `targetUserId`. */
  currentTeam?: string | null
  reason?: string
}

function isValidUuid(id?: string | null): boolean {
  if (!id) return false
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
}

/**
 * The target as the server knows it.
 *
 * The users screen lists auth accounts and, beneath them, directory employees
 * who have never signed in, so `targetUserId` is either an auth user id or an
 * employee id. Whichever it is, the email, current role and current team come
 * from the records here. The browser's copies of them are what made it
 * possible to claim a Super Admin was a plain employee and take the role
 * away, or to name one account and change another.
 */
async function lookUpTarget(
  admin: NonNullable<ReturnType<typeof createAdminSupabaseClient>>,
  targetUserId: string
) {
  const supabase = await createServerSupabaseClient()

  let authUser: any = null
  if (isValidUuid(targetUserId)) {
    const { data } = await admin.auth.admin.getUserById(targetUserId)
    authUser = data?.user ?? null
  }

  let employee: { id: string; email: string | null; team: string | null } | null = null
  if (authUser?.email) {
    const escaped = String(authUser.email).replace(/[\\%_]/g, '\\$&')
    const { data } = await supabase.from('employees').select('id, email, team').ilike('email', escaped).limit(1)
    employee = data?.[0] ?? null
  } else if (isValidUuid(targetUserId)) {
    const { data } = await supabase
      .from('employees')
      .select('id, email, team')
      .eq('id', targetUserId)
      .maybeSingle()
    employee = data ?? null
  }

  const email = String(authUser?.email ?? employee?.email ?? '').trim().toLowerCase()
  if (!email) return null

  // A directory employee may still have an auth account under their email.
  if (!authUser) {
    const { data: userList } = await admin.auth.admin.listUsers({ page: 1, perPage: 100 })
    authUser = userList?.users?.find((u) => u.email?.toLowerCase() === email) ?? null
  }

  const role: UserRole = IMMUTABLE_SUPER_ADMIN_EMAILS.includes(email)
    ? 'super_admin'
    : (normalizeRole(authUser?.app_metadata?.role) ?? DEFAULT_ROLE)
  // The same precedence the users screen shows: the account's team, then the
  // directory's.
  const accountTeam = authUser?.user_metadata?.team as string | undefined
  const team = accountTeam && accountTeam !== 'None' ? accountTeam : employee?.team || 'None'

  return { authUser, email, role, team }
}

export async function updateUserAllocations(input: UpdateAllocationsInput) {
  const { targetUserId, targetName, newRole, newTeam, reason } = input

  // The users screen's own gate, checked on both roles.
  const allowed = await guard('manageUsers')
  if (!allowed.ok) return { success: false, error: allowed.error }
  const caller = allowed.caller

  if (!isRoleCode(newRole)) {
    return { success: false, error: 'Invalid role selected' }
  }

  const admin = createAdminSupabaseClient()
  if (!admin) return { success: false, error: 'Role changes are unavailable: no service-role key.' }

  const target = await lookUpTarget(admin, targetUserId)
  if (!target) return { success: false, error: 'User not found' }

  const cleanTargetEmail = target.email
  const isImmutable = IMMUTABLE_SUPER_ADMIN_EMAILS.includes(cleanTargetEmail)

  // One authority decides who may grant what. The caller's real role is used,
  // never an emulated one, so impersonating a Super Admin cannot grant like one.
  const decision = canGrantRole(caller.originalRole, newRole, {
    isSelf:
      cleanTargetEmail === caller.email?.toLowerCase() ||
      (Boolean(target.authUser?.id) && target.authUser?.id === caller.userId),
  })
  if (!decision.ok) {
    return { success: false, error: GRANT_REFUSALS[decision.reason] ?? 'Not allowed' }
  }

  if (isImmutable && newRole !== 'super_admin') {
    return {
      success: false,
      error: `${cleanTargetEmail} is an immutable Root Super Admin. Role cannot be modified.`,
    }
  }

  // Removing a sensitive role is as restricted as granting one, judged on the
  // role the target actually holds.
  const overCurrent = canGrantRole(caller.originalRole, target.role, {})
  if (!overCurrent.ok && overCurrent.reason !== 'role_is_automatic') {
    return { success: false, error: 'Only a Super Admin can alter this user’s role.' }
  }

  const normalizedCurrentTeam = target.team
  const normalizedNewTeam = newTeam || 'None'
  const normalizedCurrentRole = target.role

  const roleChanged = normalizedCurrentRole !== newRole
  const teamChanged = normalizedCurrentTeam !== normalizedNewTeam

  if (!roleChanged && !teamChanged) {
    return { success: true, message: 'No allocation changes detected' }
  }

  const diffs: { field: string; label: string; from: string; to: string }[] = []
  if (roleChanged) {
    diffs.push({
      field: 'role',
      label: 'System Role',
      from: normalizedCurrentRole,
      to: newRole,
    })
  }
  if (teamChanged) {
    diffs.push({
      field: 'team',
      label: 'Team / Department',
      from: normalizedCurrentTeam,
      to: normalizedNewTeam,
    })
  }

  // 1. Update Supabase Auth metadata (if auth account exists)
  const authUserRecord = target.authUser
  if (authUserRecord) {
    try {
      await admin.auth.admin.updateUserById(authUserRecord.id, {
        app_metadata: { ...authUserRecord.app_metadata, role: newRole },
        user_metadata: { ...authUserRecord.user_metadata, team: normalizedNewTeam },
      })
    } catch (err) {
      console.warn('Supabase Auth user update non-fatal error:', err)
    }
  }

  // 2. Update employee record in public.employees (if present)
  try {
    const supabase = await createServerSupabaseClient()

    let teamId: string | null = null
    let departmentId: string | null = null
    if (normalizedNewTeam !== 'None') {
      try {
        const { data: deptRecord } = await supabase
          .from('departments')
          .select('id')
          .ilike('name', normalizedNewTeam.trim())
          .maybeSingle()
        if (deptRecord) departmentId = deptRecord.id
      } catch {}

      try {
        const { data: teamRecord } = await supabase
          .from('teams')
          .select('id')
          .ilike('name', normalizedNewTeam.trim())
          .maybeSingle()
        if (teamRecord) teamId = teamRecord.id
      } catch {}
    }

    const cleanTeamValue = normalizedNewTeam === 'None' ? null : normalizedNewTeam
    const updatePayload: Record<string, any> = {
      team: cleanTeamValue,
      department: cleanTeamValue,
      updated_at: new Date().toISOString(),
    }
    if (teamId) updatePayload.team_id = teamId
    if (departmentId) updatePayload.department_id = departmentId

    await supabase
      .from('employees')
      .update(updatePayload)
      .or(`email.ilike.${cleanTargetEmail}${isValidUuid(targetUserId) ? `,id.eq.${targetUserId}` : ''}`)
  } catch (err) {
    console.warn('Employees table sync non-fatal error:', err)
  }

  // 3. Write Audit Log to public.audit_log
  try {
    const supabase = await createServerSupabaseClient()
    const auditRecordId = isValidUuid(targetUserId) ? targetUserId : randomUUID()
    const callerId = caller.userId && isValidUuid(caller.userId) ? caller.userId : null

    await supabase.from('audit_log').insert({
      table_name: 'users',
      record_id: auditRecordId,
      action: 'update',
      changed_by: callerId,
      changed_data: {
        event: 'user_allocations_updated',
        target_email: cleanTargetEmail,
        target_name: targetName || cleanTargetEmail,
        target_id: targetUserId,
        actor_email: caller.email || 'Admin',
        actor_role: caller.role,
        changes: diffs,
        reason: reason?.trim() || null,
        timestamp: new Date().toISOString(),
      },
    })
  } catch (err) {
    console.warn('audit_log table write non-fatal warning:', err)
  }

  // 4. Record to unified employee audit trail
  try {
    const summaryStr = diffs.map((d) => `${d.label}: ${d.from} → ${d.to}`).join('; ')
    await recordAuditEvent({
      subject: {
        employee_id: targetUserId,
        employee_email: cleanTargetEmail,
        employee_name: targetName,
      },
      actor: {
        actor_email: caller.email,
        actor_name: caller.email ? caller.email.split('@')[0] : 'Admin',
        actor_type: 'pnc',
      },
      module: 'access',
      action: 'access.user.allocated',
      description: `Updated allocations for ${targetName || cleanTargetEmail}: ${summaryStr}${
        reason ? ` (Reason: ${reason})` : ''
      }`,
      changes: diffs.map((d) => ({ field: d.field, label: d.label, from: d.from, to: d.to })),
      metadata: {
        reason: reason?.trim() || null,
        actor_role: caller.role,
      },
    })
  } catch (err) {
    console.warn('Unified audit trail write non-fatal warning:', err)
  }

  revalidatePath('/manage/users')
  revalidatePath('/manage/roles')
  revalidatePath('/employees')

  return { success: true, changes: diffs }
}
