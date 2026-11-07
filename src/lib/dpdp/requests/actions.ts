'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { guard } from '@/lib/rbac/guard'
import { createAdminSupabaseClient } from '@/lib/supabase/admin'
import { staffPrincipal } from '../consent/principal'
import { fieldErrors } from '../settings/schemas'
import { addDays, isoDate } from '../dates'
import { erasureAnswer, latestRetainUntil, retainedForErasure, type RetainedItem, type RuleForErasure } from './erasure'
import { answerAndSend, createRequest, getRequest, updateRequest, type RequestPrincipal } from './service'
import { REQUEST_STATUSES, REQUEST_TYPES } from './types'
import { myRequestSchema } from './schemas'

// ============================================================================
// Rights requests: server actions
// ----------------------------------------------------------------------------
// My Privacy (`myPrivacy`) raises the caller's own requests and nomination.
// The queue (`privacyCases`: Super Admin, PnC Admin) records emailed
// requests, assigns, works and answers them. Every export checks first.
// ============================================================================

type Result = { success: true; reference?: string } | { success: false; error: string; fieldErrors?: Record<string, string> }

const details = z.string().trim().max(2000, 'At most 2,000 characters')

/** Raises a request for the signed-in person, about their own data. */
export async function submitMyRequest(input: unknown): Promise<Result> {
  const allowed = await guard('myPrivacy')
  if (!allowed.ok) return { success: false, error: allowed.error }
  const parsed = myRequestSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: 'Check the highlighted fields.', fieldErrors: fieldErrors(parsed.error) }

  const principal = await staffPrincipal(allowed.caller)
  if (!principal) return { success: false, error: 'Your account has no employee record yet. Write to the privacy contact instead.' }

  const created = await createRequest({
    principal: { type: principal.type === 'contractor' ? 'contractor' : 'employee', ref: principal.ref },
    type: parsed.data.request_type as (typeof REQUEST_TYPES)[number],
    details: parsed.data.details,
    channel: 'app',
  })
  if (!created.ok) return { success: false, error: created.error }

  if ('nominee_name' in parsed.data) {
    const recorded = await recordNominationFor(principal, parsed.data, allowed.caller.email ?? null)
    if (!recorded) return { success: false, error: 'The request is recorded, but the nomination could not be saved. We will contact you.' }
  }
  revalidatePath('/my-privacy')
  return { success: true, reference: created.request.reference }
}

async function recordNominationFor(
  principal: { type: string; ref: string },
  nominee: { nominee_name: string; nominee_relation: string; nominee_contact: string },
  recordedBy: string | null,
): Promise<boolean> {
  const admin = createAdminSupabaseClient()
  if (!admin) return false
  await admin
    .from('privacy_nominations')
    .update({ revoked_at: new Date().toISOString() })
    .eq('principal_type', principal.type)
    .eq('principal_ref', principal.ref)
    .is('revoked_at', null)
  const { error } = await admin.from('privacy_nominations').insert({
    principal_type: principal.type,
    principal_ref: principal.ref,
    nominee_name: nominee.nominee_name,
    nominee_relation: nominee.nominee_relation,
    nominee_contact: nominee.nominee_contact,
    recorded_by: recordedBy,
  })
  return !error
}

const emailRequestSchema = z.object({
  request_type: z.enum(REQUEST_TYPES),
  requester_name: z.string().trim().min(2, 'Enter their name').max(150),
  requester_email: z.email('Enter the address it came from'),
  received_on: z.iso.date('Enter the date it arrived'),
  details,
})

/**
 * Records a request that arrived by email (a former employee with no login,
 * for example). Matched to a record by the sender's address where one exists.
 */
export async function recordEmailRequest(input: unknown): Promise<Result> {
  const allowed = await guard('privacyCases')
  if (!allowed.ok) return { success: false, error: allowed.error }
  const parsed = emailRequestSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: 'Check the highlighted fields.', fieldErrors: fieldErrors(parsed.error) }

  const received = new Date(`${parsed.data.received_on}T09:00:00+05:30`)
  if (received > new Date()) return { success: false, error: 'The date it arrived cannot be in the future.', fieldErrors: { received_on: 'Not in the future' } }

  const principal = await principalByEmail(parsed.data.requester_email)
  const created = await createRequest({
    principal,
    type: parsed.data.request_type,
    details: parsed.data.details,
    channel: 'email',
    requesterName: parsed.data.requester_name,
    requesterEmail: parsed.data.requester_email,
    recordedBy: allowed.caller.email ?? null,
    receivedAt: received,
  })
  if (!created.ok) return { success: false, error: created.error }
  revalidatePath('/manage/privacy/requests')
  return { success: true, reference: created.request.reference }
}

async function principalByEmail(email: string): Promise<RequestPrincipal> {
  const admin = createAdminSupabaseClient()
  if (!admin) return { type: 'former_employee', ref: null }
  const { data: employee } = await admin.from('employees').select('id, status').ilike('email', email).limit(1).maybeSingle()
  if (employee) return { type: employee.status === 'exited' ? 'former_employee' : 'employee', ref: employee.id as string }
  const { data: candidate } = await admin.from('onboarding_records').select('id').ilike('personal_email', email).limit(1).maybeSingle()
  if (candidate) return { type: 'candidate', ref: candidate.id as string }
  return { type: 'former_employee', ref: null }
}

