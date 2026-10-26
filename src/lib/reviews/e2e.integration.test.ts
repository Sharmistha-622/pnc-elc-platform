// ============================================================================
// The whole review cycle, end to end, against a real database
// ----------------------------------------------------------------------------
// Skipped unless scripts/review-cycles-e2e.sh starts it: that script builds a
// scratch database from every migration, seeds a made-up team and puts
// PostgREST in front of it. The service then runs exactly as in production —
// service-role writes — while each person's view is read with their own
// token, so the row policies answer for real. The clock and the mailbox are
// the only things faked: time is moved forward step by step, and every email
// is captured instead of sent.
// ============================================================================

import { createHmac } from 'crypto'
import http from 'http'
import type { AddressInfo } from 'net'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const PGRST = process.env.REVIEW_E2E_PGRST
const SECRET = process.env.REVIEW_E2E_SECRET ?? ''

const E = {
  manager: '10000000-0000-0000-0000-00000000000a',
  ravi: '10000000-0000-0000-0000-00000000000b',
  peers: ['10000000-0000-0000-0000-0000000000c1', '10000000-0000-0000-0000-0000000000c2', '10000000-0000-0000-0000-0000000000c3', '10000000-0000-0000-0000-0000000000c4'],
  spare: '10000000-0000-0000-0000-0000000000c5',
  anil: '10000000-0000-0000-0000-0000000000d1',
  old: '10000000-0000-0000-0000-0000000000e1',
}
const U = {
  manager: { sub: '20000000-0000-0000-0000-00000000000a', email: 'meera@navgurukul.org' },
  ravi: { sub: '20000000-0000-0000-0000-00000000000b', email: 'ravi@navgurukul.org' },
  pia: { sub: '20000000-0000-0000-0000-0000000000c1', email: 'pia@navgurukul.org' },
  pnc: { sub: '20000000-0000-0000-0000-0000000000f1', email: 'pnc.admin@navgurukul.org' },
  ops: { sub: '20000000-0000-0000-0000-0000000000f2', email: 'pnc.ops@navgurukul.org' },
}
const PNC = [{ name: 'PnC', email: 'pnc.mailbox@navgurukul.org' }]

function jwt(payload: Record<string, unknown>): string {
  const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url')
  const head = b64({ alg: 'HS256', typ: 'JWT' })
  const body = b64({ ...payload, exp: Math.floor(Date.now() / 1000) + 3600 })
  const sig = createHmac('sha256', SECRET).update(`${head}.${body}`).digest('base64url')
  return `${head}.${body}.${sig}`
}

type Sent = { template: string; subject: string; to: string[]; ics?: string }

