import { getBreakGlassSetting } from '@/lib/settings/breakGlass'
import { BREAK_GLASS_EMAILS } from '@/lib/rbac/breakGlass'
import { BreakGlassToggle } from './break-glass-toggle'
import { ShieldAlert } from 'lucide-react'

export const dynamic = 'force-dynamic'

/**
 * Settings only a Super Admin may see or change. The settings layout admits
 * `platformConfig`; this page narrows it to Super Admin, and the actions
 * behind it check again.
 */
export default async function SuperAdminSettingsPage() {
  const setting = await getBreakGlassSetting()

  if (!setting.success) {
    return (
      <div className="rounded-lg border border-border bg-card/60 backdrop-blur-sm p-8 text-center space-y-3">
        <div className="size-10 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto border border-amber-500/20">
          <ShieldAlert className="size-5" />
        </div>
        <div className="space-y-1">
          <p className="text-sm font-semibold text-foreground">Super Admin Access Required</p>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto">
            You do not hold the required Super Admin privileges to view or modify emergency governance overrides.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <BreakGlassToggle initialEnabled={setting.enabled} accounts={[...BREAK_GLASS_EMAILS]} />
    </div>
  )
}
