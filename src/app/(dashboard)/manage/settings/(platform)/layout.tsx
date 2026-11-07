import { requireFeature } from '@/lib/rbac/requireFeature'

// The platform settings tabs. PnC Admin reaches them read-only; the writes
// check `platformConfigRefusal()` (src/lib/settings/access.ts).
export default async function Layout({ children }: { children: React.ReactNode }) {
  await requireFeature('platformConfig')
  return <>{children}</>
}
