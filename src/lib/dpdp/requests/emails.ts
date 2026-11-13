import type { PrivacyContactDetails } from '@/components/shared/privacy/privacy-contact'
import { REQUEST_LABELS, type PrivacyRequestRow } from './types'

// ============================================================================
// Emails for rights requests. Every one carries the privacy contact and the
// route to the Data Protection Board (DPDP Act s. 8(9), s. 13; Rules r. 9).
// Bodies hold the reference, the request type, dates and the answer only.
// ============================================================================

export interface ContactContext {
  contact: PrivacyContactDetails
  grievanceDays: number
  boardUrl: string
}

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

const fmt = (iso: string) => new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Kolkata' })

/** The contact, the grievance period and the Board route, as an email block. */
export function contactBlock(c: ContactContext): string {
  const who = c.contact.name && c.contact.email
    ? `${esc(c.contact.role || 'Privacy & Grievance Officer')}: ${esc(c.contact.name)}, <a href="mailto:${esc(c.contact.email)}">${esc(c.contact.email)}</a>${c.contact.phone ? `, ${esc(c.contact.phone)}` : ''}`
    : 'People &amp; Culture, NavGurukul'
  const board = c.boardUrl
    ? `<p>If you are not satisfied once our grievance process is complete, you may complain to the <a href="${esc(c.boardUrl)}">Data Protection Board of India</a>.</p>`
    : '<p>If you are not satisfied once our grievance process is complete, you may complain to the Data Protection Board of India.</p>'
  return `<hr><p><strong>Questions about your data</strong><br>${who}. We answer a grievance within ${c.grievanceDays} days.</p>${board}`
}

export function acknowledgmentEmail(r: PrivacyRequestRow, c: ContactContext): Record<string, string> & { subject: string; body: string } {
  const kind = REQUEST_LABELS[r.request_type].label.toLowerCase()
  const receivedDate = fmt(r.received_at)
  const dueDate = fmt(r.due_at)
  const contact = contactBlock(c)
  return {
    subject: `We have your request ${r.reference}`,
    body: `<p>We received your request (${esc(kind)}) on ${receivedDate}, reference <strong>${esc(r.reference)}</strong>.</p>`
      + `<p>We will answer by ${dueDate}. Quote the reference if you write to us about it.</p>`
      + contact,
    reference: r.reference,
    request_type: kind,
    received_date: receivedDate,
    due_date: dueDate,
    contact_block: contact,
  }
}

export function answerEmail(r: PrivacyRequestRow, c: ContactContext): Record<string, string> & { subject: string; body: string } {
  const answer = esc(r.answer ?? '').replace(/\n/g, '<br>')
  const kept = r.request_type === 'erasure' && r.statute_cited
    ? `<p>Kept under: ${esc(r.statute_cited)}${r.retain_until ? `, until ${fmt(r.retain_until)}` : ''}.</p>`
    : ''
  const contact = contactBlock(c)
  return {
    subject: `Answer to your request ${r.reference}`,
    body: `<p>${answer}</p>${kept}` + contact,
    reference: r.reference,
    answer_text: answer,
    retention_note: kept,
    contact_block: contact,
  }
}

/** To the escalation contact: reference, type and due date only. */
export function escalationEmail(r: PrivacyRequestRow, appUrl: string): Record<string, string> & { subject: string; body: string } {
  const requestType = REQUEST_LABELS[r.request_type].label
  const dueDate = fmt(r.due_at)
  const requestUrl = `${appUrl}/manage/privacy/requests/${r.id}`
  return {
    subject: `Privacy request ${r.reference} is close to its due date`,
    body: `<p>Request ${esc(r.reference)} (${esc(requestType)}) is due on ${dueDate} and is still open.</p>`
      + `<p><a href="${esc(appUrl)}/manage/privacy/requests/${esc(r.id)}">Open it in the request queue</a>.</p>`,
    reference: r.reference,
    request_type: requestType,
    due_date: dueDate,
    request_url: requestUrl,
  }
}
