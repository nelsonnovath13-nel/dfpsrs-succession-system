"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import DashboardShell from "@/components/DashboardShell";
import { StatCard, StatusBadge } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import { useLanguage } from "@/lib/i18n";

type Row = {
  id: string;
  decision: string;
  succession_record_id: string;
  dfp_succession_records: { title: string; status: string } | null;
};

export default function LeaderDashboardPage() {
  const supabase = createClient();
  const { lang } = useLanguage();
  const sw = lang === "sw";
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from("dfp_verifications")
        .select("id, decision, succession_record_id, dfp_succession_records(title, status)")
        .eq("verifier_id", user.id)
        .eq("verifier_role", "leader")
        .order("id", { ascending: false });
      setRows((data as any) ?? []);
      setLoading(false);
    })();
  }, [supabase]);

  const actionable = rows.filter(
    (r) => r.decision === "pending" && r.dfp_succession_records?.status === "local_leader_review"
  );
  const waitingOnWitnesses = rows.filter(
    (r) => r.decision === "pending" && r.dfp_succession_records?.status === "witness_review"
  );
  const history = rows.filter((r) => r.decision !== "pending");

  return (
    <DashboardShell role="leader">
      <h1 className="text-xl font-semibold text-primary mb-6">{sw ? "Kituo cha Uhakiki" : "Verification Center"}</h1>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <StatCard label={sw ? "Tayari kwa Uhakiki Wako" : "Ready for Your Review"} value={actionable.length} />
        <StatCard label={sw ? "Inasubiri Mashahidi" : "Waiting on Witnesses"} value={waitingOnWitnesses.length} />
        <StatCard label={sw ? "Zilizothibitishwa Kipindi Hiki" : "Verified This Session"} value={history.filter((r) => r.decision === "approved").length} />
      </div>

      <h2 className="text-sm font-semibold text-neutralDark uppercase mb-3">{sw ? "Tayari kwa Uhakiki Wako" : "Ready for Your Review"}</h2>
      {loading ? (
        <p className="text-sm text-neutralDark">{sw ? "Inapakia…" : "Loading…"}</p>
      ) : actionable.length === 0 ? (
        <div className="card text-center py-8 text-neutralDark mb-8">{sw ? "Hakuna kitu cha kuhakiki kwa sasa." : "Nothing to review right now."}</div>
      ) : (
        <div className="space-y-3 mb-8">
          {actionable.map((r) => (
            <Link
              key={r.id}
              href={`/leader/requests/${r.id}`}
              className="card flex items-center justify-between hover:bg-neutralLight transition"
            >
              <p className="font-medium text-neutralDark">{r.dfp_succession_records?.title}</p>
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
              <p className="text-neutralDark">{r.dfp_succession_records?.title}</p>
              <StatusBadge status={r.decision} />
            </div>
          ))}
        </div>
      )}
    </DashboardShell>
  );
}
