"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import DashboardShell from "@/components/DashboardShell";
import { StatusBadge } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";

type Row = {
  id: string;
  decision: string;
  succession_record_id: string;
  dfp_succession_records: { title: string; status: string } | null;
};

export default function LegalDashboardPage() {
  const supabase = createClient();
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
        .eq("verifier_role", "legal")
        .order("id", { ascending: false });
      setRows((data as any) ?? []);
      setLoading(false);
    })();
  }, [supabase]);

  const pending = rows.filter((r) => r.decision === "pending");
  const history = rows.filter((r) => r.decision !== "pending");

  return (
    <DashboardShell role="legal">
      <h1 className="text-xl font-semibold text-primary mb-6">Legal Review Center</h1>

      <h2 className="text-sm font-semibold text-neutralDark uppercase mb-3">Awaiting Legal Review</h2>
      {loading ? (
        <p className="text-sm text-neutralDark">Loading…</p>
      ) : pending.length === 0 ? (
        <div className="card text-center py-8 text-neutralDark mb-8">No records pending legal review.</div>
      ) : (
        <div className="space-y-3 mb-8">
          {pending.map((r) => (
            <Link
              key={r.id}
              href={`/legal/requests/${r.id}`}
              className="card flex items-center justify-between hover:bg-neutralLight transition"
            >
              <p className="font-medium text-neutralDark">{r.dfp_succession_records?.title}</p>
              <span className="text-primary text-sm font-medium">Review</span>
            </Link>
          ))}
        </div>
      )}

      <h2 className="text-sm font-semibold text-neutralDark uppercase mb-3">History</h2>
      {history.length === 0 ? (
        <div className="card text-center py-8 text-neutralDark">No past decisions yet.</div>
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
