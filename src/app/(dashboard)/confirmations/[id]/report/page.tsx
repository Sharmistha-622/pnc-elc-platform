import { getCompiledFeedback } from '@/lib/confirmations/getCompiledFeedback'

export default async function CompiledReportPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const report = await getCompiledFeedback(id)

  if (!report) {
    return <div className="p-6">Report not found.</div>
  }

  return (
    <div className="p-6 max-w-3xl">
      <h1 className="text-2xl font-bold mb-1">Compiled Feedback Report</h1>
      <p className="text-gray-600 mb-4">
        {report.employeeName} — {report.employeeType}
      </p>

      {report.redFlag && (
        <div className="bg-red-50 border border-red-300 text-red-800 rounded p-4 mb-6">
          <strong>:warning: Red Flag:</strong> {report.redFlagReason}
        </div>
      )}

      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="border rounded p-4">
          <p className="text-sm text-gray-500">Nominated</p>
          <p className="text-2xl font-bold">{report.totalNominated}</p>
        </div>
        <div className="border rounded p-4">
          <p className="text-sm text-gray-500">Submitted</p>
          <p className="text-2xl font-bold">{report.totalSubmitted}</p>
        </div>
        <div className="border rounded p-4">
          <p className="text-sm text-gray-500">Pending</p>
          <p className="text-2xl font-bold">{report.totalPending}</p>
        </div>
      </div>

      <h2 className="text-lg font-semibold mb-3">Peer Responses</h2>
      <div className="space-y-3">
        {report.feedbackEntries.map((entry) => (
          <div key={entry.id} className="border rounded p-4">
            <div className="flex justify-between items-center mb-2">
              <span className="font-medium">{entry.peerName}</span>
              <span
                className={`text-xs px-2 py-1 rounded ${
                  entry.responseStatus === 'submitted'
                    ? 'bg-green-100 text-green-700'
                    : 'bg-yellow-100 text-yellow-700'
                }`}
              >
                {entry.responseStatus}
              </span>
            </div>
            {entry.feedbackText && (
              <p className="text-gray-700 text-sm">{entry.feedbackText}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}