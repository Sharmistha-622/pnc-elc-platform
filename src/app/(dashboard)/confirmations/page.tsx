import Link from 'next/link'
import { getConfirmationsList } from '@/lib/confirmations/getConfirmationsList'

export default async function ConfirmationsPage() {
  const confirmations = await getConfirmationsList()

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">Confirmations</h1>
        <Link
          href="/confirmations/new"
          className="bg-black text-white px-4 py-2 rounded text-sm"
        >
          + New Confirmation
        </Link>
      </div>

      {confirmations.length === 0 ? (
        <p className="text-gray-500">No confirmations yet. Start one with "New Confirmation".</p>
      ) : (
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b">
              <th className="text-left p-2">Employee</th>
              <th className="text-left p-2">Type</th>
              <th className="text-left p-2">Status</th>
              <th className="text-left p-2">Manager Decision</th>
              <th className="text-left p-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {confirmations.map((c) => (
              <tr key={c.id} className="border-b">
                <td className="p-2">{c.employeeName}</td>
                <td className="p-2">{c.employeeType}</td>
                <td className="p-2">{c.status}</td>
                <td className="p-2">{c.managerDecision ?? 'Pending'}</td>
                <td className="p-2 space-x-4">
                  <Link href={`/confirmations/${c.id}/report`} className="text-blue-600 hover:underline">
                    Report
                  </Link>
                  <Link href={`/confirmations/${c.id}/manager-decision`} className="text-blue-600 hover:underline">
                    Manager Decision
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}