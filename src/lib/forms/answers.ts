export function asString(value: unknown): string {
  if (typeof value === 'string') return value
  if (typeof value === 'number') return String(value)
  return ''
}

export function asArray(value: unknown): string[] {
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value)
      if (Array.isArray(parsed)) return parsed.map((item) => String(item))
    } catch {}
  }
  return Array.isArray(value) ? value.map((item) => String(item)) : []
}

export function asObject(value: unknown): Record<string, number> {
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value)
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, number>
      }
    } catch {}
  }
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, number>)
    : {}
}

// Turns a stored answer into readable text for review screens
export function formatAnswer(
  field: { field_type: string },
  value: unknown,
  employeeNames: Map<string, string>
): string {
  if (value === null || value === undefined) return '—'
  switch (field.field_type) {
    case 'multi_select': {
      const picked = asArray(value)
      return picked.length ? picked.join(', ') : '—'
    }
    case 'yes_no':
      return value === 'yes' ? 'Yes' : value === 'no' ? 'No' : '—'
    case 'rating':
      return asString(value) ? `${asString(value)} / 5` : '—'
    case 'rating_grid': {
      const rated = asObject(value)
      const keys = Object.keys(rated)
      return keys.length ? keys.map((k) => `${k}: ${rated[k]} / 5`).join('\n') : '—'
    }
    case 'employee_picker':
      return employeeNames.get(asString(value)) ?? (asString(value) || '—')
    default:
      return asString(value) || '—'
  }
}
