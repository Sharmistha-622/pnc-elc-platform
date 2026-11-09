import type { SupabaseClient } from '@supabase/supabase-js'
import { createAdminSupabaseClient } from '@/lib/supabase/admin'
import type { User } from '@supabase/supabase-js'
import { closeAccount, endRoleBeforeExit } from '@/lib/rbac/endPlatformAccess'
import { accessEndedAt, isPreExitRoleDue, PRE_EXIT_ROLE_LEAD_HOURS } from '@/lib/rbac/lifecycle'
import { IMMUTABLE_SUPER_ADMIN_EMAILS } from '@/lib/rbac/resolveRole'
import { normalizeRole } from '@/lib/role-constants'
import { auditEvent } from '@/lib/audit/events'

// ============================================================================
// Ending stored roles before exit
// ----------------------------------------------------------------------------
// SERVER ONLY. Deliberately not a 'use server' file: it writes auth users with
// the service-role client. It runs from the daily job behind the cron secret
// (`/api/cron/pre-exit-roles`), and from offboarding actions that have already
// passed their own guard, when an exit is opened or its dates change inside
// the window.
//
// The rule itself (when, and what is removed) is `isPreExitRoleDue` and
// `endRoleBeforeExit`. This file finds the exits it applies to, and records
// what it did, with the number of active reportees still reporting to the
// leaver: the dependency most likely to need sorting out before they go.
// ============================================================================

/** Exits still under way. A completed exit has already ended access; a cancelled one ends nothing. */
export const OPEN_EXIT_STATUSES = [
  'initiated',
  'notice_period',
  'clearance_in_progress',
  'settlement_pending',
] as const

const ACTOR_NAME = 'Pre-exit role rule'
const PAGE = 500

export interface ExitForRoleCheck {
  caseId: string
  employeeId: string
  employeeEmail: string | null
  employeeName: string | null
  lastWorkingDay: string | null
  status?: string | null
}

export type PreExitTrigger = 'daily job' | 'exit opened' | 'exit dates changed'

export interface PreExitRuleResult {
  due: boolean
  ended: boolean
  failed: boolean
  activeReportees: number
}

export interface PreExitRoleReport {
  checked: number
  due: number
  ended: number
  failed: number
  reporteesToReassign: number
}

/** The last working day an exit is working to: the confirmed one, else the proposed one. */
export function lastWorkingDayOf(c: { actual_lwd?: string | null; proposed_lwd?: string | null }): string | null {
  return c.actual_lwd || c.proposed_lwd || null
}

function isOpenExit(status: string | null | undefined): boolean {
  return status == null || (OPEN_EXIT_STATUSES as readonly string[]).includes(status)
}

async function activeReporteeCount(db: SupabaseClient | null, employeeId: string): Promise<number> {
  if (!db) return 0
  try {
    const { count, error } = await db
      .from('employees')
      .select('id', { count: 'exact', head: true })
      .eq('manager_id', employeeId)
      .eq('status', 'active')
    return error ? 0 : (count ?? 0)
  } catch {
    return 0
  }
}

/**
 * Applies the rule to one exit: once it is due, the leaver's stored role goes.
 *
 * Never throws. A failure is reported in the result and logged without
 * personal data; the daily job tries again on its next run.
 */
export async function applyPreExitRoleRule(
  exit: ExitForRoleCheck,
  options: { now: Date; trigger: PreExitTrigger; db?: SupabaseClient | null },
): Promise<PreExitRuleResult> {
  const idle: PreExitRuleResult = { due: false, ended: false, failed: false, activeReportees: 0 }
  if (!isOpenExit(exit.status) || !isPreExitRoleDue(exit.lastWorkingDay, options.now)) return idle

  try {
    const result = await endRoleBeforeExit(exit.employeeEmail, { now: options.now })
    if (!result.ok) {
      console.error('Pre-exit role rule: could not end the role', { caseId: exit.caseId })
      return { ...idle, due: true, failed: true }
    }
    if (result.outcome !== 'ended') return { ...idle, due: true }

    const db = options.db === undefined ? createAdminSupabaseClient() : options.db
    const activeReportees = await activeReporteeCount(db, exit.employeeId)
    const previous = result.previousRole ?? ''

    await auditEvent(
      'access',
      'access.role.ended_before_exit',
      `Stored role removed ${PRE_EXIT_ROLE_LEAD_HOURS} hours before the last working day.`,
      {
        subject: {
          employee_id: exit.employeeId,
          employee_email: exit.employeeEmail,
          employee_name: exit.employeeName,
        },
        actorName: ACTOR_NAME,
        actorType: 'system',
        entityType: 'offboarding_case',
        entityId: exit.caseId,
        changes: [{ field: 'role', label: 'System Role', from: normalizeRole(previous) ?? previous, to: 'employee' }],
        metadata: {
          last_working_day: exit.lastWorkingDay,
          active_reportees: activeReportees,
          trigger: options.trigger,
        },
        severity: 'warning',
      },
    )
    return { due: true, ended: true, failed: false, activeReportees }
  } catch {
    console.error('Pre-exit role rule failed', { caseId: exit.caseId })
    return { ...idle, due: true, failed: true }
  }
}

