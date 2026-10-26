'use server'

// ============================================================================
// Review cycles — what the browser may ask for
// ----------------------------------------------------------------------------
// Every export is callable from any signed-in browser with any arguments, so
// each one starts with a guard and then checks the caller's relationship to
// the cycle from the session — never from what the browser sent. Only then
// does it hand over to `service.ts`, which writes with the service-role
// client.
//
// Results are `{ ok, error }`, never thrown: these run inside transitions,
// where a throw replaces the page with the error boundary.
// ============================================================================

import { revalidatePath } from 'next/cache'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { guard, passes, type Guarded } from '@/lib/rbac/guard'
import { getCurrentEmployee } from '@/lib/forms/currentEmployee'
import { platformConfigRefusal } from '@/lib/settings/access'
import {
  cancelCycle,
  closeCycle,
  defaultCtx,
  loadSettings,
  openCycle,
  recordDecision,
  remind,
  runAutomation,
  scheduleMeeting,
  setNominations,
  withdrawParticipant,
  type AutomationSummary,
  type Ctx,
} from './service'
import { relationship, REVIEW_CLOSERS, REVIEW_OPERATORS, type Relationship } from './queries'
import { DEFAULT_REVIEW_CYCLE_SETTINGS, type CycleRow, type ReviewCycleSettings, type ReviewDecision, type ReviewKind } from './types'
import { isoDate } from './engine'

type Outcome = { ok: true; message?: string } | { ok: false; error: string }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const NOT_ALLOWED = 'You do not have access to do that.'
const NO_SERVICE = 'Reviews are unavailable: the server is missing its service key.'

function refresh(cycleId?: string) {
  revalidatePath('/reviews')
  revalidatePath('/my-reviews')
  revalidatePath('/my-forms')
  if (cycleId) {
    revalidatePath(`/reviews/${cycleId}`)
    revalidatePath(`/my-reviews/${cycleId}`)
  }
}

async function actorEmail(): Promise<string> {
  const supabase = await createServerSupabaseClient()
  const { data } = await supabase.auth.getUser()
  return data.user?.email ?? 'unknown'
}

/** The cycle, and how the signed-in caller stands to it. Null if they have no standing at all. */
async function standing(caller: Guarded, cycleId: string): Promise<{ cycle: CycleRow; rel: Relationship; employeeId: string | null } | null> {
  if (!UUID.test(cycleId)) return null
  const supabase = await createServerSupabaseClient()
  const { data } = await supabase.from('review_cycles').select('*').eq('id', cycleId).maybeSingle()
  const cycle = data as CycleRow | null
  if (!cycle) return null
  const { employee } = await getCurrentEmployee(supabase)
  const { data: subject } = await supabase.from('employees').select('manager_id').eq('id', cycle.employee_id).maybeSingle()
  const rel = relationship(caller, cycle, {
    employeeId: employee?.id ?? null,
    currentManagerOfSubject: (subject?.manager_id as string | null) ?? null,
  })
  if (!rel.admin && !rel.isManager && !rel.isSubject) return null
  return { cycle, rel, employeeId: employee?.id ?? null }
}

async function ctxFor(): Promise<Ctx | null> {
  return defaultCtx(await actorEmail())
}

// ----------------------------------------------------------------------------
// Starting
// ----------------------------------------------------------------------------

/**
 * Opens a review for one employee now, without waiting for the daily job.
 * PnC for anyone; a line manager for a confirmation of their own report.
 */
