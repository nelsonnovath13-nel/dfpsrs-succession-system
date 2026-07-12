"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import DashboardShell from "@/components/DashboardShell";
import { EmptyState } from "@/components/EmptyState";
import { StatusBadge } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import { useLanguage } from "@/lib/i18n";

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
  const { lang } = useLanguage();
  const sw = lang === "sw";
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
        <h1 className="text-xl font-semibold text-primary">{sw ? "Usimamizi wa Migogoro" : "Dispute Management"}</h1>
        <Link href="/owner/disputes/new" className="btn-primary text-sm">{sw ? "Fungua Mgogoro" : "Open Dispute"}</Link>
      </div>

      {loading ? (
        <p className="text-sm text-neutralDark">{sw ? "Inapakia…" : "Loading…"}</p>
      ) : list.length === 0 ? (
        <EmptyState
          icon={AlertTriangle}
          title={sw ? "Hakuna mgogoro uliopo." : "No disputes on record."}
          description={
            sw
              ? "Mgogoro ni kutoelewana kuhusu kumbukumbu ya urithi — kwa mfano mpaka wa ardhi, umiliki, au mgao wa mali — kunakohitaji kutatuliwa."
              : "A dispute is a disagreement about a succession record — for example a boundary, ownership, or allocation issue — that needs to be resolved."
          }
          action={{ label: sw ? "Fungua Mgogoro" : "Open a Dispute", href: "/owner/disputes/new" }}
          helpHref="/help"
          helpLabel={sw ? "Nahitaji msaada zaidi" : "I need more help"}
        />
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
