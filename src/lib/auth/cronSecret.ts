import { timingSafeEqual } from 'crypto'

/**
 * True when the request carries `Bearer <CRON_SECRET>`.
 *
 * Cron routes sit outside the session check in `middleware.ts`, so this is
 * their only gate — and they run with the service-role client.
 *
 * An unset CRON_SECRET must fail closed: comparing against
 * `Bearer ${undefined}` would otherwise accept the literal string
 * "Bearer undefined" from anyone. The comparison is constant-time, so the
 * response time says nothing about how much of a guess was right; unequal
 * lengths are refused first because `timingSafeEqual` requires equal ones.
 */
export function carriesCronSecret(
  authHeader: string | null,
  secret: string | undefined = process.env.CRON_SECRET
): boolean {
  if (!secret || !authHeader) return false
  const expected = Buffer.from(`Bearer ${secret}`)
  const given = Buffer.from(authHeader)
  return given.length === expected.length && timingSafeEqual(given, expected)
}
