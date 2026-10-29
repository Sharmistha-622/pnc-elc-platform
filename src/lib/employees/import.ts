// ============================================================================
// Employee import — parse, check and plan
// ----------------------------------------------------------------------------
// Pure: no database. The server action (importActions.ts) loads the directory
// as it stands, runs `planEmployeeImport` on the uploaded CSV, shows the plan,
// and on confirm runs the same plan again before writing anything — the
// browser's copy of the plan is never trusted.
//
// People are matched by email. A row whose email is already in the directory
// updates that person, and only in the cells that are filled in: an empty cell
// leaves the value as it is. A new email creates a person.
// ============================================================================

export const IMPORT_COLUMNS = [
  { key: 'email', required: 'always', help: 'Official email. Matches the Google sign-in; one row per email.' },
  { key: 'employee_code', required: null, help: 'Employee ID, e.g. NG-0669. Unique; capitals, digits and hyphens.' },
  { key: 'name', required: 'new', help: 'Full name.' },
  { key: 'employee_type', required: 'new', help: 'fte, ftc, intern, apprentice_tech, apprentice_nontech, contractor, part_time or fellow.' },
  { key: 'joining_date', required: 'new', help: 'YYYY-MM-DD or DD/MM/YYYY.' },
  { key: 'manager_email', required: null, help: 'The manager’s official email. They must be in the file or already in the directory.' },
  { key: 'team', required: null, help: 'A department name exactly as in Data Management → Departments.' },
  { key: 'status', required: null, help: 'active (default) or exited.' },
  { key: 'confirmation_date', required: null, help: 'For people already confirmed. Leave empty otherwise.' },
  { key: 'conversion_date', required: null, help: 'Interns who converted: the date they converted.' },
] as const

export type ImportColumn = (typeof IMPORT_COLUMNS)[number]['key']

/** For new people these must be filled in; for updates every cell is optional. */
const REQUIRED_FOR_NEW: ImportColumn[] = ['name', 'employee_type', 'joining_date']

/** A sheet larger than this is split: one request carries the whole file twice. */
export const MAX_IMPORT_ROWS = 2000

export const IMPORT_TEMPLATE_CSV =
  IMPORT_COLUMNS.map((c) => c.key).join(',') +
  '\n' +
  'manager.one@navgurukul.org,NG-0101,Manager One,fte,2024-04-01,,CEO Office,active,2024-07-01,\n' +
  'new.joiner@navgurukul.org,NG-0669,New Joiner,fte,2026-08-05,manager.one@navgurukul.org,CEO Office,active,,\n'

// ----------------------------------------------------------------------------
// CSV
// ----------------------------------------------------------------------------

/**
 * RFC 4180 CSV: quoted cells may hold commas, quotes ("") and line breaks.
 * Spreadsheet exports quote any name with a comma in it, which splitting on
 * commas would have cut in two.
 */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false
  const src = text.replace(/^﻿/, '')

  for (let i = 0; i < src.length; i++) {
    const ch = src[i]
    if (quoted) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          cell += '"'
          i++
        } else {
          quoted = false
        }
      } else {
        cell += ch
      }
      continue
    }
    if (ch === '"') quoted = true
    else if (ch === ',') {
      row.push(cell)
      cell = ''
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++
      row.push(cell)
      rows.push(row)
      row = []
      cell = ''
    } else cell += ch
  }
  if (cell !== '' || row.length > 0) {
    row.push(cell)
    rows.push(row)
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ''))
}

function headerKey(raw: string): string {
  return raw.trim().toLowerCase().replace(/[\s-]+/g, '_')
}

// ----------------------------------------------------------------------------
// Values
// ----------------------------------------------------------------------------

