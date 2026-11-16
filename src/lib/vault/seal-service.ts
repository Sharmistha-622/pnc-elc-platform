// ============================================================================
// SEALING (core side)
// ----------------------------------------------------------------------------
// Moves a staged record out of core and into the vault.
//
// The order is the design, and it is not negotiable:
//
//   1. mark `sealing`           so a second run does not start
//   2. write to the vault       idempotent on the core id
//   3. delete the core copy     only once the vault has confirmed
//   4. mark `sealed`            with the residue
//
// Never delete before the vault confirms. A crash between 2 and 3 leaves a
// duplicate, which a retry resolves; a crash between a delete and a failed
// write would lose someone's document outright.
// ============================================================================

import { createHash } from 'node:crypto'
import { onboardingDb, assertOk } from '@/lib/onboarding/db'
import { CANDIDATE_BUCKET } from '@/lib/onboarding/candidate-storage'
import { sealDocumentInVault, sealFeedbackInVault, isVaultConfigured, VaultUnavailable } from './client'
import { canSeal, maskDocumentNumber, type StagedRecord } from './sealing'

export type SealOutcome =
  | { ok: true; vaultId: string; numberLast4?: string | null; skipped?: false }
  | { ok: true; skipped: true; reason: string }
  | { ok: false; error: string }

/**
 * Seal a verified identity document.
 *
 * `documentNumber` is the number PnC Ops typed at verification. It is passed
 * through to the vault and deliberately never persisted in core â€” only the
 * last four characters come back.
 */
export async function sealIdentityDocument(
  coreDocumentId: string,
  options: { verifiedBy: string; documentNumber?: string | null }
): Promise<SealOutcome> {
  const db = onboardingDb()

  const { data: doc, error } = await db
    .from('onboarding_documents')
    .select('id, onboarding_id, document_type, document_type_key, file_name, status, storage_reference, seal_state, staged_at')
    .eq('id', coreDocumentId)
    .maybeSingle()
  assertOk(error, 'Failed to load the document to seal')
  if (!doc) return { ok: false, error: 'Document not found.' }

  const record: StagedRecord = {
    kind: 'identity_document',
    state: doc.seal_state,
    stagedAt: doc.staged_at,
  }
  const decision = canSeal(record, doc.status === 'verified')
  if (!decision.ok) {
    // Already sealed is a success from the caller's point of view: the document
    // is where it should be.
    if (decision.reason === 'already_sealed') {
      return { ok: true, skipped: true, reason: 'already sealed' }
    }
    return { ok: false, error: decision.reason }
  }

  if (!isVaultConfigured()) {
    // Fail loudly rather than leaving a verified document sitting in core
    // under the impression it was filed away.
    return { ok: false, error: 'The vault is not configured, so nothing can be sealed.' }
  }

  await db.from('onboarding_documents').update({ seal_state: 'sealing', seal_error: null }).eq('id', coreDocumentId)

  try {
    let file: Blob | null = null
    if (doc.storage_reference) {
      const { data, error: dlError } = await db.storage
        .from(CANDIDATE_BUCKET)
        .download(doc.storage_reference)
      if (dlError || !data) throw new Error(`Could not read the staged file: ${dlError?.message}`)
      file = data
    }

    const result = await sealDocumentInVault({
      corePersonId: doc.onboarding_id,
      coreDocumentId: doc.id,
      documentType: doc.document_type_key || doc.document_type,
      fileName: doc.file_name || doc.document_type,
      verifiedBy: options.verifiedBy,
      documentNumber: options.documentNumber ?? null,
      file,
    })

    // Only now is it safe to remove core's copy.
    if (doc.storage_reference) {
      await db.storage.from(CANDIDATE_BUCKET).remove([doc.storage_reference])
    }

    const numberLast4 = result.numberLast4 ?? maskDocumentNumber(options.documentNumber)
    const now = new Date().toISOString()

    const { error: updateError } = await db
      .from('onboarding_documents')
      .update({
        seal_state: 'sealed',
        sealed_at: now,
        seal_error: null,
        storage_reference: null,
        storage_bucket: null,
        vault_document_id: result.vaultDocumentId,
        document_number_last4: numberLast4,
        number_captured_by: options.documentNumber ? options.verifiedBy : null,
        number_captured_at: options.documentNumber ? now : null,
      })
      .eq('id', coreDocumentId)
    assertOk(updateError, 'Sealed in the vault, but core could not be updated')

    return { ok: true, vaultId: result.vaultDocumentId, numberLast4 }
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    // Left in core and visible in `exposed_records`. A failed seal is worse
    // than a staged one, because nobody is waiting on it.
    await db
      .from('onboarding_documents')
      .update({ seal_state: 'seal_failed', seal_error: message })
      .eq('id', coreDocumentId)
    return { ok: false, error: message }
  }
}

