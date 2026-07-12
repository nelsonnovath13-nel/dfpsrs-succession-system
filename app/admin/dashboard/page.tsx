"use client";

import { useEffect, useState } from "react";
import DashboardShell from "@/components/DashboardShell";
import { StatCard } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import { useLanguage } from "@/lib/i18n";

export default function AdminDashboardPage() {
  const supabase = createClient();
  const { lang } = useLanguage();
  const sw = lang === "sw";
  const [stats, setStats] = useState({
    users: 0,
    properties: 0,
    records: 0,
    pending: 0,
    verified: 0,
    rejected: 0,
  });
  const [activity, setActivity] = useState<{ action: string; created_at: string }[]>([]);

  useEffect(() => {
    (async () => {
      const [
        { count: users },
        { count: properties },
        { data: records },
      ] = await Promise.all([
        supabase.from("dfp_profiles").select("id", { count: "exact", head: true }),
        supabase.from("dfp_properties").select("id", { count: "exact", head: true }),
        supabase.from("dfp_succession_records").select("status"),
      ]);

      const pending = (records ?? []).filter((r) =>
        ["submitted", "witness_review", "local_leader_review", "legal_review"].includes(r.status)
      ).length;
      const verified = (records ?? []).filter((r) => r.status === "verified").length;
      const rejected = (records ?? []).filter((r) => r.status === "rejected").length;

      setStats({
        users: users ?? 0,
        properties: properties ?? 0,
        records: records?.length ?? 0,
        pending,
        verified,
        rejected,
      });

      const { data: logs } = await supabase
        .from("dfp_audit_logs")
        .select("action, created_at")
        .order("created_at", { ascending: false })
        .limit(12);
      setActivity(logs ?? []);
    })();
  }, [supabase]);

  return (
    <DashboardShell role="admin">
      <h1 className="text-xl font-semibold text-primary mb-6">{sw ? "Muhtasari wa Mfumo" : "System Overview"}</h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        <StatCard label={sw ? "Jumla ya Watumiaji" : "Total Users"} value={stats.users} />
        <StatCard label={sw ? "Jumla ya Mali" : "Total Properties"} value={stats.properties} />
        <StatCard label={sw ? "Kumbukumbu za Urithi" : "Succession Records"} value={stats.records} />
        <StatCard label={sw ? "Uhakiki Unaosubiri" : "Pending Verifications"} value={stats.pending} />
        <StatCard label={sw ? "Zilizothibitishwa" : "Verified"} value={stats.verified} />
        <StatCard label={sw ? "Zilizokataliwa" : "Rejected"} value={stats.rejected} />
      </div>

      <div className="card">
        <h2 className="font-semibold text-primary mb-4 text-sm uppercase tracking-wide">{sw ? "Shughuli za Hivi Karibuni Mfumoni Kote" : "System-Wide Recent Activity"}</h2>
        {activity.length === 0 ? (
          <p className="text-sm text-neutralDark">{sw ? "Bado hakuna shughuli iliyorekodiwa." : "No activity recorded yet."}</p>
        ) : (
          <ul className="space-y-2">
            {activity.map((a, i) => (
              <li key={i} className="flex items-center justify-between text-sm border-b border-gray-200 last:border-0 py-2">
                <span className="text-neutralDark">{a.action}</span>
                <span className="text-neutralDark text-xs">{new Date(a.created_at).toLocaleString()}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </DashboardShell>
  );
}
