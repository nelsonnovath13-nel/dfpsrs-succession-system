import { NextRequest, NextResponse } from "next/server";
import { generateRegistrationOptions } from "@simplewebauthn/server";
import { isoUint8Array } from "@simplewebauthn/server/helpers";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { rpFromRequest } from "@/lib/webauthn";

export async function POST(req: NextRequest) {
  const supabase = createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { rpID, rpName } = rpFromRequest(req);

  const { data: profile } = await supabase.from("dfp_profiles").select("full_name").eq("id", user.id).maybeSingle();
  const { data: existing } = await supabase.from("dfp_webauthn_credentials").select("credential_id").eq("user_id", user.id);

  const options = await generateRegistrationOptions({
    rpName,
    rpID,
    userID: isoUint8Array.fromUTF8String(user.id),
    userName: user.email ?? profile?.full_name ?? "user",
    userDisplayName: profile?.full_name ?? user.email ?? "user",
    attestationType: "none",
    excludeCredentials: (existing ?? []).map((c) => ({ id: c.credential_id })),
    authenticatorSelection: {
      residentKey: "preferred",
      userVerification: "required",
      authenticatorAttachment: "platform",
    },
  });

  await supabase.from("dfp_webauthn_challenges").delete().eq("user_id", user.id).eq("purpose", "register");
  await supabase.from("dfp_webauthn_challenges").insert({
    user_id: user.id,
    challenge: options.challenge,
    purpose: "register",
  });

  return NextResponse.json(options);
}
