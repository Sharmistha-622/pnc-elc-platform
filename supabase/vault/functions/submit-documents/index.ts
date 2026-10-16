// A pre-joiner submits an identity document.
//
// Insert-only, by construction: this function writes and never reads back.
// There is deliberately no companion function that returns a pre-joiner's own
// uploads — "the pre-joiner submits through a vault Edge Function and cannot
// read uploads back. PnC Ops sees a checklist of what has arrived, not the
// files."

import { vaultClient, logAccess, deny, ok } from '../_shared/vault.ts'

/**
 * The pre-joiner holds an invitation token from core, not a vault session.
 *
 * Open decision #3 (candidate access: magic link or full account) decides what
 * this becomes. Until then the contract is: core vouches for the token with a
 * shared secret, and passes the vault the person it resolved to. The vault
 * never trusts a core *role* — only this narrow, signed assertion.
 */
function callerIsCore(req: Request): boolean {
  const presented = req.headers.get('x-core-signature')
  const expected = Deno.env.get('CORE_SUBMISSION_SECRET')
  if (!presented || !expected) return false
  // Constant-time compare; a length mismatch is already a mismatch.
  if (presented.length !== expected.length) return false
  let diff = 0
  for (let i = 0; i < presented.length; i++) diff |= presented.charCodeAt(i) ^ expected.charCodeAt(i)
  return diff === 0
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return deny(405, 'Use POST.')
  if (!callerIsCore(req)) return deny(401, 'Unrecognised submission source.')

  const form = await req.formData()
  const corePersonId = String(form.get('core_person_id') ?? '')
  const documentType = String(form.get('document_type') ?? '')
  const file = form.get('file')

  if (!corePersonId || !documentType) return deny(400, 'core_person_id and document_type are required.')
  if (!(file instanceof File) || file.size === 0) return deny(400, 'A file is required.')
  if (file.size > 10 * 1024 * 1024) return deny(400, 'That file is larger than 10 MB.')

  const allowed = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
  if (!allowed.includes(file.type)) return deny(400, 'Only PDF, JPG, PNG or WebP are accepted.')

  const db = vaultClient()

  const { data: person } = await db
    .from('people')
    .select('id')
    .eq('core_id', corePersonId)
    .maybeSingle()
  if (!person) return deny(404, 'That person has not been synced into the vault.')

  const extension = file.name.includes('.') ? file.name.slice(file.name.lastIndexOf('.')) : ''
  const path = `${person.id}/${documentType}${extension}`

  const { error: uploadError } = await db.storage
    .from('identity-documents')
    .upload(path, new Uint8Array(await file.arrayBuffer()), {
      contentType: file.type,
      upsert: true, // a re-submission replaces the rejected one
    })
  if (uploadError) return deny(500, `Upload failed: ${uploadError.message}`)

  const { error } = await db.from('identity_documents').upsert(
    {
      person_id: person.id,
      document_type: documentType,
      file_name: file.name,
      storage_path: path,
      mime_type: file.type,
      byte_size: file.size,
      status: 'submitted',
      submitted_at: new Date().toISOString(),
      verified_by: null,
      verified_at: null,
      rejection_reason: null,
    },
    { onConflict: 'person_id,document_type' }
  )
  if (error) return deny(500, error.message)

  await logAccess(db, null, {
    action: 'submit_document',
    resource: 'identity_documents',
    subjectPersonId: person.id,
    context: { document_type: documentType },
  })

  // Returns the fact, never the file. Core records "arrived" and nothing more.
  return ok({ documentType, status: 'submitted' })
})
