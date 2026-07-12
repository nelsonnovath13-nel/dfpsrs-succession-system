"use client";

import { useEffect, useState } from "react";
import { BadgeCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useLanguage } from "@/lib/i18n";
import { verifierTypeLabel } from "@/lib/verifierTypes";

type Badge = {
  full_name: string;
  verifier_type: string;
  region: string | null;
  district: string | null;
  ward: string | null;
  village_or_street: string | null;
  license_number: string | null;
  trust: { verification_count: number; approved_count: number; trust_score: number | null } | null;
};

// Shows nothing at all if the user has no APPROVED dfp_verifiers row -- this badge only ever
// reflects a real, admin-approved credential, never a self-declared claim.
export function VerifierBadge({ userId }: { userId: string }) {
  const supabase = createClient();
  const { lang } = useLanguage();
  const sw = lang === "sw";
  const [badge, setBadge] = useState<Badge | null | undefined>(undefined);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.rpc("dfp_get_verifier_badge", { p_user_id: userId });
      setBadge(data ?? null);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  if (!badge) return null;

  const jurisdiction = [badge.village_or_street, badge.ward, badge.district, badge.region].filter(Boolean).join(", ");

  return (
    <span className="inline-flex items-center gap-1.5 bg-white border border-secondary text-secondary text-xs px-2 py-1">
      <BadgeCheck size={13} aria-hidden="true" />
      {sw ? "Mthibitishaji Aliyeidhinishwa" : "Verified Official"} — {verifierTypeLabel(badge.verifier_type, lang)}
      {jurisdiction && <span className="text-inkSoft">· {jurisdiction}</span>}
      {badge.trust?.trust_score !== null && badge.trust?.trust_score !== undefined && (
        <span className="text-inkSoft">· {badge.trust.trust_score}% {sw ? "uaminifu" : "trust"}</span>
      )}
    </span>
  );
}
