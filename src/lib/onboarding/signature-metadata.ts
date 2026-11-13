import { clientIp } from '@/lib/http/clientIp'
import type { SignatureMetadata, SignatureMethod } from './types'

export const ALLOWED_SIGNATURE_METHODS: readonly SignatureMethod[] = ['draw', 'upload'] as const

export const MAX_SIGNATURE_UPLOAD_BYTES = 1024 * 1024
export const MAX_SIGNATURE_DATA_URL_BYTES = 300 * 1024

export function resolveSignatureMethod(input: unknown): SignatureMethod {
  return input === 'upload' ? 'upload' : 'draw'
}

export function validateSignatureImageFile(file: {
  type?: string
  size: number
  name?: string
}): { ok: true } | { ok: false; error: string } {
  const mime = (file.type || '').toLowerCase()
  const extAllowed = /\.(png|jpe?g)$/i.test(file.name || '')
  if (mime !== 'image/png' && mime !== 'image/jpeg' && !(mime === '' && extAllowed)) {
    return { ok: false, error: 'Signature image must be a PNG or JPG file.' }
  }
  if (file.size <= 0) {
    return { ok: false, error: 'Signature image file is empty.' }
  }
  if (file.size > MAX_SIGNATURE_UPLOAD_BYTES) {
    return { ok: false, error: 'Signature image must be 1 MB or smaller.' }
  }
  return { ok: true }
}

/**
 * The record kept with a candidate's signature, taken from the request that
 * carried it: the client's network address as the edge saw it, the browser's
 * user agent, the server's clock, and the allow-listed capture method
 * (`draw` | `upload`). Nothing else the browser sends in the body is used, so
 * a signature's metadata cannot be supplied by the signer.
 *
 * It follows the retention rule of the letter it is attached to.
 */
export function buildSignatureMetadata(
  headers: Pick<Headers, 'get'>,
  now: Date,
  method?: unknown
): SignatureMetadata {
  const agent = headers.get('user-agent')?.slice(0, 512) ?? null
  return {
    ip_address: clientIp(headers),
    user_agent: agent,
    timestamp: now.toISOString(),
    method: resolveSignatureMethod(method),
  }
}
