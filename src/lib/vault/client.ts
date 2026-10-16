// ============================================================================
// VAULT CLIENT (core side)
// ----------------------------------------------------------------------------
// Core never holds the vault's service-role key. It knows the vault's URL and a
// shared secret, and can call exactly the narrow functions the vault exposes.
// That is the whole of core's reach into the vault, and it is why those
// functions are written to accept so little.
// ============================================================================

export class VaultUnavailable extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'VaultUnavailable'
  }
}

function vaultUrl(): string {
  const url = process.env.VAULT_URL
  if (!url) throw new VaultUnavailable('VAULT_URL is not configured.')
  return url.replace(/\/$/, '')
}

function submissionSecret(): string {
  const secret = process.env.CORE_SUBMISSION_SECRET
  if (!secret) throw new VaultUnavailable('CORE_SUBMISSION_SECRET is not configured.')
  return secret
}

/** True when core is configured to talk to the vault at all. */
export function isVaultConfigured(): boolean {
  return Boolean(process.env.VAULT_URL && process.env.CORE_SUBMISSION_SECRET)
}

async function call<T>(fn: string, body: FormData | object): Promise<T> {
  const isForm = body instanceof FormData
  const res = await fetch(`${vaultUrl()}/functions/v1/${fn}`, {
    method: 'POST',
    headers: {
      'x-core-signature': submissionSecret(),
      ...(isForm ? {} : { 'content-type': 'application/json' }),
    },
    body: isForm ? body : JSON.stringify(body),
  })

  const json = await res.json().catch(() => null)
  if (!res.ok || !json?.ok) {
    throw new VaultUnavailable(json?.error ?? `${fn} failed with ${res.status}`)
  }
  return json as T
}

export interface SealDocumentResult {
  vaultDocumentId: string
  numberLast4: string | null
  alreadySealed?: boolean
}

/**
 * Hand a verified document to the vault.
 *
 * `documentNumber` passes straight through: it is never written to core, which
 * keeps only the last four characters this returns.
 */
export async function sealDocumentInVault(input: {
  corePersonId: string
  coreDocumentId: string
  documentType: string
  fileName: string
  verifiedBy: string
  documentNumber?: string | null
  file: Blob | null
}): Promise<SealDocumentResult> {
  const form = new FormData()
  form.append('core_person_id', input.corePersonId)
  form.append('core_document_id', input.coreDocumentId)
  form.append('document_type', input.documentType)
  form.append('file_name', input.fileName)
  form.append('verified_by', input.verifiedBy)
  if (input.documentNumber) form.append('document_number', input.documentNumber)
  if (input.file) form.append('file', input.file, input.fileName)

  return call<SealDocumentResult>('seal-document', form)
}

export interface SealFeedbackResult {
  vaultFeedbackId: string
  alreadySealed?: boolean
}

export async function sealFeedbackInVault(input: {
  corePersonId: string
  coreFeedbackId: string
  authorCoreId?: string | null
  authorLabel: string
  kind: 'peer' | 'manager' | 'appraisal'
  cycle?: string | null
  text: string
  sealedOnEvent?: string
}): Promise<SealFeedbackResult> {
  return call<SealFeedbackResult>('seal-feedback', input)
}
