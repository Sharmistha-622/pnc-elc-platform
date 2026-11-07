import { getCurrentUserRole } from '@/lib/rbac/getCurrentUserRole'
import { FEATURE_ACCESS, type Feature } from '@/lib/role-constants'
import { SettingsShell } from './settings-shell'

// The settings shell. It gates nothing itself: each tab's route group does
// (`(platform)/layout.tsx` for the platform tabs, `dpdp/layout.tsx` for DPDP &
// Privacy), and middleware maps each prefix. It only decides which tabs to
// show, from the same feature lists.
export default async function Layout({ children }: { children: React.ReactNode }) {
  const { role, originalRole } = await getCurrentUserRole()
  const reaches = (feature: Feature) =>
    !!role && !!originalRole && FEATURE_ACCESS[feature].includes(role) && FEATURE_ACCESS[feature].includes(originalRole)

  return (
    <SettingsShell canSeePlatform={reaches('platformConfig')} canSeePrivacy={reaches('privacy')}>
      {children}
    </SettingsShell>
  )
}
