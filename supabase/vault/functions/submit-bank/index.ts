// A pre-joiner or employee submits their bank details, through core.
//
// Insert-only, like submit-documents: it writes a `pending` row and returns
// the fact and the last four digits, never the details. Nothing is live until
// a Super Admin or Fin Admin approves it in `approve-bank`, and the database
// (0005_bank_approval.sql) refuses to let the submitter be that person.
//
// Multipart form:
//   core_person_id   the person, as core knows them (must be synced)
//   submitted_by     the email of whoever submitted, as core verified it
//   account_name, account_number, ifsc, bank_name
//   proof            optional: a cancelled cheque or passbook page

import { vaultClient, logAccess, deny, ok } from '../_shared/vault.ts'
import { callerIsCore } from '../_shared/core.ts'
import { checkBankInput, maskAccount } from '../_shared/bank.ts'

const PROOF_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp']

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return deny(405, 'Use POST.')
  if (!callerIsCore(req)) return deny(401, 'Unrecognised submission source.')

  const form = await req.formData()
  const corePersonId = String(form.get('core_person_id') ?? '')
  const submittedBy = String(form.get('submitted_by') ?? '').trim().toLowerCase()
  if (!corePersonId || !submittedBy) return deny(400, 'core_person_id and submitted_by are required.')

  const checked = checkBankInput({
    accountName: form.get('account_name'),
    accountNumber: form.get('account_number'),
    ifsc: form.get('ifsc'),
    bankName: form.get('bank_name'),
  })
  if (!checked.ok) return deny(400, checked.error)

  const proof = form.get('proof')
  if (proof !== null && !(proof instanceof File)) return deny(400, 'proof must be a file.')
  if (proof instanceof File) {
    if (proof.size === 0 || proof.size > 10 * 1024 * 1024) return deny(400, 'The proof must be a file of at most 10 MB.')
    if (!PROOF_TYPES.includes(proof.type)) return deny(400, 'The proof must be a PDF, JPG, PNG or WebP.')
  }

  const db = vaultClient()
  const { data: person } = await db.from('people').select('id').eq('core_id', corePersonId).maybeSingle()
  if (!person) return deny(404, 'That person has not been synced into the vault.')

  let proofPath: string | null = null
  if (proof instanceof File) {
    const extension = proof.name.includes('.') ? proof.name.slice(proof.name.lastIndexOf('.')) : ''
    proofPath = `${person.id}/bank_proof-${Date.now()}${extension}`
    const { error: uploadError } = await db.storage
      .from('identity-documents')
      .upload(proofPath, new Uint8Array(await proof.arrayBuffer()), { contentType: proof.type })
    if (uploadError) return deny(500, `Upload failed: ${uploadError.message}`)
  }

  const { value } = checked
  const { data: id, error } = await db.rpc('submit_bank_details', {
    p_person_id: person.id,
    p_account_name: value.accountName,
    p_account_number: value.accountNumber,
    p_ifsc: value.ifsc,
    p_bank_name: value.bankName,
    p_submitted_by: submittedBy,
    p_proof_path: proofPath,
  })
  if (error) return deny(400, error.message)

  await logAccess(db, null, {
    action: 'submit_bank',
    resource: 'bank_details',
    subjectPersonId: person.id,
    context: { bank_details_id: id, with_proof: Boolean(proofPath) },
  })

  return ok({ status: 'pending', account: maskAccount(value.accountNumber), ifsc: value.ifsc })
})