export async function startReviewCycle(input: { employeeId: string; kind: ReviewKind; periodKey?: string; periodLabel?: string; dueDate?: string | null }): Promise<Outcome & { cycleId?: string }> {
  const allowed = await guard('self')
  if (!allowed.ok) return { ok: false, error: allowed.error }
  if (!UUID.test(input.employeeId) || (input.kind !== 'confirmation' && input.kind !== 'appraisal')) {
    return { ok: false, error: 'Invalid request.' }
  }

  const supabase = await createServerSupabaseClient()
  const pnc = input.kind === 'confirmation'
    ? passes(allowed.caller, REVIEW_OPERATORS)
    : passes(allowed.caller, ['super_admin', 'pnc_admin'])
  if (!pnc) {
    if (input.kind !== 'confirmation') return { ok: false, error: NOT_ALLOWED }
    const { employee } = await getCurrentEmployee(supabase)
    const { data: e } = await supabase.from('employees').select('manager_id').eq('id', input.employeeId).maybeSingle()
    if (!employee || e?.manager_id !== employee.id) return { ok: false, error: NOT_ALLOWED }
  }

  const periodKey = input.kind === 'confirmation' ? 'confirmation' : input.periodKey ?? ''
  if (input.kind === 'appraisal' && !/^appraisal:[a-z0-9_-]+-\d{4}$/.test(periodKey)) {
    return { ok: false, error: 'Choose the appraisal cycle to start.' }
  }
  const dueDate = input.dueDate && /^\d{4}-\d{2}-\d{2}$/.test(input.dueDate) ? input.dueDate : null

  const ctx = await ctxFor()
  if (!ctx) return { ok: false, error: NO_SERVICE }
  const { data: typeRow } = await supabase.from('employees').select('employee_type, employee_types(code)').eq('id', input.employeeId).maybeSingle()
  const typeCode = (typeRow as { employee_type?: string; employee_types?: { code?: string } | null } | null)?.employee_types?.code
    ?? (typeRow as { employee_type?: string } | null)?.employee_type ?? null
  const opened = await openCycle(ctx, {
    employeeId: input.employeeId,
    kind: input.kind,
    periodKey,
    periodLabel: input.kind === 'confirmation' ? 'Probation' : (input.periodLabel ?? periodKey.replace('appraisal:', '')).slice(0, 80),
    dueDate,
    typeCode,
  })
  if (!opened.ok) return { ok: false, error: opened.error }
  refresh(opened.value.cycleId)
  return { ok: true, cycleId: opened.value.cycleId, message: opened.value.created ? 'Review started. The employee and their manager have been emailed.' : 'A review for this period is already open.' }
}

/** Runs the daily job now: opens what is due, reminds, escalates. PnC only. */
export async function runReviewAutomationNow(): Promise<Outcome & { summary?: AutomationSummary }> {
  const allowed = await guard(REVIEW_OPERATORS)
  if (!allowed.ok) return { ok: false, error: allowed.error }
  const ctx = await ctxFor()
  if (!ctx) return { ok: false, error: NO_SERVICE }
  const summary = await runAutomation(ctx, { force: true })
  refresh()
  return { ok: true, summary }
}

// ----------------------------------------------------------------------------
// The employee's part
// ----------------------------------------------------------------------------

/**
 * The employee names the peers they want feedback from. Before they submit
 * their own review, only they may change the list; afterwards, PnC can add
 * peers (who are sent their form at once).
 */
export async function saveNominations(cycleId: string, peerIds: string[]): Promise<Outcome> {
  const allowed = await guard('self')
  if (!allowed.ok) return { ok: false, error: allowed.error }
  if (!Array.isArray(peerIds) || peerIds.length > 20 || peerIds.some((id) => typeof id !== 'string' || !UUID.test(id))) {
    return { ok: false, error: 'Invalid list.' }
  }
  const s = await standing(allowed.caller, cycleId)
  if (!s) return { ok: false, error: NOT_ALLOWED }
  const subjectMay = s.rel.isSubject && s.cycle.stage === 'self_review'
  if (!subjectMay && !s.rel.operator) return { ok: false, error: s.rel.isSubject ? 'Your nominations are locked once you submit your self-reflection. Ask PnC to add someone.' : NOT_ALLOWED }

  const ctx = await ctxFor()
  if (!ctx) return { ok: false, error: NO_SERVICE }
  const saved = await setNominations(ctx, cycleId, peerIds, s.employeeId)
  if (!saved.ok) return { ok: false, error: saved.error }
  refresh(cycleId)
  return { ok: true, message: 'Nominations saved.' }
}

// ----------------------------------------------------------------------------
// Reminders
// ----------------------------------------------------------------------------

/**
 * Reminds one person, subject to the same 24-hour clock as the automatic
 * reminder. PnC for anyone; the manager for anyone on their report's review;
 * the employee for their peers and manager.
 */