describe.skipIf(!PGRST)('review cycle, end to end', () => {
  let server: http.Server
  let url = ''
  let admin: SupabaseClient
  const as = (u: { sub: string; email: string }) =>
    createClient(url, jwt({ sub: u.sub, email: u.email, role: 'authenticated', aud: 'authenticated' }), {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  const outbox: Sent[] = []
  let svc: typeof import('./service')
  let now = new Date('2026-10-14T03:30:00Z') // 09:00 IST, six days before Ravi's confirmation date
  const ctx = (actor = 'automation') => ({
    db: admin,
    now,
    actor,
    appUrl: 'https://elc.example.org',
    pncRecipients: PNC,
    busy: async () => [] as { start: string; end: string }[],
    mail: {
      send: async (template: string, m: { subject: string }, to: { email: string }) => {
        outbox.push({ template, subject: m.subject, to: [to.email] })
        return { success: true }
      },
      invite: async (template: string, m: { subject: string }, ics: string, to: { email: string }[]) => {
        outbox.push({ template, subject: m.subject, to: to.map((t) => t.email), ics })
        return { success: true }
      },
    },
  })
  const hours = (h: number) => {
    now = new Date(now.getTime() + h * 3600000)
  }
  const mailsTo = (email: string, template?: string) => outbox.filter((m) => m.to.includes(email) && (!template || m.template.includes(template)))

  // A respondent fills in and submits their form with their own token, the
  // way saveSubmission does, then the hook runs.
  async function submitForm(user: { sub: string; email: string }, requestId: string) {
    const db = as(user)
    const { data: req } = await db.from('form_requests').select('form_version_id, subject_employee_id, respondent_employee_id').eq('id', requestId).single()
    expect(req, 'the respondent can read their own request').toBeTruthy()
    const { data: fields } = await db.from('form_fields').select('id, field_type, options, is_required').eq('form_version_id', req!.form_version_id)
    const { data: sub, error } = await db
      .from('form_submissions')
      .insert({ form_version_id: req!.form_version_id, request_id: requestId, subject_employee_id: req!.subject_employee_id, respondent_employee_id: req!.respondent_employee_id })
      .select('id')
      .single()
    expect(error).toBeNull()
    const rows = (fields ?? []).map((f) => ({
      submission_id: sub!.id,
      field_id: f.id,
      value:
        f.field_type === 'rating_grid'
          ? Object.fromEntries(((f.options?.rows as string[]) ?? []).map((r) => [r, 4]))
          : f.field_type === 'single_select'
            ? (f.options?.choices as string[])[0]
            : f.field_type === 'yes_no'
              ? 'yes'
              : `Answer from ${user.email}`,
    }))
    const { error: answerError } = await db.from('form_answers').upsert(rows, { onConflict: 'submission_id,field_id' })
    expect(answerError).toBeNull()
    const { error: submitError } = await db.from('form_submissions').update({ status: 'submitted' }).eq('id', sub!.id)
    expect(submitError).toBeNull()
    await svc.onFormSubmitted(ctx(user.email) as never, requestId)
  }

  beforeAll(async () => {
    // supabase-js speaks to /rest/v1; PostgREST serves at its root.
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
    const serviceKey = jwt({ role: 'service_role' })
    process.env.NEXT_PUBLIC_SUPABASE_URL = url
    process.env.SUPABASE_SERVICE_ROLE_KEY = serviceKey
    admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })
    svc = await import('./service')
  })

  afterAll(() => server?.close())

  let cycleId = ''
  let selfRequest = ''
  let managerRequest = ''

  it('opens what is due — and only that', async () => {
    const summary = await svc.runAutomation(ctx() as never)
    expect(summary.openFailures).toEqual([])
    expect(summary.opened).toBe(1)

    const { data: cycles } = await admin.from('review_cycles').select('*')
    expect(cycles).toHaveLength(1)
    const c = cycles![0]
    expect(c).toMatchObject({ kind: 'confirmation', employee_id: E.ravi, manager_id: E.manager, stage: 'self_review', due_date: '2026-10-20' })
    cycleId = c.id
    expect(c.confirmation_id, 'kept in step with the Confirmations screen').toBeTruthy()

    const { data: parts } = await admin.from('review_participants').select('*').eq('cycle_id', cycleId)
    expect(parts!.map((p) => [p.role, p.status]).sort()).toEqual([['manager', 'invited'], ['self', 'invited']])
    selfRequest = parts!.find((p) => p.role === 'self')!.form_request_id
    managerRequest = parts!.find((p) => p.role === 'manager')!.form_request_id

    expect(mailsTo('ravi@navgurukul.org', 'self_invite')).toHaveLength(1)
    expect(mailsTo('meera@navgurukul.org', 'manager_invite')).toHaveLength(1)
    // A record years overdue is left for PnC, not mailed.
    const due = await svc.whoIsDue(admin, now, await svc.loadSettings(admin))
    expect(due.find((d) => d.employeeId === E.old)?.state).toBe('overdue_manual')
    expect(due.find((d) => d.employeeId === E.ravi)).toBeUndefined()

    // Running again the same day changes nothing.
    const again = await svc.runAutomation(ctx() as never)
    expect(again.opened).toBe(0)
    expect(again.reminded).toBe(0)
  })

  it('puts the forms in My Forms for the right people only', async () => {
    const { data: ravisRequests } = await as(U.ravi).from('form_requests').select('id')
    expect(ravisRequests!.map((r) => r.id)).toEqual([selfRequest])
    const { data: managersRequests } = await as(U.manager).from('form_requests').select('id')
    expect(managersRequests!.map((r) => r.id)).toEqual([managerRequest])
  })

  it('holds the self-reflection until enough peers are nominated', async () => {
    expect(await svc.selfSubmitBlocker(as(U.ravi), selfRequest)).toMatch(/at least 4/)
    const tooFew = await svc.setNominations(ctx(U.ravi.email) as never, cycleId, E.peers.slice(0, 2), E.ravi)
    expect(tooFew.ok).toBe(true) // saved as a draft list before submitting
    expect(await svc.selfSubmitBlocker(as(U.ravi), selfRequest)).toMatch(/at least 4/)
    const withManager = await svc.setNominations(ctx(U.ravi.email) as never, cycleId, [...E.peers.slice(0, 3), E.manager], E.ravi)
    expect(withManager).toMatchObject({ ok: false })
    const four = await svc.setNominations(ctx(U.ravi.email) as never, cycleId, E.peers, E.ravi)
    expect(four.ok).toBe(true)
    expect(await svc.selfSubmitBlocker(as(U.ravi), selfRequest)).toBeNull()
    // Nominated, not yet asked.
    expect(outbox.filter((m) => m.template.includes('peer_invite'))).toHaveLength(0)
  })

  it('asks the peers the moment the self-reflection is submitted', async () => {
    hours(2)
    await submitForm(U.ravi, selfRequest)
    const { data: c } = await admin.from('review_cycles').select('stage, self_submitted_at').eq('id', cycleId).single()
    expect(c!.stage).toBe('in_review')
    expect(c!.self_submitted_at).toBeTruthy()
    const invites = outbox.filter((m) => m.template === 'review_confirmation_peer_invite')
    expect(invites).toHaveLength(4)
    expect(invites[0].subject).toContain('Ravi Report has nominated you')
  })

  it('lets the employee see who answered, never what anyone wrote', async () => {
    const ravi = as(U.ravi)
    const { data: parts } = await ravi.from('review_participants').select('role, status').eq('cycle_id', cycleId)
    expect(parts).toHaveLength(6)
    const { data: decisions } = await ravi.from('review_decisions').select('*')
    expect(decisions).toEqual([])
    const { data: events } = await ravi.from('review_events').select('*')
    expect(events).toEqual([])
    // Only their own answers, never a reviewer's.
    const { data: answers } = await ravi.from('form_answers').select('submission_id, form_submissions!inner(respondent_employee_id)')
    expect((answers ?? []).every((a) => (a as unknown as { form_submissions: { respondent_employee_id: string } }).form_submissions.respondent_employee_id === E.ravi)).toBe(true)
  })

  it('keeps one peer out of the cycle and other peers’ rows', async () => {
    const pia = as(U.pia)
    expect((await pia.from('review_cycles').select('id')).data).toEqual([])
    const { data: own } = await pia.from('review_participants').select('employee_id')
    expect(own!.map((r) => r.employee_id)).toEqual([E.peers[0]])
  })

  it('reminds once per 24 hours, whoever presses it', async () => {
    const piaRow = (await admin.from('review_participants').select('id').eq('cycle_id', cycleId).eq('employee_id', E.peers[0]).single()).data!
    hours(1)
    const early = await svc.remind(ctx('ravi@navgurukul.org') as never, piaRow.id)
    expect(early).toMatchObject({ ok: false })
    expect(!early.ok && early.error).toMatch(/next one can be sent in 23h/)

    hours(23)
    const onTime = await svc.remind(ctx('pnc.admin@navgurukul.org') as never, piaRow.id)
    expect(onTime.ok).toBe(true)
    const twice = await svc.remind(ctx('pnc.admin@navgurukul.org') as never, piaRow.id)
    expect(twice).toMatchObject({ ok: false })
  })

  it('reminds automatically, then tells PnC who has gone quiet', async () => {
    hours(1) // a day after the peers were asked, two after the manager
    const first = await svc.runAutomation(ctx() as never)
    // The manager (asked a day earlier) and three peers; Pia was reminded an hour ago.
    expect(first.reminded).toBe(4)
    hours(24)
    const second = await svc.runAutomation(ctx() as never)
    expect(second.reminded).toBe(5)
    expect(second.escalated).toBe(0)
    hours(24)
    const third = await svc.runAutomation(ctx() as never)
    expect(third.escalated).toBeGreaterThanOrEqual(1)
    const escalations = outbox.filter((m) => m.template === 'review_escalation')
    expect(escalations.every((m) => m.to[0] === PNC[0].email)).toBe(true)
    expect(escalations.some((m) => m.subject.includes('stuck'))).toBe(true)
    // Escalated once, not every day after.
    hours(24)
    const fourth = await svc.runAutomation(ctx() as never)
    const { count } = await admin.from('review_participants').select('id', { count: 'exact', head: true }).eq('cycle_id', cycleId).not('escalated_at', 'is', null)
    expect(fourth.escalated + third.escalated).toBe(count)
  })

  it('books the meeting once the manager and most peers are in', async () => {
    hours(1)
    await submitForm(U.manager, managerRequest)
    expect((await admin.from('review_cycles').select('stage').eq('id', cycleId).single()).data!.stage).toBe('in_review')

    const peerRequests = (await admin.from('review_participants').select('employee_id, form_request_id').eq('cycle_id', cycleId).eq('role', 'peer')).data!
    const users = [U.pia, { sub: '20000000-0000-0000-0000-0000000000c2', email: 'paul@navgurukul.org' }, { sub: '20000000-0000-0000-0000-0000000000c3', email: 'priya@navgurukul.org' }]
    for (const [i, user] of users.entries()) {
      await submitForm(user, peerRequests.find((p) => p.employee_id === E.peers[i])!.form_request_id)
    }
    const { data: c } = await admin.from('review_cycles').select('*').eq('id', cycleId).single()
    expect(c!.stage).toBe('meeting_scheduled')
    expect(c!.ready_at).toBeTruthy()
    const invite = outbox.find((m) => m.template === 'review_meeting_invite')!
    expect(invite.to.sort()).toEqual(['meera@navgurukul.org', 'pnc.mailbox@navgurukul.org', 'ravi@navgurukul.org'])
    expect(invite.ics).toContain('METHOD:REQUEST')
    expect(new Date(c!.meeting_start).getUTCDay()).not.toBe(0)
    expect(mailsTo(PNC[0].email, 'ready_for_meeting')).toHaveLength(1)
  })

  it('keeps the manager’s view at the database to cycle facts, not answers', async () => {
    const m = as(U.manager)
    expect((await m.from('review_cycles').select('id')).data).toHaveLength(1)
    expect((await m.from('review_participants').select('id').eq('cycle_id', cycleId)).data).toHaveLength(6)
    // Answers reach the manager only through the app, after the reporting
    // line check (queries.ts); the database gives a session none of a peer's.
    const { data: peerAnswers } = await m.from('form_answers').select('id, form_submissions!inner(respondent_employee_id)').neq('form_submissions.respondent_employee_id', E.manager)
    expect(peerAnswers).toEqual([])
    // PnC Ops sees statuses, not the decision.
    expect((await as(U.ops).from('review_participants').select('id').eq('cycle_id', cycleId)).data).toHaveLength(6)
  })

  it('records the decision, lets PnC send it back, then close it', async () => {
    hours(72)
    const short = await svc.recordDecision(ctx(U.manager.email) as never, cycleId, { decision: 'confirm', note: 'ok', extendUntil: null, decidedBy: E.manager })
    expect(short).toMatchObject({ ok: false })
    const recorded = await svc.recordDecision(ctx(U.manager.email) as never, cycleId, { decision: 'confirm', note: 'Consistently strong delivery; peers agree.', extendUntil: null, decidedBy: E.manager })
    expect(recorded.ok).toBe(true)
    expect(mailsTo(PNC[0].email, 'decision_recorded')).toHaveLength(1)
    const { data: conf } = await admin.from('review_cycles').select('confirmation_id').eq('id', cycleId).single()
    expect((await admin.from('confirmations').select('manager_decision').eq('id', conf!.confirmation_id).single()).data!.manager_decision).toBe('yes')

    // The decision note is the manager's and PnC's; Ravi still sees nothing.
    expect((await as(U.ravi).from('review_decisions').select('*')).data).toEqual([])
    expect((await as(U.manager).from('review_decisions').select('note')).data).toEqual([{ note: 'Consistently strong delivery; peers agree.' }])
    expect((await as(U.ops).from('review_decisions').select('*')).data).toEqual([])

    const returned = await svc.closeCycle(ctx(U.pnc.email) as never, cycleId, { outcome: 'returned', note: 'Please address the attendance point raised by a peer.' })
    expect(returned.ok).toBe(true)
    expect((await admin.from('review_cycles').select('stage').eq('id', cycleId).single()).data!.stage).toBe('meeting_scheduled')
    expect(mailsTo('meera@navgurukul.org', 'decision_returned')).toHaveLength(1)

    await svc.recordDecision(ctx(U.manager.email) as never, cycleId, { decision: 'confirm', note: 'Discussed attendance; resolved. Confirm.', extendUntil: null, decidedBy: E.manager })
    const accepted = await svc.closeCycle(ctx(U.pnc.email) as never, cycleId, { outcome: 'accepted', note: '' })
    expect(accepted.ok).toBe(true)

    const { data: done } = await admin.from('review_cycles').select('stage, closed_at').eq('id', cycleId).single()
    expect(done!.stage).toBe('closed')
    expect((await admin.from('employees').select('confirmation_date').eq('id', E.ravi).single()).data!.confirmation_date).toBeTruthy()
    expect((await admin.from('confirmations').select('status').eq('id', conf!.confirmation_id).single()).data!.status).toBe('approved')
    // Pranav never answered: his form is withdrawn, not left hanging in My Forms.
    const { data: left } = await admin.from('review_participants').select('status, form_request_id').eq('cycle_id', cycleId).eq('employee_id', E.peers[3]).single()
    expect(left!.status).toBe('cancelled')
    expect((await admin.from('form_requests').select('status').eq('id', left!.form_request_id).single()).data!.status).toBe('cancelled')
    // Nothing chases anyone on a closed review.
    hours(48)
    const after = await svc.runAutomation(ctx() as never)
    expect(after.reminded).toBe(0)
  })

  it('opens an appraisal batch for the people in it', async () => {
    now = new Date('2026-11-20T03:30:00Z')
    const summary = await svc.runAutomation(ctx() as never)
    const { data: appraisals } = await admin.from('review_cycles').select('employee_id, period_key, appraisal_id').eq('kind', 'appraisal')
    expect(summary.openFailures).toEqual([])
    // Anil joined April 2025: reference October 2025, so the December batch.
    expect(appraisals!.find((a) => a.employee_id === E.anil)).toMatchObject({ period_key: 'appraisal:december-2026' })
    expect(appraisals!.find((a) => a.employee_id === E.anil)!.appraisal_id).toBeTruthy()
    // Ravi joined July 2026: reference January 2027, not yet in a batch.
    expect(appraisals!.find((a) => a.employee_id === E.ravi)).toBeUndefined()
  })
})
