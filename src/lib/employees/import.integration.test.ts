// ============================================================================
// Employee import against a real database
// ----------------------------------------------------------------------------
// Skipped unless scripts/review-cycles-e2e.sh starts it: that script builds a
// scratch database from every migration and puts PostgREST in front of it.
// The import runs as in production — through the caller's own session — so
// the "pnc insert" and "pnc and exits update" policies answer for real.
// Only the role lookup is set per test, to play each person.
// ============================================================================

import { createHmac } from 'crypto'
import http from 'http'
import type { AddressInfo } from 'net'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const PGRST = process.env.REVIEW_E2E_PGRST
const SECRET = process.env.REVIEW_E2E_SECRET ?? ''

function jwt(payload: Record<string, unknown>): string {
  const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url')
  const head = b64({ alg: 'HS256', typ: 'JWT' })
  const body = b64({ ...payload, exp: Math.floor(Date.now() / 1000) + 3600 })
  const sig = createHmac('sha256', SECRET).update(`${head}.${body}`).digest('base64url')
  return `${head}.${body}.${sig}`
}

const session = vi.hoisted(() => ({
  db: null as unknown,
  resolved: null as unknown,
  audit: [] as unknown[],
}))

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/supabase/server', () => ({ createServerSupabaseClient: async () => session.db }))
vi.mock('@/lib/rbac/getCurrentUserRole', () => ({ getCurrentUserRole: async () => session.resolved }))
vi.mock('@/lib/audit/service', () => ({
  recordAuditEvents: async (events: unknown[]) => {
    session.audit.push(...events)
    return events
  },
}))

// Seeded by the script: a PnC Admin account, and an employee account.
const PNC_ADMIN = { sub: '20000000-0000-0000-0000-0000000000f1', email: 'pnc.admin@navgurukul.org' }
const EMPLOYEE = { sub: '20000000-0000-0000-0000-00000000000b', email: 'ravi@navgurukul.org' }

const FILE =
  'email,employee_code,name,employee_type,joining_date,manager_email,team,status,confirmation_date,conversion_date\n' +
  'imp.joiner@navgurukul.org,ng-9669,"Joiner, Imported",FTE,05/08/2026,imp.lead@navgurukul.org,CEO Office,,,\n' +
  'imp.lead@navgurukul.org,NG-9101,Lead Imported,fte,2023-04-01,,CEO Office,,2023-07-01,\n' +
  'imp.intern@navgurukul.org,,Intern Imported,intern,2026-06-01,imp.lead@navgurukul.org,Finance,,,2026-09-01\n' +
  'imp.existing@navgurukul.org,NG-9001,,,,,Finance,,2019-04-01,\n'

