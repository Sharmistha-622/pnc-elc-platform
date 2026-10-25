import { requireFeature } from '@/lib/rbac/requireFeature'

// The candidate pipeline. Every screen under it carries CTC and identity
// documents, so it is gated here as well as in middleware.
export default async function Layout({ children }: { children: React.ReactNode }) {
  await requireFeature('onboarding')
  return <>{children}</>
}
