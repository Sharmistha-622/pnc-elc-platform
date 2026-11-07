import type { SupabaseClient } from '@supabase/supabase-js'
import { createAdminSupabaseClient } from '@/lib/supabase/admin'
import { sendEmail } from '@/lib/email/sendEmail'
import { toSettings } from '../settings/queries'
import type { DpdpSettings } from '../settings/types'
import { dueAt, deadlineState } from './deadlines'
import { acknowledgmentEmail, answerEmail, escalationEmail, type ContactContext } from './emails'
import type { PrivacyRequestRow, RequestType } from './types'

// ============================================================================
// Rights requests: the queue
// ----------------------------------------------------------------------------
// Server-only. Reads and writes privacy_requests with the service role, which
// sessions cannot write. Callers decide who the principal is (the session,
// the invitation token, or PnC recording an emailed request) and check their
// own guard first.
// ============================================================================

export interface RequestPrincipal {
  type: 'candidate' | 'employee' | 'contractor' | 'volunteer' | 'former_employee'
  ref: string | null
}

const COLUMNS =
  'id, reference, principal_type, principal_ref, requester_name, requester_email, request_type, channel, details, status, received_at, due_at, escalated_at, acknowledged_at, assigned_to, answer, statute_cited, retain_until, answered_at, answered_by, closed_at'

function db(): SupabaseClient {
  const client = createAdminSupabaseClient()
  if (!client) throw new Error('Rights requests need the service-role key on the server.')
  return client
}

export async function readSettings(): Promise<DpdpSettings> {
  const { data } = await db().from('dpdp_settings').select('*').eq('id', 'default').maybeSingle()
  return toSettings((data as Record<string, unknown> | null) ?? null)
}

export function contactContext(s: DpdpSettings): ContactContext {
  return {
    contact: { name: s.contact_name, role: s.contact_role, email: s.contact_email, phone: s.contact_phone },
    grievanceDays: s.grievance_days,
    boardUrl: s.board_complaint_url,
  }
}

/** Where the answer goes: the principal's own address on record, else the address the request came from. */
export async function recipientFor(r: Pick<PrivacyRequestRow, 'principal_type' | 'principal_ref' | 'requester_email'>): Promise<string | null> {
  if (r.principal_ref) {
    if (r.principal_type === 'candidate') {
      const { data } = await db().from('onboarding_records').select('personal_email').eq('id', r.principal_ref).maybeSingle()
      if (data?.personal_email) return data.personal_email as string
    } else {
      const { data } = await db().from('employees').select('email').eq('id', r.principal_ref).maybeSingle()
      if (data?.email) return data.email as string
    }
  }
  return r.requester_email?.trim() || null
}

/** Raises a request, sets its due date from the published periods and acknowledges it by email. */
export async function createRequest(input: {
  principal: RequestPrincipal
  type: RequestType
  details: string
  channel: 'app' | 'portal' | 'email' | 'paper' | 'in_person'
  requesterName?: string | null
  requesterEmail?: string | null
  recordedBy?: string | null
  receivedAt?: Date
}): Promise<{ ok: true; request: PrivacyRequestRow } | { ok: false; error: string }> {
  const settings = await readSettings()
  const received = input.receivedAt ?? new Date()
  const { data, error } = await db()
    .from('privacy_requests')
    .insert({
      principal_type: input.principal.type,
      principal_ref: input.principal.ref,
      requester_name: input.requesterName ?? null,
      requester_email: input.requesterEmail ?? null,
      request_type: input.type,
      channel: input.channel,
      details: input.details,
      received_at: received.toISOString(),
      due_at: dueAt(input.type, received, settings).toISOString(),
      recorded_by: input.recordedBy ?? null,
    })
    .select(COLUMNS)
    .single()
  if (error || !data) return { ok: false, error: 'Could not record the request.' }
  const request = data as PrivacyRequestRow

  const to = await recipientFor(request)
  if (to) {
    const mail = acknowledgmentEmail(request, contactContext(settings))
    const sent = await sendEmail('privacy_request_acknowledgment', mail, to).catch(() => ({ success: false }))
    if (sent.success) {
      await db().from('privacy_requests').update({ acknowledged_at: new Date().toISOString() }).eq('id', request.id)
    }
  }
  return { ok: true, request }
}

export async function listForPrincipal(principal: RequestPrincipal): Promise<PrivacyRequestRow[]> {
  if (!principal.ref) return []
  const { data } = await db()
    .from('privacy_requests')
    .select(COLUMNS)
    .eq('principal_type', principal.type)
    .eq('principal_ref', principal.ref)
    .order('received_at', { ascending: false })
  return (data as PrivacyRequestRow[] | null) ?? []
}

export async function listQueue(): Promise<PrivacyRequestRow[]> {
  const { data } = await db().from('privacy_requests').select(COLUMNS).order('due_at', { ascending: true }).limit(500)
  return (data as PrivacyRequestRow[] | null) ?? []
}

export async function getRequest(id: string): Promise<PrivacyRequestRow | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null
  const { data } = await db().from('privacy_requests').select(COLUMNS).eq('id', id).maybeSingle()
  return (data as PrivacyRequestRow | null) ?? null
}

export async function updateRequest(id: string, patch: Record<string, unknown>): Promise<boolean> {
  const { error } = await db().from('privacy_requests').update(patch).eq('id', id)
  return !error
}

/** Records the answer and sends it, with the privacy contact. */
export async function answerAndSend(
  id: string,
  answer: { text: string; statute: string | null; retainUntil: string | null },
  actor: string,
): Promise<{ ok: boolean; emailed: boolean; error?: string }> {
  const ok = await updateRequest(id, {
    status: 'answered',
    answer: answer.text,
    statute_cited: answer.statute,
    retain_until: answer.retainUntil,
    answered_at: new Date().toISOString(),
    answered_by: actor,
  })
  if (!ok) return { ok: false, emailed: false, error: 'Could not save the answer.' }
  const request = await getRequest(id)
  if (!request) return { ok: true, emailed: false }
  const to = await recipientFor(request)
  if (!to) return { ok: true, emailed: false }
  const settings = await readSettings()
  const sent = await sendEmail('privacy_request_answer', answerEmail(request, contactContext(settings)), to).catch(() => ({ success: false }))
  return { ok: true, emailed: !!sent.success }
}

/**
 * Escalates open requests past 80% of their period to the escalation contact.
 * Run by the daily DPDP job. Returns how many were escalated.
 */
export async function escalateDueRequests(now: Date, appUrl: string): Promise<number> {
  const settings = await readSettings()
  const { data } = await db().from('privacy_requests').select(COLUMNS).neq('status', 'closed').is('escalated_at', null)
  const due = ((data as PrivacyRequestRow[] | null) ?? []).filter((r) => {
    const state = deadlineState(r, now)
    return state === 'escalate' || state === 'overdue'
  })
  for (const r of due) {
    if (settings.escalation_email) {
      await sendEmail('privacy_request_escalation', escalationEmail(r, appUrl), settings.escalation_email).catch(() => null)
    }
    await updateRequest(r.id, { escalated_at: now.toISOString() })
  }
  return due.length
}
