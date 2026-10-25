import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { IMMUTABLE_SUPER_ADMIN_EMAILS } from "@/lib/rbac/resolveRole";
import { isAllowedEmail } from "@/lib/auth/allowedEmail";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  // Only same-site paths are honoured, so a crafted `?next=` cannot bounce a
  // freshly authenticated session off to another host.
  const rawNext = searchParams.get("next");
  const next = rawNext && rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/";

  if (code) {
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    // A Google account outside the organisation completes OAuth like any
    // other. Refuse it here, before the session is ever used: otherwise it
    // would sign in as the fail-safe `employee`.
    if (!error && !isAllowedEmail(data?.session?.user?.email)) {
      await supabase.auth.signOut();
      return NextResponse.redirect(`${origin}/login?error=domain`);
    }
    if (!error) {
      // Keep the immutable owner's stored role correct on sign-in.
      //
      // This wrote the old display name 'Super Admin', which the RBAC v1
      // migration had just replaced with 'super_admin' — so every login undid
      // the migration for that account. The app read it through normalizeRole
      // and still worked, which is exactly why it would have gone unnoticed.
      const email = data?.session?.user?.email?.toLowerCase();
      if (email && IMMUTABLE_SUPER_ADMIN_EMAILS.includes(email)) {
        try {
          const { createAdminSupabaseClient } = await import('@/lib/supabase/admin');
          const admin = createAdminSupabaseClient();
          if (admin && data.session.user.id) {
            await admin.auth.admin.updateUserById(data.session.user.id, {
              app_metadata: { ...data.session.user.app_metadata, role: 'super_admin' },
            });
          }
        } catch {
          // Ignore admin update failure
        }
      }
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth-code-error`);
}