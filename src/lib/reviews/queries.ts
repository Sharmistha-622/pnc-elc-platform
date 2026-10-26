// ============================================================================
// Review cycles — what each person may see
// ----------------------------------------------------------------------------
// Not a 'use server' module: server components call these, the browser never
// does. Each function starts with a guard, works out how the caller relates to
// the cycle, and returns only what that relationship allows:
//
//   PnC who read feedback   statuses, every review (peers without names),
//   (Super Admin, PnC         the decision, the timeline
//   Admin, Exec View)
//   PnC Ops                 statuses and the timeline. Never what anyone
//                           wrote: the matrix gives them `status_only`.
//   The manager             statuses, the self-reflection, the peer reviews
//                           (without names), their own review, the decision,
//                           the timeline
//   The employee            who was asked and whether they answered. Never
//                           what anyone wrote, never the decision.
//   Anyone else             nothing.
//
// Statuses are read with the caller's own session, so the database's row
// policies apply as well. Answers are read with the service-role client, after
// the check above, because `form_answers` is deliberately closed to managers
// at the database (202610241000_lockdown_rls.sql, section 13).
// ============================================================================

import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createAdminSupabaseClient } from '@/lib/supabase/admin'
import { guard, passes, type Guarded } from '@/lib/rbac/guard'
import { getCurrentEmployee } from '@/lib/forms/currentEmployee'
import { formatAnswer } from '@/lib/forms/answers'
import { mayReadFeedbackText } from '@/lib/confirmations/access'
import { readiness, reminderState, waitLabel } from './engine'
import { loadSettings, whoIsDue, type DueEntry } from './service'
import {
  OPEN_STAGES,
  type CycleRow,
  type DecisionRow,
  type ParticipantRole,
  type ParticipantRow,
  type ReviewCycleSettings,
} from './types'

export type { DueEntry }

type Db = Awaited<ReturnType<typeof createServerSupabaseClient>>

/** Roles that run review cycles for the whole organisation. */
export const REVIEW_ADMINS = ['super_admin', 'pnc_admin', 'pnc_ops', 'exec_view'] as const
/** Roles that may act on any cycle (remind, schedule, cancel). */
export const REVIEW_OPERATORS = ['super_admin', 'pnc_admin', 'pnc_ops'] as const
/** Roles that close a cycle: PnC's own decision. */
export const REVIEW_CLOSERS = ['super_admin', 'pnc_admin'] as const

/**
 * Peer answers are shown only once this many peers have answered, so that
 * a manager cannot tell who wrote what from who has submitted. Added: the
 * request asked for peer reviews to reach the manager and PnC; this keeps the
 * "without your name" promise the peer form makes.
 */
export const MIN_PEERS_FOR_ANONYMITY = 2

export type Relationship = {
  /** Runs cycles org-wide (see REVIEW_ADMINS). */
  admin: boolean
  /** May read what reviewers wrote. */
  readsText: boolean
  /** May act: remind, schedule, cancel. */
  operator: boolean
  /** May close a cycle: PnC's own call. */
  closer: boolean
  isManager: boolean
  isSubject: boolean
}

export function relationship(
  caller: Pick<Guarded, 'role' | 'originalRole'>,
  cycle: Pick<CycleRow, 'employee_id' | 'manager_id'>,
  me: { employeeId: string | null; currentManagerOfSubject: string | null }
): Relationship {
  const admin = passes({ ...caller, userId: 'x' } as Guarded, REVIEW_ADMINS)
  const isSubject = Boolean(me.employeeId && me.employeeId === cycle.employee_id)
  const isManager =
    !isSubject &&
    Boolean(me.employeeId && (me.employeeId === cycle.manager_id || me.employeeId === me.currentManagerOfSubject))
  return {
    admin,
    readsText: (admin && mayReadFeedbackText(caller)) || isManager,
    operator: passes({ ...caller, userId: 'x' } as Guarded, REVIEW_OPERATORS),
    closer: passes({ ...caller, userId: 'x' } as Guarded, REVIEW_CLOSERS) && !isSubject,
    isManager,
    isSubject,
  }
}

