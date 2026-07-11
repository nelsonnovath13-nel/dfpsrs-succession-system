"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import DashboardShell from "@/components/DashboardShell";
import { StatusBadge } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";

type Dispute = {
  id: string;
  category: string;
  description: string;
  status: string;
  created_at: string;
  succession_record_id: string;
  dfp_succession_records: { title: string } | null;
};

export default function DisputesPage() {
  const supabase = createClient();
  const [list, setList] = useState<Dispute[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from("dfp_disputes")
        .select("id, category, description, status, created_at, succession_record_id, dfp_succession_records(title)")
        .order("created_at", { ascending: false });
      setList((data as any) ?? []);
      setLoading(false);
    })();
  }, [supabase]);

  return (
    <DashboardShell role="owner">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-primary">Dispute Management</h1>
        <Link href="/owner/disputes/new" className="btn-primary text-sm">Open Dispute</Link>
      </div>

      {loading ? (
        <p className="text-sm text-neutralDark">Loading…</p>
      ) : list.length === 0 ? (
        <div className="card text-center py-10 text-neutralDark">No disputes on record.</div>
      ) : (
        <div className="space-y-3">
          {list.map((d) => (
            <Link key={d.id} href={`/owner/disputes/${d.id}`} className="card flex items-center justify-between hover:bg-neutralLight transition">
              <div>
                <p className="font-medium text-neutralDark">{d.dfp_succession_records?.title}</p>
                <p className="text-xs text-neutralDark capitalize">{d.category} · {new Date(d.created_at).toLocaleDateString()}</p>
              </div>
              <StatusBadge status={d.status} />
            </Link>
          ))}
        </div>
      )}
    </DashboardShell>
  );
}
