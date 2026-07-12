import { NextRequest, NextResponse } from "next/server";
import { verifyRegistrationResponse } from "@simplewebauthn/server";
import { isoBase64URL } from "@simplewebauthn/server/helpers";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { rpFromRequest } from "@/lib/webauthn";

export async function POST(req: NextRequest) {
  const supabase = createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { rpID, origin } = rpFromRequest(req);
  const body = await req.json();
  const { response, nickname } = body;

  const { data: challengeRow } = await supabase
    .from("dfp_webauthn_challenges")
    .select("challenge, expires_at")
    .eq("user_id", user.id)
    .eq("purpose", "register")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!challengeRow || new Date(challengeRow.expires_at) < new Date()) {
    return NextResponse.json({ error: "Registration session expired. Please try again." }, { status: 400 });
  }

  let verification;
  try {
    verification = await verifyRegistrationResponse({
      response,
      expectedChallenge: challengeRow.challenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? "Verification failed" }, { status: 400 });
  }

  if (!verification.verified || !verification.registrationInfo) {
    return NextResponse.json({ error: "Could not verify this device" }, { status: 400 });
  }

  const { credential, credentialDeviceType, credentialBackedUp } = verification.registrationInfo;

  await supabase.from("dfp_webauthn_credentials").insert({
    user_id: user.id,
    credential_id: credential.id,
    public_key: isoBase64URL.fromBuffer(credential.publicKey),
    counter: credential.counter,
    device_type: credentialDeviceType,
    backed_up: credentialBackedUp,
    transports: credential.transports ?? [],
    nickname: nickname || null,
  });

  await supabase.from("dfp_webauthn_challenges").delete().eq("user_id", user.id).eq("purpose", "register");

  return NextResponse.json({ verified: true });
}
