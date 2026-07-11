"use client";

import { useEffect, useState } from "react";
import DashboardShell from "@/components/DashboardShell";
import { StatCard, StatusBadge } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";

type Record_ = {
  id: string;
  title: string;
  status: string;
};

export default function ExecutorEstatePage() {
  const supabase = createClient();
  const [records, setRecords] = useState<Record_[]>([]);
  const [propertyCount, setPropertyCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data: appointments } = await supabase
        .from("dfp_executors")
        .select("owner_id")
        .eq("linked_user_id", user.id)
        .eq("status", "active");
      const ownerIds = (appointments ?? []).map((a) => a.owner_id);

      if (ownerIds.length > 0) {
        const { data: recs } = await supabase
          .from("dfp_succession_records")
          .select("id, title, status")
          .in("owner_id", ownerIds);
        setRecords(recs ?? []);

        const { count } = await supabase
          .from("dfp_properties")
          .select("id", { count: "exact", head: true })
          .in("owner_id", ownerIds);
        setPropertyCount(count ?? 0);
      }

      setLoading(false);
    })();
  }, [supabase]);

  return (
    <DashboardShell role="executor">
      <h1 className="text-xl font-semibold text-primary mb-2">Estate Overview</h1>
      <p className="text-sm text-neutralDark mb-6">
        Succession records become visible here once the linked owner&apos;s death verification
        workflow reaches &quot;Released&quot;.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        <StatCard label="Total Properties" value={propertyCount} />
        <StatCard label="Visible Succession Records" value={records.length} />
      </div>

      {loading ? (
        <p className="text-sm text-neutralDark">Loading…</p>
      ) : records.length === 0 ? (
        <div className="card text-center py-10 text-neutralDark">
          No succession records are visible yet. This unlocks automatically once death has been
          confirmed and released for an estate you are appointed to.
        </div>
      ) : (
        <div className="space-y-3">
          {records.map((r) => (
            <div key={r.id} className="card flex items-center justify-between">
              <p className="font-medium text-neutralDark">{r.title}</p>
              <StatusBadge status={r.status} />
            </div>
          ))}
        </div>
      )}
    </DashboardShell>
  );
}
