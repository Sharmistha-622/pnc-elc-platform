import type { SupabaseClient, User } from '@supabase/supabase-js'
import { createAdminSupabaseClient } from '@/lib/supabase/admin'
import { IMMUTABLE_SUPER_ADMIN_EMAILS } from '@/lib/rbac/resolveRole'
import { accessEndedAt, CLEARED_PRE_EXIT_MARKERS } from '@/lib/rbac/lifecycle'
import { normalizeRole } from '@/lib/role-constants'

// ============================================================================
// Ending platform access at exit
// ----------------------------------------------------------------------------
// Server-only, and deliberately not a server action: it writes auth users with
// the service-role client, so it is called only from actions that have already
// passed their own guard (`closeOffboardingCase`, `restorePlatformAccess`), or
// from the pre-exit job behind the cron secret (`runPreExitRoleEnding`).
//
// Ending access does three things to the auth user, in one write:
//   - removes the stored role;
//   - sets `app_metadata.access_ended_at`, which `resolveRole` and
//     `current_app_role()` both read as "no role at all" (an org account with
//     no stored role would otherwise fall back to `employee`);
//   - bans the account, so its refresh tokens stop working and a session that
//     predates the exit cannot be renewed.
// ============================================================================

/** Long enough to mean "until restored": Supabase takes a duration, not a date. */
export const ENDED_BAN_DURATION = '876000h'

export type AccessChangeResult =
  | { ok: true; userId: string | null }
  | { ok: false; error: string }

/** Finds an auth user by email, page by page. Null when there is none. */
export async function findAuthUserByEmail(admin: SupabaseClient, email: string): Promise<User | null> {
  const target = email.trim().toLowerCase()
  const perPage = 200
  for (let page = 1; page <= 50; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage })
    if (error) throw new Error('Could not list accounts')
    const users = data?.users ?? []
    const found = users.find((u) => u.email?.toLowerCase() === target)
    if (found) return found
    if (users.length < perPage) return null
  }
  return null
}

/**
 * Ends the platform access of the account with this email.
 *
 * Idempotent: an account already ended is left as it is. A person with no
 * auth account has nothing to end and succeeds with `userId: null` — the
 * database still refuses them through their `exited` employee record.
 */
export async function endPlatformAccess(
  email: string | null | undefined,
  options: { endedBy: string; now: Date },
): Promise<AccessChangeResult> {
  if (!email) return { ok: false, error: 'No email on the employee record, so no account to close.' }
  if (IMMUTABLE_SUPER_ADMIN_EMAILS.includes(email.trim().toLowerCase())) {
    return { ok: false, error: 'The owner account cannot be closed through an exit.' }
  }

  const admin = createAdminSupabaseClient()
  if (!admin) return { ok: false, error: 'Account changes are unavailable: no service-role key.' }

  let user: User | null
  try {
    user = await findAuthUserByEmail(admin, email)
  } catch {
    return { ok: false, error: 'Could not look up the account.' }
  }
  if (!user) return { ok: true, userId: null }
  if (accessEndedAt(user.app_metadata)) return { ok: true, userId: user.id }

  const { error } = await admin.auth.admin.updateUserById(user.id, {
    app_metadata: {
      ...user.app_metadata,
      role: null,
      access_ended_at: options.now.toISOString(),
      access_ended_by: options.endedBy,
    },
    ban_duration: ENDED_BAN_DURATION,
  })
  if (error) return { ok: false, error: 'Could not close the account.' }
  return { ok: true, userId: user.id }
}

/**
 * Re-opens an account whose access was ended: clears the marker and lifts the
 * ban. The role is not restored — whoever re-opens it assigns one on the users
 * screen, and the `employee` baseline applies until then.
 */
export async function reopenPlatformAccess(userId: string): Promise<AccessChangeResult> {
  const admin = createAdminSupabaseClient()
  if (!admin) return { ok: false, error: 'Account changes are unavailable: no service-role key.' }

  const { data, error: lookupError } = await admin.auth.admin.getUserById(userId)
  if (lookupError || !data?.user) return { ok: false, error: 'User not found' }
  if (!accessEndedAt(data.user.app_metadata)) return { ok: true, userId }

  const { error } = await admin.auth.admin.updateUserById(userId, {
    app_metadata: {
      ...data.user.app_metadata,
      access_ended_at: null,
      access_ended_by: null,
      ...CLEARED_PRE_EXIT_MARKERS,
    },
    ban_duration: 'none',
  })
  if (error) return { ok: false, error: 'Could not re-open the account.' }
  return { ok: true, userId }
}

// ============================================================================
// Ending the stored role before exit
// ----------------------------------------------------------------------------
// 72 hours before the last working day (`isPreExitRoleDue`), a leaver's stored
// role goes and they drop to the `employee` baseline: still signed in, still
// able to finish their handover, without the powers of a granted role. The
// account is not banned and `access_ended_at` is not set; closing the exit
// does both.
//
// The previous role is kept in `app_metadata.role_before_exit`, so whoever
// gives it back after a cancelled exit knows what it was. Setting a role by
// hand clears both markers.
// ============================================================================

export type PreExitRoleOutcome =
  | 'ended' // the stored role was removed
  | 'no_stored_role' // nothing above the `employee` baseline to remove
  | 'no_account' // never signed in, so nothing is stored
  | 'access_ended' // the exit has already closed the account
  | 'owner' // the owner keeps their role by identity

export type PreExitRoleResult =
  | { ok: true; outcome: PreExitRoleOutcome; userId: string | null; previousRole: string | null }
  | { ok: false; error: string }

/**
 * Removes the stored role of the account with this email, ahead of its exit.
 *
 * Idempotent: an account with no stored role (or only `employee`) is left as
 * it is, so running it every day changes nothing until someone puts a role
 * back, and then removes that one too.
 */
export async function endRoleBeforeExit(
  email: string | null | undefined,
  options: { now: Date },
): Promise<PreExitRoleResult> {
  if (!email) return { ok: false, error: 'No email on the employee record, so no account to change.' }
  if (IMMUTABLE_SUPER_ADMIN_EMAILS.includes(email.trim().toLowerCase())) {
    return { ok: true, outcome: 'owner', userId: null, previousRole: null }
  }

  const admin = createAdminSupabaseClient()
  if (!admin) return { ok: false, error: 'Account changes are unavailable: no service-role key.' }

  let user: User | null
  try {
    user = await findAuthUserByEmail(admin, email)
  } catch {
    return { ok: false, error: 'Could not look up the account.' }
  }
  if (!user) return { ok: true, outcome: 'no_account', userId: null, previousRole: null }
  if (accessEndedAt(user.app_metadata)) {
    return { ok: true, outcome: 'access_ended', userId: user.id, previousRole: null }
  }

  const stored = user.app_metadata?.role
  const storedRole = typeof stored === 'string' ? stored.trim() : ''
  // Legacy names ('Viewer', 'Member'…) that mean `employee` are left alone too.
  if (storedRole === '' || normalizeRole(storedRole) === 'employee') {
    return { ok: true, outcome: 'no_stored_role', userId: user.id, previousRole: null }
  }

  const { error } = await admin.auth.admin.updateUserById(user.id, {
    app_metadata: {
      ...user.app_metadata,
      role: null,
      role_before_exit: storedRole,
      role_ended_before_exit_at: options.now.toISOString(),
    },
  })
  if (error) return { ok: false, error: 'Could not remove the role.' }
  return { ok: true, outcome: 'ended', userId: user.id, previousRole: storedRole }
}