/**
 * Seal every piece of written feedback for a closed cycle.
 *
 * Returns per-record outcomes rather than throwing on the first failure: one
 * unreachable row must not leave the rest sitting in core.
 */
export async function sealFeedbackForConfirmation(
  confirmationId: string,
  options: { corePersonId: string; cycle?: string | null; event?: string }
): Promise<{ sealed: number; failed: number; errors: string[] }> {
  const db = onboardingDb()
  const summary = { sealed: 0, failed: 0, errors: [] as string[] }

  const { data: rows } = await db
    .from('peer_feedback')
    .select('id, peer_employee_id, peer_name, peer_email, feedback_text, seal_state, staged_at')
    .eq('confirmation_id', confirmationId)
    .neq('seal_state', 'sealed')

  for (const row of rows ?? []) {
    if (!row.feedback_text) continue // nothing written, nothing to seal

    const decision = canSeal(
      { kind: 'feedback', state: row.seal_state, stagedAt: row.staged_at },
      true
    )
    if (!decision.ok && decision.reason !== 'not_yet_triggered') {
      if (decision.reason === 'already_sealed') continue
      summary.failed += 1
      summary.errors.push(`${row.id}: ${decision.reason}`)
      continue
    }

    await db.from('peer_feedback').update({ seal_state: 'sealing', seal_error: null }).eq('id', row.id)

    try {
      const result = await sealFeedbackInVault({
        corePersonId: options.corePersonId,
        coreFeedbackId: row.id,
        authorCoreId: row.peer_employee_id,
        authorLabel: row.peer_name || row.peer_email || 'Unattributed',
        kind: 'peer',
        cycle: options.cycle ?? null,
        text: row.feedback_text,
        sealedOnEvent: options.event ?? 'cycle_closed',
      })

      const { error } = await db
        .from('peer_feedback')
        .update({
          seal_state: 'sealed',
          sealed_at: new Date().toISOString(),
          seal_error: null,
          // The text is gone from core; a constraint enforces that this and the
          // vault pointer move together.
          feedback_text: null,
          vault_feedback_id: result.vaultFeedbackId,
        })
        .eq('id', row.id)
      if (error) throw new Error(error.message)

      summary.sealed += 1
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      await db
        .from('peer_feedback')
        .update({ seal_state: 'seal_failed', seal_error: message })
        .eq('id', row.id)
      summary.failed += 1
      summary.errors.push(`${row.id}: ${message}`)
    }
  }

  return summary
}