/** YYYY-MM-DD, or DD/MM/YYYY and DD-MM-YYYY as Indian sheets write them. Null if not a real date. */
export function parseImportDate(raw: string): string | null {
  const v = raw.trim()
  let y: number, m: number, d: number
  let match = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(v)
  if (match) {
    ;[y, m, d] = [Number(match[1]), Number(match[2]), Number(match[3])]
  } else if ((match = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/.exec(v))) {
    ;[d, m, y] = [Number(match[1]), Number(match[2]), Number(match[3])]
  } else {
    return null
  }
  const date = new Date(Date.UTC(y, m - 1, d))
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) return null
  if (y < 1990 || y > 2100) return null
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
/** Same rule as the `employees_employee_code_format` check in the database. */
export const EMPLOYEE_CODE_RE = /^[A-Z0-9][A-Z0-9-]{1,19}$/

// ----------------------------------------------------------------------------
// Plan
// ----------------------------------------------------------------------------

export type ExistingEmployee = {
  id: string
  email: string | null
  employee_code: string | null
  name: string
  employee_type: string | null
  joining_date: string | null
  manager_id: string | null
  team: string | null
  status: string | null
  confirmation_date: string | null
  conversion_date: string | null
}

export type ImportContext = {
  existing: ExistingEmployee[]
  /** employee_types rows: code → id, plus the display names people may type. */
  employeeTypes: { id: string; code: string; name: string | null }[]
  /** Department names people may put in `team` (not archived). */
  departments: string[]
  /** Email domains that may sign in. */
  allowedDomains: string[]
}

/** The values written for one person. Absent keys are left as they are. */
export type EmployeeWrite = {
  email: string
  employee_code?: string
  name?: string
  employee_type?: string
  employee_type_id?: string
  joining_date?: string
  team?: string | null
  status?: 'active' | 'exited'
  confirmation_date?: string
  conversion_date?: string
}

export type FieldChange = { field: string; from: string | null; to: string | null }

export type RowPlan = {
  /** Line in the file, counting the header as line 1. */
  line: number
  email: string
  name: string
  action: 'create' | 'update' | 'unchanged' | 'error'
  errors: string[]
  warnings: string[]
  write: EmployeeWrite
  /** Lower-cased; resolved to an id when the import runs. */
  managerEmail: string | null
  changes: FieldChange[]
  existingId: string | null
}

export type ImportPlan = {
  /** Problems with the file itself; any of these stops the import. */
  fileErrors: string[]
  fileWarnings: string[]
  rows: RowPlan[]
  counts: { create: number; update: number; unchanged: number; error: number }
  /** True when nothing stops the import and there is something to write. */
  canImport: boolean
}

function emptyPlan(fileErrors: string[]): ImportPlan {
  return {
    fileErrors,
    fileWarnings: [],
    rows: [],
    counts: { create: 0, update: 0, unchanged: 0, error: 0 },
    canImport: false,
  }
}

