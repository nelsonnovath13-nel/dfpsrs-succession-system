"use client";

import { useEffect, useState } from "react";
import DashboardShell from "@/components/DashboardShell";
import { StatusBadge } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";

type Flag = {
  id: string;
  issue: string;
  recommendation: string | null;
  status: string;
  created_at: string;
  succession_record_id: string;
  dfp_succession_records: { title: string } | null;
};

export default function LegalFlagsPage() {
  const supabase = createClient();
  const [flags, setFlags] = useState<Flag[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase
      .from("dfp_legal_flags")
      .select("id, issue, recommendation, status, created_at, succession_record_id, dfp_succession_records(title)")
      .eq("legal_officer_id", user.id)
      .order("created_at", { ascending: false });
    setFlags((data as any) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function resolve(id: string) {
    await supabase.from("dfp_legal_flags").update({ status: "resolved", resolved_at: new Date().toISOString() }).eq("id", id);
    load();
  }

  return (
    <DashboardShell role="legal">
      <h1 className="text-xl font-semibold text-primary mb-6">Compliance Flags</h1>

      {loading ? (
        <p className="text-sm text-neutralDark">Loading…</p>
      ) : flags.length === 0 ? (
        <div className="card text-center py-10 text-neutralDark">
          No compliance issues flagged yet. Flag one from a record&apos;s review page.
        </div>
      ) : (
        <div className="space-y-3">
          {flags.map((f) => (
            <div key={f.id} className="card">
              <div className="flex items-center justify-between mb-2">
                <p className="font-medium text-neutralDark">{f.dfp_succession_records?.title}</p>
                <StatusBadge status={f.status} />
              </div>
              <p className="text-sm text-neutralDark mb-1">{f.issue}</p>
              {f.recommendation && (
                <p className="text-xs text-neutralDark italic mb-2">Recommendation: {f.recommendation}</p>
              )}
              {f.status === "open" && (
                <button onClick={() => resolve(f.id)} className="text-xs text-primary underline">
                  Mark Resolved
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </DashboardShell>
  );
}
