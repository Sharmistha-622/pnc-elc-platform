import { getAppraisalReportData } from '@/lib/appraisals/getAppraisalReportData'

export default async function AppraisalReportPage() {
  const { teamBreakdown, totalEligible, cycleSplit } = await getAppraisalReportData()

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-1">Appraisal Reporting</h1>
      <p className="text-gray-600 mb-6">
        Historical/current cycle distribution across teams. Cost and budget tracking will be added once salary data is captured in the schema.
      </p>

      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="border rounded p-4">
          <p className="text-sm text-gray-500">Total Eligible</p>
          <p className="text-2xl font-bold">{totalEligible}</p>
        </div>
        <div className="border rounded p-4">
          <p className="text-sm text-gray-500">July Cycle</p>
          <p className="text-2xl font-bold">{cycleSplit.july}</p>
        </div>
        <div className="border rounded p-4">
          <p className="text-sm text-gray-500">December Cycle</p>
          <p className="text-2xl font-bold">{cycleSplit.december}</p>
        </div>
      </div>

      <h2 className="text-lg font-semibold mb-3">Team-wise Breakdown</h2>
      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b">
            <th className="text-left p-2">Team</th>
            <th className="text-left p-2">July Cycle</th>
            <th className="text-left p-2">December Cycle</th>
            <th className="text-left p-2">Total</th>
          </tr>
        </thead>
        <tbody>
          {teamBreakdown.map((t) => (
            <tr key={t.team} className="border-b">
              <td className="p-2">{t.team}</td>
              <td className="p-2">{t.july}</td>
              <td className="p-2">{t.december}</td>
              <td className="p-2 font-medium">{t.total}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}