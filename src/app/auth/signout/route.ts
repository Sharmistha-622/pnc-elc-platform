import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { isAllowedEmail } from '@/lib/auth/allowedEmail'
import { resolveRole } from '@/lib/rbac/resolveRole'

/**
 * Ends the session of an account that is not allowed in, then shows why.
 *
 * Middleware sends a signed-in account that holds no role here: one outside
 * the organisation's domains, or one whose access ended when their exit
 * closed. It cannot send them to `/login` — that page returns any signed-in
 * visitor to `/`, and middleware would send them straight back — and a server
 * component cannot clear the auth cookies, so this is a route handler.
 *
 * It only ever signs out an account that is refused anyway, so a link to it
 * cannot be used to sign an ordinary member of staff out.
 */
export async function GET(request: Request) {
  const { origin } = new URL(request.url)
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Refused accounts only: outside the domains, or access ended at exit.
  if (user && !resolveRole(user).role) {
    await supabase.auth.signOut()
    const reason = isAllowedEmail(user.email) ? 'ended' : 'domain'
    return NextResponse.redirect(`${origin}/login?error=${reason}`)
  }
  return NextResponse.redirect(`${origin}/`)
}
