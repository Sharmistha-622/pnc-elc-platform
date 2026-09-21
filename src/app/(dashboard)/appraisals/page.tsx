import { getAppraisalCohortView } from '@/lib/appraisals/getAppraisalCohortView'

export default async function AppraisalsPage() {
  const entries = await getAppraisalCohortView()

  const julyCohort = entries.filter((e) => e.cohort === 'july')
  const decemberCohort = entries.filter((e) => e.cohort === 'december')

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Appraisal Cohorts</h1>

      <div className="grid grid-cols-2 gap-6">
        <div>
          <h2 className="text-lg font-semibold mb-3">July Cycle ({julyCohort.length})</h2>
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b">
                <th className="text-left p-2">Name</th>
                <th className="text-left p-2">Type</th>
                <th className="text-left p-2">Reference Date</th>
              </tr>
            </thead>
            <tbody>
              {julyCohort.map((e) => (
                <tr key={e.employeeId} className="border-b">
                  <td className="p-2">{e.name}</td>
                  <td className="p-2">{e.employeeType}</td>
                  <td className="p-2">{e.referenceDate}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div>
          <h2 className="text-lg font-semibold mb-3">December Cycle ({decemberCohort.length})</h2>
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b">
                <th className="text-left p-2">Name</th>
                <th className="text-left p-2">Type</th>
                <th className="text-left p-2">Reference Date</th>
              </tr>
            </thead>
            <tbody>
              {decemberCohort.map((e) => (
                <tr key={e.employeeId} className="border-b">
                  <td className="p-2">{e.name}</td>
                  <td className="p-2">{e.employeeType}</td>
                  <td className="p-2">{e.referenceDate}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}