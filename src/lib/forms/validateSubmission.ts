import { visibleSectionIds } from '@/lib/forms/branching'

const MAX_TEXT = 10000
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

type Parsed = { value: unknown; empty: boolean; incomplete?: boolean; error?: string }

function parseField(field: any, formData: FormData): Parsed {
  const key = `f_${field.id}`
  const label = String(field.label)
  const type = String(field.field_type)
  const choices: string[] = Array.isArray(field.options?.choices) ? field.options.choices : []
  const raw = String(formData.get(key) ?? '').trim()

  if (type === 'short_text' || type === 'long_text') {
    if (raw.length > MAX_TEXT) return { value: null, empty: true, error: `"${label}" is too long` }
    return { value: raw === '' ? null : raw, empty: raw === '' }
  }

  if (type === 'number') {
    if (raw === '') return { value: null, empty: true }
    const n = Number(raw)
    if (!Number.isFinite(n)) return { value: null, empty: true, error: `"${label}" must be a number` }
    return { value: n, empty: false }
  }

  if (type === 'date') {
    if (raw === '') return { value: null, empty: true }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(raw) || Number.isNaN(Date.parse(raw))) {
      return { value: null, empty: true, error: `"${label}" must be a valid date` }
    }
    return { value: raw, empty: false }
  }

  if (type === 'single_select') {
    if (raw === '') return { value: null, empty: true }
    if (!choices.includes(raw)) return { value: null, empty: true, error: `Choose one of the listed options for "${label}"` }
    return { value: raw, empty: false }
  }

  if (type === 'multi_select') {
    const picked = formData.getAll(key).map((v) => String(v)).filter(Boolean)
    if (picked.some((p) => !choices.includes(p))) {
      return { value: null, empty: true, error: `Choose only the listed options for "${label}"` }
    }
    return { value: picked.length ? picked : null, empty: picked.length === 0 }
  }

  if (type === 'yes_no') {
    if (raw === '') return { value: null, empty: true }
    if (raw !== 'yes' && raw !== 'no') return { value: null, empty: true, error: `Answer yes or no for "${label}"` }
    return { value: raw, empty: false }
  }

  if (type === 'rating') {
    if (raw === '') return { value: null, empty: true }
    const n = Number(raw)
    if (!Number.isInteger(n) || n < 1 || n > 5) return { value: null, empty: true, error: `"${label}" must be rated 1 to 5` }
    return { value: n, empty: false }
  }

  if (type === 'rating_grid') {
    const rows: string[] = Array.isArray(field.options?.rows) ? field.options.rows : []
    const rated: Record<string, number> = {}
    for (let i = 0; i < rows.length; i++) {
      const cell = String(formData.get(`${key}__${i}`) ?? '').trim()
      if (cell === '') continue
      const n = Number(cell)
      if (!Number.isInteger(n) || n < 1 || n > 5) {
        return { value: null, empty: true, error: `Ratings in "${label}" must be 1 to 5` }
      }
      rated[rows[i]] = n
    }
    const count = Object.keys(rated).length
    return {
      value: count ? rated : null,
      empty: count === 0,
      incomplete: count > 0 && count < rows.length,
    }
  }

  if (type === 'employee_picker') {
    if (raw === '') return { value: null, empty: true }
    if (!UUID.test(raw)) return { value: null, empty: true, error: `Choose a person from the list for "${label}"` }
    return { value: raw, empty: false }
  }

  return { value: null, empty: true, error: `"${label}" has an unsupported type` }
}

export type SubmissionCheck =
  | { ok: false; error: string }
  | { ok: true; rows: { field_id: string; value: unknown }[]; pickerIds: string[] }

// Checks what the respondent sent. Only questions in sections that are shown count:
// anything posted for a hidden section is ignored and stored as empty.
export function validateSubmission(
  sections: any[],
  fields: any[],
  formData: FormData,
  intent: string
): SubmissionCheck {
  const parsed = fields.map((field) => ({ field, ...parseField(field, formData) }))

  const answers = new Map<string, unknown>(
    parsed.map((p) => [p.field.id as string, p.error ? null : p.value])
  )
  const visible = visibleSectionIds(sections, fields, answers)
  const shown = parsed.filter((p) => visible.has(p.field.section_id))

  const typeProblem = shown.find((p) => p.error)
  if (typeProblem) return { ok: false, error: typeProblem.error as string }

  if (intent === 'submit') {
    for (const p of shown) {
      if (!p.field.is_required) continue
      if (p.empty) return { ok: false, error: `"${p.field.label}" is required` }
      if (p.incomplete) return { ok: false, error: `Please rate every item in "${p.field.label}"` }
    }
  }

  const rows = parsed.map((p) => ({
    field_id: p.field.id as string,
    value: visible.has(p.field.section_id) ? p.value : null,
  }))
  const pickerIds = shown
    .filter((p) => p.field.field_type === 'employee_picker' && typeof p.value === 'string')
    .map((p) => p.value as string)

  return { ok: true, rows, pickerIds }
}