describe.skipIf(!PGRST)('employee import, against the database', () => {
  let server: http.Server
  let url = ''
  let admin: SupabaseClient
  let actions: typeof import('./importActions')
  const as = (u: { sub: string; email: string }, role: string) => {
    session.db = createClient(url, jwt({ sub: u.sub, email: u.email, role: 'authenticated', aud: 'authenticated' }), {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    session.resolved = { userId: u.sub, email: u.email, role, originalRole: role, isEmulating: false }
  }
  const imported = async () => {
    const { data } = await admin
      .from('employees')
      .select('id, email, employee_code, name, employee_type, employee_type_id, joining_date, manager_id, team, status, confirmation_date, conversion_date')
      .in('email', ['imp.joiner@navgurukul.org', 'imp.lead@navgurukul.org', 'imp.intern@navgurukul.org', 'imp.existing@navgurukul.org'])
    return new Map((data ?? []).map((r) => [r.email as string, r]))
  }

  beforeAll(async () => {
    // supabase-js calls /rest/v1/...; PostgREST serves at the root.
    server = http.createServer((req, res) => {
      const path = (req.url ?? '').replace(/^\/rest\/v1/, '')
      const upstream = http.request(`${PGRST}${path}`, { method: req.method, headers: { ...req.headers, host: new URL(PGRST!).host } }, (up) => {
        res.writeHead(up.statusCode ?? 502, up.headers)
        up.pipe(res)
      })
      req.pipe(upstream)
    })
    await new Promise<void>((r) => server.listen(0, '127.0.0.1', r))
    url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
    admin = createClient(url, jwt({ role: 'service_role' }), { auth: { persistSession: false, autoRefreshToken: false } })
    // Someone already in the directory, with a manager, for the update case.
    const { error } = await admin.from('employees').insert({
      name: 'Existing Imported',
      email: 'imp.existing@navgurukul.org',
      employee_type: 'fte',
      joining_date: '2019-01-01',
      status: 'active',
      manager_id: '10000000-0000-0000-0000-00000000000a',
    })
    if (error) throw new Error(error.message)
    actions = await import('./importActions')
  })

  afterAll(() => server?.close())

  beforeEach(() => {
    session.audit = []
  })

  it('refuses a role without directory edit, before reading anything', async () => {
    as(EMPLOYEE, 'platform_admin')
    expect(await actions.previewEmployeeImport(FILE)).toEqual({ ok: false, error: 'You do not have access to do that.' })
    expect(await actions.runEmployeeImport(FILE)).toMatchObject({ ok: false })
    expect((await imported()).has('imp.lead@navgurukul.org')).toBe(false)
  })

  it('is refused by the database too, if the app check were ever wrong', async () => {
    // An employee's token, with the app believing they are PnC Admin.
    as(EMPLOYEE, 'pnc_admin')
    const res = await actions.runEmployeeImport(FILE)
    expect(res).toMatchObject({ ok: false, error: expect.stringContaining('row-level security') })
    expect((await imported()).has('imp.lead@navgurukul.org')).toBe(false)
  })

  it('writes nothing while any row has an error', async () => {
    as(PNC_ADMIN, 'pnc_admin')
    const res = await actions.runEmployeeImport(FILE + 'imp.bad@navgurukul.org,Bad,fte,2026-01-01,nobody@navgurukul.org,,,,\n')
    expect(res).toMatchObject({ ok: false, error: 'Fix the rows marked with errors, then upload again.' })
    expect((await imported()).has('imp.lead@navgurukul.org')).toBe(false)
  })

  it('previews, then adds and updates people with managers, as PnC Admin', async () => {
    as(PNC_ADMIN, 'pnc_admin')
    const preview = await actions.previewEmployeeImport(FILE)
    expect(preview.ok && preview.plan.counts).toEqual({ create: 3, update: 1, unchanged: 0, error: 0 })

    const before = (await imported()).get('imp.existing@navgurukul.org')!
    const res = await actions.runEmployeeImport(FILE)
    expect(res).toEqual({ ok: true, created: 3, updated: 1, unchanged: 0 })

    const rows = await imported()
    const lead = rows.get('imp.lead@navgurukul.org')!
    expect(rows.get('imp.joiner@navgurukul.org')).toMatchObject({
      employee_code: 'NG-9669',
      name: 'Joiner, Imported',
      employee_type: 'fte',
      joining_date: '2026-08-05',
      team: 'CEO Office',
      status: 'active',
      manager_id: lead.id,
    })
    expect(rows.get('imp.joiner@navgurukul.org')!.employee_type_id).toBeTruthy()
    expect(lead).toMatchObject({ confirmation_date: '2023-07-01', manager_id: null })
    expect(rows.get('imp.intern@navgurukul.org')).toMatchObject({ conversion_date: '2026-09-01', manager_id: lead.id })
    // The existing person keeps every value the file left empty.
    expect(rows.get('imp.existing@navgurukul.org')).toMatchObject({
      name: before.name,
      joining_date: before.joining_date,
      manager_id: before.manager_id,
      employee_code: 'NG-9001',
      team: 'Finance',
      confirmation_date: '2019-04-01',
    })
    expect(rows.get('imp.intern@navgurukul.org')!.employee_code).toBeNull()

    expect(session.audit).toHaveLength(4)
  })

  it('reads the same file as already in, the second time', async () => {
    as(PNC_ADMIN, 'pnc_admin')
    const preview = await actions.previewEmployeeImport(FILE)
    expect(preview.ok && preview.plan.counts).toEqual({ create: 0, update: 0, unchanged: 4, error: 0 })
    expect(await actions.runEmployeeImport(FILE)).toMatchObject({ ok: false, error: 'Nothing to import.' })
  })

  it('is refused by the database for an employee ID someone already has', async () => {
    // The plan catches this first; the unique index is the backstop for two
    // imports racing. Written straight to the table to show the index holds.
    const insert = (employee_code: string) =>
      admin
        .from('employees')
        .insert({ name: 'Dup', email: 'imp.dup@navgurukul.org', employee_code, employee_type: 'fte', joining_date: '2026-01-01' })
    expect((await insert('NG-9669')).error?.message).toMatch(/employees_employee_code_key/)
    expect((await insert('ng-9670')).error?.message).toMatch(/employees_employee_code_format/)
  })

  it('changes only the manager when only the manager changes', async () => {
    as(PNC_ADMIN, 'pnc_admin')
    const res = await actions.runEmployeeImport('email,manager_email\nimp.intern@navgurukul.org,imp.joiner@navgurukul.org\n')
    expect(res).toEqual({ ok: true, created: 0, updated: 1, unchanged: 0 })
    const rows = await imported()
    expect(rows.get('imp.intern@navgurukul.org')!.manager_id).toBe(rows.get('imp.joiner@navgurukul.org')!.id)
    expect(session.audit).toMatchObject([{ changes: [{ field: 'manager_email', from: 'imp.lead@navgurukul.org', to: 'imp.joiner@navgurukul.org' }] }])
  })
})
