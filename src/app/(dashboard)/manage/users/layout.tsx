import { requireFeatureOrBreakGlass } from '@/lib/rbac/breakGlassAccess'

// `manageUsers`, plus the break-glass accounts while the Super Admin switch is
// on (src/lib/rbac/breakGlass.ts).
export default async function Layout({ children }: { children: React.ReactNode }) {
  await requireFeatureOrBreakGlass('manageUsers')
  return <>{children}</>
}
