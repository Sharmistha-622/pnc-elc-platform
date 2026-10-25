import { requireFeature } from '@/lib/rbac/requireFeature'
import { SettingsShell } from './settings-shell'

// The shell is a client component (it tracks the active tab), and a client
// layout cannot gate. So the gate lives here and the shell renders inside it.
export default async function Layout({ children }: { children: React.ReactNode }) {
  await requireFeature('platformConfig')
  return <SettingsShell>{children}</SettingsShell>
}
