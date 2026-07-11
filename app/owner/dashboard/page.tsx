"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import DashboardShell from "@/components/DashboardShell";
import { StatCard, StatusBadge, VerificationTimeline } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";

type SuccessionRecord = {
  id: string;
  title: string;
  status: string;
  created_at: string;
};

export default function OwnerDashboardPage() {
  const supabase = createClient();
  const [counts, setCounts] = useState({ properties: 0, plans: 0, pending: 0, value: 0 });
  const [activePlan, setActivePlan] = useState<SuccessionRecord | null>(null);
  const [activity, setActivity] = useState<{ action: string; created_at: string }[]>([]);

  useEffect(() => {
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data: properties } = await supabase
        .from("dfp_properties")
        .select("id, estimated_value")
        .eq("owner_id", user.id);

      const { data: plans } = await supabase
        .from("dfp_succession_records")
        .select("id, title, status, created_at")
        .eq("owner_id", user.id)
        .order("created_at", { ascending: false });

      const pending = (plans ?? []).filter((p) =>
        ["submitted", "witness_review", "local_leader_review", "legal_review"].includes(p.status)
      ).length;
      const totalValue = (properties ?? []).reduce(
        (sum, p) => sum + (Number(p.estimated_value) || 0),
        0
      );

      setCounts({
        properties: properties?.length ?? 0,
        plans: plans?.length ?? 0,
        pending,
        value: totalValue,
      });
      setActivePlan((plans && plans[0]) ?? null);

      const { data: logs } = await supabase
        .from("dfp_audit_logs")
        .select("action, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(8);
      setActivity(logs ?? []);
    })();
  }, [supabase]);

  return (
    <DashboardShell role="owner">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-primary">Overview</h1>
        <div className="flex gap-2">
          <Link href="/owner/properties/new" className="btn-outline text-sm">Register Property</Link>
          <Link href="/owner/succession-plans/new" className="btn-primary text-sm">
            New Succession Record
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Total Properties" value={counts.properties} />
        <StatCard label="Succession Records" value={counts.plans} />
        <StatCard label="Pending Verification" value={counts.pending} />
        <StatCard label="Estimated Total Value (TZS)" value={counts.value.toLocaleString()} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="card lg:col-span-2">
          <h2 className="font-semibold text-primary mb-4 text-sm uppercase tracking-wide">Most Recent Succession Record</h2>
          {activePlan ? (
            <div>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="font-medium text-neutralDark">{activePlan.title}</p>
                  <StatusBadge status={activePlan.status} />
                </div>
                <Link
                  href={`/owner/succession-plans/${activePlan.id}`}
                  className="text-sm text-primary font-medium underline"
                >
                  View details
                </Link>
              </div>
              <VerificationTimeline status={activePlan.status} />
            </div>
          ) : (
            <p className="text-sm text-neutralDark">
              You haven&apos;t created a succession record yet.{" "}
              <Link href="/owner/succession-plans/new" className="text-primary font-medium underline">
                Create one now
              </Link>
              .
            </p>
          )}
        </div>

        <div className="card">
          <h2 className="font-semibold text-primary mb-4 text-sm uppercase tracking-wide">Recent Activity</h2>
          {activity.length === 0 && <p className="text-sm text-neutralDark">No activity yet.</p>}
          <ul className="space-y-3">
            {activity.map((a, i) => (
              <li key={i} className="text-xs text-neutralDark border-l-2 border-primary pl-3">
                <p className="text-neutralDark">{a.action}</p>
                <p className="text-neutralDark">{new Date(a.created_at).toLocaleString()}</p>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </DashboardShell>
  );
}
