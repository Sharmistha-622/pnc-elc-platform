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
 * through to the vault and deliberately never persisted in core — only the
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
 * This is **not** called automatically. Whether and when to purge is open
 * decision #6; this is the mechanism, invoked by a person who has decided.
 *
 * The rows survive — the fact that a document was submitted and then purged is
 * part of the record. Only the files go.
 */
export async function purgeStagedDocuments(
  onboardingId: string,
  options: { purgedBy: string; reason: string }
): Promise<{ purged: number; errors: string[] }> {
  const db = onboardingDb()
  const summary = { purged: 0, errors: [] as string[] }

  const { data: docs, error } = await db
    .from('onboarding_documents')
    .select('id, document_type, storage_reference, seal_state')
    .eq('onboarding_id', onboardingId)
    .neq('seal_state', 'sealed')
    .not('storage_reference', 'is', null)
    .is('purged_at', null)
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