export type ParticipantView = {
  id: string
  employeeId: string
  role: ParticipantRole
  name: string
  status: ParticipantRow['status']
  invitedAt: string | null
  dueAt: string | null
  submittedAt: string | null
  reminderCount: number
  lastRemindedAt: string | null
  escalated: boolean
  /** Whether the viewer may press "remind" now, and if not, how long to wait. */
  remind: { allowed: boolean; wait: string | null }
}

export type CycleSummary = {
  id: string
  kind: CycleRow['kind']
  stage: CycleRow['stage']
  periodLabel: string | null
  dueDate: string | null
  employeeId: string
  employeeName: string
  managerName: string | null
  createdAt: string
  meetingStart: string | null
  counts: { peersAsked: number; peersDone: number; peersNominated: number; selfDone: boolean; managerDone: boolean; pendingTotal: number; escalated: number }
  ready: boolean
}

export type ReviewAnswer = { label: string; value: string }
export type ReviewBlock = { title: string; submittedAt: string | null; answers: ReviewAnswer[] }

export type CycleDetail = CycleSummary & {
  rel: Relationship
  participants: ParticipantView[]
  /** Null when the viewer may not read what was written. */
  reviews: {
    self: ReviewBlock | null
    manager: ReviewBlock | null
    peers: ReviewBlock[]
    peersHidden: boolean
  } | null
  decision: (Pick<DecisionRow, 'decision' | 'extend_until' | 'note' | 'decided_at' | 'pnc_outcome' | 'pnc_note' | 'pnc_reviewed_at' | 'pnc_reviewed_by'> & { decidedByName: string | null }) | null
  events: { kind: string; actor: string; at: string; detail: Record<string, unknown> | null }[] | null
  settings: Pick<ReviewCycleSettings, 'reminder_interval_hours' | 'meeting_duration_minutes'>
  peerBounds: { min: number; max: number }
  /** Active colleagues the employee may nominate, for the nomination picker. */
  nominees: { id: string; name: string }[] | null
  selfRequestId: string | null
  managerRequestId: string | null
}

type Names = Map<string, string>

async function namesFor(db: Db, ids: (string | null | undefined)[]): Promise<Names> {
  const unique = Array.from(new Set(ids.filter((v): v is string => Boolean(v))))
  if (unique.length === 0) return new Map()
  const { data } = await db.from('employees').select('id, name').in('id', unique)
  return new Map(((data ?? []) as { id: string; name: string }[]).map((r) => [r.id, r.name]))
}

function summarise(cycle: CycleRow, participants: ParticipantRow[], names: Names, ratio: number): CycleSummary {
  const r = readiness(participants, ratio)
  return {
    id: cycle.id,
    kind: cycle.kind,
    stage: cycle.stage,
    periodLabel: cycle.period_label,
    dueDate: cycle.due_date,
    employeeId: cycle.employee_id,
    employeeName: names.get(cycle.employee_id) ?? 'Unknown',
    managerName: cycle.manager_id ? names.get(cycle.manager_id) ?? null : null,
    createdAt: cycle.created_at,
    meetingStart: cycle.meeting_start,
    counts: {
      peersAsked: r.peersAsked,
      peersDone: r.peersDone,
      peersNominated: participants.filter((p) => p.role === 'peer' && p.status === 'nominated').length,
      selfDone: r.selfDone,
      managerDone: r.managerDone,
      pendingTotal: participants.filter((p) => p.status === 'invited').length,
      escalated: participants.filter((p) => p.status === 'invited' && p.escalated_at).length,
    },
    ready: r.ready,
  }
}

