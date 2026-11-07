import { redirect } from 'next/navigation'
import { ShieldCheck } from 'lucide-react'
import { PageBanner } from '@/components/shared/page-banner'
import { getMyPrivacyData } from '@/lib/dpdp/my-privacy'
import { getDpdpPublic } from '@/lib/dpdp/public-settings'
import { MyPrivacyView } from './_components/my-privacy-view'

export const dynamic = 'force-dynamic'

/** My Privacy: the person's own data, notice, consents, processors and requests (DPDP Act s. 11–14). */
export default async function MyPrivacyPage() {
  const [data, settings] = await Promise.all([getMyPrivacyData(), getDpdpPublic()])
  if (!data) redirect('/')

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 md:p-6 lg:p-8 max-w-6xl mx-auto w-full pb-20">
      <PageBanner
        title="My Privacy"
        description="What we hold about you, why, who it is shared with, and how to ask us to correct, erase or explain it."
        icon={<ShieldCheck className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />}
      />
      <MyPrivacyView data={data} settings={settings} />
    </div>
  )
}
