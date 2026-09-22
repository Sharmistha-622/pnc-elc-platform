import { getConfirmation } from '@/lib/confirmations/getConfirmation'
import { ManagerDecisionForm } from './ManagerDecisionForm'
import { PageBanner } from '@/components/shared/page-banner'
import { ShieldCheck, UserCheck } from 'lucide-react'

export default async function ManagerDecisionPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const confirmation = await getConfirmation(id)

  if (!confirmation) {
    return (
      <div className="flex flex-1 flex-col gap-6 p-4 md:p-6 lg:p-8 max-w-7xl mx-auto w-full pb-20 animate-in fade-in duration-300">
        <PageBanner
          title="Confirmation Not Found"
          description="The requested confirmation decision record could not be found."
          icon={<ShieldCheck className="h-5 w-5 text-destructive" />}
        />
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 md:p-6 lg:p-8 max-w-7xl mx-auto w-full pb-20 animate-in fade-in duration-300">
      <PageBanner
        title={`Manager Decision — ${confirmation.employees?.name || 'Employee'}`}
        description={`Record final manager evaluation and decision for ${confirmation.employees?.name} (${confirmation.employees?.employee_type || 'Probation'}).`}
        icon={<UserCheck className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />}
      />

      <div className="bg-card border border-border rounded-lg p-6 shadow-xs max-w-2xl">
        <ManagerDecisionForm
          confirmationId={id}
          employeeName={confirmation.employees?.name || 'this employee'}
          employeeEmail={confirmation.employees?.email}
        />
      </div>
    </div>
  )
}