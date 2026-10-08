import { requireFeature } from '@/lib/rbac/requireFeature'

export default async function Layout({ children }: { children: React.ReactNode }) {
  await requireFeature('manageUsers')
  return <>{children}</>
}
