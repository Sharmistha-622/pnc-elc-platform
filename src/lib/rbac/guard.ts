import { getCurrentUserRole } from '@/lib/rbac/getCurrentUserRole'
import type { ResolvedRole } from '@/lib/rbac/resolveRole'
import { canRead, canWrite, type Resource } from '@/lib/rbac/roles'
import { FEATURE_ACCESS, type Feature, type UserRole } from '@/lib/role-constants'

// ============================================================================
// Server-side guards for server actions and route handlers.
// ----------------------------------------------------------------------------
// A file marked 'use server' exports functions the browser can call directly,
// with any arguments, regardless of which page imported them. Hiding a button
// does not protect one; the first lines of the function do. Every exported
// action that reads or writes someone else's data starts with one of these.
//
// Both the effective and the original role must pass. Emulation exists to see
// less, never more, so a Super Admin viewing the app as Manager is refused
// exactly what a real Manager would be — and a Manager cannot reach further by
// setting the override cookie, because their original role is checked too.
// ============================================================================

/** Who may proceed: a feature from the matrix, or an explicit list of roles. */
export type Allowed = Feature | readonly UserRole[]

export type Guarded = ResolvedRole & { role: UserRole; originalRole: UserRole; userId: string }

export type GuardResult = { ok: true; caller: Guarded } | { ok: false; error: string }

const REFUSED = 'You do not have access to do that.'

function roles(allowed: Allowed): readonly UserRole[] {
  return typeof allowed === 'string' ? FEATURE_ACCESS[allowed] : allowed
}

/** Pure, for tests: does this resolution pass? */
export function passes(resolved: ResolvedRole, allowed: Allowed): resolved is Guarded {
  if (!resolved.userId || !resolved.role || !resolved.originalRole) return false
  const list = roles(allowed)
  return list.includes(resolved.role) && list.includes(resolved.originalRole)
}

/**
 * The caller, if they may proceed; otherwise a refusal to return as-is.
 *
 * Returned rather than thrown: actions are called inside `startTransition`,
 * where a throw replaces the page with the error boundary. Callers whose
 * contract is "null on failure" return null on `!ok` instead.
 */
export async function guard(allowed: Allowed): Promise<GuardResult> {
  const resolved = await getCurrentUserRole()
  if (!passes(resolved, allowed)) return { ok: false, error: REFUSED }
  return { ok: true, caller: resolved }
}

/** Like `guard`, but requires the matrix to grant the resource at `level`. */
export async function guardResource(resource: Resource, level: 'view' | 'edit'): Promise<GuardResult> {
  const resolved = await getCurrentUserRole()
  const check = level === 'edit' ? canWrite : canRead
  if (
    !resolved.userId ||
    !resolved.role ||
    !resolved.originalRole ||
    !check(resolved.role, resource) ||
    !check(resolved.originalRole, resource)
  ) {
    return { ok: false, error: REFUSED }
  }
  return { ok: true, caller: resolved as Guarded }
}

/** True when the caller may see salary figures at all, through any route. */
export function maySeeSalary(caller: Pick<Guarded, 'role' | 'originalRole'>): boolean {
  return canRead(caller.role, 'salary') && canRead(caller.originalRole, 'salary')
}
