import type { User } from '@supabase/supabase-js'
import type { UserRole } from '@/lib/role-constants'
import { DEFAULT_ROLE } from '@/lib/role-constants'

export const IMMUTABLE_SUPER_ADMIN_EMAILS = ['nitin@navgurukul.org']

export interface ResolvedRole {
  userId: string | null
  email: string | null
  role: UserRole | null
  originalRole: UserRole | null
  isEmulating: boolean
}

/**
 * Resolves the role for a Supabase user.
 *
 * Shared by `getCurrentUserRole` (server components, server actions) and the
 * middleware so both answer identically — a gate that disagrees with the page
 * it guards is worse than no gate.
 *
 * A null user resolves to a null role. Callers must treat that as "deny".
 */
export function resolveRole(
  user: User | null,
  devRoleOverride?: string | null
): ResolvedRole {
  if (!user) {
    return { userId: null, email: null, role: null, originalRole: null, isEmulating: false }
  }

  const email = user.email?.toLowerCase() ?? null
  const isImmutableSuperAdmin = email ? IMMUTABLE_SUPER_ADMIN_EMAILS.includes(email) : false

  const rawRole = (user.app_metadata?.role as UserRole | undefined) ?? null
  const originalRole: UserRole = isImmutableSuperAdmin ? 'Super Admin' : (rawRole || DEFAULT_ROLE)

  // Only admin-style roles may emulate another role, and emulation can never
  // widen access — the override is applied on top of an already-admin session.
  const isAdminActor = originalRole === 'Super Admin' || originalRole === 'Admin'
  const override = devRoleOverride as UserRole | undefined
  const effectiveRole: UserRole = isAdminActor && override ? override : originalRole

  return {
    userId: user.id,
    email: user.email ?? null,
    role: effectiveRole,
    originalRole,
    isEmulating: Boolean(isAdminActor && override && override !== originalRole),
  }
}
