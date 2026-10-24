import { requireFeature } from '@/lib/rbac/requireFeature'

// The shadcn component gallery. Not linked from the nav; platform-only.
export default async function Layout({ children }: { children: React.ReactNode }) {
  await requireFeature('manageUsers')
  return <>{children}</>
}
