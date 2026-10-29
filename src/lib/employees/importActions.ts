'use server'

import { revalidatePath } from 'next/cache'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { guardResource } from '@/lib/rbac/guard'
import { allowedEmailDomains } from '@/lib/auth/allowedEmail'
import { recordAuditEvents } from '@/lib/audit/service'
import type { AuditEventInput } from '@/lib/audit/types'
import {
  planEmployeeImport,
  type ExistingEmployee,
  type ImportContext,
  type ImportPlan,
} from '@/lib/employees/import'

// Importing changes the directory, which the matrix makes `general: edit`:
// Super Admin, PnC Admin and PnC Ops. The writes go through the caller's own
// session, so the database's "pnc insert" / "pnc and exits update" policies
// check the same thing a second time.

const PAGE = 1000

async function loadDirectory(db: SupabaseClient): Promise<ExistingEmployee[]> {
  const out: ExistingEmployee[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await db
      .from('employees')
      .select('id, email, employee_code, name, employee_type, joining_date, manager_id, team, status, confirmation_date, conversion_date')
      .order('id')
      .range(from, from + PAGE - 1)
    if (error) throw new Error(`Could not read the directory: ${error.message}`)
    out.push(...((data ?? []) as ExistingEmployee[]))
    if (!data || data.length < PAGE) return out
  }
}

async function loadContext(db: SupabaseClient): Promise<ImportContext & { teamIds: Map<string, string> }> {
  const [existing, types, departments, teams] = await Promise.all([
    loadDirectory(db),
    db.from('employee_types').select('id, code, name'),
    db.from('departments').select('name, is_archived'),
    db.from('teams').select('id, name'),
  ])
  if (types.error) throw new Error(`Could not read employment types: ${types.error.message}`)
  if (departments.error) throw new Error(`Could not read departments: ${departments.error.message}`)
  return {
    existing,
    employeeTypes: ((types.data ?? []) as { id: string; code: string | null; name: string | null }[])
      .filter((t): t is { id: string; code: string; name: string | null } => Boolean(t.code)),
    departments: ((departments.data ?? []) as { name: string; is_archived: boolean }[])
      .filter((d) => !d.is_archived)
      .map((d) => d.name),
    allowedDomains: allowedEmailDomains(),
    teamIds: new Map(
      ((teams.data ?? []) as { id: string; name: string }[]).map((t) => [t.name.trim().toLowerCase(), t.id])
    ),
  }
}

export type PreviewResult = { ok: true; plan: ImportPlan } | { ok: false; error: string }

/** Checks the file against the directory as it stands. Writes nothing. */
export async function previewEmployeeImport(csvText: string): Promise<PreviewResult> {
  const allowed = await guardResource('general', 'edit')
  if (!allowed.ok) return { ok: false, error: allowed.error }
  if (typeof csvText !== 'string') return { ok: false, error: 'No file.' }

  try {
    const db = await createServerSupabaseClient()
    const ctx = await loadContext(db)
    return { ok: true, plan: planEmployeeImport(csvText, ctx) }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Could not check the file.' }
  }
}

export type RunResult =
  | { ok: true; created: number; updated: number; unchanged: number }
  | { ok: false; error: string; plan?: ImportPlan; created?: number; updated?: number }

/**
 * Writes the file. The plan is worked out again here from the file and the
 * directory as they are now, and nothing is written unless every row passes.
 */
