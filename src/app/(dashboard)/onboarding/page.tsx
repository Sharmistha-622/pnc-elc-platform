import { Compass, History, UserPlus } from 'lucide-react'
import Link from 'next/link'

import { OnboardingHub } from '@/app/(dashboard)/onboarding/_components/OnboardingHub'
import { PageBanner } from '@/components/shared/page-banner'
import { Button } from '@/components/ui/button'
import { requireFeature } from '@/lib/rbac/requireFeature'

/**
 * Onboarding.
 *
 * The candidate-to-employee hub: intake, offers and document review through to
 * joining.
 */
export default async function OnboardingPage() {
  // Gated here rather than in a layout: a layout would also cover
  // /onboarding/review/[token], which candidates open with an invitation token
  // and no staff role.
  await requireFeature('onboarding')

  return (
    <div className="animate-in fade-in mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 p-4 pb-20 duration-300 md:p-6 lg:p-8">
      <PageBanner
        title="Onboarding"
        description="Track candidates from offer through to joining."
        icon={<Compass className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />}
        actions={
          <div className="flex items-center gap-2">
            <Button
              asChild
              variant="outline"
              size="sm"
              className="gap-1.5 rounded-lg text-xs font-medium"
            >
              <Link href="/data-management/audit-logs?table=onboarding_records">
                <History className="text-muted-foreground h-3.5 w-3.5" />
                <span>Audit Logs</span>
              </Link>
            </Button>
            <Button
              asChild
              size="sm"
              className="gap-2 rounded-lg bg-indigo-600 text-xs font-semibold text-white shadow-xs hover:bg-indigo-700"
            >
              <Link href="/onboarding/candidate/new">
                <UserPlus className="h-3.5 w-3.5" />
                <span>Create Candidate</span>
              </Link>
            </Button>
          </div>
        }
      />

      <OnboardingHub />
    </div>
  )
}
