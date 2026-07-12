import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const origin = req.nextUrl.origin;

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=oauth_failed`);
  }

  const supabase = createServerSupabaseClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(`${origin}/login?error=oauth_failed`);
  }

  // dfp_handle_new_user defaults a brand-new Google/phone sign-in to role='owner' with
  // role_confirmed=false (there was no form step to ask), so route them to pick their real
  // role before landing anywhere else. Middleware also enforces this on every subsequent
  // request, so this redirect is a same-request shortcut, not the only guard.
  const { data: status } = await supabase.rpc("dfp_get_my_role_status");
  if (status && !status.role_confirmed) {
    return NextResponse.redirect(`${origin}/auth/complete-profile`);
  }

  return NextResponse.redirect(`${origin}/`);
}
