import { requireFeature } from '@/lib/rbac/requireFeature'

// My Privacy: every staff member, for their own data only. The page reads the
// caller's own records, resolved from the session.
export default async function Layout({ children }: { children: React.ReactNode }) {
  await requireFeature('myPrivacy')
  return <>{children}</>
}
