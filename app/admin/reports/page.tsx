"use client";

import { useEffect, useState } from "react";
import DashboardShell from "@/components/DashboardShell";
import { createClient } from "@/lib/supabase/client";
import { useLanguage } from "@/lib/i18n";

export default function AdminReportsPage() {
  const supabase = createClient();
  const { lang } = useLanguage();
  const sw = lang === "sw";
  const [records, setRecords] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      const { data: recs } = await supabase
        .from("dfp_succession_records")
        .select("id, title, status, created_at, finalized_at, dfp_profiles(full_name)");
      setRecords((recs as any) ?? []);

      const { data: u } = await supabase.from("dfp_profiles").select("role");
      setUsers(u ?? []);
    })();
  }, [supabase]);

  const byStatus = records.reduce((acc: Record<string, number>, r) => {
    acc[r.status] = (acc[r.status] ?? 0) + 1;
    return acc;
  }, {});
  const byRole = users.reduce((acc: Record<string, number>, u) => {
    acc[u.role] = (acc[u.role] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <DashboardShell role="admin">
      <div className="flex items-center justify-between mb-6 no-print">
        <h1 className="text-xl font-semibold text-primary">{sw ? "Ripoti ya Utii" : "Compliance Report"}</h1>
        <button onClick={() => window.print()} className="btn-primary text-xs">{sw ? "Chapisha" : "Print"}</button>
      </div>

      <div className="card">
        <div className="text-center border-b border-gray-300 pb-4 mb-4">
          <p className="text-xs text-neutralDark uppercase tracking-widest">{sw ? "Jamhuri ya Muungano wa Tanzania" : "United Republic of Tanzania"}</p>
          <p className="font-semibold text-primary">{sw ? "Ripoti ya Utii na Ukaguzi wa Mfumo Mzima" : "System-Wide Compliance & Audit Report"}</p>
          <p className="text-xs text-neutralDark">{sw ? "Imetengenezwa" : "Generated"}: {new Date().toLocaleDateString()}</p>
        </div>

        <p className="text-sm font-semibold text-neutralDark mb-2">{sw ? "Mgawanyo wa Watumiaji kwa Jukumu" : "User Distribution by Role"}</p>
        <table className="w-full text-sm mb-6">
          <tbody>
            {Object.entries(byRole).map(([role, count]) => (
              <tr key={role} className="border-b border-gray-200 last:border-0">
                <td className="py-1.5 capitalize">{role}</td>
                <td className="py-1.5 text-right">{count}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <p className="text-sm font-semibold text-neutralDark mb-2">{sw ? "Mgawanyo wa Hadhi za Kumbukumbu za Urithi" : "Succession Record Status Distribution"}</p>
        <table className="w-full text-sm mb-6">
          <tbody>
            {Object.entries(byStatus).map(([status, count]) => (
              <tr key={status} className="border-b border-gray-200 last:border-0">
                <td className="py-1.5 capitalize">{status.replace("_", " ")}</td>
                <td className="py-1.5 text-right">{count}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <p className="text-sm font-semibold text-neutralDark mb-2">{sw ? "Kumbukumbu Zote za Urithi" : "All Succession Records"}</p>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left border-b border-gray-300">
              <th className="py-2 pr-4">{sw ? "Kichwa" : "Title"}</th>
              <th className="py-2 pr-4">{sw ? "Mmiliki" : "Owner"}</th>
              <th className="py-2 pr-4">{sw ? "Hadhi" : "Status"}</th>
              <th className="py-2 pr-4">{sw ? "Imeundwa" : "Created"}</th>
              <th className="py-2">{sw ? "Imekamilishwa" : "Finalized"}</th>
            </tr>
          </thead>
          <tbody>
            {records.map((r) => (
              <tr key={r.id} className="border-b border-gray-200 last:border-0">
                <td className="py-2 pr-4">{r.title}</td>
                <td className="py-2 pr-4">{r.dfp_profiles?.full_name}</td>
                <td className="py-2 pr-4 capitalize">{r.status.replace("_", " ")}</td>
                <td className="py-2 pr-4">{new Date(r.created_at).toLocaleDateString()}</td>
                <td className="py-2">{r.finalized_at ? new Date(r.finalized_at).toLocaleDateString() : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </DashboardShell>
  );
}
