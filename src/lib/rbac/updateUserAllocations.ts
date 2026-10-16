'use server'

import { revalidatePath } from 'next/cache'
import { randomUUID } from 'crypto'
import { createAdminSupabaseClient } from '@/lib/supabase/admin'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getCurrentUserRole, IMMUTABLE_SUPER_ADMIN_EMAILS } from '@/lib/rbac/getCurrentUserRole'
import { normalizeRole, type UserRole } from '@/lib/role-constants'
import { recordAuditEvent } from '@/lib/audit/service'
import { canGrantRole, isRoleCode } from '@/lib/rbac/roles'

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
  targetEmail: string
  targetName?: string
  newRole: UserRole
  newTeam: string
  currentRole?: UserRole | null
  currentTeam?: string | null
  reason?: string
}

function isValidUuid(id?: string | null): boolean {
  if (!id) return false
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
}

export async function updateUserAllocations(input: UpdateAllocationsInput) {
  const {
    targetUserId,
    targetEmail,
    targetName,
    newRole,
    newTeam,
    currentRole,
    currentTeam,
    reason,
  } = input

  const caller = await getCurrentUserRole()

  const cleanTargetEmail = targetEmail.trim().toLowerCase()
  const isImmutable = IMMUTABLE_SUPER_ADMIN_EMAILS.includes(cleanTargetEmail)

  if (!isRoleCode(newRole)) {
    return { success: false, error: 'Invalid role selected' }
  }

  // One authority decides who may grant what. The caller's real role is used,
  // never an emulated one, so impersonating a Super Admin cannot grant like one.
  const decision = canGrantRole(caller.originalRole, newRole, {
    isSelf: cleanTargetEmail === caller.email?.toLowerCase(),
  })
  if (!decision.ok) {
    return { success: false, error: GRANT_REFUSALS[decision.reason] ?? 'Not allowed' }
  }

  if (isImmutable && newRole !== 'super_admin') {
    return {
      success: false,
      error: `${targetEmail} is an immutable Root Super Admin. Role cannot be modified.`,
    }
  }

  // Removing a sensitive role is as restricted as granting one.
  const existingRole = normalizeRole(currentRole)
  if (existingRole) {
    const overCurrent = canGrantRole(caller.originalRole, existingRole, {})
    if (!overCurrent.ok && overCurrent.reason !== 'role_is_automatic') {
      return { success: false, error: 'Only a Super Admin can alter this user’s role.' }
    }
  }

  const normalizedCurrentTeam = currentTeam || 'None'
  const normalizedNewTeam = newTeam || 'None'
  const normalizedCurrentRole = normalizeRole(currentRole) ?? 'employee'

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
  const admin = createAdminSupabaseClient()
  if (admin) {
    try {
      // Find auth user by targetUserId or by email
      let authUserRecord: any = null
      if (isValidUuid(targetUserId)) {
        const { data: userById } = await admin.auth.admin.getUserById(targetUserId)
        if (userById?.user) authUserRecord = userById.user
      }

      if (!authUserRecord) {
        const { data: userList } = await admin.auth.admin.listUsers({ page: 1, perPage: 100 })
        authUserRecord = userList?.users?.find(
          (u) => u.email?.toLowerCase() === cleanTargetEmail
        )
      }

      if (authUserRecord) {
        await admin.auth.admin.updateUserById(authUserRecord.id, {
          app_metadata: { ...authUserRecord.app_metadata, role: newRole },
          user_metadata: { ...authUserRecord.user_metadata, team: normalizedNewTeam },
        })
      }
    } catch (err) {
      console.warn('Supabase Auth user update non-fatal error:', err)
    }
  }

  // 2. Update employee record in public.employees (if present)
  try {
    const supabase = await createServerSupabaseClient()

    let teamId: string | null = null
    if (normalizedNewTeam !== 'None') {
      const { data: teamRecord } = await supabase
        .from('teams')
        .select('id')
        .ilike('name', normalizedNewTeam.trim())
        .maybeSingle()
      if (teamRecord) teamId = teamRecord.id
    }

    const cleanTeamValue = normalizedNewTeam === 'None' ? null : normalizedNewTeam
    const updatePayload: Record<string, any> = {
      team: cleanTeamValue,
      updated_at: new Date().toISOString(),
    }
    if (teamId) updatePayload.team_id = teamId

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
