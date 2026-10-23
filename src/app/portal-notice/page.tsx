import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { MailCheck } from 'lucide-react'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getCurrentUserRole } from '@/lib/rbac/getCurrentUserRole'
import { isPortalOnlyRole, roleLabel } from '@/lib/role-constants'

/**
 * The way out for someone actually signed in as a candidate. A link to /login
 * is not one: /login sends a signed-in visitor to `/`, and middleware sends
 * them back here.
 */
async function signOut() {
  'use server'
  const supabase = await createServerSupabaseClient()
  await supabase.auth.signOut()
  redirect('/login')
}

/**
 * The way out for a Super Admin viewing the app as a candidate. The role
 * switcher lives in the dashboard header, which this role never sees, so
 * without this the override cookie holds them here until it expires.
 */
async function stopEmulating() {
  'use server'
  ;(await cookies()).delete('dev-role-override')
  redirect('/')
}

const buttonClass =
  'inline-flex h-9 items-center justify-center rounded-lg border border-border px-4 text-sm font-medium text-foreground hover:bg-muted'

/**
 * Where a candidate or pre-joiner lands if they reach the app outside their
 * invitation link.
 *
 * They can hold a real session — the token portal signs them in — but they
 * have no dashboard, so the ordinary denial path (`redirect('/')`) would
 * bounce them between `/` and itself. This page is the end of that road: it
 * sits outside the `(dashboard)` route group, so no feature gate applies, and
 * it tells them where their actual entry point is.
 *
 * Anyone who *does* have a dashboard is sent to it, so the page cannot be used
 * as a dead end by mistake.
 */
export default async function PortalNoticePage() {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { role, originalRole, isEmulating } = await getCurrentUserRole()
  if (!isPortalOnlyRole(role)) redirect('/')

  return (
    <main className="flex min-h-screen w-full items-center justify-center bg-background p-6">
      <div className="w-full max-w-md space-y-5 rounded-xl border border-border bg-card p-8 text-center">
        <div className="mx-auto flex size-12 items-center justify-center rounded-lg bg-muted text-foreground">
          <MailCheck className="size-6" aria-hidden="true" />
        </div>
        <div className="space-y-2">
          <h1 className="text-lg font-semibold text-foreground">Use your invitation link</h1>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Your onboarding happens on the secure link we emailed you. There is no dashboard
            for your account yet — one is created when you join.
          </p>
        </div>
        <p className="text-sm text-muted-foreground">
          Lost the link? Write to{' '}
          <a className="font-medium text-foreground underline" href="mailto:pnc@navgurukul.org">
            pnc@navgurukul.org
          </a>{' '}
          and we will send it again.
        </p>
        {isEmulating ? (
          <form action={stopEmulating}>
            <button type="submit" className={buttonClass}>
              Return to {roleLabel(originalRole)}
            </button>
          </form>
        ) : (
          <form action={signOut}>
            <button type="submit" className={buttonClass}>
              Sign out
            </button>
          </form>
        )}
      </div>
    </main>
  )
}
