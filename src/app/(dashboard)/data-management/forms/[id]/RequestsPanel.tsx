import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createFormRequest } from '@/lib/forms/requestActions'
import { formatAnswer } from '@/lib/forms/answers'
import { visibleSectionIds } from '@/lib/forms/branching'

function statusLabel(request: any, submission: any): string {
  if (submission?.status === 'submitted') return 'Submitted'
  if (request.status === 'cancelled') return 'Cancelled'
  if (request.expires_at && new Date(request.expires_at) < new Date()) return 'Expired'
  if (request.status === 'started') return 'In progress'
  if (request.status === 'opened') return 'Opened'
  return 'Not opened'
}

export async function RequestsPanel({
  formId,
  publishedVersionId,
  sent,
}: {
  formId: string
  publishedVersionId: string
  sent?: string
}) {
  const supabase = await createServerSupabaseClient()

  const { data: employeeRows } = await supabase
    .from('employees')
    .select('id, name')
    .order('name', { ascending: true })
  const employees = (employeeRows ?? []) as any[]
  const employeeNames = new Map<string, string>(employees.map((e) => [e.id as string, e.name as string]))

  const { data: versionRows } = await supabase
    .from('form_versions')
    .select('id, version_number')
    .eq('form_id', formId)
  const versions = (versionRows ?? []) as any[]
  const versionIds = versions.map((v) => v.id as string)

  const { data: requestRows } = await supabase
    .from('form_requests')
    .select('*')
    .in('form_version_id', versionIds)
    .order('created_at', { ascending: false })
  const requests = (requestRows ?? []) as any[]

  const { data: submissionRows } = requests.length
    ? await supabase
        .from('form_submissions')
        .select('id, request_id, form_version_id, status, submitted_at')
        .in('request_id', requests.map((r) => r.id as string))
    : { data: [] }
  const submissions = (submissionRows ?? []) as any[]
  const submittedIds = submissions.filter((s) => s.status === 'submitted').map((s) => s.id as string)

  let answers: any[] = []
  let fields: any[] = []
  let sections: any[] = []
  if (submittedIds.length > 0) {
    const submittedVersionIds = Array.from(
      new Set(submissions.filter((s) => s.status === 'submitted').map((s) => s.form_version_id as string))
    )
    const { data: answerRows } = await supabase
      .from('form_answers')
      .select('submission_id, field_id, value')
      .in('submission_id', submittedIds)
    const { data: fieldRows } = await supabase
      .from('form_fields')
      .select('*')
      .in('form_version_id', submittedVersionIds)
    const { data: sectionRows } = await supabase
      .from('form_sections')
      .select('id, form_version_id, order_index, show_when')
      .in('form_version_id', submittedVersionIds)
    answers = (answerRows ?? []) as any[]
    fields = (fieldRows ?? []) as any[]
    sections = (sectionRows ?? []) as any[]
  }
  const sectionOrder = new Map<string, number>(sections.map((s) => [s.id as string, s.order_index as number]))

  return (
    <div className="rounded-lg border p-4 space-y-4">
      <div>
        <h2 className="font-semibold">Send this form</h2>
        <p className="text-sm text-gray-600">
          The person finds it under <strong>My Forms</strong> after signing in. Email links come later.
        </p>
      </div>

      {sent === '1' && (
        <div className="rounded border border-green-300 bg-green-50 p-3 text-sm text-green-800">
          Form sent. It now appears under My Forms for that person.
        </div>
      )}

      <form action={createFormRequest} className="flex flex-wrap items-end gap-3">
        <input type="hidden" name="formId" value={formId} />
        <input type="hidden" name="versionId" value={publishedVersionId} />
        <div>
          <label htmlFor="respondentId" className="block text-sm font-medium mb-1">Who fills it in</label>
          <select id="respondentId" name="respondentId" required defaultValue="" className="border rounded px-3 py-2 min-w-56">
            <option value="" disabled>Choose an employee</option>
            {employees.map((e) => (
              <option key={e.id} value={e.id}>{e.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="subjectId" className="block text-sm font-medium mb-1">About (optional)</label>
          <select id="subjectId" name="subjectId" defaultValue="" className="border rounded px-3 py-2 min-w-56">
            <option value="">Not about a specific person</option>
            {employees.map((e) => (
              <option key={e.id} value={e.id}>{e.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="expiresInDays" className="block text-sm font-medium mb-1">Expires in (days)</label>
          <input id="expiresInDays" name="expiresInDays" type="number" min={1} max={365} placeholder="Never" className="border rounded px-3 py-2 w-28" />
        </div>
        <button type="submit" className="bg-black text-white px-4 py-2 rounded text-sm">Send form</button>
      </form>

      {requests.length === 0 ? (
        <p className="text-sm text-gray-500">Nobody has been sent this form yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left p-2">Fills it in</th>
                <th className="text-left p-2">About</th>
                <th className="text-left p-2">Version</th>
                <th className="text-left p-2">Status</th>
                <th className="text-left p-2">Sent</th>
                <th className="text-left p-2">Answers</th>
              </tr>
            </thead>
            <tbody>
              {requests.map((r) => {
                const submission = submissions.find((s) => s.request_id === r.id)
                const version = versions.find((v) => v.id === r.form_version_id)
                const answerByField = new Map<string, unknown>(
                  answers.filter((a) => a.submission_id === submission?.id).map((a) => [a.field_id as string, a.value])
                )
                const versionFields = fields.filter((f) => f.form_version_id === submission?.form_version_id)
                const visibleIds = visibleSectionIds(
                  sections.filter((s) => s.form_version_id === submission?.form_version_id),
                  versionFields,
                  answerByField
                )
                const submittedFields = submission?.status === 'submitted'
                  ? versionFields
                      .filter((f) => visibleIds.has(f.section_id))
                      .sort(
                        (a, b) =>
                          (sectionOrder.get(a.section_id) ?? 0) - (sectionOrder.get(b.section_id) ?? 0) ||
                          a.order_index - b.order_index
                      )
                  : []
                return (
                  <tr key={r.id} className="border-b align-top">
                    <td className="p-2">{employeeNames.get(r.respondent_employee_id) ?? '—'}</td>
                    <td className="p-2">{r.subject_employee_id ? employeeNames.get(r.subject_employee_id) ?? '—' : '—'}</td>
                    <td className="p-2">v{version?.version_number ?? '?'}</td>
                    <td className="p-2">{statusLabel(r, submission)}</td>
                    <td className="p-2">{String(r.created_at).slice(0, 10)}</td>
                    <td className="p-2">
                      {submission?.status === 'submitted' ? (
                        <details>
                          <summary className="cursor-pointer text-blue-600">View answers</summary>
                          <dl className="mt-2 space-y-2">
                            {submittedFields.map((f) => (
                              <div key={f.id}>
                                <dt className="font-medium">{f.label}</dt>
                                <dd className="whitespace-pre-line text-gray-700">
                                  {formatAnswer(f, answerByField.get(f.id), employeeNames)}
                                </dd>
                              </div>
                            ))}
                          </dl>
                        </details>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
