// ============================================================================
// Review cycles — the workflow
// ----------------------------------------------------------------------------
// Opens cycles, sends forms, reminds, escalates, books the meeting, records
// the decision and closes. Everything here writes with the service-role client
// and checks NOTHING about the caller: it is not a 'use server' module and must
// never become one. Its callers decide who may do what first —
// `actions.ts` (guarded server actions) and `/api/cron/review-cycles`
// (cron secret). See supabase/migrations/202610261000_review_cycles.sql for
// why sessions hold no write grant on these tables.
//
// Every dependency comes in through `Ctx` — the database, the clock, the
// mailer — so the whole flow can be driven against a scratch database with a
// captured mailbox (scripts/review-cycles-e2e.ts).
// ============================================================================

import type { SupabaseClient } from '@supabase/supabase-js'
import { createAdminSupabaseClient } from '@/lib/supabase/admin'
import { sendCalendarInvite, sendEmail } from '@/lib/email/sendEmail'
import { calendarAvailabilityService } from '@/lib/integrations/calendar-availability'
import { auditEvent } from '@/lib/audit/events'
import {
  DEFAULT_APPRAISAL_CYCLES,
  DEFAULT_APPRAISAL_RULES,
  DEFAULT_CONFIRMATION_RULES,
  DEFAULT_PEER_FEEDBACK_SETTINGS,
  type AppraisalCycle,
  type AppraisalRule,
  type ConfirmationRule,
} from '@/lib/settings/types'
import {
  appraisalPeriods,
  buildIcs,
  confirmationDue,
  dueForAutoReminder,
  dueForEscalation,
  inAppraisalBatch,
  isoDate,
  nominationProblem,
  pickMeetingSlot,
  readiness,
  reminderState,
  waitLabel,
  type EmployeeForReview,
} from './engine'
import * as mails from './emails'
import {
  DECISIONS,
  DEFAULT_REVIEW_CYCLE_SETTINGS,
  OPEN_STAGES,
  decisionLabel,
  type CycleRow,
  type DecisionRow,
  type ParticipantRole,
  type ParticipantRow,
  type ReviewCycleSettings,
  type ReviewDecision,
  type ReviewKind,
} from './types'

// ----------------------------------------------------------------------------
// Context
// ----------------------------------------------------------------------------

export type Recipient = { name: string; email: string }

export interface Mailer {
  send(template: string, mail: mails.Mail, to: Recipient): Promise<{ success: boolean }>
  invite(template: string, mail: mails.Mail, ics: string, to: Recipient[]): Promise<{ success: boolean }>
}

export const gmailMailer: Mailer = {
  send: (template, mail, to) =>
    sendEmail(template, { subject: mail.subject, body: mail.body, recipient_name: to.name }, to.email),
  invite: (template, mail, ics, to) => sendCalendarInvite({ template, subject: mail.subject, html: mail.body, ics, to }),
}

export type Ctx = {
  db: SupabaseClient
  now: Date
  mail: Mailer
  appUrl: string
  /** Who is acting, for the timeline: an email, or 'automation'. */
  actor: string
  /** PnC addresses, when the caller already knows them (tests). */
  pncRecipients?: Recipient[]
  /** Busy blocks for a calendar; the mock service when not given. */
  busy?: (email: string, from: Date, to: Date) => Promise<{ start: string; end: string }[]>
}

/** The production context: service-role client, Gmail, the real clock. */
export function defaultCtx(actor: string): Ctx | null {
  const db = createAdminSupabaseClient()
  if (!db) return null
  return {
    db,
    now: new Date(),
    mail: gmailMailer,
    appUrl: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
    actor,
  }
}

export type Result<T = undefined> = { ok: true; value: T } | { ok: false; error: string }
const ok = <T>(value: T): Result<T> => ({ ok: true, value })
const fail = <T = undefined>(error: string): Result<T> => ({ ok: false, error })

// ----------------------------------------------------------------------------
// Reading
// ----------------------------------------------------------------------------

export async function loadSettings(db: SupabaseClient): Promise<ReviewCycleSettings> {
  const { data } = await db.from('review_cycle_settings').select('*').eq('id', 'default').maybeSingle()
  const merged = { ...DEFAULT_REVIEW_CYCLE_SETTINGS, ...(data ?? {}) } as ReviewCycleSettings
  merged.meeting_ready_peer_ratio = Number(merged.meeting_ready_peer_ratio)
  return merged
}

export async function loadPeerBounds(db: SupabaseClient): Promise<{ min: number; max: number }> {
  const { data } = await db.from('peer_feedback_settings').select('minimum_peers, maximum_peers').limit(1).maybeSingle()
  return {
    min: data?.minimum_peers ?? DEFAULT_PEER_FEEDBACK_SETTINGS.minimum_peers,
    max: data?.maximum_peers ?? DEFAULT_PEER_FEEDBACK_SETTINGS.maximum_peers,
  }
}

type Person = { id: string; name: string; email: string | null; manager_id: string | null; status: string | null }

async function person(db: SupabaseClient, id: string | null | undefined): Promise<Person | null> {
  if (!id) return null
  const { data } = await db.from('employees').select('id, name, email, manager_id, status').eq('id', id).maybeSingle()
  return (data as Person | null) ?? null
}

async function cycleById(db: SupabaseClient, id: string): Promise<CycleRow | null> {
  const { data } = await db.from('review_cycles').select('*').eq('id', id).maybeSingle()
  return (data as CycleRow | null) ?? null
}

async function participantsOf(db: SupabaseClient, cycleId: string): Promise<ParticipantRow[]> {
  const { data } = await db.from('review_participants').select('*').eq('cycle_id', cycleId)
  return (data ?? []) as ParticipantRow[]
}

/** The newest published version of the form for this kind and role. */
export async function formVersionFor(db: SupabaseClient, kind: ReviewKind, role: ParticipantRole): Promise<string | null> {
  const { data: forms } = await db
    .from('forms')
    .select('id, created_at')
    .eq('workflow', kind)
    .eq('review_role', role)
    .is('archived_at', null)
    .order('created_at', { ascending: false })
  for (const form of (forms ?? []) as { id: string }[]) {
    const { data: version } = await db
      .from('form_versions')
      .select('id')
      .eq('form_id', form.id)
      .eq('status', 'published')
      .maybeSingle()
    if (version?.id) return version.id as string
  }
  return null
}