/** Deterministic UUID derived from a namespace + key so a retried seal is idempotent. */
function derivedUuid(seed: string): string {
  const bytes = createHash('sha256').update(seed).digest().subarray(0, 16)
  bytes[6] = (bytes[6] & 0x0f) | 0x50
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = bytes.toString('hex')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`
}

function formatAnswerText(label: string | undefined, value: unknown): string {
  const text = typeof value === 'string' ? value : JSON.stringify(value)
  return label ? `${label}: ${text}` : text
}

/**
 * Seal review form answers (`form_answers.value`) and decision notes
 * (`review_decisions.note`, `pnc_note`) into the vault when a review cycle closes.
 *
 * Clears the staged values from core only after the vault confirms receipt, and
 * keeps the submission / decision metadata in core.
 */
export async function sealReviewCycleRecords(
  cycleId: string,
  options: {
    corePersonId: string
    kind: 'confirmation' | 'appraisal'
    cycle?: string | null
    event?: string
    db?: ReturnType<typeof onboardingDb>
    sealFeedback?: typeof sealFeedbackInVault
  }
): Promise<{ sealed: number; failed: number; errors: string[] }> {
  const db = options.db ?? onboardingDb()
  const sealFn = options.sealFeedback ?? sealFeedbackInVault
  const summary = { sealed: 0, failed: 0, errors: [] as string[] }
  const event = options.event ?? 'cycle_closed'

  // 1. Seal form answers linked to this cycle's participants.
  const { data: participants } = await db
    .from('review_participants')
    .select('role, employee_id, form_request_id')
    .eq('cycle_id', cycleId)
    .not('form_request_id', 'is', null)

  const participantRows = (participants ?? []) as {
    role: string
    employee_id: string | null
    form_request_id: string | null
  }[]
  const requestIds = participantRows
    .map((p) => p.form_request_id)
    .filter((id): id is string => Boolean(id))

  if (requestIds.length > 0) {
    const byRequest = new Map(participantRows.map((p) => [p.form_request_id, p]))
    const { data: subs } = await db
      .from('form_submissions')
      .select('id, request_id, form_version_id')
      .in('request_id', requestIds)

    const submissions = (subs ?? []) as { id: string; request_id: string; form_version_id: string }[]
    if (submissions.length > 0) {
      const subMap = new Map(submissions.map((s) => [s.id, s]))
      const versionIds = Array.from(new Set(submissions.map((s) => s.form_version_id)))
      const [{ data: fields }, { data: answers }] = await Promise.all([
        db.from('form_fields').select('id, label').in('form_version_id', versionIds),
        db
          .from('form_answers')
          .select('id, submission_id, field_id, value, seal_state, staged_at')
          .in('submission_id', submissions.map((s) => s.id))
          .neq('seal_state', 'sealed'),
      ])
      const fieldLabel = new Map(((fields ?? []) as { id: string; label: string }[]).map((f) => [f.id, f.label]))

      for (const ans of (answers ?? []) as {
        id: string
        submission_id: string
        field_id: string
        value: unknown
        seal_state: 'staged' | 'sealing' | 'sealed' | 'seal_failed'
        staged_at: string
      }[]) {
        if (ans.value === null || ans.value === undefined) continue
        const decision = canSeal({ kind: 'form_answer', state: ans.seal_state, stagedAt: ans.staged_at }, true)
        if (!decision.ok && decision.reason !== 'not_yet_triggered') {
          if (decision.reason === 'already_sealed') continue
          summary.failed += 1
          summary.errors.push(`form_answer:${ans.id}: ${decision.reason}`)
          continue
        }

        const sub = subMap.get(ans.submission_id)
        const participant = sub ? byRequest.get(sub.request_id) : undefined
        const role = participant?.role ?? 'reviewer'
        const vaultKind: 'peer' | 'manager' | 'appraisal' =
          options.kind === 'appraisal' ? 'appraisal' : role === 'manager' ? 'manager' : 'peer'

        await db.from('form_answers').update({ seal_state: 'sealing', seal_error: null }).eq('id', ans.id)
        try {
          const result = await sealFn({
            corePersonId: options.corePersonId,
            coreFeedbackId: ans.id,
            authorCoreId: participant?.employee_id ?? null,
            authorLabel: `${role} form answer`,
            kind: vaultKind,
            cycle: options.cycle ?? null,
            text: formatAnswerText(fieldLabel.get(ans.field_id), ans.value),
            sealedOnEvent: event,
          })

          const { error } = await db
            .from('form_answers')
            .update({
              seal_state: 'sealed',
              sealed_at: new Date().toISOString(),
              seal_error: null,
              value: null,
              vault_feedback_id: result.vaultFeedbackId,
            })
            .eq('id', ans.id)
          if (error) throw new Error(error.message)
          summary.sealed += 1
        } catch (e) {
          const message = e instanceof Error ? e.message : String(e)
          await db.from('form_answers').update({ seal_state: 'seal_failed', seal_error: message }).eq('id', ans.id)
          summary.failed += 1
          summary.errors.push(`form_answer:${ans.id}: ${message}`)
        }
      }
    }
  }

  // 2. Seal review decision notes (`review_decisions.note` and `pnc_note`).
  const { data: decisionRow } = await db
    .from('review_decisions')
    .select('cycle_id, decided_by, note, pnc_note, seal_state, staged_at, vault_note_id, vault_pnc_note_id')
    .eq('cycle_id', cycleId)
    .maybeSingle()

  if (decisionRow && decisionRow.seal_state !== 'sealed' && (decisionRow.note || decisionRow.pnc_note)) {
    const decision = canSeal(
      { kind: 'decision_note', state: decisionRow.seal_state, stagedAt: decisionRow.staged_at },
      true,
    )
    if (!decision.ok && decision.reason !== 'not_yet_triggered') {
      if (decision.reason !== 'already_sealed') {
        summary.failed += 1
        summary.errors.push(`decision_note:${cycleId}: ${decision.reason}`)
      }
    } else {
      await db.from('review_decisions').update({ seal_state: 'sealing', seal_error: null }).eq('cycle_id', cycleId)
      try {
        const vaultKind: 'manager' | 'appraisal' = options.kind === 'appraisal' ? 'appraisal' : 'manager'
        let vaultNoteId: string | null = decisionRow.vault_note_id ?? null
        let vaultPncNoteId: string | null = decisionRow.vault_pnc_note_id ?? null

        if (decisionRow.note && !vaultNoteId) {
          const res = await sealFn({
            corePersonId: options.corePersonId,
            coreFeedbackId: cycleId,
            authorCoreId: decisionRow.decided_by ?? null,
            authorLabel: 'Manager decision note',
            kind: vaultKind,
            cycle: options.cycle ?? null,
            text: decisionRow.note,
            sealedOnEvent: event,
          })
          vaultNoteId = res.vaultFeedbackId
        }

        if (decisionRow.pnc_note && !vaultPncNoteId) {
          const res = await sealFn({
            corePersonId: options.corePersonId,
            coreFeedbackId: derivedUuid(`review_decisions.pnc_note:${cycleId}`),
            authorCoreId: null,
            authorLabel: 'PnC decision note',
            kind: vaultKind,
            cycle: options.cycle ?? null,
            text: decisionRow.pnc_note,
            sealedOnEvent: event,
          })
          vaultPncNoteId = res.vaultFeedbackId
        }

        const { error } = await db
          .from('review_decisions')
          .update({
            seal_state: 'sealed',
            sealed_at: new Date().toISOString(),
            seal_error: null,
            note: null,
            pnc_note: null,
            vault_note_id: vaultNoteId,
            vault_pnc_note_id: vaultPncNoteId,
          })
          .eq('cycle_id', cycleId)
        if (error) throw new Error(error.message)
        summary.sealed += 1
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e)
        await db.from('review_decisions').update({ seal_state: 'seal_failed', seal_error: message }).eq('cycle_id', cycleId)
        summary.failed += 1
        summary.errors.push(`decision_note:${cycleId}: ${message}`)
      }
    }
  }

  return summary
}

/** Everything still sitting in core, longest-exposed first. */
export async function listExposedRecords() {
  const { data, error } = await onboardingDb()
    .from('exposed_records')
    .select('*')
    .order('days_staged', { ascending: false })
  assertOk(error, 'Failed to list exposed records')
  return data ?? []
}

export { VaultUnavailable }

// ---------------------------------------------------------------------------
// Withdrawal
// ---------------------------------------------------------------------------

/**
 * Delete a withdrawn joiner's staged documents from core.
 *
 * The awkward case sealing creates: sealing is triggered by verification, and
 * nobody verifies the documents of someone who never joined, so they would sit
 * in core forever with no event coming.
 *
 * Two callers: a person purging a withdrawn joiner's documents by hand, and
 * the daily retention job in live mode, once the withdrawn-joiner rule's
 * period and the 1-year floor have both passed for each document
 * (`src/lib/dpdp/retention/`). The job passes `documentIds` so only the
 * documents that are due go.
 *
 * The rows survive â€” the fact that a document was submitted and then purged is
 * part of the record. Only the files go.
 */
export async function purgeStagedDocuments(
  onboardingId: string,
  options: { purgedBy: string; reason: string; documentIds?: string[] }
): Promise<{ purged: number; errors: string[] }> {
  const db = onboardingDb()
  const summary = { purged: 0, errors: [] as string[] }
  if (options.documentIds && options.documentIds.length === 0) return summary

  let query = db
    .from('onboarding_documents')
    .select('id, document_type, storage_reference, seal_state')
    .eq('onboarding_id', onboardingId)
    .neq('seal_state', 'sealed')
    .not('storage_reference', 'is', null)
    .is('purged_at', null)
  if (options.documentIds) query = query.in('id', options.documentIds)
  const { data: docs, error } = await query
  assertOk(error, 'Failed to list documents to purge')

  for (const doc of docs ?? []) {
    try {
      if (doc.storage_reference) {
        const { error: removeError } = await db.storage
          .from(CANDIDATE_BUCKET)
          .remove([doc.storage_reference])
        if (removeError) throw new Error(removeError.message)
      }

      const { error: updateError } = await db
        .from('onboarding_documents')
        .update({
          storage_reference: null,
          storage_bucket: null,
          purged_at: new Date().toISOString(),
          purged_by: options.purgedBy,
          purge_reason: options.reason,
        })
        .eq('id', doc.id)
      if (updateError) throw new Error(updateError.message)

      summary.purged += 1
    } catch (e) {
      summary.errors.push(`${doc.document_type}: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  return summary
}
