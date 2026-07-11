"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { FileText } from "lucide-react";
import DashboardShell from "@/components/DashboardShell";
import { EmptyState } from "@/components/EmptyState";
import { StatusBadge } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import { useLanguage } from "@/lib/i18n";

type Plan = { id: string; title: string; status: string; created_at: string };

export default function SuccessionPlansPage() {
  const supabase = createClient();
  const { lang } = useLanguage();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from("dfp_succession_records")
        .select("id, title, status, created_at")
        .eq("owner_id", user.id)
        .order("created_at", { ascending: false });
      setPlans(data ?? []);
      setLoading(false);
    })();
  }, [supabase]);

  return (
    <DashboardShell role="owner">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-primary">Succession Records</h1>
        <Link href="/owner/succession-plans/new" className="btn-primary text-sm">
          New Record
        </Link>
      </div>

      {loading ? (
        <p className="text-sm text-neutralDark">Loading…</p>
      ) : plans.length === 0 ? (
        <EmptyState
          icon={FileText}
          title={lang === "sw" ? "Bado hujatengeneza kumbukumbu ya urithi." : "You haven't created a succession record yet."}
          description={
            lang === "sw"
              ? "Kumbukumbu ya urithi inaunganisha mali zako na wanufaika wako, na kuiweka kwenye mchakato wa uhakiki na mashahidi wa familia na Serikali za Mitaa."
              : "A succession record links your properties to your beneficiaries and sends it through verification by family witnesses and local government."
          }
          action={{ label: lang === "sw" ? "Tengeneza Kumbukumbu ya Kwanza" : "Create your first record", href: "/owner/succession-plans/new" }}
          helpHref="/help"
          helpLabel={lang === "sw" ? "Nahitaji msaada zaidi" : "I need more help"}
        />
      ) : (
        <div className="space-y-3">
          {plans.map((p) => (
            <Link
              key={p.id}
              href={`/owner/succession-plans/${p.id}`}
              className="card flex items-center justify-between hover:bg-neutralLight transition"
            >
              <div>
                <p className="font-medium text-neutralDark">{p.title}</p>
                <p className="text-xs text-neutralDark">
                  Created {new Date(p.created_at).toLocaleDateString()}
                </p>
              </div>
              <StatusBadge status={p.status} />
            </Link>
          ))}
        </div>
      )}
    </DashboardShell>
  );
}
