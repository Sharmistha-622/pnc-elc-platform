import { getSettingsChangeLog } from '@/lib/settings/service'
import { AuditTable } from './audit-table'

export const dynamic = 'force-dynamic'

export default async function SettingsAuditPage() {
  const changeLogs = await getSettingsChangeLog(100)

  return (
    <div className="space-y-6">
      <AuditTable initialLogs={changeLogs} />
    </div>
  )
}