function participantView(
  p: ParticipantRow,
  names: Names,
  now: Date,
  intervalHours: number,
  mayRemind: boolean,
  stageOpen: boolean,
  seesEscalation: boolean
): ParticipantView {
  const state = reminderState(p, now, intervalHours)
  return {
    id: p.id,
    employeeId: p.employee_id,
    role: p.role,
    name: names.get(p.employee_id) ?? 'Unknown',
    status: p.status,
    invitedAt: p.invited_at,
    dueAt: p.due_at,
    submittedAt: p.submitted_at,
    reminderCount: p.reminder_count,
    lastRemindedAt: p.last_reminded_at,
    // That PnC was told is PnC's and the manager's business, not the employee's.
    escalated: seesEscalation && Boolean(p.escalated_at),
    remind: {
      allowed: mayRemind && stageOpen && state.canRemind,
      wait: mayRemind && stageOpen && !state.canRemind && state.reason === 'cooling_down' ? waitLabel(state.waitMs) : null,
    },
  }
}

// ----------------------------------------------------------------------------
// PnC dashboard
// ----------------------------------------------------------------------------

export type Dashboard = {
  cycles: CycleSummary[]
  due: DueEntry[]
  totals: {
    open: number
    selfDone: number
    peerRequests: number
    peerDone: number
    managerDone: number
    ready: number
    meetings: number
    awaitingPnc: number
    closed: number
    escalated: number
  }
  canOperate: boolean
  canClose: boolean
  automationEnabled: boolean
  pncMailboxSet: boolean
}

export async function getReviewDashboard(filter: { kind?: string; period?: string } = {}): Promise<Dashboard | null> {
  const allowed = await guard('reviews')
  if (!allowed.ok) return null
  const supabase = await createServerSupabaseClient()

  let query = supabase.from('review_cycles').select('*').order('created_at', { ascending: false })
  if (filter.kind === 'confirmation' || filter.kind === 'appraisal') query = query.eq('kind', filter.kind)
  if (filter.period) query = query.eq('period_key', filter.period)
  const { data: cycleRows } = await query
  const cycles = (cycleRows ?? []) as CycleRow[]
  const ids = cycles.map((c) => c.id)
  const { data: partRows } = ids.length
    ? await supabase.from('review_participants').select('*').in('cycle_id', ids)
    : { data: [] }
  const participants = (partRows ?? []) as ParticipantRow[]
  const names = await namesFor(supabase, [...cycles.map((c) => c.employee_id), ...cycles.map((c) => c.manager_id)])

  const settings = await loadSettings(supabase)
  const summaries = cycles.map((c) =>
    summarise(c, participants.filter((p) => p.cycle_id === c.id), names, settings.meeting_ready_peer_ratio)
  )

  const live = summaries.filter((s) => s.stage !== 'cancelled')
  const open = live.filter((s) => OPEN_STAGES.includes(s.stage))

  // Who is due reads every employee's dates and every rule; the service-role
  // client avoids a half answer for roles whose directory read is narrower.
  const admin = createAdminSupabaseClient()
  const due = admin ? (await whoIsDue(admin, new Date(), settings)).filter((d) => !filter.kind || d.kind === filter.kind) : []

  return {
    cycles: summaries,
    due,
    totals: {
      open: open.length,
      selfDone: live.filter((s) => s.counts.selfDone).length,
      peerRequests: live.reduce((n, s) => n + s.counts.peersAsked, 0),
      peerDone: live.reduce((n, s) => n + s.counts.peersDone, 0),
      managerDone: live.filter((s) => s.counts.managerDone).length,
      ready: live.filter((s) => s.stage === 'ready_for_meeting').length,
      meetings: live.filter((s) => s.stage === 'meeting_scheduled').length,
      awaitingPnc: live.filter((s) => s.stage === 'decision_recorded').length,
      closed: live.filter((s) => s.stage === 'closed').length,
      escalated: open.reduce((n, s) => n + s.counts.escalated, 0),
    },
    canOperate: passes(allowed.caller, REVIEW_OPERATORS),
    canClose: passes(allowed.caller, REVIEW_CLOSERS),
    automationEnabled: settings.automation_enabled,
    pncMailboxSet: Boolean(settings.pnc_notification_email?.trim()),
  }
}

