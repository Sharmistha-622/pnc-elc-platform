// ============================================================================
// SEALING — moving a record from core into the vault
// ----------------------------------------------------------------------------
// Two decisions resolved to one mechanism.
//
//   ID documents     land in core, are verified there by PnC Ops, and seal into
//                    the vault on approval.
//   Written feedback is collected in core while a confirmation or appraisal
//                    cycle runs, and seals when the cycle closes.
//
// Both follow the same shape: core is the working area, the vault is the
// archive, and a named completion event moves the record across. Afterwards
// core keeps a *residue* — the fact, a status, and a safe identifier — and the
// sensitive part is reachable only through a logged vault read.
//
// Why this is worth the complexity: it lets the roles who actually do the work
// (PnC Ops verifying documents, a manager reading their team's in-flight
// feedback) do it without a vault login, which was the contradiction in the
// original matrix.
//
// The cost, stated plainly: while a record is staged it sits in core, where the
// platform team can read it. The staging window IS the exposure. Sealing
// promptly is not housekeeping — it is the control.
// ============================================================================

/** What can be sealed. One per staged resource. */
export type SealableKind = 'identity_document' | 'feedback'

/** The event that makes a record ready to seal. */
export type SealTrigger =
  | 'document_verified' // PnC Ops approved the document
  | 'cycle_closed' // the confirmation or appraisal decision is recorded

export const SEAL_TRIGGER_FOR: Record<SealableKind, SealTrigger> = {
  identity_document: 'document_verified',
  feedback: 'cycle_closed',
}

export type SealState =
  /** In core, process still running. Readable by the core roles that need it. */
  | 'staged'
  /** The trigger fired; the move has not completed yet. */
  | 'sealing'
  /** In the vault. Core holds only the residue. */
  | 'sealed'
  /** The move failed and needs attention — still exposed in core. */
  | 'seal_failed'

/**
 * How long a record may sit staged before it is considered overdue.
 *
 * These are not SLAs for people, they are exposure budgets. A document nobody
 * has verified in a fortnight is a scan of someone's Aadhaar sitting where the
 * platform team can read it.
 */
export const STAGING_BUDGET_DAYS: Record<SealableKind, number> = {
  identity_document: 14,
  feedback: 30,
}

export interface StagedRecord {
  kind: SealableKind
  state: SealState
  stagedAt: string
}

export function daysStaged(record: StagedRecord, now: Date = new Date()): number {
  const started = new Date(record.stagedAt).getTime()
  return Math.floor((now.getTime() - started) / 86_400_000)
}

/** True when a staged record has outlived its exposure budget. */
export function isOverdue(record: StagedRecord, now: Date = new Date()): boolean {
  if (record.state === 'sealed') return false
  return daysStaged(record, now) > STAGING_BUDGET_DAYS[record.kind]
}

/** Records still exposed in core, longest-exposed first. */
export function exposed<T extends StagedRecord>(records: T[], now: Date = new Date()): T[] {
  return records
    .filter((r) => r.state !== 'sealed')
    .sort((a, b) => daysStaged(b, now) - daysStaged(a, now))
}

export type SealRefusal = 'not_yet_triggered' | 'already_sealed' | 'in_progress'

export type SealDecision = { ok: true } | { ok: false; reason: SealRefusal }

/**
 * Whether a record may be sealed now.
 *
 * A failed seal is explicitly retryable: the record is still sitting in core,
 * so giving up is the one thing that must not happen.
 */
export function canSeal(record: StagedRecord, triggerFired: boolean): SealDecision {
  if (record.state === 'sealed') return { ok: false, reason: 'already_sealed' }
  if (record.state === 'sealing') return { ok: false, reason: 'in_progress' }
  if (!triggerFired) return { ok: false, reason: 'not_yet_triggered' }
  return { ok: true }
}

// ---------------------------------------------------------------------------
// The residue core keeps
// ---------------------------------------------------------------------------

/**
 * What stays in core after a document is sealed.
 *
 * Enough to show "this is done" and to tell two documents apart. Never the
 * file, and never the full number.
 */
export interface SealedDocumentResidue {
  documentType: string
  verifiedBy: string
  verifiedAt: string
  sealedAt: string
  /** Last four characters only — enough to identify, not to use. */
  numberLast4: string | null
  /** The row in the vault, for a logged read by someone entitled to one. */
  vaultDocumentId: string
}

/**
 * Mask a document number for display in core.
 *
 * Only the last four characters survive. An Aadhaar or PAN number is a key, not
 * a label — more useful to an attacker than the scan it came from — so core
 * never keeps the whole thing.
 */
export function maskDocumentNumber(value: string | null | undefined): string | null {
  if (!value) return null
  const cleaned = value.replace(/\s+/g, '')
  if (cleaned.length <= 4) return null // too short to mask meaningfully
  return cleaned.slice(-4)
}

/** How a masked number is rendered, e.g. "XXXX XXXX 9012". */
export function displayMaskedNumber(documentType: string, last4: string | null): string {
  if (!last4) return 'Not captured'
  const shapes: Record<string, string> = {
    aadhaar: `XXXX XXXX ${last4}`,
    pan: `XXXXXX${last4}`,
  }
  return shapes[documentType] ?? `••••${last4}`
}
