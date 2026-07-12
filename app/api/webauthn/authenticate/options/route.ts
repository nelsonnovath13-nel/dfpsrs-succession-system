import { NextRequest, NextResponse } from "next/server";
import { generateAuthenticationOptions } from "@simplewebauthn/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { rpFromRequest } from "@/lib/webauthn";

export async function POST(req: NextRequest) {
  const supabase = createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { rpID } = rpFromRequest(req);

  const { data: creds } = await supabase.from("dfp_webauthn_credentials").select("credential_id, transports").eq("user_id", user.id);
  if (!creds || creds.length === 0) {
    return NextResponse.json({ error: "No passkey registered on this account" }, { status: 400 });
  }

  const options = await generateAuthenticationOptions({
    rpID,
    userVerification: "required",
    allowCredentials: creds.map((c) => ({
      id: c.credential_id,
      transports: (c.transports as any) ?? undefined,
    })),
  });

  await supabase.from("dfp_webauthn_challenges").delete().eq("user_id", user.id).eq("purpose", "authenticate");
  await supabase.from("dfp_webauthn_challenges").insert({
    user_id: user.id,
    challenge: options.challenge,
    purpose: "authenticate",
  });

  return NextResponse.json(options);
}