export async function sendReviewReminder(participantId: string): Promise<Outcome> {
  const allowed = await guard('self')
  if (!allowed.ok) return { ok: false, error: allowed.error }
  if (!UUID.test(participantId)) return { ok: false, error: 'Invalid request.' }

  const supabase = await createServerSupabaseClient()
  const { data: p } = await supabase.from('review_participants').select('cycle_id, role, employee_id').eq('id', participantId).maybeSingle()
  if (!p) return { ok: false, error: NOT_ALLOWED }
  const s = await standing(allowed.caller, p.cycle_id as string)
  if (!s) return { ok: false, error: NOT_ALLOWED }
  const may = s.rel.operator || s.rel.isManager || (s.rel.isSubject && p.role !== 'self')
  if (!may) return { ok: false, error: NOT_ALLOWED }

  const ctx = await ctxFor()
  if (!ctx) return { ok: false, error: NO_SERVICE }
  // The timeline names PnC and managers; an employee chasing their own
  // reviewers is recorded as such, without exposing who pressed it to peers.
  if (s.rel.isSubject) ctx.actor = 'the employee'
  const sent = await remind(ctx, participantId)
  if (!sent.ok) return { ok: false, error: sent.error }
  refresh(p.cycle_id as string)
  return { ok: true, message: 'Reminder sent.' }
}

/** Reminds everyone still owed on one cycle, each on their own 24-hour clock. */
export async function remindAllPending(cycleId: string): Promise<Outcome> {
  const allowed = await guard('self')
  if (!allowed.ok) return { ok: false, error: allowed.error }
  const s = await standing(allowed.caller, cycleId)
  if (!s || !(s.rel.operator || s.rel.isManager || s.rel.isSubject)) return { ok: false, error: NOT_ALLOWED }

  const ctx = await ctxFor()
  if (!ctx) return { ok: false, error: NO_SERVICE }
  if (s.rel.isSubject) ctx.actor = 'the employee'
  const { data: rows } = await ctx.db.from('review_participants').select('id, role').eq('cycle_id', cycleId).eq('status', 'invited')
  let sent = 0
  let waiting = 0
  for (const r of (rows ?? []) as { id: string; role: string }[]) {
    if (s.rel.isSubject && !s.rel.operator && r.role === 'self') continue
    const res = await remind(ctx, r.id)
    if (res.ok) sent++
    else waiting++
  }
  refresh(cycleId)
  if (sent === 0) return { ok: false, error: waiting > 0 ? 'Everyone still pending was asked or reminded in the last 24 hours.' : 'Nobody is pending.' }
  return { ok: true, message: `${sent} ${sent === 1 ? 'reminder' : 'reminders'} sent${waiting ? `; ${waiting} not yet due` : ''}.` }
}

/** PnC: remind everyone pending on every open cycle, where the clock allows. */
export async function remindEveryonePending(): Promise<Outcome> {
  const allowed = await guard(REVIEW_OPERATORS)
  if (!allowed.ok) return { ok: false, error: allowed.error }
  const ctx = await ctxFor()
  if (!ctx) return { ok: false, error: NO_SERVICE }
  const { data: open } = await ctx.db.from('review_cycles').select('id').in('stage', ['self_review', 'in_review', 'ready_for_meeting', 'meeting_scheduled'])
  const ids = ((open ?? []) as { id: string }[]).map((c) => c.id)
  if (ids.length === 0) return { ok: false, error: 'No reviews are open.' }
  const { data: rows } = await ctx.db.from('review_participants').select('id').in('cycle_id', ids).eq('status', 'invited')
  let sent = 0
  let waiting = 0
  for (const r of (rows ?? []) as { id: string }[]) {
    const res = await remind(ctx, r.id)
    if (res.ok) sent++
    else waiting++
  }
  refresh()
  return { ok: true, message: `${sent} ${sent === 1 ? 'reminder' : 'reminders'} sent; ${waiting} not yet due.` }
}

// ----------------------------------------------------------------------------
// The meeting, the decision, the close
// ----------------------------------------------------------------------------

