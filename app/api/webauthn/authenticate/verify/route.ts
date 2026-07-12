import { NextRequest, NextResponse } from "next/server";
import { verifyAuthenticationResponse } from "@simplewebauthn/server";
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
  const { response, vaultOwnerId } = body;

  const { data: challengeRow } = await supabase
    .from("dfp_webauthn_challenges")
    .select("challenge, expires_at")
    .eq("user_id", user.id)
    .eq("purpose", "authenticate")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!challengeRow || new Date(challengeRow.expires_at) < new Date()) {
    return NextResponse.json({ error: "Authentication session expired. Please try again." }, { status: 400 });
  }

  const { data: cred } = await supabase
    .from("dfp_webauthn_credentials")
    .select("id, credential_id, public_key, counter, transports")
    .eq("user_id", user.id)
    .eq("credential_id", response.id)
    .maybeSingle();

  if (!cred) {
    return NextResponse.json({ error: "This passkey is not registered to your account" }, { status: 400 });
  }

  let verification;
  try {
    verification = await verifyAuthenticationResponse({
      response,
      expectedChallenge: challengeRow.challenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      credential: {
        id: cred.credential_id,
        publicKey: isoBase64URL.toBuffer(cred.public_key),
        counter: Number(cred.counter),
        transports: (cred.transports as any) ?? undefined,
      },
    });
  } catch (e: any) {
    if (vaultOwnerId) await supabase.rpc("dfp_log_webauthn_vault_access", { p_owner_id: vaultOwnerId, p_success: false });
    return NextResponse.json({ error: e.message ?? "Verification failed" }, { status: 400 });
  }

  if (!verification.verified) {
    if (vaultOwnerId) await supabase.rpc("dfp_log_webauthn_vault_access", { p_owner_id: vaultOwnerId, p_success: false });
    return NextResponse.json({ error: "Passkey verification failed" }, { status: 400 });
  }

  await supabase
    .from("dfp_webauthn_credentials")
    .update({ counter: verification.authenticationInfo.newCounter, last_used_at: new Date().toISOString() })
    .eq("id", cred.id);

  await supabase.from("dfp_webauthn_challenges").delete().eq("user_id", user.id).eq("purpose", "authenticate");

  if (vaultOwnerId) await supabase.rpc("dfp_log_webauthn_vault_access", { p_owner_id: vaultOwnerId, p_success: true });

  return NextResponse.json({ verified: true });
}
