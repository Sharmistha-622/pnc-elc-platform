import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { getFormFill } from '@/lib/forms/getFormFill'
import { saveSubmission } from '@/lib/forms/respondentActions'
import { visibleSectionIds } from '@/lib/forms/branching'
import { BranchingForm } from './BranchingForm'
import { asArray, asObject, asString, formatAnswer } from '@/lib/forms/answers'

function FieldInput({
  field,
  value,
  employees,
}: {
  field: any
  value: unknown
  employees: { id: string; name: string }[]
}) {
  const name = `f_${field.id}`
  const box = 'w-full border rounded px-3 py-2'
  const choices: string[] = Array.isArray(field.options?.choices) ? field.options.choices : []
  const rows: string[] = Array.isArray(field.options?.rows) ? field.options.rows : []
  const scale = [1, 2, 3, 4, 5]

  switch (field.field_type) {
    case 'short_text':
      return <input name={name} defaultValue={asString(value)} className={box} />
    case 'long_text':
      return <textarea name={name} defaultValue={asString(value)} rows={4} className={box} />
    case 'number':
      return <input name={name} type="number" step="any" defaultValue={asString(value)} className={box} />
    case 'date':
      return <input name={name} type="date" defaultValue={asString(value)} className={box} />
    case 'single_select':
      return (
        <select name={name} defaultValue={asString(value)} className={box}>
          <option value="">Select…</option>
          {choices.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      )
    case 'multi_select': {
      const picked = asArray(value)
      return (
        <div className="space-y-1">
          {choices.map((c) => (
            <label key={c} className="flex items-center gap-2 text-sm">
              <input type="checkbox" name={name} value={c} defaultChecked={picked.includes(c)} />
              {c}
            </label>
          ))}
        </div>
      )
    }
    case 'yes_no':
      return (
        <div className="flex gap-6 text-sm">
          {['yes', 'no'].map((v) => (
            <label key={v} className="flex items-center gap-2">
              <input type="radio" name={name} value={v} defaultChecked={asString(value) === v} />
              {v === 'yes' ? 'Yes' : 'No'}
            </label>
          ))}
        </div>
      )
    case 'rating':
      return (
        <div className="flex gap-4 text-sm">
          {scale.map((n) => (
            <label key={n} className="flex items-center gap-1">
              <input type="radio" name={name} value={n} defaultChecked={asString(value) === String(n)} />
              {n}
            </label>
          ))}
          <span className="text-gray-500">(1 = lowest, 5 = highest)</span>
        </div>
      )
    case 'rating_grid': {
      const rated = asObject(value)
      return (
        <div className="overflow-x-auto">
          <table className="border-collapse text-sm">
            <thead>
              <tr>
                <th className="p-2 text-left"></th>
                {scale.map((n) => (
                  <th key={n} className="p-2 text-center font-medium">{n}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={row} className="border-t">
                  <td className="p-2 pr-6">{row}</td>
                  {scale.map((n) => (
                    <td key={n} className="p-2 text-center">
                      <input type="radio" name={`${name}__${i}`} value={n} defaultChecked={rated[row] === n} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-xs text-gray-500">1 = lowest, 5 = highest</p>
        </div>
      )
    }
    case 'employee_picker':
      return (
        <select name={name} defaultValue={asString(value)} className={box}>
          <option value="">Choose a person…</option>
          {employees.map((e) => (
            <option key={e.id} value={e.id}>{e.name}</option>
          ))}
        </select>
      )
    default:
      return <p className="text-sm text-red-600">Unsupported field type</p>
  }
}

export default async function FillFormPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ error?: string; saved?: string; submitted?: string }>
}) {
  const { id } = await params
  const { error, saved, submitted: justSubmitted } = await searchParams
  const data = await getFormFill(id)

  if (data.state === 'signed_out') redirect('/login')
  if (data.state === 'not_found') notFound()
  if (data.state === 'no_employee' || data.state === 'not_yours') {
    return (
      <div className="flex flex-1 flex-col gap-4 p-4 md:p-6 lg:p-8 max-w-3xl mx-auto w-full">
        <Link href="/my-forms" className="text-sm text-blue-600 hover:underline">&larr; Back to My Forms</Link>
        <div className="rounded border border-yellow-300 bg-yellow-50 p-4 text-sm text-yellow-800">
          {data.state === 'no_employee'
            ? 'Your login email is not linked to an employee record, so this form cannot be opened.'
            : 'This form was not assigned to you.'}
        </div>
      </div>
    )
  }

  const blocked = data.expired || data.cancelled || data.closed
  const editable = !data.submitted && !blocked
  const visibleIds = visibleSectionIds(data.sections, data.fields, data.answers)

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 md:p-6 lg:p-8 max-w-3xl mx-auto w-full pb-20">
      <Link href="/my-forms" className="text-sm text-blue-600 hover:underline">&larr; Back to My Forms</Link>

      <div>
        <h1 className="text-2xl font-bold">{data.formName}</h1>
        {data.subjectName && <p className="text-gray-600">About: {data.subjectName}</p>}
      </div>

      {error && (
        <div className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-800">
          {error.slice(0, 300)}
        </div>
      )}
      {saved === '1' && (
        <div className="rounded border border-blue-300 bg-blue-50 p-3 text-sm text-blue-800">
          Draft saved. You can come back and finish it later.
        </div>
      )}
      {justSubmitted === '1' && (
        <div className="rounded border border-green-300 bg-green-50 p-3 text-sm text-green-800">
          Thank you. Your response has been submitted.
        </div>
      )}
      {data.expired && !data.submitted && (
        <div className="rounded border border-gray-300 bg-gray-50 p-3 text-sm text-gray-700">
          This request has expired. Please ask PnC to send it again.
        </div>
      )}
      {data.cancelled && !data.submitted && (
        <div className="rounded border border-gray-300 bg-gray-50 p-3 text-sm text-gray-700">
          This request was cancelled.
        </div>
      )}
      {data.closed && (
        <div className="rounded border border-gray-300 bg-gray-50 p-3 text-sm text-gray-700">
          This form is closed and no longer accepting responses.
        </div>
      )}

      {data.submitted && (
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            You submitted this form{data.submittedAt ? ` on ${String(data.submittedAt).slice(0, 10)}` : ''}. It can no
            longer be changed.
          </p>
          {data.sections.filter((section) => visibleIds.has(section.id)).map((section) => (
            <div key={section.id} className="rounded-lg border p-4 space-y-3">
              <h2 className="font-semibold">{section.title}</h2>
              <dl className="space-y-2">
                {data.fields
                  .filter((f) => f.section_id === section.id)
                  .map((f) => (
                    <div key={f.id}>
                      <dt className="text-sm font-medium">{f.label}</dt>
                      <dd className="whitespace-pre-line text-sm text-gray-700">
                        {formatAnswer(f, data.answers.get(f.id), data.employeeNames)}
                      </dd>
                    </div>
                  ))}
              </dl>
            </div>
          ))}
        </div>
      )}

      {editable && (
        <BranchingForm action={saveSubmission} sections={data.sections} fields={data.fields} className="space-y-6">
          <input type="hidden" name="requestId" value={data.requestId} />

          {data.sections.map((section) => (
            <div key={section.id} data-section-id={section.id} hidden={!visibleIds.has(section.id)} className="rounded-lg border p-4 space-y-4">
              <div>
                <h2 className="font-semibold">{section.title}</h2>
                {section.description && <p className="text-sm text-gray-600">{section.description}</p>}
              </div>
              {data.fields
                .filter((f) => f.section_id === section.id)
                .map((f) => (
                  <div key={f.id} className="space-y-1">
                    <label className="block text-sm font-medium">
                      {f.label}
                      {f.is_required && <span className="text-red-600"> *</span>}
                    </label>
                    {f.help_text && <p className="text-xs text-gray-500">{f.help_text}</p>}
                    <FieldInput field={f} value={data.answers.get(f.id)} employees={data.employees} />
                  </div>
                ))}
            </div>
          ))}

          <p className="text-xs text-gray-500">Fields marked * are required when you submit.</p>
          <div className="flex gap-3">
            <button type="submit" name="intent" value="draft" className="border px-4 py-2 rounded text-sm">
              Save draft
            </button>
            <button type="submit" name="intent" value="submit" className="bg-black text-white px-4 py-2 rounded text-sm">
              Submit
            </button>
          </div>
        </BranchingForm>
      )}
    </div>
  )
}
