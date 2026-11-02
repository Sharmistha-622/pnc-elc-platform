import { passes } from '@/lib/rbac/guard'
import type { ResolvedRole } from '@/lib/rbac/resolveRole'

/**
 * Where a reader opens a review cycle. The org-wide dashboard (`/reviews`) is
 * for the roles with `reviews`; everyone else, a line manager included, opens
 * it from My Reviews, which is scoped to their own cycles and their reports'.
 * Both the effective and the original role must allow `/reviews`, so emulating
 * a role never widens where the link goes.
 */
export function cycleHref(resolved: ResolvedRole, cycleId: string): string {
  return passes(resolved, 'reviews') ? `/reviews/${cycleId}` : `/my-reviews/${cycleId}`
}
