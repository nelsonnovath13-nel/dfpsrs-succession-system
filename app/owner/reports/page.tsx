"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { FileText, Award } from "lucide-react";
import DashboardShell from "@/components/DashboardShell";
import { StatusBadge } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import { useLanguage } from "@/lib/i18n";

type SuccessionRecord = { id: string; title: string; status: string };

export default function OwnerReportsPage() {
  const supabase = createClient();
  const { lang } = useLanguage();
  const sw = lang === "sw";
  const [properties, setProperties] = useState<any[]>([]);
  const [beneficiaries, setBeneficiaries] = useState<any[]>([]);
  const [allocations, setAllocations] = useState<any[]>([]);
  const [ownerName, setOwnerName] = useState("");
  const [records, setRecords] = useState<SuccessionRecord[]>([]);
  const [report, setReport] = useState<"estate" | "property" | "beneficiary">("estate");

  useEffect(() => {
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase.from("dfp_profiles").select("full_name").eq("id", user.id).maybeSingle();
      setOwnerName(profile?.full_name ?? "");

      const { data: props } = await supabase
        .from("dfp_properties")
        .select("id, property_number, name, category, ownership_type, estimated_value, location, status")
        .eq("owner_id", user.id);
      setProperties(props ?? []);

      const { data: bens } = await supabase
        .from("dfp_beneficiaries")
        .select("id, full_name, relationship, phone_number")
        .eq("owner_id", user.id);
      setBeneficiaries(bens ?? []);

      const { data: recs } = await supabase.from("dfp_succession_records").select("id, title, status").eq("owner_id", user.id).order("created_at", { ascending: false });
      setRecords(recs ?? []);

      const { data: allocs } = await supabase
        .from("dfp_property_allocations")
        .select("id, share_percentage, dfp_properties(name), dfp_beneficiaries(full_name)")
        .in("succession_record_id", (recs ?? []).map((r) => r.id));
      setAllocations((allocs as any) ?? []);
    })();
  }, [supabase]);

  const totalValue = properties.reduce((s, p) => s + (Number(p.estimated_value) || 0), 0);

  return (
    <DashboardShell role="owner">
      <div className="flex items-center justify-between mb-6 no-print">
        <h1 className="text-xl font-semibold text-primary">{sw ? "Taarifa na Vyeti" : "Reports & Certificates"}</h1>
      </div>

      {/* The full, official multi-section report (with signatures + QR certificate) lives on
          each succession record -- this is the actual destination people mean by "the report",
          not the simple summary table below, so it's surfaced first and prominently. */}
      <div className="card mb-6 no-print">
        <h2 className="font-semibold text-primary text-sm uppercase tracking-wide mb-3">{sw ? "Kumbukumbu za Urithi" : "Succession Records"}</h2>
        {records.length === 0 ? (
          <p className="text-sm text-inkSoft">{sw ? "Bado hujatengeneza kumbukumbu ya urithi." : "You haven't created a succession record yet."}</p>
        ) : (
          <div className="border border-gray-300 divide-y divide-gray-200">
            {records.map((r) => (
              <div key={r.id} className="flex items-center justify-between px-4 py-3 flex-wrap gap-2">
                <div className="flex items-center gap-3">
                  <p className="text-sm font-medium text-ink">{r.title}</p>
                  <StatusBadge status={r.status} />
                </div>
                <div className="flex items-center gap-2">
                  <Link
                    href={`/owner/succession-plans/${r.id}/report`}
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-primary border border-primary px-3"
                    style={{ minHeight: 32 }}
                  >
                    <FileText size={14} aria-hidden="true" /> {sw ? "Ripoti Kamili" : "Full Estate Report"}
                  </Link>
                  {r.status === "verified" && (
                    <Link
                      href={`/owner/succession-plans/${r.id}/certificate`}
                      className="inline-flex items-center gap-1.5 text-xs font-medium text-secondary border border-secondary px-3"
                      style={{ minHeight: 32 }}
                    >
                      <Award size={14} aria-hidden="true" /> {sw ? "Cheti" : "Certificate"}
                    </Link>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between mb-3 no-print flex-wrap gap-2">
        <h2 className="text-sm font-semibold text-inkSoft uppercase tracking-wide">{sw ? "Majedwali Mafupi ya Muhtasari" : "Quick Summary Tables"}</h2>
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => setReport("estate")} className={`btn-outline text-xs ${report === "estate" ? "bg-neutralLight" : ""}`}>{sw ? "Muhtasari wa Mali" : "Estate Summary"}</button>
          <button onClick={() => setReport("property")} className={`btn-outline text-xs ${report === "property" ? "bg-neutralLight" : ""}`}>{sw ? "Sajili ya Mali" : "Property Registry"}</button>
          <button onClick={() => setReport("beneficiary")} className={`btn-outline text-xs ${report === "beneficiary" ? "bg-neutralLight" : ""}`}>{sw ? "Taarifa ya Wanufaika" : "Beneficiary Report"}</button>
          <button onClick={() => window.print()} className="btn-primary text-xs">{sw ? "Chapisha" : "Print"}</button>
        </div>
      </div>

      <div className="card">
        <div className="text-center border-b border-gray-300 pb-4 mb-4">
          <p className="text-xs text-neutralDark uppercase tracking-widest">{sw ? "Jamhuri ya Muungano wa Tanzania" : "United Republic of Tanzania"}</p>
          <p className="font-semibold text-primary">
            {report === "estate" && (sw ? "Muhtasari wa Mali" : "Estate Summary Report")}
            {report === "property" && (sw ? "Taarifa ya Sajili ya Mali" : "Property Registry Report")}
            {report === "beneficiary" && (sw ? "Taarifa ya Wanufaika" : "Beneficiary Report")}
          </p>
          <p className="text-xs text-neutralDark">{sw ? "Imeandaliwa kwa" : "Prepared for"}: {ownerName} — {sw ? "Imetengenezwa" : "Generated"}: {new Date().toLocaleDateString()}</p>
        </div>

        {report === "estate" && (
          <div>
            <p className="text-sm mb-4">
              {sw ? "Jumla ya mali zilizosajiliwa" : "Total registered properties"}: <strong>{properties.length}</strong> — {sw ? "Thamani ya jumla inayokadiriwa" : "Total estimated value"}: <strong>TZS {totalValue.toLocaleString()}</strong> — {sw ? "Wanufaika waliosajiliwa" : "Registered beneficiaries"}: <strong>{beneficiaries.length}</strong>
            </p>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b border-gray-300">
                  <th className="py-2 pr-4">{sw ? "Mali" : "Property"}</th>
                  <th className="py-2 pr-4">{sw ? "Mnufaika" : "Beneficiary"}</th>
                  <th className="py-2">{sw ? "Sehemu" : "Share"}</th>
                </tr>
              </thead>
              <tbody>
                {allocations.map((a) => (
                  <tr key={a.id} className="border-b border-gray-200 last:border-0">
                    <td className="py-2 pr-4">{a.dfp_properties?.name}</td>
                    <td className="py-2 pr-4">{a.dfp_beneficiaries?.full_name}</td>
                    <td className="py-2">{a.share_percentage}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {report === "property" && (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b border-gray-300">
                <th className="py-2 pr-4">{sw ? "Na. ya Mali" : "Property No."}</th>
                <th className="py-2 pr-4">{sw ? "Jina" : "Name"}</th>
                <th className="py-2 pr-4">{sw ? "Aina" : "Category"}</th>
                <th className="py-2 pr-4">{sw ? "Umiliki" : "Ownership"}</th>
                <th className="py-2 pr-4">{sw ? "Thamani (TZS)" : "Value (TZS)"}</th>
                <th className="py-2">{sw ? "Hadhi" : "Status"}</th>
              </tr>
            </thead>
            <tbody>
              {properties.map((p) => (
                <tr key={p.id} className="border-b border-gray-200 last:border-0">
                  <td className="py-2 pr-4 font-mono text-xs">{p.property_number}</td>
                  <td className="py-2 pr-4">{p.name}</td>
                  <td className="py-2 pr-4 capitalize">{p.category}</td>
                  <td className="py-2 pr-4 capitalize">{p.ownership_type}</td>
                  <td className="py-2 pr-4">{Number(p.estimated_value ?? 0).toLocaleString()}</td>
                  <td className="py-2 capitalize">{p.status.replace("_", " ")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {report === "beneficiary" && (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b border-gray-300">
                <th className="py-2 pr-4">{sw ? "Jina" : "Name"}</th>
                <th className="py-2 pr-4">{sw ? "Uhusiano" : "Relationship"}</th>
                <th className="py-2">{sw ? "Simu" : "Phone"}</th>
              </tr>
            </thead>
            <tbody>
              {beneficiaries.map((b) => (
                <tr key={b.id} className="border-b border-gray-200 last:border-0">
                  <td className="py-2 pr-4">{b.full_name}</td>
                  <td className="py-2 pr-4">{b.relationship}</td>
                  <td className="py-2">{b.phone_number ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </DashboardShell>
  );
}
