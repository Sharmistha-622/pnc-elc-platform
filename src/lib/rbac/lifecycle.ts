// ============================================================================
// JOINER LIFECYCLE — status drives the role, nothing else
// ----------------------------------------------------------------------------
// "Each stage change writes the new role and status in one step." The status
// field is the single thing the automation reads; separate flags would drift.
//
// Nobody assigns a lifecycle role by hand. `roleForStatus` is the only place
// that decides, so the role on a person can always be re-derived from their
// status and checked against what is stored.
// ============================================================================

import type { RoleCode } from './roles'

export const JOINER_STATUSES = [
  'offer_pending', // offer shared, awaiting a reply
  'offer_accepted', // accepted; pre-joining begins
  'docs_submitted', // ID, bank and joining documents are in
  'docs_verified', // the in-house audit passed
  'active', // marked joined on Day 1
  'confirmed', // probation confirmed by the manager
  'withdrawn', // declined, offer pulled, or no-show
] as const

export type JoinerStatus = (typeof JOINER_STATUSES)[number]

export const STATUS_LABELS: Record<JoinerStatus, string> = {
  offer_pending: 'Offer pending',
  offer_accepted: 'Offer accepted',
  docs_submitted: 'Docs submitted',
  docs_verified: 'Docs verified',
  active: 'Active',
  confirmed: 'Confirmed',
  withdrawn: 'Withdrawn',
}

/**
 * The role a status implies.
 *
 * `withdrawn` resolves to no role: access is off the same day, but the record
 * is kept rather than deleted, so the confirmation trigger can never fire for
 * someone who never joined.
 */
export function roleForStatus(status: JoinerStatus): RoleCode | null {
  switch (status) {
    case 'offer_pending':
      return 'candidate'
    case 'offer_accepted':
    case 'docs_submitted':
    case 'docs_verified':
      return 'pre_joiner'
    case 'active':
    case 'confirmed':
      return 'employee'
    case 'withdrawn':
      return null
  }
}

/**
 * Which statuses may follow which.
 *
 * Withdrawn is reachable from anywhere before Day 1 and is terminal. There is
 * deliberately no path out of it: a returning person is a new record, or the
 * old one is reopened explicitly by a human rather than by a status write.
 */
const TRANSITIONS: Record<JoinerStatus, JoinerStatus[]> = {
  offer_pending: ['offer_accepted', 'withdrawn'],
  offer_accepted: ['docs_submitted', 'withdrawn'],
  docs_submitted: ['docs_verified', 'offer_accepted', 'withdrawn'], // back on a rejected document
  docs_verified: ['active', 'withdrawn'],
  active: ['confirmed', 'withdrawn'], // withdrawn covers a Day 1 no-show
  confirmed: [],
  withdrawn: [],
}

export function canTransition(from: JoinerStatus, to: JoinerStatus): boolean {
  return TRANSITIONS[from].includes(to)
}

export function nextStatuses(from: JoinerStatus): JoinerStatus[] {
  return TRANSITIONS[from]
}

/** True once the person has actually joined. */
export function hasJoined(status: JoinerStatus): boolean {
  return status === 'active' || status === 'confirmed'
}

/**
 * Whether scheduled steps should still run for this record.
 *
 * A withdrawn joiner must stop receiving everything: invites cancelled,
 * accounts revoked, and no confirmation trigger.
 */
export function isLive(status: JoinerStatus): boolean {
  return status !== 'withdrawn'
}

// ---------------------------------------------------------------------------
// The line role
// ---------------------------------------------------------------------------

/**
 * Manager is not granted either — it follows the reporting line. Anyone with at
 * least one active reportee has it, and loses it when the last one goes.
 */
export function hasManagerRole(reporteeCount: number): boolean {
  return reporteeCount > 0
}

/**
 * The role a person should hold, given their lifecycle status and reporting
 * line. Returns null when they should hold no role at all.
 *
 * A granted role always wins: someone who is both an employee and a PnC Admin
 * is a PnC Admin. The lifecycle only ever sets the baseline.
 */
export function deriveRole(input: {
  status: JoinerStatus
  reporteeCount?: number
  grantedRole?: RoleCode | null
}): RoleCode | null {
  if (input.grantedRole) return input.grantedRole

  const base = roleForStatus(input.status)
  if (base === 'employee' && hasManagerRole(input.reporteeCount ?? 0)) return 'manager'
  return base
}