export async function runEmployeeImport(csvText: string): Promise<RunResult> {
  const allowed = await guardResource('general', 'edit')
  if (!allowed.ok) return { ok: false, error: allowed.error }
  const caller = allowed.caller
  if (typeof csvText !== 'string') return { ok: false, error: 'No file.' }

  let db: SupabaseClient
  let ctx: Awaited<ReturnType<typeof loadContext>>
  try {
    db = await createServerSupabaseClient()
    ctx = await loadContext(db)
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Could not read the directory.' }
  }

  const plan = planEmployeeImport(csvText, ctx)
  if (!plan.canImport) {
    return {
      ok: false,
      plan,
      error: plan.fileErrors[0] ?? (plan.counts.error ? 'Fix the rows marked with errors, then upload again.' : 'Nothing to import.'),
    }
  }

  const now = new Date().toISOString()
  const idByEmail = new Map<string, string>()
  for (const e of ctx.existing) {
    const key = e.email?.trim().toLowerCase()
    if (key) idByEmail.set(key, e.id)
  }
  const teamIdFor = (team: string | null | undefined) =>
    team ? ctx.teamIds.get(team.trim().toLowerCase()) ?? null : null

  let created = 0
  let updated = 0
  const fail = (line: number | null, message: string): RunResult => ({
    ok: false,
    created,
    updated,
    error: `${line ? `Stopped at line ${line}: ` : ''}${message}. ${created} added and ${updated} updated before that; upload the same file again to finish — rows already in are matched by email.`,
  })

  // 1. New people, in one insert. Every key is present on every row so the
  //    insert's column list is the same for all of them.
  const creates = plan.rows.filter((r) => r.action === 'create')
  if (creates.length) {
    const { data, error } = await db
      .from('employees')
      .insert(
        creates.map((r) => ({
          email: r.write.email,
          employee_code: r.write.employee_code ?? null,
          name: r.write.name,
          employee_type: r.write.employee_type,
          employee_type_id: r.write.employee_type_id ?? null,
          joining_date: r.write.joining_date,
          status: r.write.status ?? 'active',
          team: r.write.team ?? null,
          team_id: teamIdFor(r.write.team),
          confirmation_date: r.write.confirmation_date ?? null,
          conversion_date: r.write.conversion_date ?? null,
        }))
      )
      .select('id, email')
    if (error) return fail(null, `Adding new people failed (${error.message})`)
    for (const row of (data ?? []) as { id: string; email: string }[]) {
      idByEmail.set(row.email.toLowerCase(), row.id)
    }
    created = data?.length ?? 0
    if (created !== creates.length) return fail(null, 'The database added fewer people than the file has')
  }

  // 2. Changes to people already in the directory, only in the filled cells.
  for (const r of plan.rows.filter((row) => row.action === 'update')) {
    // Every filled cell but the email, which is how the person was found.
    const patch: Record<string, unknown> = { ...r.write, updated_at: now }
    delete patch.email
    if ('team' in r.write) patch.team_id = teamIdFor(r.write.team)
    const onlyManager = r.changes.every((c) => c.field === 'manager_email')
    if (!onlyManager) {
      const { data, error } = await db.from('employees').update(patch).eq('id', r.existingId!).select('id')
      if (error) return fail(r.line, error.message)
      if (!data?.length) return fail(r.line, 'the update was refused')
    }
    updated++
  }

  // 3. Managers, once everyone in the file has an id.
  const byManager = new Map<string, string[]>()
  for (const r of plan.rows) {
    if (!r.managerEmail || (r.action !== 'create' && !r.changes.some((c) => c.field === 'manager_email'))) continue
    const managerId = idByEmail.get(r.managerEmail)
    const personId = idByEmail.get(r.email)
    if (!managerId || !personId) return fail(r.line, `could not find ${managerId ? r.email : r.managerEmail}`)
    byManager.set(managerId, [...(byManager.get(managerId) ?? []), personId])
  }
  for (const [managerId, ids] of byManager) {
    const { data, error } = await db.from('employees').update({ manager_id: managerId, updated_at: now }).in('id', ids).select('id')
    if (error) return fail(null, `Setting managers failed (${error.message})`)
    if ((data?.length ?? 0) !== ids.length) return fail(null, 'Setting managers was refused for some people')
  }

  // 4. One audit event per person changed.
  const actor = {
    actor_id: caller.userId,
    actor_email: caller.email,
    actor_name: caller.email ? caller.email.split('@')[0] : 'PnC',
    actor_type: 'pnc' as const,
  }
  const events: AuditEventInput[] = plan.rows
    .filter((r) => r.action === 'create' || r.action === 'update')
    .map((r) => ({
      subject: { employee_id: idByEmail.get(r.email) ?? null, employee_email: r.email, employee_name: r.name },
      actor,
      module: 'employee',
      action: r.action === 'create' ? 'employee.imported' : 'employee.updated_by_import',
      description:
        r.action === 'create'
          ? `Added ${r.name} to the directory by import.`
          : `Updated ${r.name} by import: ${r.changes.map((c) => c.field).join(', ')}.`,
      changes: r.action === 'update' ? r.changes : null,
      metadata: { source: 'employee_import', line: r.line, actor_role: caller.role },
    }))
  await recordAuditEvents(events)

  revalidatePath('/employees')
  revalidatePath('/manage/users')
  revalidatePath('/reviews')

  return { ok: true, created, updated, unchanged: plan.counts.unchanged }
}
