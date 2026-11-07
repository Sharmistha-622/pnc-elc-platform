import { requireFeature } from '@/lib/rbac/requireFeature'

// Privacy cases: rights requests, incidents and legal holds. These hold
// people's personal data, so only Super Admin and PnC Admin (`privacyCases`).
export default async function Layout({ children }: { children: React.ReactNode }) {
  await requireFeature('privacyCases')
  return <>{children}</>
}