/** Books or moves the meeting. PnC, or the manager. `start` is ISO 8601. */
export async function scheduleReviewMeeting(cycleId: string, start: string): Promise<Outcome> {
  const allowed = await guard('self')
  if (!allowed.ok) return { ok: false, error: allowed.error }
  const s = await standing(allowed.caller, cycleId)
  if (!s || !(s.rel.operator || s.rel.isManager)) return { ok: false, error: NOT_ALLOWED }
  const when = new Date(start)
  if (typeof start !== 'string' || Number.isNaN(when.getTime())) return { ok: false, error: 'Choose a date and time.' }

  const ctx = await ctxFor()
  if (!ctx) return { ok: false, error: NO_SERVICE }
  const res = await scheduleMeeting(ctx, cycleId, when)
  if (!res.ok) return { ok: false, error: res.error }
  refresh(cycleId)
  return { ok: true, message: 'Meeting booked. The invitation has gone to the manager, the employee and PnC.' }
}

/**
 * The manager records the decision after the meeting. PnC Admin may record it
 * on the manager's behalf. Nobody else — not PnC Ops, whose access to
 * performance is status only.
 */
export async function recordReviewDecision(cycleId: string, input: { decision: string; note: string; extendUntil?: string | null }): Promise<Outcome> {
  const allowed = await guard('self')
  if (!allowed.ok) return { ok: false, error: allowed.error }
  const s = await standing(allowed.caller, cycleId)
  if (!s) return { ok: false, error: NOT_ALLOWED }
  if (!s.rel.isManager && !passes(allowed.caller, REVIEW_CLOSERS)) return { ok: false, error: NOT_ALLOWED }
  if (typeof input?.decision !== 'string' || typeof input?.note !== 'string') return { ok: false, error: 'Invalid request.' }

  const ctx = await ctxFor()
  if (!ctx) return { ok: false, error: NO_SERVICE }
  const res = await recordDecision(ctx, cycleId, {
    decision: input.decision as ReviewDecision,
    note: input.note,
    extendUntil: input.extendUntil ?? null,
    decidedBy: s.rel.isManager ? s.employeeId : s.cycle.manager_id,
  })
  if (!res.ok) return { ok: false, error: res.error }
  refresh(cycleId)
  return { ok: true, message: 'Decision recorded and sent to PnC.' }
}

/** PnC accepts the manager's decision (and it takes effect), or returns it. */
export async function closeReviewCycle(cycleId: string, input: { outcome: string; note: string }): Promise<Outcome> {
  const allowed = await guard(REVIEW_CLOSERS)
  if (!allowed.ok) return { ok: false, error: allowed.error }
  const s = await standing(allowed.caller, cycleId)
  if (!s) return { ok: false, error: NOT_ALLOWED }
  if (input?.outcome !== 'accepted' && input?.outcome !== 'returned') return { ok: false, error: 'Invalid request.' }
  // Nobody closes their own review, whatever their role.
  if (s.rel.isSubject) return { ok: false, error: 'You cannot close your own review.' }

  const ctx = await ctxFor()
  if (!ctx) return { ok: false, error: NO_SERVICE }
  const res = await closeCycle(ctx, cycleId, { outcome: input.outcome, note: String(input.note ?? '').slice(0, 2000) })
  if (!res.ok) return { ok: false, error: res.error }
  refresh(cycleId)
  return { ok: true, message: input.outcome === 'accepted' ? 'Review closed.' : 'Sent back to the manager.' }
}

export async function cancelReviewCycle(cycleId: string, reason: string): Promise<Outcome> {
  const allowed = await guard(REVIEW_OPERATORS)
  if (!allowed.ok) return { ok: false, error: allowed.error }
  const s = await standing(allowed.caller, cycleId)
  if (!s || s.rel.isSubject) return { ok: false, error: NOT_ALLOWED }
  const ctx = await ctxFor()
  if (!ctx) return { ok: false, error: NO_SERVICE }
  const res = await cancelCycle(ctx, cycleId, String(reason ?? '').slice(0, 500))
  if (!res.ok) return { ok: false, error: res.error }
  refresh(cycleId)
  return { ok: true, message: 'Review cancelled. Open forms were withdrawn.' }
}

