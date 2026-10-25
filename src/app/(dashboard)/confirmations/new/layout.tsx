import { requireFeature } from '@/lib/rbac/requireFeature'

// Starting a confirmation. Narrower than reading them: Exec View may read
// the pipeline but not start one.
export default async function Layout({ children }: { children: React.ReactNode }) {
  await requireFeature('confirmationsInitiate')
  return <>{children}</>
}
