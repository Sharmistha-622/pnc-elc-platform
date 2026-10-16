import { canReach } from '@/lib/rbac/roles'
import type { UserRole } from '@/lib/role-constants'

/**
 * Who may view or upload employee documents.
 *
 * Derived from the matrix rather than listed by hand: a role can handle
 * documents if it has write access to the identity column. Checked against the
 * user's real role (originalRole), never the dev override cookie.
 *
 * Note: which side of the core/vault line ID documents sit on is open decision
 * #1 in docs/rbac.md. Until it is settled this permits the same people the
 * matrix does, and no more.
 */
export function canHandleDocuments(role: UserRole | null): boolean {
  if (!role) return false
  const reach = canReach(role, 'identity')
  return reach.ok && reach.access.level === 'edit' && reach.access.scope === 'all'
}

/** Kept for display; the check above is the authority. */
export const DOCUMENT_ROLES: UserRole[] = ['super_admin', 'pnc_admin', 'pnc_ops']
