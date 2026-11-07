import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ShieldAlert } from 'lucide-react'
import { PageBanner } from '@/components/shared/page-banner'
import { getIncidentDetail } from '@/lib/dpdp/incidents/service'
import { formatIst } from '@/lib/dpdp/incidents/drafts'
import { IncidentWork } from '../../_components/incident-work'

export const dynamic = 'force-dynamic'

/** One incident: the deadlines, the reports made, what is known, and drafts. */
export default async function IncidentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const detail = await getIncidentDetail(id)
  if (!detail) notFound()
  const i = detail.incident
  return (
    <div className="flex flex-1 flex-col gap-6 p-4 md:p-6 lg:p-8 max-w-6xl mx-auto w-full pb-20">
      <Link href="/manage/privacy/incidents" className="text-xs text-indigo-700 hover:underline dark:text-indigo-300">← All incidents</Link>
      <PageBanner
        title={`${i.reference} · ${i.title}`}
        description={`Noticed ${formatIst(i.detected_at)} · recorded by ${i.recorded_by} · ${i.status}`}
        icon={<ShieldAlert className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />}
      />
      <IncidentWork detail={detail} />
    </div>
  )
}
