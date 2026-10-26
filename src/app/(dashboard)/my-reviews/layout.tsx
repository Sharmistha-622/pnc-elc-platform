import { requireFeature } from '@/lib/rbac/requireFeature'

// Everyone's own reviews, and a line manager's reports' — whatever role the
// manager holds. What is in the page comes from the data layer, scoped by the
// session (`getMyReviews`, `getCycleDetail`).
export default async function Layout({ children }: { children: React.ReactNode }) {
  await requireFeature('self')
  return <>{children}</>
}
