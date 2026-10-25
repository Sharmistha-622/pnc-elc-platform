import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { isAllowedEmail } from '@/lib/auth/allowedEmail'

/**
 * Ends the session of an account that is not allowed in, then shows why.
 *
 * Middleware sends a signed-in account outside the organisation's domains
 * here. It cannot send them to `/login` — that page returns any signed-in
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

  if (user && !isAllowedEmail(user.email)) {
    await supabase.auth.signOut()
    return NextResponse.redirect(`${origin}/login?error=domain`)
  }
  return NextResponse.redirect(`${origin}/`)
}