// ----------------------------------------------------------------------------
// My reviews: mine, and my direct reports'
// ----------------------------------------------------------------------------

export async function getMyReviews(): Promise<{ mine: CycleSummary[]; team: CycleSummary[]; linked: boolean } | null> {
  const allowed = await guard('self')
  if (!allowed.ok) return null
  const supabase = await createServerSupabaseClient()
  const { employee } = await getCurrentEmployee(supabase)
  if (!employee) return { mine: [], team: [], linked: false }

  const { data: reports } = await supabase.from('employees').select('id').eq('manager_id', employee.id)
  const reportIds = ((reports ?? []) as { id: string }[]).map((r) => r.id)

  const [{ data: mineRows }, { data: teamRows }] = await Promise.all([
    supabase.from('review_cycles').select('*').eq('employee_id', employee.id).neq('stage', 'cancelled').order('created_at', { ascending: false }),
    supabase
      .from('review_cycles')
      .select('*')
      .or([`manager_id.eq.${employee.id}`, ...(reportIds.length ? [`employee_id.in.(${reportIds.join(',')})`] : [])].join(','))
      .neq('stage', 'cancelled')
      .neq('employee_id', employee.id)
      .order('created_at', { ascending: false }),
  ])
  const all = [...((mineRows ?? []) as CycleRow[]), ...((teamRows ?? []) as CycleRow[])]
  const ids = all.map((c) => c.id)
  const { data: partRows } = ids.length ? await supabase.from('review_participants').select('*').in('cycle_id', ids) : { data: [] }
  const participants = (partRows ?? []) as ParticipantRow[]
  const names = await namesFor(supabase, [...all.map((c) => c.employee_id), ...all.map((c) => c.manager_id)])
  const settings = await loadSettings(supabase)
  const sum = (c: CycleRow) => summarise(c, participants.filter((p) => p.cycle_id === c.id), names, settings.meeting_ready_peer_ratio)
  return {
    mine: ((mineRows ?? []) as CycleRow[]).map(sum),
    team: ((teamRows ?? []) as CycleRow[]).map(sum),
    linked: true,
  }
}

// ----------------------------------------------------------------------------
// One cycle
// ----------------------------------------------------------------------------