export function planEmployeeImport(csvText: string, ctx: ImportContext): ImportPlan {
  const table = parseCsv(csvText)
  if (table.length < 2) return emptyPlan(['The file needs a header row and at least one person.'])
  if (table.length - 1 > MAX_IMPORT_ROWS) {
    return emptyPlan([`The file has ${table.length - 1} rows; import at most ${MAX_IMPORT_ROWS} at a time.`])
  }

  const headers = table[0].map(headerKey)
  const known = new Set<string>(IMPORT_COLUMNS.map((c) => c.key))
  const fileErrors: string[] = []
  const fileWarnings: string[] = []

  for (const col of ['email'] as const) {
    if (!headers.includes(col)) fileErrors.push(`The header row has no "${col}" column.`)
  }
  const seenHeaders = new Set<string>()
  for (const h of headers) {
    if (!h) continue
    if (seenHeaders.has(h)) fileErrors.push(`The column "${h}" appears twice.`)
    seenHeaders.add(h)
  }
  const ignored = headers.filter((h) => h && !known.has(h))
  if (ignored.length) fileWarnings.push(`Ignored columns: ${ignored.join(', ')}.`)
  if (fileErrors.length) return emptyPlan(fileErrors)

  const existingByEmail = new Map<string, ExistingEmployee[]>()
  for (const e of ctx.existing) {
    const key = e.email?.trim().toLowerCase()
    if (!key) continue
    existingByEmail.set(key, [...(existingByEmail.get(key) ?? []), e])
  }
  const existingById = new Map(ctx.existing.map((e) => [e.id, e]))
  const typeByKey = new Map<string, { id: string; code: string }>()
  for (const t of ctx.employeeTypes) {
    typeByKey.set(t.code.toLowerCase(), t)
    if (t.name) typeByKey.set(t.name.trim().toLowerCase(), t)
  }
  const departmentByKey = new Map(ctx.departments.map((d) => [d.trim().toLowerCase(), d.trim()]))
  const domains = ctx.allowedDomains.map((d) => d.toLowerCase())

  const codeOwner = new Map<string, ExistingEmployee>()
  for (const e of ctx.existing) {
    if (e.employee_code) codeOwner.set(e.employee_code.trim().toUpperCase(), e)
  }

  const fileEmails = new Map<string, number>()
  const fileCodes = new Map<string, number>()
  const rows: RowPlan[] = []

  table.slice(1).forEach((cells, idx) => {
    const line = idx + 2
    const get = (key: ImportColumn): string => {
      const at = headers.indexOf(key)
      return at === -1 ? '' : (cells[at] ?? '').trim()
    }
    const errors: string[] = []
    const warnings: string[] = []

    const email = get('email').toLowerCase()
    const plan: RowPlan = {
      line,
      email,
      name: get('name'),
      action: 'error',
      errors,
      warnings,
      write: { email },
      managerEmail: null,
      changes: [],
      existingId: null,
    }
    rows.push(plan)

    if (!email) {
      errors.push('Email is empty.')
      return
    }
    if (!EMAIL_RE.test(email)) errors.push(`"${email}" is not an email address.`)
    else if (!domains.includes(email.slice(email.lastIndexOf('@') + 1))) {
      errors.push(`Only ${domains.map((d) => '@' + d).join(', ')} addresses can sign in.`)
    }
    const earlier = fileEmails.get(email)
    if (earlier) errors.push(`The same email is on line ${earlier}.`)
    else fileEmails.set(email, line)

    const matches = existingByEmail.get(email) ?? []
    if (matches.length > 1) {
      errors.push('Two people in the directory already share this email. Fix that first.')
    }
    const current = matches.length === 1 ? matches[0] : null
    plan.existingId = current?.id ?? null
    if (current && !plan.name) plan.name = current.name

    if (matches.length === 0) {
      for (const col of REQUIRED_FOR_NEW) {
        if (!get(col)) errors.push(`${col} is needed for someone new.`)
      }
    }

    const name = get('name')
    if (name) plan.write.name = name

    const code = get('employee_code').toUpperCase()
    if (code) {
      if (!EMPLOYEE_CODE_RE.test(code)) {
        errors.push(`employee_code "${code}" may use only capitals, digits and hyphens (2–20 characters).`)
      } else {
        const holder = codeOwner.get(code)
        const codeLine = fileCodes.get(code)
        if (codeLine) errors.push(`The same employee_code is on line ${codeLine}.`)
        else fileCodes.set(code, line)
        if (holder && holder.id !== current?.id) {
          errors.push(`employee_code ${code} already belongs to ${holder.name} (${holder.email ?? 'no email'}).`)
        }
        plan.write.employee_code = code
      }
    }

    const typeRaw = get('employee_type')
    if (typeRaw) {
      const type = typeByKey.get(typeRaw.toLowerCase())
      if (!type) errors.push(`Unknown employee_type "${typeRaw}".`)
      else {
        plan.write.employee_type = type.code
        plan.write.employee_type_id = type.id
      }
    }

    for (const col of ['joining_date', 'confirmation_date', 'conversion_date'] as const) {
      const raw = get(col)
      if (!raw) continue
      const iso = parseImportDate(raw)
      if (!iso) errors.push(`${col} "${raw}" is not a date (use YYYY-MM-DD or DD/MM/YYYY).`)
      else plan.write[col] = iso
    }

    const statusRaw = get('status').toLowerCase()
    if (statusRaw) {
      if (statusRaw !== 'active' && statusRaw !== 'exited') errors.push(`status must be active or exited, not "${statusRaw}".`)
      else plan.write.status = statusRaw
    } else if (!current) {
      plan.write.status = 'active'
    }

    const teamRaw = get('team')
    if (teamRaw) {
      const team = departmentByKey.get(teamRaw.toLowerCase())
      if (!team) errors.push(`No department called "${teamRaw}". Add it in Data Management → Departments first.`)
      else plan.write.team = team
    }

    const managerRaw = get('manager_email').toLowerCase()
    if (managerRaw) {
      if (managerRaw === email) errors.push('A person cannot be their own manager.')
      else plan.managerEmail = managerRaw
    }

    // Sense checks on the dates as they will stand after the import.
    const joining = plan.write.joining_date ?? current?.joining_date ?? null
    const confirmed = plan.write.confirmation_date ?? current?.confirmation_date ?? null
    if (joining && confirmed && confirmed < joining) warnings.push('confirmation_date is before joining_date.')
    const finalType = plan.write.employee_type ?? current?.employee_type ?? null
    if (plan.write.conversion_date && finalType !== 'intern') {
      warnings.push('conversion_date is only used for interns.')
    }
  })

  // Managers: resolvable, and no one ends up managing themselves through others.
  const finalManager = new Map<string, string | null>()
  for (const e of ctx.existing) {
    const key = e.email?.trim().toLowerCase()
    if (!key) continue
    const mgr = e.manager_id ? existingById.get(e.manager_id)?.email?.trim().toLowerCase() ?? null : null
    finalManager.set(key, mgr)
  }
  for (const r of rows) {
    if (r.email && r.managerEmail) finalManager.set(r.email, r.managerEmail)
  }

  for (const r of rows) {
    if (!r.email) continue
    const current = r.existingId ? existingById.get(r.existingId) ?? null : null
    if (r.managerEmail) {
      const inFile = fileEmails.has(r.managerEmail)
      const inDirectory = (existingByEmail.get(r.managerEmail) ?? []).length === 1
      if (!inFile && !inDirectory) {
        r.errors.push(`Manager ${r.managerEmail} is not in this file or the directory.`)
      } else {
        const seen = new Set<string>([r.email])
        let at: string | null = r.managerEmail
        while (at && !seen.has(at)) {
          seen.add(at)
          at = finalManager.get(at) ?? null
        }
        if (at === r.email) r.errors.push('This manager line loops back to the person.')
      }
    } else {
      const keepsManager = Boolean(current?.manager_id)
      const finalStatus = r.write.status ?? current?.status ?? 'active'
      if (!keepsManager && finalStatus === 'active') {
        r.warnings.push('No manager: their reviews cannot be sent until one is set.')
      }
    }

    if (r.errors.length) {
      r.action = 'error'
      continue
    }
    if (!current) {
      r.action = 'create'
      continue
    }

    const before: Record<string, string | null> = {
      employee_code: current.employee_code,
      name: current.name,
      employee_type: current.employee_type,
      joining_date: current.joining_date,
      team: current.team,
      status: current.status,
      confirmation_date: current.confirmation_date,
      conversion_date: current.conversion_date,
      manager_email: current.manager_id ? existingById.get(current.manager_id)?.email?.toLowerCase() ?? null : null,
    }
    const after: Record<string, string | null | undefined> = {
      employee_code: r.write.employee_code,
      name: r.write.name,
      employee_type: r.write.employee_type,
      joining_date: r.write.joining_date,
      team: r.write.team,
      status: r.write.status,
      confirmation_date: r.write.confirmation_date,
      conversion_date: r.write.conversion_date,
      manager_email: r.managerEmail ?? undefined,
    }
    for (const [field, to] of Object.entries(after)) {
      if (to === undefined) continue
      const from = before[field] ?? null
      if ((from ?? '') !== (to ?? '')) r.changes.push({ field, from, to })
    }
    r.action = r.changes.length ? 'update' : 'unchanged'
  }

  const counts = { create: 0, update: 0, unchanged: 0, error: 0 }
  for (const r of rows) counts[r.action]++

  return {
    fileErrors,
    fileWarnings,
    rows,
    counts,
    canImport: counts.error === 0 && counts.create + counts.update > 0,
  }
}