export async function withdrawReviewer(participantId: string): Promise<Outcome> {
  const allowed = await guard(REVIEW_OPERATORS)
  if (!allowed.ok) return { ok: false, error: allowed.error }
  if (!UUID.test(participantId)) return { ok: false, error: 'Invalid request.' }
  const supabase = await createServerSupabaseClient()
  const { data: p } = await supabase.from('review_participants').select('cycle_id').eq('id', participantId).maybeSingle()
  if (!p) return { ok: false, error: NOT_ALLOWED }
  const s = await standing(allowed.caller, p.cycle_id as string)
  if (!s || s.rel.isSubject) return { ok: false, error: NOT_ALLOWED }
  const ctx = await ctxFor()
  if (!ctx) return { ok: false, error: NO_SERVICE }
  const res = await withdrawParticipant(ctx, participantId)
  if (!res.ok) return { ok: false, error: res.error }
  refresh(p.cycle_id as string)
  return { ok: true, message: 'Reviewer withdrawn.' }
}

// ----------------------------------------------------------------------------
// Settings
// ----------------------------------------------------------------------------

export async function getReviewCycleSettings(): Promise<ReviewCycleSettings> {
  const allowed = await guard('platformConfig')
  if (!allowed.ok) return DEFAULT_REVIEW_CYCLE_SETTINGS
  const supabase = await createServerSupabaseClient()
  return loadSettings(supabase)
}

const INT_RANGES: Partial<Record<keyof ReviewCycleSettings, [number, number]>> = {
  confirmation_lead_days: [0, 60],
  appraisal_lead_days: [0, 60],
  self_due_days: [1, 60],
  peer_due_days: [1, 60],
  manager_due_days: [1, 60],
  reminder_interval_hours: [24, 336],
  reminders_before_escalation: [1, 10],
  meeting_duration_minutes: [15, 180],
  meeting_lead_working_days: [0, 15],
}

export async function updateReviewCycleSettings(patch: Partial<ReviewCycleSettings>): Promise<Outcome> {
  const refused = await platformConfigRefusal()
  if (refused) return { ok: false, error: refused.error }

  const clean: Record<string, unknown> = {}
  for (const [key, [lo, hi]] of Object.entries(INT_RANGES) as [keyof ReviewCycleSettings, [number, number]][]) {
    if (patch[key] === undefined) continue
    const n = Number(patch[key])
    if (!Number.isInteger(n) || n < lo || n > hi) return { ok: false, error: `${String(key).replace(/_/g, ' ')} must be a whole number from ${lo} to ${hi}.` }
    clean[key] = n
  }
  if (patch.meeting_ready_peer_ratio !== undefined) {
    const r = Number(patch.meeting_ready_peer_ratio)
    if (!(r >= 0 && r <= 1)) return { ok: false, error: 'The peer share must be between 0% and 100%.' }
    clean.meeting_ready_peer_ratio = Math.round(r * 100) / 100
  }
  for (const key of ['automation_enabled', 'auto_schedule_meeting'] as const) {
    if (patch[key] !== undefined) clean[key] = Boolean(patch[key])
  }
  if (patch.pnc_notification_email !== undefined) {
    const raw = String(patch.pnc_notification_email ?? '').trim()
    const list = raw ? raw.split(',').map((s) => s.trim()).filter(Boolean) : []
    if (list.some((e) => !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e))) return { ok: false, error: 'Enter valid email addresses, separated by commas.' }
    clean.pnc_notification_email = list.length ? list.join(', ') : null
  }

  const supabase = await createServerSupabaseClient()
  const email = await actorEmail()
  const { error } = await supabase
    .from('review_cycle_settings')
    .update({ ...clean, updated_at: new Date().toISOString(), updated_by: email })
    .eq('id', 'default')
  if (error) return { ok: false, error: 'Could not save the settings.' }
  await supabase.from('settings_change_log').insert({
    table_name: 'review_cycle_settings',
    // A single row with a text id; the log's record_id is a uuid.
    record_id: null,
    setting_key: 'review_cycle_settings',
    old_value: null,
    new_value: JSON.stringify(clean),
    changed_by: email,
    changed_at: new Date().toISOString(),
  })
  revalidatePath('/manage/settings/reviews')
  return { ok: true, message: 'Saved.' }
}

/** Today's date in ISO, for date inputs rendered on the server. */
export async function reviewToday(): Promise<string> {
  const allowed = await guard('self')
  if (!allowed.ok) return ''
  return isoDate(new Date())
}