type CaseRow = {
  id: string
  employee_id: string
  proposed_lwd: string | null
  actual_lwd: string | null
  status: string | null
  employees: { name: string | null; email: string | null } | { name: string | null; email: string | null }[] | null
}

/**
 * The daily job: applies the rule to every open exit.
 *
 * Reads with the service-role client the caller passes in; the caller has
 * already checked the cron secret. Returns counts only.
 */
export async function runPreExitRoleEnding(db: SupabaseClient, now: Date): Promise<PreExitRoleReport> {
  const rows: CaseRow[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await db
      .from('offboarding_cases')
      .select('id, employee_id, proposed_lwd, actual_lwd, status, employees(name, email)')
      .in('status', [...OPEN_EXIT_STATUSES])
      .order('id')
      .range(from, from + PAGE - 1)
    if (error) throw new Error('Could not read open exits')
    rows.push(...((data ?? []) as CaseRow[]))
    if (!data || data.length < PAGE) break
  }

  const report: PreExitRoleReport = { checked: rows.length, due: 0, ended: 0, failed: 0, reporteesToReassign: 0 }
  for (const row of rows) {
    const person = Array.isArray(row.employees) ? row.employees[0] : row.employees
    const result = await applyPreExitRoleRule(
      {
        caseId: row.id,
        employeeId: row.employee_id,
        employeeEmail: person?.email ?? null,
        employeeName: person?.name ?? null,
        lastWorkingDay: lastWorkingDayOf(row),
        status: row.status,
      },
      { now, trigger: 'daily job', db },
    )
    if (result.due) report.due += 1
    if (result.ended) report.ended += 1
    if (result.failed) report.failed += 1
    report.reporteesToReassign += result.activeReportees
  }
  return report
}

// ============================================================================
// Exited records end access
// ----------------------------------------------------------------------------
// An employee record marked `exited` ends the account's platform access,
// however it came to be marked: closing an exit, an import, or an edit. The
// paths that mark it end the access themselves; this runs every night after
// them and closes any account still open, so the rule holds whichever way the
// record was changed. A person with an active record too (a re-hire) keeps
// their account, as `current_app_role()` does.
// ============================================================================

export interface ExitedAccessReport {
  exitedPeople: number
  ended: number
  failed: number
}

async function exitedOnlyEmails(db: SupabaseClient): Promise<Map<string, { id: string; name: string | null }>> {
  const exited = new Map<string, { id: string; name: string | null }>()
  const active = new Set<string>()
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await db
      .from('employees')
      .select('id, name, email, status')
      .in('status', ['exited', 'active'])
      .order('id')
      .range(from, from + PAGE - 1)
    if (error) throw new Error('Could not read the directory')
    for (const row of (data ?? []) as { id: string; name: string | null; email: string | null; status: string }[]) {
      const email = row.email?.trim().toLowerCase()
      if (!email) continue
      if (row.status === 'active') active.add(email)
      else exited.set(email, { id: row.id, name: row.name })
    }
    if (!data || data.length < PAGE) break
  }
  for (const email of active) exited.delete(email)
  for (const email of IMMUTABLE_SUPER_ADMIN_EMAILS) exited.delete(email)
  return exited
}

/**
 * Closes every account whose only employee record is `exited` and whose
 * access has not ended. Reads the directory and the accounts once each.
 * `db` is the service-role client; the caller has checked the cron secret.
 */
export async function endAccessOfExitedRecords(db: SupabaseClient, now: Date): Promise<ExitedAccessReport> {
  const exited = await exitedOnlyEmails(db)
  const report: ExitedAccessReport = { exitedPeople: exited.size, ended: 0, failed: 0 }
  if (exited.size === 0) return report

  const perPage = 200
  for (let page = 1; page <= 50; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage })
    if (error) throw new Error('Could not list accounts')
    const users: User[] = data?.users ?? []
    for (const user of users) {
      const email = user.email?.trim().toLowerCase()
      const person = email ? exited.get(email) : undefined
      if (!email || !person || accessEndedAt(user.app_metadata)) continue
      const result = await closeAccount(db, user, { endedBy: ACTOR_NAME, now })
      if (!result.ok) {
        report.failed += 1
        console.error('Exited record: could not close the account', { userId: user.id })
        continue
      }
      report.ended += 1
      await auditEvent('access', 'access.revoked', 'ELC platform access revoked.', {
        subject: { employee_id: person.id, employee_email: email, employee_name: person.name },
        actorName: ACTOR_NAME,
        actorType: 'system',
        entityType: 'user',
        entityId: user.id,
        severity: 'warning',
        metadata: { source: 'exited record', trigger: 'daily job' },
      })
    }
    if (users.length < perPage) break
  }
  return report
}
