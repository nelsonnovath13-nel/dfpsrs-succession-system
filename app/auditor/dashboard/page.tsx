"use client";

import { useEffect, useState } from "react";
import DashboardShell from "@/components/DashboardShell";
import { StatCard } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import { useLanguage } from "@/lib/i18n";

type Log = {
  id: string;
  action: string;
  reference_table: string | null;
  created_at: string;
  dfp_profiles: { full_name: string } | null;
};

export default function AuditorDashboardPage() {
  const supabase = createClient();
  const { lang } = useLanguage();
  const sw = lang === "sw";
  const [stats, setStats] = useState({ records: 0, verified: 0, rejected: 0, pending: 0 });
  const [logs, setLogs] = useState<Log[]>([]);
  const [tableFilter, setTableFilter] = useState("all");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: records } = await supabase.from("dfp_succession_records").select("status");
      const verified = (records ?? []).filter((r) => r.status === "verified").length;
      const rejected = (records ?? []).filter((r) => r.status === "rejected").length;
      const pending = (records ?? []).filter((r) =>
        ["submitted", "witness_review", "local_leader_review", "legal_review"].includes(r.status)
      ).length;
      setStats({ records: records?.length ?? 0, verified, rejected, pending });

      const { data: logData } = await supabase
        .from("dfp_audit_logs")
        .select("id, action, reference_table, created_at, dfp_profiles(full_name)")
        .order("created_at", { ascending: false })
        .limit(200);
      setLogs((logData as any) ?? []);
      setLoading(false);
    })();
  }, [supabase]);

  const tables = Array.from(new Set(logs.map((l) => l.reference_table).filter(Boolean))) as string[];
  const filtered = tableFilter === "all" ? logs : logs.filter((l) => l.reference_table === tableFilter);

  return (
    <DashboardShell role="auditor">
      <h1 className="text-xl font-semibold text-primary mb-2">{sw ? "Ukaguzi na Utii" : "Audit & Compliance"}</h1>
      <p className="text-sm text-neutralDark mb-6">
        {sw ? "Muonekano wa kusoma tu. Akaunti za ukaguzi haziwezi kubadilisha kumbukumbu." : "Read-only view. Auditor accounts cannot modify records."}
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard label={sw ? "Jumla ya Kumbukumbu za Urithi" : "Total Succession Records"} value={stats.records} />
        <StatCard label={sw ? "Zilizothibitishwa" : "Verified"} value={stats.verified} />
        <StatCard label={sw ? "Zilizokataliwa" : "Rejected"} value={stats.rejected} />
        <StatCard label={sw ? "Zinazoendelea" : "In Progress"} value={stats.pending} />
      </div>

      <div className="mb-4">
        <select className="input-field max-w-xs" value={tableFilter} onChange={(e) => setTableFilter(e.target.value)}>
          <option value="all">{sw ? "Aina Zote za Kumbukumbu" : "All record types"}</option>
          {tables.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
      </div>

      <div className="card overflow-x-auto">
        {loading ? (
          <p className="text-sm text-neutralDark">{sw ? "Inapakia…" : "Loading…"}</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-neutralDark border-b border-gray-300">
                <th className="py-2 pr-4">{sw ? "Mtumiaji" : "User"}</th>
                <th className="py-2 pr-4">{sw ? "Kitendo" : "Action"}</th>
                <th className="py-2 pr-4">{sw ? "Aina ya Kumbukumbu" : "Record Type"}</th>
                <th className="py-2">{sw ? "Muda" : "Timestamp"}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((l) => (
                <tr key={l.id} className="border-b border-gray-200 last:border-0">
                  <td className="py-2 pr-4 text-neutralDark">{l.dfp_profiles?.full_name ?? (sw ? "Mfumo" : "System")}</td>
                  <td className="py-2 pr-4 text-neutralDark">{l.action}</td>
                  <td className="py-2 pr-4 text-neutralDark">{l.reference_table}</td>
                  <td className="py-2 text-neutralDark text-xs">{new Date(l.created_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </DashboardShell>
  );
}
