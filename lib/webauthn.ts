import { NextRequest } from "next/server";

// The relying party ID/origin must match the actual host the browser is on for a WebAuthn
// ceremony to succeed. Deriving them from the incoming request (instead of hardcoding the
// production domain) lets registration/authentication keep working under local dev and any
// future custom domain without a code change.
export function rpFromRequest(req: NextRequest) {
  const origin = req.headers.get("origin") || req.nextUrl.origin;
  const rpID = new URL(origin).hostname;
  const rpName = "DFPSRS Family Vault";
  return { rpID, rpName, origin };
}
