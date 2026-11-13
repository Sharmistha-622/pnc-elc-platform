import ExcelJS from 'exceljs'
import {
  MAX_IMPORT_FILE_BYTES,
  planEmployeeImport,
  type ImportContext,
  type ImportPlan,
} from './import'

function cellToString(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return 'invalid-date'
    const y = value.getUTCFullYear()
    const m = String(value.getUTCMonth() + 1).padStart(2, '0')
    const d = String(value.getUTCDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  }
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>
    if (typeof obj.text === 'string') return obj.text
    if (Array.isArray(obj.richText)) {
      return obj.richText
        .map((part) => (part && typeof part === 'object' && 'text' in part ? String((part as { text?: unknown }).text ?? '') : ''))
        .join('')
    }
    if ('result' in obj) return cellToString(obj.result)
    if ('error' in obj && obj.error !== undefined) return String(obj.error)
  }
  return String(value)
}

/**
 * Reads the first worksheet of an `.xlsx` file into a 2D array of cell strings.
 * Rejects oversized uploads before parsing (`rules/data-import.md`).
 */
export async function parseXlsx(input: ArrayBuffer | Uint8Array | Buffer): Promise<string[][]> {
  const byteLength = input.byteLength
  if (byteLength > MAX_IMPORT_FILE_BYTES) {
    throw new Error('The file is too large (maximum 5 MB).')
  }
  if (byteLength === 0) {
    return []
  }

  const workbook = new ExcelJS.Workbook()
  try {
    const buf = Buffer.isBuffer(input)
      ? input
      : input instanceof Uint8Array
        ? Buffer.from(input.buffer, input.byteOffset, input.byteLength)
        : Buffer.from(input)
    await workbook.xlsx.load(buf as unknown as ExcelJS.Buffer)
  } catch {
    throw new Error('Could not read the .xlsx file. Check that it is a valid Excel workbook.')
  }

  const sheet = workbook.worksheets[0]
  if (!sheet) return []

  const maxCols = Math.max(sheet.columnCount, 1)
  const rows: string[][] = []
  sheet.eachRow({ includeEmpty: false }, (row) => {
    const cells: string[] = []
    const colCount = Math.max(maxCols, row.cellCount)
    for (let col = 1; col <= colCount; col++) {
      const cell = row.getCell(col)
      cells.push(cellToString(cell.value))
    }
    if (cells.some((c) => c.trim() !== '')) {
      rows.push(cells)
    }
  })

  return rows
}

/**
 * Plans an employee import from an `.xlsx` buffer using the same validation as
 * `planEmployeeImport` in `src/lib/employees/import.ts`.
 */
export async function planEmployeeImportXlsx(
  input: ArrayBuffer | Uint8Array | Buffer,
  ctx: ImportContext,
): Promise<ImportPlan> {
  try {
    const rows = await parseXlsx(input)
    return planEmployeeImport(rows, ctx)
  } catch (err) {
    return {
      fileErrors: [err instanceof Error ? err.message : 'Could not read the .xlsx file.'],
      fileWarnings: [],
      rows: [],
      counts: { create: 0, update: 0, unchanged: 0, error: 0 },
      canImport: false,
    }
  }
}

/** Builds an `.xlsx` workbook buffer from a 2D array of rows (for templates and tests). */
export async function buildXlsxBuffer(
  rows: (string | number | boolean | Date | null | undefined)[][],
  sheetName = 'Employees',
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet(sheetName)
  for (const r of rows) {
    sheet.addRow(r)
  }
  const out = await workbook.xlsx.writeBuffer()
  return Buffer.from(out)
}

