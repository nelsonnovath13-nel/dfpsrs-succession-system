import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  const supabase = createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { verifierId, decision, reason } = await req.json();
  if (!verifierId || !decision) return NextResponse.json({ error: "Missing fields" }, { status: 400 });

  // The client can't reliably read its own public IP, so this admin-only decision action is
  // routed through a server handler that captures it from request headers for the immutable
  // audit trail (Section 13 of the spec: who approved, when, IP, device).
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? req.headers.get("x-real-ip") ?? "unknown";
  const device = req.headers.get("user-agent") ?? "unknown";

  const { error } = await supabase.rpc("dfp_decide_verifier", {
    p_verifier_id: verifierId,
    p_decision: decision,
    p_reason: reason ?? null,
    p_ip: ip,
    p_device: device,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
