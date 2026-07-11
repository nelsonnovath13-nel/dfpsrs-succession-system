"use client";

import { useEffect, useState } from "react";
import DashboardShell from "@/components/DashboardShell";
import { createClient } from "@/lib/supabase/client";

type Log = {
  id: string;
  action: string;
  reference_table: string | null;
  created_at: string;
  dfp_profiles: { full_name: string } | null;
};

export default function AuditLogsPage() {
  const supabase = createClient();
  const [logs, setLogs] = useState<Log[]>([]);
  const [tableFilter, setTableFilter] = useState("all");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("dfp_audit_logs")
        .select("id, action, reference_table, created_at, dfp_profiles(full_name)")
        .order("created_at", { ascending: false })
        .limit(200);
      setLogs((data as any) ?? []);
      setLoading(false);
    })();
  }, [supabase]);

  const tables = Array.from(new Set(logs.map((l) => l.reference_table).filter(Boolean))) as string[];
  const filtered = tableFilter === "all" ? logs : logs.filter((l) => l.reference_table === tableFilter);

  return (
    <DashboardShell role="admin">
      <h1 className="text-xl font-semibold text-primary mb-6">Audit &amp; Compliance</h1>

      <div className="mb-4">
        <select className="input-field max-w-xs" value={tableFilter} onChange={(e) => setTableFilter(e.target.value)}>
          <option value="all">All tables</option>
          {tables.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
      </div>

      <div className="card overflow-x-auto">
        {loading ? (
          <p className="text-sm text-neutralDark">Loading…</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-neutralDark border-b border-gray-300">
                <th className="py-2 pr-4">User</th>
                <th className="py-2 pr-4">Action</th>
                <th className="py-2 pr-4">Table</th>
                <th className="py-2">When</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((l) => (
                <tr key={l.id} className="border-b border-gray-200 last:border-0">
                  <td className="py-2 pr-4 text-neutralDark">{l.dfp_profiles?.full_name ?? "System"}</td>
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
