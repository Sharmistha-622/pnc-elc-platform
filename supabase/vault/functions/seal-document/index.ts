// Receive a verified ID document from core.
//
// Core verifies the document, then hands it here and deletes its own copy.
// This function is the only thing that writes identity_documents from core, and
// it is idempotent on `core_document_id`: a retry after a half-finished move
// returns the same vault id rather than filing a second copy.
//
// It does not read anything back. Core gets an id and a last-four, which is all
// its residue needs.

import { vaultClient, logAccess, deny, ok } from '../_shared/vault.ts'

function callerIsCore(req: Request): boolean {
  const presented = req.headers.get('x-core-signature')
  const expected = Deno.env.get('CORE_SUBMISSION_SECRET')
  if (!presented || !expected || presented.length !== expected.length) return false
  let diff = 0
  for (let i = 0; i < presented.length; i++) diff |= presented.charCodeAt(i) ^ expected.charCodeAt(i)
  return diff === 0
}

/** Last four alphanumeric characters — what core is allowed to keep. */
function last4(value: string | null): string | null {
  if (!value) return null
  const cleaned = value.replace(/[^A-Za-z0-9]/g, '')
  return cleaned.length > 4 ? cleaned.slice(-4) : null
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return deny(405, 'Use POST.')
  if (!callerIsCore(req)) return deny(401, 'Unrecognised submission source.')

  const form = await req.formData()
  const corePersonId = String(form.get('core_person_id') ?? '')
  const coreDocumentId = String(form.get('core_document_id') ?? '')
  const documentType = String(form.get('document_type') ?? '')
  const verifiedBy = String(form.get('verified_by') ?? '')
  // The full number, typed by PnC Ops at verification. It is never written to
  // core — it passes through and comes to rest here.
  const documentNumber = (form.get('document_number') as string | null) || null
  const file = form.get('file')

  if (!corePersonId || !coreDocumentId || !documentType) {
    return deny(400, 'core_person_id, core_document_id and document_type are required.')
  }

  const db = vaultClient()

  // Idempotent: if this core document was already sealed, say so and stop.
  const { data: existing } = await db
    .from('identity_documents')
    .select('id, document_number')
    .eq('core_document_id', coreDocumentId)
    .maybeSingle()

  if (existing) {
    return ok({
      vaultDocumentId: existing.id,
      numberLast4: last4(existing.document_number),
      alreadySealed: true,
    })
  }

  const { data: person } = await db
    .from('people')
    .select('id')
    .eq('core_id', corePersonId)
    .maybeSingle()
  if (!person) return deny(404, 'That person has not been synced into the vault.')

  let storagePath: string | null = null
  if (file instanceof File && file.size > 0) {
    const extension = file.name.includes('.') ? file.name.slice(file.name.lastIndexOf('.')) : ''
    storagePath = `${person.id}/${documentType}${extension}`
    const { error: uploadError } = await db.storage
      .from('identity-documents')
      .upload(storagePath, new Uint8Array(await file.arrayBuffer()), {
        contentType: file.type || 'application/octet-stream',
        upsert: true,
      })
    // The upload has to land before the row exists, or core would delete its
    // copy on the strength of a row pointing at nothing.
    if (uploadError) return deny(500, `Vault upload failed: ${uploadError.message}`)
  }

  const now = new Date().toISOString()
  const { data: inserted, error } = await db
    .from('identity_documents')
    .insert({
      person_id: person.id,
      core_document_id: coreDocumentId,
      document_type: documentType,
      file_name: String(form.get('file_name') ?? documentType),
      storage_path: storagePath ?? '',
      mime_type: file instanceof File ? file.type : null,
      byte_size: file instanceof File ? file.size : null,
      status: 'verified',
      verified_by: verifiedBy,
      verified_at: now,
      document_number: documentNumber,
      number_captured_by: documentNumber ? verifiedBy : null,
      number_captured_at: documentNumber ? now : null,
      sealed_at: now,
    })
    .select('id')
    .single()

  if (error) return deny(500, error.message)

  await logAccess(db, null, {
    action: 'seal_document',
    resource: 'identity_documents',
    subjectPersonId: person.id,
    context: { document_type: documentType, has_number: Boolean(documentNumber) },
  })

  return ok({ vaultDocumentId: inserted.id, numberLast4: last4(documentNumber) })
})
