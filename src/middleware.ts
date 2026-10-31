import { NextResponse, type NextRequest } from 'next/server'
import { createMiddlewareSupabaseClient } from '@/lib/supabase/middleware'
import { resolveRole } from '@/lib/rbac/resolveRole'
import { canAccessRoute, isPortalOnlyRole } from '@/lib/role-constants'
import { isBreakGlassEmail, isBreakGlassRoute } from '@/lib/rbac/breakGlass'

/**
 * Routes reachable without a signed-in session.
 *
 * Cron routes carry their own `CRON_SECRET` bearer check.
 */
const PUBLIC_PREFIXES = [
  '/login',
  '/auth/callback',
  // Signs out an account outside the organisation's domains, and nobody else.
  '/auth/signout',
  '/api/onboarding/token/', // candidate portal API, token-authenticated
  '/api/cron/',
]

/**
 * Segments under `/onboarding/` that belong to the signed-in dashboard rather
 * than to the candidate portal.
 *
 * The public portal is `app/onboarding/[token]`, a single dynamic segment, and
 * the dashboard's own onboarding screens sit at the same depth under the
 * `(dashboard)` route group. Next resolves the static segments first, so this
 * list has to name them or `/onboarding/review/<token>` — the P&C audit screen —
 * would read as a candidate token and open to anyone.
 */
const DASHBOARD_ONBOARDING_SEGMENTS = ['candidate', 'employee', 'review']

function isPublic(pathname: string): boolean {
  if (pathname === '/login') return true
  if (PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix))) return true

  const portal = pathname.match(/^\/onboarding\/([^/]+)\/?$/)
  if (portal && !DASHBOARD_ONBOARDING_SEGMENTS.includes(portal[1])) return true

  return false
}

/**
 * Where to send a signed-in user who may not open the path they asked for.
 *
 * A candidate or pre-joiner has no dashboard at all, so the usual `/?denied=`
 * redirect would hand them a path they are also refused — and `/login` sends a
 * signed-in user straight back to `/`. Either way round that is a loop, so
 * they get the portal notice instead.
 */
function deniedRedirect(role: Parameters<typeof canAccessRoute>[0], pathname: string, url: string) {
  if (isPortalOnlyRole(role)) return NextResponse.redirect(new URL('/portal-notice', url))
  return NextResponse.redirect(new URL('/?denied=' + encodeURIComponent(pathname), url))
}

export async function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl

  const { supabase, response } = createMiddlewareSupabaseClient(request)

  // Always call getUser(): it revalidates the token with Supabase and refreshes
  // the cookie. Reading the session from the cookie alone would trust a value
  // the browser can forge.
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (isPublic(pathname)) return response

  if (user) {
    // Authenticated, but not necessarily entitled to this route. `canAccessRoute`
    // is the same map the sidebar hides links with, applied here so hiding a link
    // is not the only thing standing between a Viewer and /manage.
    const { role, email, isEmulating } = resolveRole(
      user,
      request.cookies.get('dev-role-override')?.value
    )

    // Signed in, but with no role at all: an account outside the
    // organisation's domains. Every route would refuse it and the refusals
    // would loop, so end the session instead.
    if (!role) {
      if (pathname.startsWith('/api/')) {
        return NextResponse.json(
          { success: false, error: 'This account is not allowed to use the platform.' },
          { status: 403 }
        )
      }
      return NextResponse.redirect(new URL('/auth/signout', request.url))
    }

    // The notice page is the one dashboard-adjacent screen a portal-only role
    // is meant to reach, and sending them there again from there would loop.
    if (pathname === '/portal-notice') return response

    // Break-glass accounts reach the users screen whatever role they hold
    // (src/lib/rbac/breakGlass.ts). Only that screen, and never while
    // emulating. The Super Admin switch is not read here: the screen's layout
    // and `updateUserAllocations` check it on every request.
    const breakGlassScreen = !isEmulating && isBreakGlassEmail(email) && isBreakGlassRoute(pathname)

    if (!canAccessRoute(role, pathname) && !breakGlassScreen) {
      if (pathname.startsWith('/api/')) {
        return NextResponse.json(
          { success: false, error: 'You do not have access to this resource.' },
          { status: 403 }
        )
      }
      return deniedRedirect(role, pathname, request.url)
    }
    return response
  }

  // An unauthenticated API call gets a 401 rather than an HTML redirect, so
  // fetch() callers see a real error instead of parsing a login page as JSON.
  if (pathname.startsWith('/api/')) {
    return NextResponse.json(
      { success: false, error: 'Authentication required.' },
      { status: 401 }
    )
  }

  const loginUrl = new URL('/login', request.url)
  loginUrl.searchParams.set('next', `${pathname}${search}`)
  return NextResponse.redirect(loginUrl)
}

export const config = {
  matcher: [
    /*
     * Everything except Next.js internals and static assets. Auth is the
     * default; `PUBLIC_PREFIXES` is the only way out.
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff|woff2|ttf)$).*)',
  ],
}
