import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { getCurrentUserRole } from '@/lib/rbac/getCurrentUserRole'
import { canAccessRoute } from '@/lib/role-constants'

/**
 * `/manage` is a navigation grouping, not a permission boundary: the letter,
 * signatory and onboarding screens live under it but belong to the onboarding
 * feature. Gating the whole subtree on `manageUsers` would lock P&C out of the
 * offer letters they write.
 *
 * So this re-applies the same longest-prefix route map the middleware uses,
 * against the path the middleware passes down — defence in depth, without
 * pretending every page here is a user-management page.
 */
export default async function Layout({ children }: { children: React.ReactNode }) {
  const pathname = (await headers()).get('x-pathname')
  const { role } = await getCurrentUserRole()

  if (!role) redirect('/login')
  if (pathname && !canAccessRoute(role, pathname)) redirect('/')

  return <>{children}</>
}
