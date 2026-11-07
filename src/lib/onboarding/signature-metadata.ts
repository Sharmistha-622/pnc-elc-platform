import { clientIp } from '@/lib/http/clientIp'
import type { SignatureMetadata } from './types'

/**
 * The record kept with a candidate's signature, taken from the request that
 * carried it: the client's network address as the edge saw it, the browser's
 * user agent, and the server's clock. Nothing the browser sends in the body is
 * used, so a signature's metadata cannot be supplied by the signer.
 *
 * It follows the retention rule of the letter it is attached to.
 */
export function buildSignatureMetadata(headers: Pick<Headers, 'get'>, now: Date): SignatureMetadata {
  const agent = headers.get('user-agent')?.slice(0, 512) ?? null
  return {
    ip_address: clientIp(headers),
    user_agent: agent,
    timestamp: now.toISOString(),
    method: 'canvas_digital_draw',
  }
}
