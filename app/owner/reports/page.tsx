"use client";

import { useEffect, useState } from "react";
import DashboardShell from "@/components/DashboardShell";
import { createClient } from "@/lib/supabase/client";

export default function OwnerReportsPage() {
  const supabase = createClient();
  const [properties, setProperties] = useState<any[]>([]);
  const [beneficiaries, setBeneficiaries] = useState<any[]>([]);
  const [allocations, setAllocations] = useState<any[]>([]);
  const [ownerName, setOwnerName] = useState("");
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

      const { data: allocs } = await supabase
        .from("dfp_property_allocations")
        .select("id, share_percentage, dfp_properties(name), dfp_beneficiaries(full_name)")
        .in("succession_record_id",
          (await supabase.from("dfp_succession_records").select("id").eq("owner_id", user.id)).data?.map((r) => r.id) ?? []
        );
      setAllocations((allocs as any) ?? []);
    })();
  }, [supabase]);

  const totalValue = properties.reduce((s, p) => s + (Number(p.estimated_value) || 0), 0);

  return (
    <DashboardShell role="owner">
      <div className="flex items-center justify-between mb-6 no-print">
        <h1 className="text-xl font-semibold text-primary">Reports &amp; Certificates</h1>
        <div className="flex gap-2">
          <button onClick={() => setReport("estate")} className={`btn-outline text-xs ${report === "estate" ? "bg-neutralLight" : ""}`}>Estate Summary</button>
          <button onClick={() => setReport("property")} className={`btn-outline text-xs ${report === "property" ? "bg-neutralLight" : ""}`}>Property Registry</button>
          <button onClick={() => setReport("beneficiary")} className={`btn-outline text-xs ${report === "beneficiary" ? "bg-neutralLight" : ""}`}>Beneficiary Report</button>
          <button onClick={() => window.print()} className="btn-primary text-xs">Print</button>
        </div>
      </div>

      <div className="card">
        <div className="text-center border-b border-gray-300 pb-4 mb-4">
          <p className="text-xs text-neutralDark uppercase tracking-widest">United Republic of Tanzania</p>
          <p className="font-semibold text-primary">
            {report === "estate" && "Estate Summary Report"}
            {report === "property" && "Property Registry Report"}
            {report === "beneficiary" && "Beneficiary Report"}
          </p>
          <p className="text-xs text-neutralDark">Prepared for: {ownerName} — Generated: {new Date().toLocaleDateString()}</p>
        </div>

        {report === "estate" && (
          <div>
            <p className="text-sm mb-4">
              Total registered properties: <strong>{properties.length}</strong> — Total estimated
              value: <strong>TZS {totalValue.toLocaleString()}</strong> — Registered beneficiaries: <strong>{beneficiaries.length}</strong>
            </p>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b border-gray-300">
                  <th className="py-2 pr-4">Property</th>
                  <th className="py-2 pr-4">Beneficiary</th>
                  <th className="py-2">Share</th>
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
                <th className="py-2 pr-4">Property No.</th>
                <th className="py-2 pr-4">Name</th>
                <th className="py-2 pr-4">Category</th>
                <th className="py-2 pr-4">Ownership</th>
                <th className="py-2 pr-4">Value (TZS)</th>
                <th className="py-2">Status</th>
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
                <th className="py-2 pr-4">Name</th>
                <th className="py-2 pr-4">Relationship</th>
                <th className="py-2">Phone</th>
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