/**
 * Where PnC notices go: the address in settings (several, comma-separated),
 * or else every PnC Admin account.
 */
export async function pncRecipients(ctx: Ctx, settings: ReviewCycleSettings): Promise<Recipient[]> {
  if (ctx.pncRecipients) return ctx.pncRecipients
  const configured = (settings.pnc_notification_email ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter((s) => /^[^@\s]+@[^@\s]+$/.test(s))
  if (configured.length > 0) return configured.map((email) => ({ name: 'PnC', email }))
  try {
    const out: Recipient[] = []
    for (let page = 1; page <= 20; page++) {
      const { data, error } = await ctx.db.auth.admin.listUsers({ page, perPage: 200 })
      if (error || !data) break
      for (const u of data.users) {
        if (u.email && u.app_metadata?.role === 'pnc_admin') out.push({ name: 'PnC', email: u.email })
      }
      if (data.users.length < 200) break
    }
    return out
  } catch {
    return []
  }
}

const cycleUrl = (ctx: Ctx, id: string) => `${ctx.appUrl}/reviews/${id}`
const myReviewUrl = (ctx: Ctx, id: string) => `${ctx.appUrl}/my-reviews/${id}`
const formUrl = (ctx: Ctx, requestId: string) => `${ctx.appUrl}/my-forms/${requestId}`

async function logEvent(ctx: Ctx, cycleId: string, kind: string, participantId: string | null = null, detail: Record<string, unknown> | null = null) {
  await ctx.db.from('review_events').insert({
    cycle_id: cycleId,
    participant_id: participantId,
    kind,
    actor: ctx.actor,
    detail,
    created_at: ctx.now.toISOString(),
  })
}

async function touchCycle(ctx: Ctx, id: string, patch: Partial<CycleRow>) {
  await ctx.db.from('review_cycles').update({ ...patch, updated_at: ctx.now.toISOString() }).eq('id', id)
}

function dueOnLabel(iso: string | null): string | null {
  if (!iso) return null
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' })
}

function whenLabel(d: Date): string {
  return d.toLocaleString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'Asia/Kolkata',
  }) + ' IST'
}

// ----------------------------------------------------------------------------
// Inviting a respondent
// ----------------------------------------------------------------------------

function dueDays(settings: ReviewCycleSettings, role: ParticipantRole): number {
  return role === 'self' ? settings.self_due_days : role === 'peer' ? settings.peer_due_days : settings.manager_due_days
}

/**
 * Sends one participant their form: creates the form request (which is what
 * puts it in their My Forms), marks them invited and emails them.
 */
async function invite(ctx: Ctx, cycle: CycleRow, p: ParticipantRow, settings: ReviewCycleSettings): Promise<Result> {
  const versionId = await formVersionFor(ctx.db, cycle.kind, p.role)
  if (!versionId) return fail(`There is no published ${p.role} form for ${cycle.kind} reviews. Publish one in the Form Builder.`)

  const respondent = await person(ctx.db, p.employee_id)
  const subject = await person(ctx.db, cycle.employee_id)
  if (!respondent || !subject) return fail('Employee not found')

  const { data: request, error } = await ctx.db
    .from('form_requests')
    .insert({
      form_version_id: versionId,
      respondent_employee_id: p.employee_id,
      subject_employee_id: cycle.employee_id,
      linked_confirmation_id: cycle.confirmation_id,
      linked_appraisal_id: cycle.confirmation_id ? null : cycle.appraisal_id,
    })
    .select('id')
    .single()
  if (error || !request) return fail('Could not create the form request')

  const dueAt = new Date(ctx.now.getTime() + dueDays(settings, p.role) * 24 * 60 * 60 * 1000)
  await ctx.db
    .from('review_participants')
    .update({
      form_request_id: request.id,
      status: 'invited',
      invited_at: ctx.now.toISOString(),
      due_at: dueAt.toISOString(),
      updated_at: ctx.now.toISOString(),
    })
    .eq('id', p.id)
  await logEvent(ctx, cycle.id, 'invited', p.id, { role: p.role })

  if (respondent.email) {
    const dueOn = dueOnLabel(dueAt.toISOString())
    const mail =
      p.role === 'self'
        ? mails.selfInvite({
            kind: cycle.kind,
            name: respondent.name,
            url: myReviewUrl(ctx, cycle.id),
            dueOn,
            ...(await loadPeerBounds(ctx.db).then((b) => ({ minPeers: b.min, maxPeers: b.max }))),
          })
        : mails.reviewerInvite({
            kind: cycle.kind,
            role: p.role,
            name: respondent.name,
            subjectName: subject.name,
            url: formUrl(ctx, request.id as string),
            dueOn,
          })
    await ctx.mail.send(`review_${cycle.kind}_${p.role}_invite`, mail, { name: respondent.name, email: respondent.email })
  }
  return ok(undefined)
}

// ----------------------------------------------------------------------------
// Opening a cycle
// ----------------------------------------------------------------------------

export type OpenInput = {
  employeeId: string
  kind: ReviewKind
  periodKey: string
  periodLabel: string
  dueDate: string | null
  typeCode?: string | null
}

