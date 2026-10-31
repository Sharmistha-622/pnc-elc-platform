import { ROLE_CODES, type RoleCode } from '@/lib/rbac/roles'

// ============================================================================
// Break-glass access to roles and departments
// ----------------------------------------------------------------------------
// Two named people can always reach the users screen and change anyone's role
// or department, their own included, so a mis-set role can never lock the
// platform's operators out of it. This is a stopgap: the accounts are listed
// here until there is a proper way to nominate them.
//
// What it never reaches is Super Admin. A break-glass account cannot grant it,
// and cannot change anything about someone who holds it.
//
// A Super Admin can turn the whole thing off under Settings → Super Admin. It
// is on by default. This file is the rules only (pure, so the middleware and
// the client can use it); `breakGlassAccess.ts` reads the switch.
// ============================================================================

export const BREAK_GLASS_EMAILS: readonly string[] = [
  'sharmishtha@navgurukul.org',
  'kartik.t@navgurukul.org',
]

/** The screen break-glass opens, and the only one. */
export const BREAK_GLASS_ROUTE = '/manage/users'

/**
 * Roles a break-glass account may put anyone into.
 *
 * Everything but Super Admin, and but the two portal roles: a candidate or
 * pre-joiner is tied to an onboarding token, and a staff account set to either
 * would be sent to the portal notice instead of the dashboard.
 */
export const BREAK_GLASS_GRANTABLE_ROLES: readonly RoleCode[] = ROLE_CODES.filter(
  (code) => code !== 'super_admin' && code !== 'candidate' && code !== 'pre_joiner'
)

export function isBreakGlassEmail(email: string | null | undefined): boolean {
  if (!email) return false
  return BREAK_GLASS_EMAILS.includes(email.trim().toLowerCase())
}

/** Whether a path is the break-glass screen (or a server action posted to it). */
export function isBreakGlassRoute(pathname: string): boolean {
  return pathname === BREAK_GLASS_ROUTE || pathname.startsWith(`${BREAK_GLASS_ROUTE}/`)
}

export type BreakGlassDecision =
  | { ok: true }
  | { ok: false; reason: 'target_is_super_admin' | 'role_not_allowed' }

/**
 * Whether a break-glass account may move someone from `currentRole` to
 * `newRole`. Pass `newRole === currentRole` for a department-only change.
 * Self is allowed: changing their own role is the point.
 */
export function canBreakGlassChange(currentRole: RoleCode, newRole: RoleCode): BreakGlassDecision {
  if (currentRole === 'super_admin') return { ok: false, reason: 'target_is_super_admin' }
  if (newRole !== currentRole && !BREAK_GLASS_GRANTABLE_ROLES.includes(newRole)) {
    return { ok: false, reason: 'role_not_allowed' }
  }
  return { ok: true }
}

export const BREAK_GLASS_REFUSALS: Record<Exclude<BreakGlassDecision, { ok: true }>['reason'], string> = {
  target_is_super_admin: 'Break-glass access cannot change a Super Admin.',
  role_not_allowed: 'Break-glass access cannot grant that role.',
}
