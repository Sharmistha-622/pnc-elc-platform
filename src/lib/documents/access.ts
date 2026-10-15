import type { UserRole } from '@/lib/role-constants'

// Only these roles may view or upload employee documents. Checked against the
// user's real role (originalRole), never the dev override cookie.
export const DOCUMENT_ROLES: UserRole[] = ['Super Admin', 'Admin', 'PnC']

export function canHandleDocuments(role: UserRole | null): boolean {
  return role !== null && DOCUMENT_ROLES.includes(role)
}
