import { Users } from 'lucide-react'

import { EmployeeOnboardingView } from '@/app/(dashboard)/onboarding/employee/_components/EmployeeOnboardingView'
import { PipelineHealth } from '@/app/(dashboard)/onboarding/employee/_components/PipelineHealth'
import { OnboardingBoard } from '@/app/(dashboard)/onboarding/_components/OnboardingBoard'
import { OnboardingStats } from '@/app/(dashboard)/onboarding/_components/OnboardingStats'
import { OnboardingTabs } from '@/app/(dashboard)/onboarding/_components/OnboardingTabs'
import { RunModeBadge } from '@/app/(dashboard)/onboarding/_components/RunModeBadge'
import { PageBanner } from '@/components/shared/page-banner'
import { getAutomationHealth } from '@/lib/onboarding/automation/getAutomationHealth'
import { getOnboardingDashboard } from '@/lib/onboarding/automation/getOnboardingDashboard'
import { requireFeature } from '@/lib/rbac/requireFeature'

/**
 * Employee onboarding — everything that happens once someone has joined.
 *
 * Two views of the same period: the checklist P&C work through by hand, and the
 * automated communications that run alongside it from two days before joining
 * to the end of induction.
 */
export default async function EmployeeOnboardingPage() {
  await requireFeature('onboarding')

  const [{ rows, totals }, health] = await Promise.all([
    getOnboardingDashboard(),
    getAutomationHealth(),
  ])

  return (
    <div className="animate-in fade-in mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 p-4 pb-20 duration-300 md:p-6 lg:p-8">
      <PageBanner
        title="Employee Onboarding"
        description="Post-joining pipeline: account provisioning, Day-1 orientation, probation check-ins, and the automated communications that run alongside them."
        icon={<Users className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />}
        actions={<RunModeBadge />}
      />

      <OnboardingTabs
        hub={<EmployeeOnboardingView />}
        pipeline={
          <div className="space-y-4">
            <PipelineHealth health={health} />
            <OnboardingStats totals={totals} />
            <OnboardingBoard rows={rows} />
          </div>
        }
      />
    </div>
  )
}
