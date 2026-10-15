import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";

  if (code) {
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      if (data?.session?.user?.email?.toLowerCase() === 'nitin@navgurukul.org') {
        try {
          const { createAdminSupabaseClient } = await import('@/lib/supabase/admin');
          const admin = createAdminSupabaseClient();
          if (admin && data.session.user.id) {
            await admin.auth.admin.updateUserById(data.session.user.id, {
              app_metadata: { ...data.session.user.app_metadata, role: 'Super Admin' },
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