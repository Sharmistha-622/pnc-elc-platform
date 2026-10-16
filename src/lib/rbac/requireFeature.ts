import { redirect } from 'next/navigation'
import { getCurrentUserRole } from '@/lib/rbac/getCurrentUserRole'
import { FEATURE_ACCESS, type Feature } from '@/lib/role-constants'

/**
 * Gate a page on a feature, and hand back the resolved role.
 *
 * Returns the whole resolution rather than just the effective role: a screen
 * that grants or revokes needs `originalRole`, because an emulated role must
 * never widen what someone can do.
 */
export async function requireFeature(feature: Feature) {
  const resolved = await getCurrentUserRole()
  if (!resolved.userId) redirect('/login')
  if (!resolved.role || !FEATURE_ACCESS[feature].includes(resolved.role)) redirect('/')
  return resolved
}
