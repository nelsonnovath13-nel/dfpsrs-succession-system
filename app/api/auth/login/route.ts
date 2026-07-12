import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  const supabase = createServerSupabaseClient();
  const { email, password } = await req.json();
  if (!email || !password) return NextResponse.json({ error: "missing_fields" }, { status: 400 });

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? req.headers.get("x-real-ip") ?? "unknown";

  const { data: lockout } = await supabase.rpc("dfp_check_login_lockout", { p_email: email });
  if (lockout?.locked) {
    return NextResponse.json({ error: "locked_out", retryAfterSeconds: lockout.retry_after_seconds }, { status: 429 });
  }

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  await supabase.rpc("dfp_record_login_attempt", { p_email: email, p_success: !error, p_ip: ip });

  if (error) {
    // Deliberately not distinguishing "no such account" from "wrong password" -- Supabase
    // itself returns the same generic error for both, which is a real anti-enumeration
    // protection (telling an attacker which emails are registered is its own vulnerability).
    // What IS safe and useful to distinguish is *why the request itself failed*, not who owns
    // the account.
    let code = "invalid_credentials";
    if (/email not confirmed/i.test(error.message)) code = "email_not_confirmed";
    else if (/rate limit/i.test(error.message)) code = "rate_limited";
    return NextResponse.json({ error: code, message: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true, userId: data.user?.id });
}
