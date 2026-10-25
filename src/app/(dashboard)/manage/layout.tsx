import { redirect } from 'next/navigation'
import { getCurrentUserRole } from '@/lib/rbac/getCurrentUserRole'

/**
 * `/manage` is a navigation grouping, not a permission boundary: the letter,
 * signatory and onboarding screens live under it but belong to other
 * features. Each subtree carries its own `requireFeature` layout instead.
 *
 * This used to re-check the route map against an `x-pathname` header from
 * middleware. Middleware set it on the response, and `headers()` reads the
 * request, so the check never ran. A gate that silently passes is worse than
 * none, so it is gone; `layout-gates.test.ts` now fails if a page under
 * `(dashboard)` has no gate above it.
 */
export default async function Layout({ children }: { children: React.ReactNode }) {
  const { role } = await getCurrentUserRole()
  if (!role) redirect('/login')
  return <>{children}</>
}
