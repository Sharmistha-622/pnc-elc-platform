'use server'

import { revalidatePath } from 'next/cache'
import { guard } from '@/lib/rbac/guard'
import { reopenPlatformAccess } from '@/lib/rbac/endPlatformAccess'
import { auditEvent } from '@/lib/audit/events'
import { createAdminSupabaseClient } from '@/lib/supabase/admin'

/**
 * Re-opens an account whose platform access ended at exit — a re-hire, or an
 * exit closed by mistake. Super Admin only: it is the one way back from an
 * exit, so it sits with the role that grants every sensitive role.
 */
export async function restorePlatformAccess(userId: string) {
  const allowed = await guard(['super_admin'])
  if (!allowed.ok) return { success: false, error: allowed.error }
  if (typeof userId !== 'string' || userId.trim() === '') {
    return { success: false, error: 'Invalid user' }
  }

  const result = await reopenPlatformAccess(userId)
  if (!result.ok) return { success: false, error: result.error }

  const admin = createAdminSupabaseClient()
  const { data } = admin ? await admin.auth.admin.getUserById(userId) : { data: null }
  const email = data?.user?.email ?? null
  await auditEvent('access', 'access.restored', 'Platform access re-opened.', {
    subject: { employee_id: null, employee_email: email, employee_name: null },
    actorName: allowed.caller.email,
    actorEmail: allowed.caller.email,
    entityType: 'user',
    entityId: userId,
    severity: 'warning',
  })

  revalidatePath('/manage/users')
  return { success: true }
}
