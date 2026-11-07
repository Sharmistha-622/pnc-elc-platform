import { redirect } from 'next/navigation'
import { getDpdpSettingsBundle } from '@/lib/dpdp/settings/queries'
import { privacyEditRefusal } from '@/lib/dpdp/access'
import { getCurrentUserRole } from '@/lib/rbac/getCurrentUserRole'
import { isoDate } from '@/lib/dpdp/dates'
import { DpdpSettings } from './_components/dpdp-settings'
import { CheckerTab } from './_components/checker-tab'
import { RetentionStatusPanel } from './_components/retention-status'

export const dynamic = 'force-dynamic'

/**
 * Settings → DPDP & Privacy. Gated by `privacy` in the layout; the bundle
 * read checks again, and every write checks `privacyEdit` for itself.
 */
export default async function DpdpSettingsPage() {
  const bundle = await getDpdpSettingsBundle()
  if (!bundle) redirect('/')

  const [refusal, { role, originalRole }] = await Promise.all([privacyEditRefusal(), getCurrentUserRole()])
  const isSuperAdmin = role === 'super_admin' && originalRole === 'super_admin'

  return (
    <DpdpSettings
      bundle={bundle}
      canEdit={refusal === null}
      isSuperAdmin={isSuperAdmin}
      today={isoDate(new Date())}
      checker={<CheckerTab />}
      holds={<RetentionStatusPanel />}
    />
  )
}
