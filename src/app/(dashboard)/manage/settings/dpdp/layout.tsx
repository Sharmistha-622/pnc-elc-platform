import { requireFeature } from '@/lib/rbac/requireFeature'

// DPDP & Privacy: configuration and counts. Read by `privacy`; every write
// checks `privacyEditRefusal()` (src/lib/dpdp/access.ts) for itself.
export default async function Layout({ children }: { children: React.ReactNode }) {
  await requireFeature('privacy')
  return <>{children}</>
}