/** Takes a request: assigns it to the caller and marks it in progress. */
export async function takeRequest(id: string): Promise<Result> {
  const allowed = await guard('privacyCases')
  if (!allowed.ok) return { success: false, error: allowed.error }
  const request = await getRequest(String(id))
  if (!request) return { success: false, error: 'Unknown request.' }
  const ok = await updateRequest(request.id, {
    assigned_to: allowed.caller.email,
    status: request.status === 'received' ? 'in_progress' : request.status,
  })
  if (!ok) return { success: false, error: 'Could not update the request.' }
  revalidatePath(`/manage/privacy/requests/${request.id}`)
  return { success: true }
}

const statusSchema = z.object({ id: z.uuid(), status: z.enum(REQUEST_STATUSES) })

/** Moves a request to another status. Answering goes through answerRequest. */
export async function setRequestStatus(input: unknown): Promise<Result> {
  const allowed = await guard('privacyCases')
  if (!allowed.ok) return { success: false, error: allowed.error }
  const parsed = statusSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: 'Invalid status.' }
  const request = await getRequest(parsed.data.id)
  if (!request) return { success: false, error: 'Unknown request.' }
  if (parsed.data.status === 'answered') return { success: false, error: 'Use Answer to send the answer.' }
  if (parsed.data.status === 'closed' && !request.answered_at) return { success: false, error: 'Answer the request before closing it.' }
  const ok = await updateRequest(request.id, {
    status: parsed.data.status,
    closed_at: parsed.data.status === 'closed' ? new Date().toISOString() : null,
  })
  if (!ok) return { success: false, error: 'Could not update the request.' }
  revalidatePath(`/manage/privacy/requests/${request.id}`)
  return { success: true }
}

/**
 * What an erasure answer must say for this request: the records kept, each
 * with its statute and date, and a draft answer.
 */
export async function draftErasureAnswer(id: string): Promise<{ success: true; items: RetainedItem[]; draft: string; retainUntil: string | null } | { success: false; error: string }> {
  const allowed = await guard('privacyCases')
  if (!allowed.ok) return { success: false, error: allowed.error }
  const request = await getRequest(String(id))
  if (!request || request.request_type !== 'erasure') return { success: false, error: 'Not an erasure request.' }

  const admin = createAdminSupabaseClient()
  if (!admin) return { success: false, error: 'The server is missing its service key.' }
  const { data: rules } = await admin.from('dpdp_retention_rules').select('id, label, period_days, statutory_ref, floor_days')
  let exitDate: string | null = null
  if (request.principal_ref && request.principal_type !== 'candidate') {
    const { data } = await admin.from('employees').select('exit_date').eq('id', request.principal_ref).maybeSingle()
    exitDate = (data?.exit_date as string | null) ?? null
  }
  const today = new Date()
  const items = retainedForErasure(
    (request.principal_type === 'dependant' ? 'volunteer' : request.principal_type) as Parameters<typeof retainedForErasure>[0],
    (rules as RuleForErasure[] | null) ?? [],
    { exitDate, lastProcessedAt: request.received_at },
    today,
  )
  return { success: true, items, draft: erasureAnswer(items, isoDate(addDays(new Date(request.due_at), 0))), retainUntil: latestRetainUntil(items) }
}

const answerSchema = z
  .object({
    id: z.uuid(),
    answer: z.string().trim().min(20, 'Write the answer in full').max(10000),
    statute_cited: z.string().trim().max(500),
    retain_until: z.union([z.literal(''), z.iso.date()]),
  })

/**
 * Answers a request and emails the answer with the privacy contact. An
 * erasure answer that keeps data must name the statute.
 */
export async function answerRequest(input: unknown): Promise<Result> {
  const allowed = await guard('privacyCases')
  if (!allowed.ok) return { success: false, error: allowed.error }
  const parsed = answerSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: 'Check the highlighted fields.', fieldErrors: fieldErrors(parsed.error) }
  const request = await getRequest(parsed.data.id)
  if (!request) return { success: false, error: 'Unknown request.' }

  if (request.request_type === 'erasure') {
    const draft = await draftErasureAnswer(request.id)
    if (draft.success && draft.items.length > 0 && !parsed.data.statute_cited) {
      return { success: false, error: 'This person\'s data is partly kept by law: name the statute.', fieldErrors: { statute_cited: 'Name the statute' } }
    }
  }

  const result = await answerAndSend(
    request.id,
    { text: parsed.data.answer, statute: parsed.data.statute_cited || null, retainUntil: parsed.data.retain_until || null },
    allowed.caller.email ?? allowed.caller.userId,
  )
  if (!result.ok) return { success: false, error: result.error ?? 'Could not answer the request.' }
  revalidatePath(`/manage/privacy/requests/${request.id}`)
  revalidatePath('/manage/privacy/requests')
  return result.emailed ? { success: true } : { success: false, error: 'The answer is saved, but the email could not be sent. Send it by hand.' }
}
