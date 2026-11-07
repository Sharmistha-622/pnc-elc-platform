import { redirect } from 'next/navigation'
import { Users } from 'lucide-react'
import { PageBanner } from '@/components/shared/page-banner'
import { getGuardianQueue } from '@/lib/dpdp/guardian-consent/queries'
import { GuardianQueue } from '../_components/guardian-queue'

export const dynamic = 'force-dynamic'

/** Joiners under 18, waiting in the portal for a guardian's consent (DPDP Act s. 9; Rules r. 10). */
export default async function GuardianConsentPage() {
  const queue = await getGuardianQueue()
  if (!queue) redirect('/')
  return (
    <div className="flex flex-1 flex-col gap-6 p-4 md:p-6 lg:p-8 max-w-6xl mx-auto w-full pb-20">
      <PageBanner
        title="Guardian consent"
        description={`${queue.waiting.length} waiting · ${queue.given} recorded. A joiner under 18 can read the notice and contact us, and nothing more, until a guardian's verified consent is recorded here.`}
        icon={<Users className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />}
      />
      <GuardianQueue waiting={queue.waiting} methods={queue.methods} />
    </div>
  )
}