async function readReviews(cycle: CycleRow, participants: ParticipantRow[], rel: Relationship): Promise<CycleDetail['reviews']> {
  if (!rel.readsText) return null
  const db = createAdminSupabaseClient()
  if (!db) return null

  const submitted = participants.filter((p) => p.status === 'submitted' && p.form_request_id)
  const requestIds = submitted.map((p) => p.form_request_id as string)
  if (requestIds.length === 0) return { self: null, manager: null, peers: [], peersHidden: false }

  const { data: subs } = await db
    .from('form_submissions')
    .select('id, request_id, form_version_id, submitted_at')
    .in('request_id', requestIds)
    .eq('status', 'submitted')
  const submissions = (subs ?? []) as { id: string; request_id: string; form_version_id: string; submitted_at: string | null }[]
  const versionIds = Array.from(new Set(submissions.map((s) => s.form_version_id)))
  const [{ data: fieldRows }, { data: sectionRows }, { data: answerRows }] = await Promise.all([
    versionIds.length ? db.from('form_fields').select('id, section_id, label, field_type, order_index, form_version_id').in('form_version_id', versionIds) : Promise.resolve({ data: [] }),
    versionIds.length ? db.from('form_sections').select('id, order_index').in('form_version_id', versionIds) : Promise.resolve({ data: [] }),
    submissions.length ? db.from('form_answers').select('submission_id, field_id, value').in('submission_id', submissions.map((s) => s.id)) : Promise.resolve({ data: [] }),
  ])
  const fields = (fieldRows ?? []) as { id: string; section_id: string; label: string; field_type: string; order_index: number; form_version_id: string }[]
  const sectionOrder = new Map(((sectionRows ?? []) as { id: string; order_index: number }[]).map((s) => [s.id, s.order_index]))
  const answers = (answerRows ?? []) as { submission_id: string; field_id: string; value: unknown }[]

  // Employee pickers in a review form show names; everything else is text.
  const pickerIds = answers
    .filter((a) => fields.find((f) => f.id === a.field_id)?.field_type === 'employee_picker' && typeof a.value === 'string')
    .map((a) => a.value as string)
  const { data: pickerRows } = pickerIds.length ? await db.from('employees').select('id, name').in('id', pickerIds) : { data: [] }
  const pickerNames = new Map(((pickerRows ?? []) as { id: string; name: string }[]).map((r) => [r.id, r.name]))

  const block = (title: string, s: (typeof submissions)[number]): ReviewBlock => ({
    title,
    submittedAt: s.submitted_at,
    answers: fields
      .filter((f) => f.form_version_id === s.form_version_id)
      .sort((a, b) => (sectionOrder.get(a.section_id) ?? 0) - (sectionOrder.get(b.section_id) ?? 0) || a.order_index - b.order_index)
      .map((f) => ({
        label: f.label,
        value: formatAnswer(f, answers.find((a) => a.submission_id === s.id && a.field_id === f.id)?.value, pickerNames),
      })),
  })
  const subFor = (p: ParticipantRow) => submissions.find((s) => s.request_id === p.form_request_id)

  const selfP = submitted.find((p) => p.role === 'self')
  const managerP = submitted.find((p) => p.role === 'manager')
  const selfSub = selfP && subFor(selfP)
  const managerSub = managerP && subFor(managerP)

  const peerSubs = submitted
    .filter((p) => p.role === 'peer')
    .map(subFor)
    .filter((s): s is (typeof submissions)[number] => Boolean(s))
    // Ordered by submission id, which says nothing about who wrote it.
    .sort((a, b) => a.id.localeCompare(b.id))
  const peersHidden = peerSubs.length > 0 && peerSubs.length < MIN_PEERS_FOR_ANONYMITY

  return {
    self: selfSub ? block('Self-reflection', selfSub) : null,
    manager: managerSub ? block('Manager review', managerSub) : null,
    // Submission times are dropped from peer blocks: next to the status
    // list, a timestamp would name the writer.
    peers: peersHidden ? [] : peerSubs.map((s, i) => ({ ...block(`Peer review ${i + 1}`, s), submittedAt: null })),
    peersHidden,
  }
}

