/**
 * Which Google accounts may hold a session at all.
 *
 * Sign-in is Google OAuth, and nothing else stopped a personal Gmail account
 * from completing it: it then resolved to `employee`, the fail-safe default,
 * and could read anything RLS left open to `authenticated`. Being signed in
 * now means being signed in with an organisation account.
 *
 * Candidates are unaffected — they use the token portal, which needs no
 * session. Override with `ALLOWED_EMAIL_DOMAINS` (comma-separated) if the
 * organisation ever uses a second domain; the database's `is_org_email()` in
 * `202610241000_lockdown_rls.sql` must list the same domains.
 */
export const DEFAULT_ALLOWED_DOMAINS = ['navgurukul.org']

export function allowedEmailDomains(env: string | undefined = process.env.ALLOWED_EMAIL_DOMAINS): string[] {
  const configured = (env ?? '')
    .split(',')
    .map((d) => d.trim().toLowerCase().replace(/^@/, ''))
    .filter(Boolean)
  return configured.length > 0 ? configured : DEFAULT_ALLOWED_DOMAINS
}

/** True when the address belongs to one of the allowed domains, exactly. */
export function isAllowedEmail(
  email: string | null | undefined,
  domains: string[] = allowedEmailDomains()
): boolean {
  if (!email) return false
  const at = email.lastIndexOf('@')
  if (at < 1) return false
  // Exact match on the part after the last @: `x@navgurukul.org.evil.com` and
  // `x@evilnavgurukul.org` are both refused.
  return domains.includes(email.slice(at + 1).toLowerCase())
}
