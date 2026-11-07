import { redirect } from 'next/navigation'
import { getBreakGlassSetting } from '@/lib/settings/breakGlass'
import { BREAK_GLASS_EMAILS } from '@/lib/rbac/breakGlass'
import { BreakGlassToggle } from './break-glass-toggle'

export const dynamic = 'force-dynamic'

/**
 * Settings only a Super Admin may see or change. The settings layout admits
 * `platformConfig`; this page narrows it to Super Admin, and the actions
 * behind it check again.
 */
export default async function SuperAdminSettingsPage() {
  const setting = await getBreakGlassSetting()
  if (!setting.success) redirect('/manage/settings')

  return (
    <div className="space-y-6">
      <BreakGlassToggle initialEnabled={setting.enabled} accounts={[...BREAK_GLASS_EMAILS]} />
    </div>
  )
}
