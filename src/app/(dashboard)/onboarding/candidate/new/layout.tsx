import { requireFeature } from '@/lib/rbac/requireFeature'

// The new-candidate form takes the CTC. Narrower than the pipeline itself:
// PnC Ops works candidates through it but does not make offers.
export default async function Layout({ children }: { children: React.ReactNode }) {
  await requireFeature('offers')
  return <>{children}</>
}
