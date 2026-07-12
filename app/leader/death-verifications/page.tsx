"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import DashboardShell from "@/components/DashboardShell";
import { StatusBadge } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import { useLanguage } from "@/lib/i18n";

type Row = {
  id: string;
  decision: string;
  death_verification_id: string;
  dfp_death_verifications: { status: string; owner_id: string } | null;
};

export default function LeaderDeathVerificationsPage() {
  const supabase = createClient();
  const { lang } = useLanguage();
  const sw = lang === "sw";
  const [rows, setRows] = useState<Row[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from("dfp_death_verification_steps")
        .select("id, decision, death_verification_id, dfp_death_verifications(status, owner_id)")
        .eq("verifier_id", user.id)
        .eq("step", "local_government_confirmation")
        .order("id", { ascending: false });
      setRows((data as any) ?? []);

      const ownerIds = ((data as any) ?? []).map((r: any) => r.dfp_death_verifications?.owner_id).filter(Boolean);
      if (ownerIds.length > 0) {
        const { data: profiles } = await supabase.from("dfp_profiles").select("id, full_name").in("id", ownerIds);
        const map: Record<string, string> = {};
        (profiles ?? []).forEach((p) => (map[p.id] = p.full_name));
        setNames(map);
      }
      setLoading(false);
    })();
  }, [supabase]);

  const pending = rows.filter((r) => r.decision === "pending");
  const history = rows.filter((r) => r.decision !== "pending");

  return (
    <DashboardShell role="leader">
      <h1 className="text-xl font-semibold text-primary mb-6">{sw ? "Uhakiki wa Kifo" : "Death Verification"}</h1>

      <h2 className="text-sm font-semibold text-neutralDark uppercase mb-3">{sw ? "Inasubiri Uthibitisho Wako" : "Awaiting Your Confirmation"}</h2>
      {loading ? (
        <p className="text-sm text-neutralDark">{sw ? "Inapakia…" : "Loading…"}</p>
      ) : pending.length === 0 ? (
        <div className="card text-center py-8 text-neutralDark mb-8">{sw ? "Hakuna ripoti za kifo zinazosubiri." : "No pending death reports."}</div>
      ) : (
        <div className="space-y-3 mb-8">
          {pending.map((r) => (
            <Link key={r.id} href={`/leader/death-verifications/${r.id}`} className="card flex items-center justify-between hover:bg-neutralLight transition">
              <p className="font-medium text-neutralDark">{names[r.dfp_death_verifications?.owner_id ?? ""] ?? "—"}</p>
              <span className="text-primary text-sm font-medium">{sw ? "Hakiki" : "Review"}</span>
            </Link>
          ))}
        </div>
      )}

      <h2 className="text-sm font-semibold text-neutralDark uppercase mb-3">{sw ? "Historia" : "History"}</h2>
      {history.length === 0 ? (
        <div className="card text-center py-8 text-neutralDark">{sw ? "Bado hakuna maamuzi ya nyuma." : "No past decisions yet."}</div>
      ) : (
        <div className="space-y-3">
          {history.map((r) => (
            <div key={r.id} className="card flex items-center justify-between">
              <p className="text-neutralDark">{names[r.dfp_death_verifications?.owner_id ?? ""] ?? "—"}</p>
              <StatusBadge status={r.decision} />
            </div>
          ))}
        </div>
      )}
    </DashboardShell>
  );
}
