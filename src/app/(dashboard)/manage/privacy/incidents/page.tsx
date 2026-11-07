import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ShieldAlert } from 'lucide-react'
import { PageBanner } from '@/components/shared/page-banner'
import { Badge } from '@/components/ui/badge'
import { listIncidents } from '@/lib/dpdp/incidents/service'
import { formatIst } from '@/lib/dpdp/incidents/drafts'
import { BOARD_DETAILED_REPORT_HOURS, CERT_IN_REPORT_HOURS } from '@/lib/dpdp/constants'
import { IncidentCountdown } from '../_components/incident-countdown'
import { RecordIncident } from '../_components/record-incident'

export const dynamic = 'force-dynamic'

/** The incident register, newest first, with the CERT-In and Board countdowns. */
export default async function IncidentsPage() {
  const incidents = await listIncidents()
  if (!incidents) redirect('/')
  const open = incidents.filter((i) => i.status !== 'closed').length
  return (
    <div className="flex flex-1 flex-col gap-6 p-4 md:p-6 lg:p-8 max-w-6xl mx-auto w-full pb-20">
      <PageBanner
        title="Incidents"
        description={`${open} open. CERT-In within ${CERT_IN_REPORT_HOURS.value} h of noticing a cyber incident; the Board's detailed report within ${BOARD_DETAILED_REPORT_HOURS.value} h of a personal data breach. Messages are drafted here and sent by you.`}
        icon={<ShieldAlert className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />}
      />
      <RecordIncident />
      <div className="overflow-x-auto rounded-xl border border-border bg-card">
        <table className="w-full text-xs">
          <thead className="bg-muted/40 text-left text-muted-foreground">
            <tr>
              <th className="p-2 font-medium">Reference</th>
              <th className="p-2 font-medium">Incident</th>
              <th className="p-2 font-medium">Noticed</th>
              <th className="p-2 font-medium">Status</th>
              <th className="p-2 font-medium">CERT-In ({CERT_IN_REPORT_HOURS.value} h)</th>
              <th className="p-2 font-medium">Board report ({BOARD_DETAILED_REPORT_HOURS.value} h)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {incidents.length === 0 && <tr><td colSpan={6} className="p-4 text-center text-muted-foreground">No incidents recorded.</td></tr>}
            {incidents.map((i) => (
              <tr key={i.id}>
                <td className="p-2 font-mono"><Link href={`/manage/privacy/incidents/${i.id}`} className="text-indigo-700 hover:underline dark:text-indigo-300">{i.reference}</Link></td>
                <td className="p-2">{i.title}<span className="block text-[10px] capitalize text-muted-foreground">{i.severity}</span></td>
                <td className="p-2">{formatIst(i.detected_at)}</td>
                <td className="p-2"><Badge variant="outline" className="text-[10px] capitalize">{i.status}</Badge></td>
                <td className="p-2"><IncidentCountdown due={i.certin_due_at} done={i.certin_reported_at} windowHours={CERT_IN_REPORT_HOURS.value} /></td>
                <td className="p-2"><IncidentCountdown due={i.board_report_due_at} done={i.board_report_at} windowHours={BOARD_DETAILED_REPORT_HOURS.value} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
