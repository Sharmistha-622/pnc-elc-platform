import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  IMPORT_TEMPLATE_CSV,
  parseCsv,
  planEmployeeImport,
  type ExistingEmployee,
  type ImportContext,
} from './import'
import { buildXlsxBuffer, parseXlsx, planEmployeeImportXlsx } from './xlsx'

const mockGuard = vi.fn()
const mockGuardResource = vi.fn()
const mockCreateServerSupabase = vi.fn()

vi.mock('@/lib/rbac/guard', () => ({
  guard: (...args: unknown[]) => mockGuard(...args),
  guardResource: (...args: unknown[]) => mockGuardResource(...args),
}))

vi.mock('@/lib/supabase/server', () => ({
  createServerSupabaseClient: () => mockCreateServerSupabase(),
}))

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))

function ctx(existing: ExistingEmployee[] = []): ImportContext {
  return {
    existing,
    employeeTypes: [
      { id: 't-fte', code: 'fte', name: 'Full-Time Employee (FTE)' },
      { id: 't-intern', code: 'intern', name: 'Intern' },
    ],
    departments: ['CEO Office', 'Finance'],
    allowedDomains: ['navgurukul.org'],
  }
}

describe('XLSX employee import and Import History', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('plans the exact same result from CSV and XLSX for the same rows', async () => {
    const csvRows = parseCsv(IMPORT_TEMPLATE_CSV)
    const xlsxBuf = await buildXlsxBuffer(csvRows)

    const fromCsv = planEmployeeImport(IMPORT_TEMPLATE_CSV, ctx())
    const fromXlsx = await planEmployeeImportXlsx(xlsxBuf, ctx())

    expect(fromXlsx).toEqual(fromCsv)
    expect(fromXlsx.canImport).toBe(true)
    expect(fromXlsx.counts).toEqual({ create: 2, update: 0, unchanged: 0, error: 0 })
  })

  it('refuses a bad XLSX with the row number and the offending column names', async () => {
    const rows = [
      ['email', 'name', 'employee_type', 'joining_date', 'team', 'is_alumni'],
      ['valid.person@navgurukul.org', 'Valid Person', 'fte', '2026-08-05', 'CEO Office', 'yes'],
      ['bad.person@navgurukul.org', 'Bad Person', 'staff', '2026-13-40', 'Marketing', 'maybe'],
    ]
    const xlsxBuf = await buildXlsxBuffer(rows)
    const plan = await planEmployeeImportXlsx(xlsxBuf, ctx())

    expect(plan.canImport).toBe(false)
    expect(plan.counts.error).toBe(1)

    const badRow = plan.rows[1]
    expect(badRow.line).toBe(3)
    expect(badRow.action).toBe('error')
    expect(badRow.errors).toEqual([
      'Unknown employee_type "staff".',
      'joining_date "2026-13-40" is not a date (use YYYY-MM-DD or DD/MM/YYYY).',
      'is_alumni must be yes or no, not "maybe".',
      'No department called "Marketing". Add it in Data Management → Departments first.',
    ])
  })

  it('rejects an oversized buffer before parsing', async () => {
    const oversized = new Uint8Array(5 * 1024 * 1024 + 10)
    await expect(parseXlsx(oversized)).rejects.toThrow('The file is too large (maximum 5 MB).')
  })

  it('imports the same rows from CSV and XLSX with the same result and lists each batch in Import History', async () => {
    const { runEmployeeImport, getEmployeeImportHistory } = await import('./importActions')

    const makeMockDb = () => {
      const insertedRows: Record<string, unknown>[] = []
      const updatedRows: Record<string, unknown>[] = []
      return {
        insertedRows,
        updatedRows,
        client: {
          from: (table: string) => {
            if (table === 'employees') {
              return {
                select: () => ({
                  order: () => ({
                    range: async () => ({
                      data: [
                        {
                          id: 'emp-existing-1',
                          email: 'existing.one@navgurukul.org',
                          employee_code: 'NG-0100',
                          name: 'Existing One',
                          employee_type: 'fte',
                          joining_date: '2024-04-01',
                          manager_id: null,
                          team: 'CEO Office',
                          status: 'active',
                          confirmation_date: '2024-07-01',
                          conversion_date: null,
                          is_alumni: false,
                        },
                      ],
                      error: null,
                    }),
                  }),
                }),
                insert: (rows: Record<string, unknown>[]) => {
                  insertedRows.push(...rows)
                  return {
                    select: async () => ({
                      data: rows.map((r, idx) => ({ id: `emp-new-${idx + 1}`, email: r.email })),
                      error: null,
                    }),
                  }
                },
                update: (patch: Record<string, unknown>) => {
                  const cleanPatch = { ...patch }
                  delete cleanPatch.updated_at
                  updatedRows.push(cleanPatch)
                  return {
                    eq: () => ({
                      select: async () => ({ data: [{ id: 'emp-existing-1' }], error: null }),
                    }),
                    in: (_col: string, ids: string[]) => ({
                      select: async () => ({ data: ids.map((id) => ({ id })), error: null }),
                    }),
                  }
                },
              }
            }
            if (table === 'employee_types') {
              return {
                select: async () => ({
                  data: [{ id: 't-fte', code: 'fte', name: 'Full-Time Employee (FTE)' }],
                  error: null,
                }),
              }
            }
            if (table === 'departments') {
              return {
                select: async () => ({
                  data: [
                    { name: 'CEO Office', is_archived: false },
                    { name: 'Finance', is_archived: false },
                  ],
                  error: null,
                }),
              }
            }
            if (table === 'teams') {
              return {
                select: async () => ({
                  data: [
                    { id: 'team-ceo', name: 'CEO Office' },
                    { id: 'team-fin', name: 'Finance' },
                  ],
                  error: null,
                }),
              }
            }
            if (table === 'employee_audit_log') {
              return {
                select: () => ({
                  eq: () => ({
                    order: () => ({
                      limit: () => ({
                        abortSignal: async () => ({ data: [], error: null }),
                      }),
                    }),
                  }),
                }),
              }
            }
            return {}
          },
        },
      }
    }

    const sheetRows = [
      ['email', 'employee_code', 'name', 'employee_type', 'joining_date', 'is_alumni', 'manager_email', 'team'],
      ['existing.one@navgurukul.org', '', '', '', '', '', '', 'Finance'],
      ['new.joiner@navgurukul.org', 'NG-0669', 'New Joiner', 'fte', '2026-08-05', 'yes', 'existing.one@navgurukul.org', 'CEO Office'],
    ]
    const csvText = sheetRows.map((r) => r.join(',')).join('\n')
    const xlsxBuf = await buildXlsxBuffer(sheetRows)

    mockGuardResource.mockResolvedValue({
      ok: true,
      caller: { userId: 'u-pnc', email: 'pnc.importer@example.org', role: 'pnc_admin' },
    })
    mockGuard.mockResolvedValue({
      ok: true,
      caller: { userId: 'u-pnc', email: 'pnc.importer@example.org', role: 'pnc_admin' },
    })

    const csvDb = makeMockDb()
    mockCreateServerSupabase.mockResolvedValueOnce(csvDb.client)
    const csvResult = await runEmployeeImport({
      fileName: 'cohort_august.csv',
      csvText,
    })

    const xlsxDb = makeMockDb()
    mockCreateServerSupabase.mockResolvedValueOnce(xlsxDb.client)
    const xlsxResult = await runEmployeeImport({
      fileName: 'cohort_august.xlsx',
      xlsxBase64: xlsxBuf.toString('base64'),
    })

    expect(csvResult).toEqual({ ok: true, created: 1, updated: 1, unchanged: 0 })
    expect(xlsxResult).toEqual(csvResult)
    expect(xlsxDb.insertedRows).toEqual(csvDb.insertedRows)
    expect(xlsxDb.updatedRows).toEqual(csvDb.updatedRows)

    mockCreateServerSupabase.mockResolvedValueOnce(xlsxDb.client)
    const history = await getEmployeeImportHistory()

    expect(history.length).toBeGreaterThanOrEqual(2)
    expect(history[0]).toMatchObject({
      file_name: 'cohort_august.xlsx',
      file_type: 'xlsx',
      uploaded_by: 'pnc.importer@example.org',
      processed: 2,
      created: 1,
      updated: 1,
      unchanged: 0,
      failed: 0,
      status: 'completed',
    })
    expect(history[1]).toMatchObject({
      file_name: 'cohort_august.csv',
      file_type: 'csv',
      uploaded_by: 'pnc.importer@example.org',
      processed: 2,
      created: 1,
      updated: 1,
      unchanged: 0,
      failed: 0,
      status: 'completed',
    })
  })
})