export async function getCycleDetail(cycleId: string): Promise<CycleDetail | null> {
  const allowed = await guard('self')
  if (!allowed.ok) return null
  if (!/^[0-9a-f-]{36}$/i.test(cycleId)) return null
  const supabase = await createServerSupabaseClient()

  // The row policy already limits this to admins, the manager and the
  // employee; anything else reads as not found.
  const { data: row } = await supabase.from('review_cycles').select('*').eq('id', cycleId).maybeSingle()
  const cycle = row as CycleRow | null
  if (!cycle) return null

  const { employee } = await getCurrentEmployee(supabase)
  const { data: subjectRow } = await supabase.from('employees').select('manager_id').eq('id', cycle.employee_id).maybeSingle()
  const rel = relationship(allowed.caller, cycle, {
    employeeId: employee?.id ?? null,
    currentManagerOfSubject: (subjectRow?.manager_id as string | null) ?? null,
  })
  if (!rel.admin && !rel.isManager && !rel.isSubject) return null

  const { data: partRows } = await supabase.from('review_participants').select('*').eq('cycle_id', cycleId)
  const participants = ((partRows ?? []) as ParticipantRow[]).filter((p) => p.status !== 'cancelled' || rel.admin)
  const settings = await loadSettings(supabase)
  const names = await namesFor(supabase, [cycle.employee_id, cycle.manager_id, ...participants.map((p) => p.employee_id)])

  const stageOpen = OPEN_STAGES.includes(cycle.stage)
  const now = new Date()
  const views = participants
    .sort((a, b) => ['self', 'manager', 'peer'].indexOf(a.role) - ['self', 'manager', 'peer'].indexOf(b.role) || (names.get(a.employee_id) ?? '').localeCompare(names.get(b.employee_id) ?? ''))
    .map((p) => {
      // The employee may chase their peers and manager; nobody chases themselves.
      const mayRemind = p.employee_id !== employee?.id && (rel.operator || rel.isManager || rel.isSubject)
      return participantView(p, names, now, settings.reminder_interval_hours, mayRemind, stageOpen, rel.admin || rel.isManager)
    })

  let decision: CycleDetail['decision'] = null
  if (rel.readsText) {
    const { data: d } = await supabase.from('review_decisions').select('*').eq('cycle_id', cycleId).maybeSingle()
    if (d) {
      const decidedBy = (d as DecisionRow).decided_by
      const by = decidedBy ? await namesFor(supabase, [decidedBy]) : new Map()
      const row = d as DecisionRow
      decision = {
        decision: row.decision,
        extend_until: row.extend_until,
        note: row.note,
        decided_at: row.decided_at,
        pnc_outcome: row.pnc_outcome,
        pnc_note: row.pnc_note,
        pnc_reviewed_at: row.pnc_reviewed_at,
        pnc_reviewed_by: row.pnc_reviewed_by,
        decidedByName: decidedBy ? by.get(decidedBy) ?? null : null,
      }
    }
  }

  let events: CycleDetail['events'] = null
  if (rel.admin || rel.isManager) {
    const { data: ev } = await supabase
      .from('review_events')
      .select('kind, actor, created_at, detail')
      .eq('cycle_id', cycleId)
      .order('created_at', { ascending: false })
      .limit(100)
    events = ((ev ?? []) as { kind: string; actor: string; created_at: string; detail: Record<string, unknown> | null }[]).map((e) => ({
      kind: e.kind,
      // Reminders pressed by the employee show as "the employee", not their
      // address; everything else names who acted.
      actor: e.actor,
      at: e.created_at,
      detail: e.detail,
    }))
  }

  let nominees: CycleDetail['nominees'] = null
  if ((rel.isSubject && cycle.stage === 'self_review') || (rel.operator && stageOpen)) {
    const { data: people } = await supabase.from('employees').select('id, name').eq('status', 'active').order('name')
    nominees = ((people ?? []) as { id: string; name: string }[]).filter((p) => p.id !== cycle.employee_id && p.id !== cycle.manager_id)
  }

  const { data: bounds } = await supabase.from('peer_feedback_settings').select('minimum_peers, maximum_peers').limit(1).maybeSingle()

  return {
    ...summarise(cycle, participants, names, settings.meeting_ready_peer_ratio),
    rel,
    participants: views,
    reviews: await readReviews(cycle, participants, rel),
    decision,
    events,
    settings: { reminder_interval_hours: settings.reminder_interval_hours, meeting_duration_minutes: settings.meeting_duration_minutes },
    peerBounds: { min: bounds?.minimum_peers ?? 4, max: bounds?.maximum_peers ?? 5 },
    nominees,
    selfRequestId: rel.isSubject ? participants.find((p) => p.role === 'self')?.form_request_id ?? null : null,
    managerRequestId: rel.isManager
      ? participants.find((p) => p.role === 'manager' && p.employee_id === employee?.id)?.form_request_id ?? null
      : null,
  }
}
