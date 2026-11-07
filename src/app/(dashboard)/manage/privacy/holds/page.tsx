import { redirect } from 'next/navigation'
import { Scale } from 'lucide-react'
import { PageBanner } from '@/components/shared/page-banner'
import { getHoldsPageData } from '@/lib/dpdp/holds/queries'
import { isoDate } from '@/lib/dpdp/dates'
import { LegalHolds } from '../_components/legal-holds'

export const dynamic = 'force-dynamic'

/** Legal holds: people or records whose retention is paused (DPDP Act s. 17(1)(a)). */
export default async function LegalHoldsPage() {
  const data = await getHoldsPageData()
  if (!data) redirect('/')
  return (
    <div className="flex flex-1 flex-col gap-6 p-4 md:p-6 lg:p-8 max-w-6xl mx-auto w-full pb-20">
      <PageBanner
        title="Legal holds"
        description="A hold pauses every retention rule for its person or record until it is released. Review each hold by its date."
        icon={<Scale className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />}
      />
      <LegalHolds data={data} today={isoDate(new Date())} />
    </div>
  )
}
