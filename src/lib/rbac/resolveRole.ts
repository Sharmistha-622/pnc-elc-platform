import type { User } from '@supabase/supabase-js'
import { DEFAULT_ROLE, normalizeRole, type UserRole } from '@/lib/role-constants'
import { canImpersonate } from '@/lib/rbac/roles'

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

  // Roles stored before RBAC v1 are still display names; normalizeRole maps
  // them forward so a user is never locked out mid-migration.
  const storedRole = normalizeRole(user.app_metadata?.role)
  const originalRole: UserRole = isImmutableSuperAdmin ? 'super_admin' : (storedRole ?? DEFAULT_ROLE)

  // Impersonation is bounded by rank within a group; `canImpersonate` is the
  // single place that decides, so the override cookie can never widen access.
  const requested = normalizeRole(devRoleOverride)
  const mayEmulate = requested !== null && canImpersonate(originalRole, requested)
  const effectiveRole: UserRole = mayEmulate ? requested : originalRole

  return {
    userId: user.id,
    email: user.email ?? null,
    role: effectiveRole,
    originalRole,
    isEmulating: mayEmulate,
  }
}
