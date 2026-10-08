'use server'

import { revalidatePath } from 'next/cache'
import { createAdminSupabaseClient } from '@/lib/supabase/admin'
import { getCurrentUserRole } from '@/lib/rbac/getCurrentUserRole'
import { ASSIGNABLE_ROLES, type UserRole } from '@/lib/role-constants'

export async function setUserRole(targetUserId: string, role: UserRole) {
  const caller = await getCurrentUserRole()
  const isSuper = caller.role === 'Super Admin'
  if (!isSuper && caller.role !== 'Admin') return { success: false, error: 'Not allowed' }
  if (!ASSIGNABLE_ROLES.includes(role)) return { success: false, error: 'Invalid role' }
  if (targetUserId === caller.userId) return { success: false, error: "You can't change your own role" }

  const admin = createAdminSupabaseClient()
  const { data: target, error: lookupError } = await admin.auth.admin.getUserById(targetUserId)
  if (lookupError || !target.user) return { success: false, error: 'User not found' }

  const targetRole = target.user.app_metadata?.role as UserRole | undefined
  const touchesAdmin =
    role === 'Super Admin' || role === 'Admin' ||
    targetRole === 'Super Admin' || targetRole === 'Admin'
  if (touchesAdmin && !isSuper) {
    return { success: false, error: 'Only a Super Admin can change admin roles' }
  }

  const { error } = await admin.auth.admin.updateUserById(targetUserId, {
    app_metadata: { ...target.user.app_metadata, role },
  })
  if (error) return { success: false, error: error.message }

  revalidatePath('/manage/roles')
  return { success: true }
}
