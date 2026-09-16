import { getConfirmation } from '@/lib/confirmations/getConfirmation'
import { ManagerDecisionForm } from './ManagerDecisionForm'

export default async function ManagerDecisionPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const confirmation = await getConfirmation(id)

  if (!confirmation) {
    return <div className="p-6">Confirmation not found.</div>
  }

  return (
    <div className="p-6 max-w-xl">
      <h1 className="text-2xl font-bold mb-2">Manager Decision</h1>
      <p className="text-gray-600 mb-6">
        Employee: {confirmation.employees?.name} ({confirmation.employees?.employee_type})
      </p>
     <ManagerDecisionForm confirmationId={id} employeeName={confirmation.employees?.name || 'this employee'} />
    </div>
  )
}