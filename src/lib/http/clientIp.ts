/**
 * The caller's network address, as the platform's edge saw it.
 *
 * Vercel puts the client address first in `x-forwarded-for` and also sets
 * `x-real-ip`. The first hop is the client; later hops are proxies. Returns
 * null when neither header carries something shaped like an IPv4 or IPv6
 * address, rather than recording a guess.
 */
export function clientIp(headers: Pick<Headers, 'get'>): string | null {
  const forwarded = headers.get('x-forwarded-for')
  const first = forwarded?.split(',')[0]?.trim()
  if (first && isIpLike(first)) return first
  const real = headers.get('x-real-ip')?.trim()
  if (real && isIpLike(real)) return real
  return null
}

function isIpLike(value: string): boolean {
  if (value.length > 45) return false
  return /^(\d{1,3}\.){3}\d{1,3}$/.test(value) || /^[0-9a-fA-F:]+$/.test(value) && value.includes(':')
}