export async function openCycle(ctx: Ctx, input: OpenInput): Promise<Result<{ cycleId: string; created: boolean }>> {
  const subject = await person(ctx.db, input.employeeId)
  if (!subject) return fail('Employee not found')
  if (subject.status && subject.status !== 'active') return fail(`${subject.name} is not an active employee`)
  if (!subject.manager_id) return fail(`${subject.name} has no manager on record. Set their manager first.`)
  if (!subject.email) return fail(`${subject.name} has no email address on record`)

  const { data: existing } = await ctx.db
    .from('review_cycles')
    .select('id')
    .eq('employee_id', input.employeeId)
    .eq('kind', input.kind)
    .eq('period_key', input.periodKey)
    .neq('stage', 'cancelled')
    .maybeSingle()
  if (existing?.id) return ok({ cycleId: existing.id as string, created: false })

  for (const role of ['self', 'manager', 'peer'] as const) {
    if (!(await formVersionFor(ctx.db, input.kind, role))) {
      return fail(`There is no published ${role} form for ${input.kind} reviews. Publish one in the Form Builder.`)
    }
  }

  // Keep the older records in step, so the Confirmations and Appraisals
  // screens and reports see this cycle too.
  let confirmationId: string | null = null
  let appraisalId: string | null = null
  if (input.kind === 'confirmation') {
    const { data: open } = await ctx.db
      .from('confirmations')
      .select('id')
      .eq('employee_id', input.employeeId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(1)
    confirmationId = ((open ?? [])[0] as { id: string } | undefined)?.id ?? null
    if (!confirmationId) {
      const { data: created } = await ctx.db
        .from('confirmations')
        .insert({ employee_id: input.employeeId, status: 'pending', timeline_type: input.typeCode ?? null })
        .select('id')
        .single()
      confirmationId = (created?.id as string | undefined) ?? null
    }
  } else {
    const cycleName = input.periodKey.replace(/^appraisal:/, '').replace(/-\d{4}$/, '')
    if (cycleName === 'july' || cycleName === 'december') {
      const { data: created } = await ctx.db
        .from('appraisals')
        .insert({ employee_id: input.employeeId, cycle: cycleName, reference_date: input.dueDate ?? isoDate(ctx.now), status: 'pending' })
        .select('id')
        .single()
      appraisalId = (created?.id as string | undefined) ?? null
    }
  }

  const { data: cycle, error } = await ctx.db
    .from('review_cycles')
    .insert({
      kind: input.kind,
      employee_id: input.employeeId,
      manager_id: subject.manager_id,
      period_key: input.periodKey,
      period_label: input.periodLabel,
      due_date: input.dueDate,
      confirmation_id: confirmationId,
      appraisal_id: appraisalId,
      stage: 'self_review',
      opened_by: ctx.actor,
      created_at: ctx.now.toISOString(),
      updated_at: ctx.now.toISOString(),
    })
    .select('*')
    .single()
  if (error || !cycle) {
    // Lost a race with another opener: the unique index kept one live cycle.
    const { data: again } = await ctx.db
      .from('review_cycles')
      .select('id')
      .eq('employee_id', input.employeeId)
      .eq('kind', input.kind)
      .eq('period_key', input.periodKey)
      .neq('stage', 'cancelled')
      .maybeSingle()
    if (again?.id) return ok({ cycleId: again.id as string, created: false })
    return fail('Could not open the review cycle')
  }

  const settings = await loadSettings(ctx.db)
  const { data: rows } = await ctx.db
    .from('review_participants')
    .insert([
      { cycle_id: cycle.id, role: 'self', employee_id: input.employeeId, status: 'nominated' },
      { cycle_id: cycle.id, role: 'manager', employee_id: subject.manager_id, status: 'nominated' },
    ])
    .select('*')
  await logEvent(ctx, cycle.id, 'opened', null, { period: input.periodLabel })

  for (const p of (rows ?? []) as ParticipantRow[]) {
    const sent = await invite(ctx, cycle as CycleRow, p, settings)
    if (!sent.ok) return fail(sent.error)
  }

  await auditEvent(
    input.kind === 'confirmation' ? 'confirmation' : 'appraisal',
    `${input.kind}.review_cycle.opened`,
    `${input.kind === 'confirmation' ? 'Confirmation' : 'Appraisal'} review opened (${input.periodLabel}).`,
    {
      subject: { employee_id: subject.id, employee_email: subject.email, employee_name: subject.name },
      actorType: ctx.actor === 'automation' ? 'system' : 'pnc',
      actorEmail: ctx.actor === 'automation' ? null : ctx.actor,
      entityType: 'review_cycle',
      entityId: cycle.id,
    }
  )
  return ok({ cycleId: cycle.id as string, created: true })
}

// ----------------------------------------------------------------------------
// Nominations
// ----------------------------------------------------------------------------

/**
 * Replaces the employee's nominated peers. Before the self-review is in, they
 * wait as `nominated`; added later (by PnC), they are invited at once. Peers
 * already invited stay — their request is out and may already be answered.
 */
export async function setNominations(ctx: Ctx, cycleId: string, peerIds: string[], nominatedBy: string | null): Promise<Result> {
  const cycle = await cycleById(ctx.db, cycleId)
  if (!cycle) return fail('Review not found')
  if (!OPEN_STAGES.includes(cycle.stage)) return fail('This review is no longer open')

  const participants = await participantsOf(ctx.db, cycleId)
  const peers = participants.filter((p) => p.role === 'peer' && p.status !== 'cancelled')
  const locked = peers.filter((p) => p.status !== 'nominated').map((p) => p.employee_id)
  const wanted = Array.from(new Set([...locked, ...peerIds]))

  const { min, max } = await loadPeerBounds(ctx.db)
  const { data: active } = await ctx.db.from('employees').select('id').in('id', wanted).eq('status', 'active')
  const problem = nominationProblem(wanted, {
    subjectId: cycle.employee_id,
    managerId: cycle.manager_id,
    min: cycle.stage === 'self_review' ? 0 : min,
    max,
    activeIds: new Set(((active ?? []) as { id: string }[]).map((r) => r.id)),
  })
  if (problem) return fail(problem)

  const toRemove = peers.filter((p) => p.status === 'nominated' && !wanted.includes(p.employee_id))
  if (toRemove.length > 0) {
    await ctx.db.from('review_participants').delete().in('id', toRemove.map((p) => p.id))
  }
  const existingIds = new Set(peers.map((p) => p.employee_id))
  const toAdd = wanted.filter((id) => !existingIds.has(id))
  if (toAdd.length > 0) {
    // A peer cancelled earlier and nominated again comes back as nominated.
    await ctx.db
      .from('review_participants')
      .upsert(
        toAdd.map((id) => ({
          cycle_id: cycleId,
          role: 'peer',
          employee_id: id,
          status: 'nominated',
          nominated_by: nominatedBy,
          form_request_id: null,
          invited_at: null,
          reminder_count: 0,
          last_reminded_at: null,
          escalated_at: null,
        })),
        { onConflict: 'cycle_id,employee_id,role' }
      )
  }
  await logEvent(ctx, cycleId, 'nominated', null, { count: wanted.length })

  if (cycle.stage !== 'self_review' && toAdd.length > 0) {
    const settings = await loadSettings(ctx.db)
    for (const p of await participantsOf(ctx.db, cycleId)) {
      if (p.role === 'peer' && p.status === 'nominated') {
        const sent = await invite(ctx, cycle, p, settings)
        if (!sent.ok) return fail(sent.error)
      }
    }
    await evaluateCycle(ctx, cycleId)
  }
  return ok(undefined)
}

/**
 * Called before a self-review is submitted: the employee must have nominated
 * at least the minimum number of peers. Returns the problem, or null.
 */
export async function selfSubmitBlocker(db: SupabaseClient, requestId: string): Promise<string | null> {
  const { data: p } = await db
    .from('review_participants')
    .select('cycle_id, role')
    .eq('form_request_id', requestId)
    .maybeSingle()
  if (!p || p.role !== 'self') return null
  const { min } = await loadPeerBounds(db)
  const { count } = await db
    .from('review_participants')
    .select('id', { count: 'exact', head: true })
    .eq('cycle_id', p.cycle_id)
    .eq('role', 'peer')
    .neq('status', 'cancelled')
  if ((count ?? 0) < min) {
    return `Nominate at least ${min} ${min === 1 ? 'colleague' : 'colleagues'} for peer feedback before you submit. You can do that on your review page.`
  }
  return null
}

// ----------------------------------------------------------------------------
// A form comes back
// ----------------------------------------------------------------------------

/**
 * Called after any form submission. If the form belongs to a review cycle,
 * records it and moves the cycle on: a self-review sends the peers their
 * forms; every submission re-checks whether the meeting can be set up.
 */
export async function onFormSubmitted(ctx: Ctx, requestId: string): Promise<void> {
  const { data: p } = await ctx.db.from('review_participants').select('*').eq('form_request_id', requestId).maybeSingle()
  if (!p) return
  const participant = p as ParticipantRow
  if (participant.status === 'submitted') return

  const { data: submission } = await ctx.db
    .from('form_submissions')
    .select('status, submitted_at')
    .eq('request_id', requestId)
    .maybeSingle()
  if (submission?.status !== 'submitted') return
  const at = (submission.submitted_at as string | null) ?? ctx.now.toISOString()

  await ctx.db
    .from('review_participants')
    .update({ status: 'submitted', submitted_at: at, updated_at: ctx.now.toISOString() })
    .eq('id', participant.id)
  await logEvent(ctx, participant.cycle_id, 'submitted', participant.id, { role: participant.role })

  const cycle = await cycleById(ctx.db, participant.cycle_id)
  if (!cycle) return

  if (participant.role === 'self') {
    await touchCycle(ctx, cycle.id, { self_submitted_at: at, stage: cycle.stage === 'self_review' ? 'in_review' : cycle.stage })
    const settings = await loadSettings(ctx.db)
    const fresh = { ...cycle, stage: cycle.stage === 'self_review' ? 'in_review' : cycle.stage } as CycleRow
    for (const peer of await participantsOf(ctx.db, cycle.id)) {
      if (peer.role === 'peer' && peer.status === 'nominated') await invite(ctx, fresh, peer, settings)
    }
  } else if (participant.role === 'manager') {
    await touchCycle(ctx, cycle.id, { manager_submitted_at: at })
  }

  await evaluateCycle(ctx, cycle.id)
}

/**
 * Moves a cycle to "ready for meeting" once enough is in, tells PnC once, and
 * books the meeting if settings say so.
 */
export async function evaluateCycle(ctx: Ctx, cycleId: string): Promise<void> {
  const cycle = await cycleById(ctx.db, cycleId)
  if (!cycle || (cycle.stage !== 'self_review' && cycle.stage !== 'in_review')) return
  const settings = await loadSettings(ctx.db)
  const r = readiness(await participantsOf(ctx.db, cycleId), settings.meeting_ready_peer_ratio)
  if (!r.ready) return

  await touchCycle(ctx, cycleId, { stage: 'ready_for_meeting', ready_at: ctx.now.toISOString() })
  await logEvent(ctx, cycleId, 'ready', null, { peersDone: r.peersDone, peersAsked: r.peersAsked })

  let meetingNote = 'Set up the meeting from the review cycle page.'
  if (settings.auto_schedule_meeting) {
    const booked = await autoScheduleMeeting(ctx, cycleId)
    meetingNote = booked.ok
      ? `The meeting has been booked for ${booked.value} and the invitation sent to the manager, the employee and PnC.`
      : `The meeting could not be booked automatically (${booked.error}). Set it up from the review cycle page.`
  }

  if (!cycle.pnc_ready_notified_at) {
    const subject = await person(ctx.db, cycle.employee_id)
    const manager = await person(ctx.db, cycle.manager_id)
    const mail = mails.readyForMeeting({
      kind: cycle.kind,
      subjectName: subject?.name ?? 'An employee',
      managerName: manager?.name ?? null,
      peersDone: r.peersDone,
      peersAsked: r.peersAsked,
      meetingNote,
      url: cycleUrl(ctx, cycleId),
    })
    for (const to of await pncRecipients(ctx, settings)) await ctx.mail.send('review_ready_for_meeting', mail, to)
    await touchCycle(ctx, cycleId, { pnc_ready_notified_at: ctx.now.toISOString() })
  }
}

// ----------------------------------------------------------------------------
// Reminders and escalation
// ----------------------------------------------------------------------------

/**
 * Reminds one participant, if the 24-hour clock allows. The same rule for the
 * daily job, PnC, the manager and the employee: whoever presses, one reminder
 * per interval.
 */
export async function remind(ctx: Ctx, participantId: string): Promise<Result<{ nextAt: string }>> {
  const { data } = await ctx.db.from('review_participants').select('*').eq('id', participantId).maybeSingle()
  if (!data) return fail('Not found')
  const p = data as ParticipantRow
  const cycle = await cycleById(ctx.db, p.cycle_id)
  if (!cycle || !OPEN_STAGES.includes(cycle.stage)) return fail('This review is no longer open')

  const settings = await loadSettings(ctx.db)
  const state = reminderState(p, ctx.now, settings.reminder_interval_hours)
  if (!state.canRemind) {
    if (state.reason === 'cooling_down') {
      return fail(`A reminder went out recently. The next one can be sent in ${waitLabel(state.waitMs)}.`)
    }
    return fail(state.reason === 'answered' ? 'They have already responded.' : 'Their form has not been sent yet.')
  }

  const respondent = await person(ctx.db, p.employee_id)
  const subject = await person(ctx.db, cycle.employee_id)
  if (!respondent?.email || !subject) return fail('No email address on record')

  const url = p.role === 'self' ? myReviewUrl(ctx, cycle.id) : formUrl(ctx, p.form_request_id ?? '')
  const sent = await ctx.mail.send(
    `review_${cycle.kind}_${p.role}_reminder`,
    mails.reminder({ kind: cycle.kind, role: p.role, name: respondent.name, subjectName: subject.name, url, dueOn: dueOnLabel(p.due_at) }),
    { name: respondent.name, email: respondent.email }
  )
  if (!sent.success) return fail('The reminder email could not be sent. Try again later.')

  await ctx.db
    .from('review_participants')
    .update({
      reminder_count: p.reminder_count + 1,
      last_reminded_at: ctx.now.toISOString(),
      last_reminded_by: ctx.actor,
      updated_at: ctx.now.toISOString(),
    })
    .eq('id', p.id)
  await logEvent(ctx, cycle.id, 'reminded', p.id, { role: p.role, count: p.reminder_count + 1 })
  const nextAt = new Date(ctx.now.getTime() + settings.reminder_interval_hours * 60 * 60 * 1000)
  return ok({ nextAt: nextAt.toISOString() })
}

async function escalate(ctx: Ctx, p: ParticipantRow, cycle: CycleRow, settings: ReviewCycleSettings) {
  const respondent = await person(ctx.db, p.employee_id)
  const subject = await person(ctx.db, cycle.employee_id)
  const mail = mails.escalation({
    kind: cycle.kind,
    role: p.role,
    respondentName: respondent?.name ?? 'A reviewer',
    subjectName: subject?.name ?? 'an employee',
    reminders: p.reminder_count,
    url: cycleUrl(ctx, cycle.id),
  })
  for (const to of await pncRecipients(ctx, settings)) await ctx.mail.send('review_escalation', mail, to)
  await ctx.db
    .from('review_participants')
    .update({ escalated_at: ctx.now.toISOString(), updated_at: ctx.now.toISOString() })
    .eq('id', p.id)
  await logEvent(ctx, cycle.id, 'escalated', p.id, { role: p.role, reminders: p.reminder_count })
}

// ----------------------------------------------------------------------------
// The meeting
// ----------------------------------------------------------------------------

async function meetingBusy(ctx: Ctx, email: string, from: Date, to: Date) {
  if (ctx.busy) return ctx.busy(email, from, to)
  const res = await calendarAvailabilityService.getFreeBusy(email, from.toISOString(), to.toISOString())
  return res.busy
}

/** Books the first free slot in the manager's calendar. Returns when, as text. */
export async function autoScheduleMeeting(ctx: Ctx, cycleId: string): Promise<Result<string>> {
  const cycle = await cycleById(ctx.db, cycleId)
  if (!cycle) return fail('Review not found')
  const settings = await loadSettings(ctx.db)
  const manager = await person(ctx.db, cycle.manager_id)
  const windowEnd = new Date(ctx.now.getTime() + 30 * 24 * 60 * 60 * 1000)
  const busy = manager?.email ? await meetingBusy(ctx, manager.email, ctx.now, windowEnd) : []
  const slot = pickMeetingSlot({
    from: ctx.now,
    leadWorkingDays: settings.meeting_lead_working_days,
    durationMinutes: settings.meeting_duration_minutes,
    busy,
  })
  if (!slot) return fail('no free slot in the next three weeks')
  const booked = await scheduleMeeting(ctx, cycleId, slot.start)
  return booked.ok ? ok(whenLabel(slot.start)) : fail(booked.error)
}

/**
 * Books (or moves) the meeting and sends one calendar invitation to the
 * manager, the employee and PnC. Moving it re-sends the same event with a
 * higher sequence, so calendars update rather than double up.
 */
export async function scheduleMeeting(ctx: Ctx, cycleId: string, start: Date): Promise<Result> {
  const cycle = await cycleById(ctx.db, cycleId)
  if (!cycle) return fail('Review not found')
  if (!['in_review', 'ready_for_meeting', 'meeting_scheduled', 'decision_recorded'].includes(cycle.stage)) {
    return fail('The meeting can be set once the self-reflection is in.')
  }
  if (Number.isNaN(start.getTime()) || start.getTime() < ctx.now.getTime()) return fail('Choose a time in the future.')

  const settings = await loadSettings(ctx.db)
  const end = new Date(start.getTime() + settings.meeting_duration_minutes * 60000)
  const subject = await person(ctx.db, cycle.employee_id)
  const manager = await person(ctx.db, cycle.manager_id)
  if (!subject?.email) return fail('The employee has no email address on record')

  const attendees: Recipient[] = [{ name: subject.name, email: subject.email }]
  if (manager?.email) attendees.push({ name: manager.name, email: manager.email })
  for (const r of await pncRecipients(ctx, settings)) {
    if (!attendees.some((a) => a.email.toLowerCase() === r.email.toLowerCase())) attendees.push(r)
  }

  const { count } = await ctx.db
    .from('review_events')
    .select('id', { count: 'exact', head: true })
    .eq('cycle_id', cycleId)
    .eq('kind', 'meeting_scheduled')
  const kindTitle = cycle.kind === 'confirmation' ? 'Confirmation' : 'Appraisal'
  const ics = buildIcs({
    uid: `review-${cycle.id}@elc.navgurukul.org`,
    sequence: count ?? 0,
    start,
    end,
    summary: `${kindTitle} review: ${subject.name}`,
    description: `${kindTitle} review meeting for ${subject.name}${manager ? ` with ${manager.name}` : ''} and PnC.\n${myReviewUrl(ctx, cycle.id)}`,
    organizer: { name: 'NavGurukul ELC', email: process.env.GOOGLE_SENDER_EMAIL || 'elc@navgurukul.org' },
    attendees,
    now: ctx.now,
  })
  const mail = mails.meetingInvite({
    kind: cycle.kind,
    subjectName: subject.name,
    managerName: manager?.name ?? null,
    when: whenLabel(start),
    url: myReviewUrl(ctx, cycle.id),
  })
  const sent = await ctx.mail.invite('review_meeting_invite', mail, ics, attendees)
  if (!sent.success) return fail('The calendar invitation could not be sent')

  await touchCycle(ctx, cycleId, {
    meeting_start: start.toISOString(),
    meeting_end: end.toISOString(),
    meeting_scheduled_at: ctx.now.toISOString(),
    meeting_scheduled_by: ctx.actor,
    stage: cycle.stage === 'decision_recorded' ? cycle.stage : 'meeting_scheduled',
  })
  await logEvent(ctx, cycleId, 'meeting_scheduled', null, { start: start.toISOString(), attendees: attendees.length })
  return ok(undefined)
}

// ----------------------------------------------------------------------------
// The decision, and PnC's close
// ----------------------------------------------------------------------------

export async function recordDecision(
  ctx: Ctx,
  cycleId: string,
  input: { decision: ReviewDecision; note: string; extendUntil: string | null; decidedBy: string | null }
): Promise<Result> {
  const cycle = await cycleById(ctx.db, cycleId)
  if (!cycle) return fail('Review not found')
  if (!['ready_for_meeting', 'meeting_scheduled', 'decision_recorded'].includes(cycle.stage)) {
    return fail('A decision can be recorded once the reviews are in and the meeting is set.')
  }
  if (!DECISIONS[cycle.kind].some((d) => d.value === input.decision)) return fail('Choose one of the listed decisions.')
  const note = input.note.trim()
  if (note.length < 10) return fail('Add a short note on why — at least a sentence.')
  if (note.length > 5000) return fail('The note is too long.')
  if (input.decision === 'extend_probation') {
    if (!input.extendUntil || !/^\d{4}-\d{2}-\d{2}$/.test(input.extendUntil)) return fail('Choose the date probation is extended to.')
    if (input.extendUntil <= isoDate(ctx.now)) return fail('The extension must end after today.')
  }

  const { data: prior } = await ctx.db.from('review_decisions').select('pnc_outcome').eq('cycle_id', cycleId).maybeSingle()
  if (prior?.pnc_outcome === 'accepted') return fail('PnC has already closed this review.')

  await ctx.db.from('review_decisions').upsert(
    {
      cycle_id: cycleId,
      decision: input.decision,
      extend_until: input.decision === 'extend_probation' ? input.extendUntil : null,
      note,
      decided_by: input.decidedBy,
      decided_at: ctx.now.toISOString(),
      pnc_outcome: null,
      pnc_note: null,
      pnc_reviewed_by: null,
      pnc_reviewed_at: null,
      updated_at: ctx.now.toISOString(),
    },
    { onConflict: 'cycle_id' }
  )
  await touchCycle(ctx, cycleId, { stage: 'decision_recorded' })
  await logEvent(ctx, cycleId, 'decision_recorded', null, { decision: input.decision })

  if (cycle.confirmation_id) {
    await ctx.db
      .from('confirmations')
      .update({ manager_decision: input.decision === 'confirm' ? 'yes' : 'no', updated_at: ctx.now.toISOString() })
      .eq('id', cycle.confirmation_id)
  }

  const subject = await person(ctx.db, cycle.employee_id)
  const manager = await person(ctx.db, input.decidedBy ?? cycle.manager_id)
  const settings = await loadSettings(ctx.db)
  const mail = mails.decisionRecorded({
    kind: cycle.kind,
    subjectName: subject?.name ?? 'An employee',
    managerName: manager?.name ?? 'The manager',
    decision: decisionLabel(input.decision),
    url: cycleUrl(ctx, cycleId),
  })
  for (const to of await pncRecipients(ctx, settings)) await ctx.mail.send('review_decision_recorded', mail, to)

  await auditEvent(
    cycle.kind === 'confirmation' ? 'confirmation' : 'appraisal',
    `${cycle.kind}.manager_decision.recorded`,
    `Manager recorded the ${cycle.kind} decision: ${decisionLabel(input.decision)}.`,
    {
      subject: { employee_id: cycle.employee_id, employee_email: subject?.email ?? null, employee_name: subject?.name ?? null },
      actorType: 'manager',
      actorEmail: ctx.actor,
      entityType: 'review_cycle',
      entityId: cycleId,
      severity: 'notice',
    }
  )
  return ok(undefined)
}

/**
 * PnC's close. Accepting carries the decision through: a confirmation stamps
 * the employee's confirmation date, an extension reschedules it. Returning
 * sends it back to the manager with PnC's note.
 */
export async function closeCycle(ctx: Ctx, cycleId: string, input: { outcome: 'accepted' | 'returned'; note: string }): Promise<Result> {
  const cycle = await cycleById(ctx.db, cycleId)
  if (!cycle) return fail('Review not found')
  if (cycle.stage !== 'decision_recorded') return fail('There is no decision waiting for PnC.')
  const { data: d } = await ctx.db.from('review_decisions').select('*').eq('cycle_id', cycleId).maybeSingle()
  const decision = d as DecisionRow | null
  if (!decision) return fail('There is no decision waiting for PnC.')
  const note = input.note.trim()
  if (input.outcome === 'returned' && note.length < 5) return fail('Say what the manager should look at again.')

  await ctx.db
    .from('review_decisions')
    .update({
      pnc_outcome: input.outcome,
      pnc_note: note || null,
      pnc_reviewed_by: ctx.actor,
      pnc_reviewed_at: ctx.now.toISOString(),
      updated_at: ctx.now.toISOString(),
    })
    .eq('cycle_id', cycleId)

  const subject = await person(ctx.db, cycle.employee_id)

  if (input.outcome === 'returned') {
    await touchCycle(ctx, cycleId, { stage: cycle.meeting_start ? 'meeting_scheduled' : 'ready_for_meeting' })
    await logEvent(ctx, cycleId, 'returned', null, null)
    const manager = await person(ctx.db, decision.decided_by ?? cycle.manager_id)
    if (manager?.email) {
      await ctx.mail.send(
        'review_decision_returned',
        mails.decisionReturned({ kind: cycle.kind, managerName: manager.name, subjectName: subject?.name ?? 'your report', url: myReviewUrl(ctx, cycleId) }),
        { name: manager.name, email: manager.email }
      )
    }
    return ok(undefined)
  }

  const today = isoDate(ctx.now)
  if (cycle.kind === 'confirmation') {
    if (decision.decision === 'confirm') {
      await ctx.db.from('employees').update({ confirmation_date: today }).eq('id', cycle.employee_id)
      if (cycle.confirmation_id) {
        await ctx.db.from('confirmations').update({ status: 'approved', updated_at: ctx.now.toISOString() }).eq('id', cycle.confirmation_id)
      }
    } else if (decision.decision === 'extend_probation' && cycle.confirmation_id) {
      await ctx.db
        .from('confirmations')
        .update({ status: 'rescheduled', reschedule_date: decision.extend_until, updated_at: ctx.now.toISOString() })
        .eq('id', cycle.confirmation_id)
    }
  } else if (cycle.appraisal_id) {
    await ctx.db.from('appraisals').update({ status: 'completed', updated_at: ctx.now.toISOString() }).eq('id', cycle.appraisal_id)
  }

  // Anyone still asked is let off: their form leaves My Forms, and no reminder
  // can reach them for a review that is over.
  const outstanding = (await participantsOf(ctx.db, cycleId)).filter((p) => p.status === 'invited' || p.status === 'nominated')
  const openRequests = outstanding.map((p) => p.form_request_id).filter((id): id is string => Boolean(id))
  if (openRequests.length > 0) {
    await ctx.db.from('form_requests').update({ status: 'cancelled' }).in('id', openRequests).neq('status', 'submitted')
  }
  if (outstanding.length > 0) {
    await ctx.db
      .from('review_participants')
      .update({ status: 'cancelled', updated_at: ctx.now.toISOString() })
      .in('id', outstanding.map((p) => p.id))
  }
  await touchCycle(ctx, cycleId, { stage: 'closed', closed_at: ctx.now.toISOString() })
  await logEvent(ctx, cycleId, 'closed', null, { decision: decision.decision })
  await auditEvent(
    cycle.kind === 'confirmation' ? 'confirmation' : 'appraisal',
    `${cycle.kind}.review_cycle.closed`,
    `PnC closed the ${cycle.kind} review: ${decisionLabel(decision.decision)}.`,
    {
      subject: { employee_id: cycle.employee_id, employee_email: subject?.email ?? null, employee_name: subject?.name ?? null },
      actorEmail: ctx.actor,
      entityType: 'review_cycle',
      entityId: cycleId,
      severity: 'notice',
    }
  )
  return ok(undefined)
}

export async function cancelCycle(ctx: Ctx, cycleId: string, reason: string): Promise<Result> {
  const cycle = await cycleById(ctx.db, cycleId)
  if (!cycle) return fail('Review not found')
  if (cycle.stage === 'closed' || cycle.stage === 'cancelled') return fail('This review is already finished.')
  if (reason.trim().length < 3) return fail('Give a reason for cancelling.')

  const participants = await participantsOf(ctx.db, cycleId)
  const requestIds = participants.filter((p) => p.form_request_id && p.status !== 'submitted').map((p) => p.form_request_id as string)
  if (requestIds.length > 0) {
    await ctx.db.from('form_requests').update({ status: 'cancelled' }).in('id', requestIds).neq('status', 'submitted')
  }
  await ctx.db
    .from('review_participants')
    .update({ status: 'cancelled', updated_at: ctx.now.toISOString() })
    .eq('cycle_id', cycleId)
    .neq('status', 'submitted')
  await touchCycle(ctx, cycleId, { stage: 'cancelled', cancelled_reason: reason.trim() })
  await logEvent(ctx, cycleId, 'cancelled', null, null)
  return ok(undefined)
}

/** Withdraws one reviewer's request (e.g. a peer who has left). */
export async function withdrawParticipant(ctx: Ctx, participantId: string): Promise<Result> {
  const { data } = await ctx.db.from('review_participants').select('*').eq('id', participantId).maybeSingle()
  const p = data as ParticipantRow | null
  if (!p) return fail('Not found')
  if (p.role !== 'peer') return fail('Only a peer can be withdrawn. Cancel the review instead.')
  if (p.status === 'submitted') return fail('They have already responded.')
  if (p.form_request_id) await ctx.db.from('form_requests').update({ status: 'cancelled' }).eq('id', p.form_request_id)
  await ctx.db.from('review_participants').update({ status: 'cancelled', updated_at: ctx.now.toISOString() }).eq('id', p.id)
  await logEvent(ctx, p.cycle_id, 'withdrawn', p.id, null)
  await evaluateCycle(ctx, p.cycle_id)
  return ok(undefined)
}

// ----------------------------------------------------------------------------
// Who is due
// ----------------------------------------------------------------------------

type EmployeeRow = {
  id: string
  name: string
  email: string | null
  status: string | null
  joining_date: string | null
  conversion_date: string | null
  confirmation_date: string | null
  manager_id: string | null
  employee_type: string | null
  employee_types: { code: string | null } | null
}

export async function loadEmployeesForReview(db: SupabaseClient): Promise<EmployeeForReview[]> {
  const { data } = await db
    .from('employees')
    .select('id, name, email, status, joining_date, conversion_date, confirmation_date, manager_id, employee_type, employee_types(code)')
  return ((data ?? []) as unknown as EmployeeRow[]).map((e) => ({
    id: e.id,
    name: e.name,
    email: e.email,
    typeCode: e.employee_types?.code ?? e.employee_type,
    status: e.status,
    joiningDate: e.joining_date,
    conversionDate: e.conversion_date,
    confirmationDate: e.confirmation_date,
    managerId: e.manager_id,
  }))
}

async function loadRules(db: SupabaseClient) {
  const [c, a, y] = await Promise.all([
    db.from('confirmation_rules').select('*'),
    db.from('appraisal_rules').select('*'),
    db.from('appraisal_cycles').select('*'),
  ])
  return {
    confirmationRules: (c.data?.length ? c.data : DEFAULT_CONFIRMATION_RULES) as ConfirmationRule[],
    appraisalRules: (a.data?.length ? a.data : DEFAULT_APPRAISAL_RULES) as AppraisalRule[],
    appraisalCycles: (y.data?.length ? y.data : DEFAULT_APPRAISAL_CYCLES) as AppraisalCycle[],
  }
}

export type DueEntry = {
  employeeId: string
  name: string
  kind: ReviewKind
  periodKey: string
  periodLabel: string
  dueDate: string
  state: 'open_now' | 'upcoming' | 'overdue_manual'
  opensOn?: string
  hasManager: boolean
}

/**
 * Everyone due for a review, and when, minus anyone whose cycle for that
 * period is already open. The daily job opens the `open_now` entries; the
 * dashboard lists all of them.
 */
export async function whoIsDue(db: SupabaseClient, now: Date, settings: ReviewCycleSettings): Promise<DueEntry[]> {
  const [employees, rules, { data: live }] = await Promise.all([
    loadEmployeesForReview(db),
    loadRules(db),
    db.from('review_cycles').select('employee_id, kind, period_key').neq('stage', 'cancelled'),
  ])
  const taken = new Set(((live ?? []) as { employee_id: string; kind: string; period_key: string }[]).map((r) => `${r.employee_id}|${r.kind}|${r.period_key}`))
  const out: DueEntry[] = []

  for (const e of employees) {
    const c = confirmationDue(e, rules.confirmationRules, now, settings.confirmation_lead_days)
    if (c.state !== 'not_eligible' && !taken.has(`${e.id}|confirmation|confirmation`)) {
      out.push({
        employeeId: e.id,
        name: e.name,
        kind: 'confirmation',
        periodKey: 'confirmation',
        periodLabel: 'Probation',
        dueDate: c.dueDate,
        state: c.state,
        opensOn: c.state === 'upcoming' ? c.opensOn : undefined,
        hasManager: Boolean(e.managerId),
      })
    }
  }

  const periods = appraisalPeriods(rules.appraisalCycles, now, settings.appraisal_lead_days)
  // The open batches, and the next one to open, so PnC sees it coming.
  const upcoming = periods.find((p) => !p.open && p.start > isoDate(now))
  for (const period of periods.filter((p) => p.open || p === upcoming)) {
    for (const e of employees) {
      if (!inAppraisalBatch(e, rules.appraisalRules, rules.appraisalCycles, period)) continue
      if (taken.has(`${e.id}|appraisal|${period.periodKey}`)) continue
      out.push({
        employeeId: e.id,
        name: e.name,
        kind: 'appraisal',
        periodKey: period.periodKey,
        periodLabel: period.label,
        dueDate: period.dueDate,
        state: period.open ? 'open_now' : 'upcoming',
        opensOn: period.open ? undefined : isoDate(new Date(new Date(`${period.start}T00:00:00Z`).getTime() - settings.appraisal_lead_days * 86400000)),
        hasManager: Boolean(e.managerId),
      })
    }
  }
  return out.sort((a, b) => a.dueDate.localeCompare(b.dueDate) || a.name.localeCompare(b.name))
}

// ----------------------------------------------------------------------------
// The daily job
// ----------------------------------------------------------------------------

export type AutomationSummary = {
  skipped?: string
  opened: number
  openFailures: { name: string; error: string }[]
  reminded: number
  escalated: number
  readyChecked: number
}

/**
 * Opens what is due, reminds who is late, and tells PnC who has gone quiet.
 * Safe to run more than once a day: every step is gated by the database
 * (one live cycle per period) or the reminder clock.
 */
export async function runAutomation(ctx: Ctx, opts: { force?: boolean } = {}): Promise<AutomationSummary> {
  const settings = await loadSettings(ctx.db)
  const summary: AutomationSummary = { opened: 0, openFailures: [], reminded: 0, escalated: 0, readyChecked: 0 }
  if (!settings.automation_enabled && !opts.force) return { ...summary, skipped: 'Review automation is switched off in settings' }

  // 1. Open what is due.
  for (const entry of await whoIsDue(ctx.db, ctx.now, settings)) {
    if (entry.state !== 'open_now') continue
    const opened = await openCycle(ctx, {
      employeeId: entry.employeeId,
      kind: entry.kind,
      periodKey: entry.periodKey,
      periodLabel: entry.periodLabel,
      dueDate: entry.dueDate,
    })
    if (opened.ok && opened.value.created) summary.opened++
    else if (!opened.ok) summary.openFailures.push({ name: entry.name, error: opened.error })
  }

  // 2. Remind and escalate on every open cycle.
  const { data: cycles } = await ctx.db.from('review_cycles').select('*').in('stage', OPEN_STAGES)
  for (const cycle of (cycles ?? []) as CycleRow[]) {
    for (const p of await participantsOf(ctx.db, cycle.id)) {
      if (p.status !== 'invited') continue
      // Once the meeting is set, peers still out are not chased.
      if (p.role === 'peer' && (cycle.stage === 'meeting_scheduled' || cycle.stage === 'ready_for_meeting')) continue
      if (dueForAutoReminder(p, ctx.now, settings)) {
        const r = await remind(ctx, p.id)
        if (r.ok) summary.reminded++
      } else if (dueForEscalation(p, ctx.now, settings)) {
        await escalate(ctx, p, cycle, settings)
        summary.escalated++
      }
    }
    // 3. Catch any cycle whose readiness was missed.
    if (cycle.stage === 'in_review') {
      await evaluateCycle(ctx, cycle.id)
      summary.readyChecked++
    }
  }
  return summary
}
