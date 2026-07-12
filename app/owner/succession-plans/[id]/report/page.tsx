"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import QRCode from "qrcode";
import { Printer, Home, Users, ShieldCheck, ClipboardCheck, AlertTriangle, FileCheck2 } from "lucide-react";
import DashboardShell from "@/components/DashboardShell";
import { PageNav } from "@/components/PageNav";
import { StatusBadge } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import { useLanguage } from "@/lib/i18n";
import { categoryMeta } from "@/lib/propertyCategories";

type Property = {
  id: string;
  name: string;
  category: string;
  property_number: string | null;
  location: string | null;
  ownership_type: string | null;
  estimated_value: number | null;
  status: string;
  created_at: string;
};
type Allocation = {
  id: string;
  property_id: string;
  share_percentage: number;
  dfp_properties: { name: string } | null;
  dfp_beneficiaries: { full_name: string; relationship: string } | null;
};
type FamilyMember = { id: string; full_name: string; relationship_type: string; parent_member_id: string | null };
type Executor = { id: string; full_name: string; phone_number: string | null; role_type: string; status: string; linked_user_id: string | null };
type Verification = {
  id: string;
  verifier_role: string;
  decision: string;
  comment: string | null;
  decided_at: string | null;
  signature_data: string | null;
  dfp_profiles: { full_name: string } | null;
};

function riskColor(level: "low" | "medium" | "high") {
  return level === "low" ? "#15803D" : level === "medium" ? "#B45309" : "#B91C1C";
}
function riskLabel(level: "low" | "medium" | "high", sw: boolean) {
  if (level === "low") return sw ? "Chini" : "Low";
  if (level === "medium") return sw ? "Wastani" : "Medium";
  return sw ? "Juu" : "High";
}

export default function SuccessionFullReportPage() {
  const params = useParams<{ id: string }>();
  const supabase = createClient();
  const { lang } = useLanguage();
  const sw = lang === "sw";

  const [plan, setPlan] = useState<any>(null);
  const [owner, setOwner] = useState<any>(null);
  const [properties, setProperties] = useState<Property[]>([]);
  const [allocations, setAllocations] = useState<Allocation[]>([]);
  const [family, setFamily] = useState<FamilyMember[]>([]);
  const [executors, setExecutors] = useState<Executor[]>([]);
  const [verifications, setVerifications] = useState<Verification[]>([]);
  const [docCounts, setDocCounts] = useState<Record<string, number>>({});
  const [disputeCount, setDisputeCount] = useState(0);
  const [legalFlagCount, setLegalFlagCount] = useState(0);
  const [certNumber, setCertNumber] = useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [verifyUrl, setVerifyUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: planData } = await supabase.from("dfp_succession_records").select("*").eq("id", params.id).single();
      setPlan(planData);
      if (!planData) {
        setLoading(false);
        return;
      }

      // national_id is no longer selectable via a plain table read (closed a cross-user PII
      // exposure) -- this RPC only returns the owner's identity to the owner themselves or
      // someone actually assigned to verify their record.
      const [ownerRpcRes, propsRes, allocRes, familyRes, execRes, verRes, disputeRes, legalRes, pubRes] = await Promise.all([
        supabase.rpc("dfp_get_owner_identity_for_verification", { p_owner_id: planData.owner_id }),
        supabase
          .from("dfp_properties")
          .select("id, name, category, property_number, location, ownership_type, estimated_value, status, created_at")
          .eq("owner_id", planData.owner_id),
        supabase
          .from("dfp_property_allocations")
          .select("id, property_id, share_percentage, dfp_properties(name), dfp_beneficiaries(full_name, relationship)")
          .eq("succession_record_id", params.id),
        supabase.from("dfp_family_members").select("id, full_name, relationship_type, parent_member_id").eq("owner_id", planData.owner_id),
        supabase.from("dfp_executors").select("id, full_name, phone_number, role_type, status, linked_user_id").eq("owner_id", planData.owner_id),
        supabase
          .from("dfp_verifications")
          .select("id, verifier_role, decision, comment, decided_at, signature_data, dfp_profiles(full_name)")
          .eq("succession_record_id", params.id),
        supabase.from("dfp_disputes").select("id", { count: "exact", head: true }).eq("succession_record_id", params.id),
        supabase.from("dfp_legal_flags").select("id", { count: "exact", head: true }).eq("succession_record_id", params.id),
        supabase.from("dfp_public_verifications").select("public_token, certificate_number").eq("succession_record_id", params.id).maybeSingle(),
      ]);

      setOwner(ownerRpcRes.data);
      const props = propsRes.data ?? [];
      setProperties(props);
      setAllocations((allocRes.data as any) ?? []);
      setFamily(familyRes.data ?? []);
      setExecutors(execRes.data ?? []);
      setVerifications((verRes.data as any) ?? []);
      setDisputeCount(disputeRes.count ?? 0);
      setLegalFlagCount(legalRes.count ?? 0);
      setCertNumber(pubRes.data?.certificate_number ?? null);

      if (props.length > 0) {
        const { data: docRows } = await supabase
          .from("dfp_property_documents")
          .select("property_id")
          .in("property_id", props.map((p) => p.id));
        const counts: Record<string, number> = {};
        (docRows ?? []).forEach((d) => {
          counts[d.property_id] = (counts[d.property_id] ?? 0) + 1;
        });
        setDocCounts(counts);
      }

      if (pubRes.data?.public_token) {
        const url = `${window.location.origin}/verify/${pubRes.data.public_token}`;
        setVerifyUrl(url);
        setQrDataUrl(await QRCode.toDataURL(url, { margin: 1, width: 150 }));
      }

      setLoading(false);
    })();
  }, [supabase, params.id]);

  if (loading) {
    return (
      <DashboardShell role="owner">
        <p className="text-sm text-neutralDark">{sw ? "Inapakia…" : "Loading…"}</p>
      </DashboardShell>
    );
  }
  if (!plan) {
    return (
      <DashboardShell role="owner">
        <PageNav exitHref="/owner/succession-plans" />
        <p className="text-sm text-neutralDark">{sw ? "Kumbukumbu haikupatikana." : "Record not found."}</p>
      </DashboardShell>
    );
  }

  const totalValue = properties.reduce((s, p) => s + (Number(p.estimated_value) || 0), 0);
  const witnesses = verifications.filter((v) => v.verifier_role === "witness");
  const leader = verifications.find((v) => v.verifier_role === "leader");
  const legal = verifications.find((v) => v.verifier_role === "legal");
  const witnessesApproved = witnesses.filter((w) => w.decision === "approved").length;
  const dependentsCount = family.filter((f) => f.relationship_type === "dependent").length;
  const propertiesMissingDocs = properties.filter((p) => !docCounts[p.id]).length;

  // Real, computable risk factors -- not fabricated scores.
  const ownershipRisk: "low" | "medium" | "high" = disputeCount === 0 ? "low" : disputeCount <= 1 ? "medium" : "high";
  const docsRisk: "low" | "medium" | "high" =
    properties.length === 0 || propertiesMissingDocs === 0 ? "low" : propertiesMissingDocs < properties.length ? "medium" : "high";
  const legalRisk: "low" | "medium" | "high" = legalFlagCount === 0 ? "low" : legalFlagCount === 1 ? "medium" : "high";
  const govRisk: "low" | "medium" | "high" = !leader ? "medium" : leader.decision === "rejected" ? "high" : leader.decision === "approved" ? "low" : "medium";
  const riskScores = { low: 0, medium: 1, high: 2 };
  const overallRiskValue = Math.max(riskScores[ownershipRisk], riskScores[docsRisk], riskScores[legalRisk], riskScores[govRisk]);
  const overallRisk: "low" | "medium" | "high" = overallRiskValue === 0 ? "low" : overallRiskValue === 1 ? "medium" : "high";

  const nextAction =
    plan.status === "draft"
      ? sw
        ? "Tengeneza Ripoti ya Ukaguzi na Uwasilishe"
        : "Generate Review Report & Submit"
      : plan.status === "witness_review"
      ? sw
        ? "Uthibitisho wa Mashahidi"
        : "Witness Verification"
      : plan.status === "local_leader_review"
      ? sw
        ? "Uthibitisho wa Serikali"
        : "Government Verification"
      : plan.status === "legal_review"
      ? sw
        ? "Mapitio ya Kisheria"
        : "Legal Review"
      : sw
      ? "Hakuna — Imekamilika"
      : "None — Complete";

  const roots = family.filter((f) => !f.parent_member_id);
  const children = (parentId: string) => family.filter((f) => f.parent_member_id === parentId);

  return (
    <DashboardShell role="owner">
      <PageNav exitHref={`/owner/succession-plans/${params.id}`} />
      <div className="flex items-center justify-between mb-4 no-print">
        <h1 className="text-xl font-semibold text-primary">{sw ? "Ripoti Kamili ya Urithi wa Mali" : "Succession Estate Report"}</h1>
        <button onClick={() => window.print()} className="btn-outline text-sm inline-flex items-center gap-2">
          <Printer size={16} aria-hidden="true" /> {sw ? "Chapisha" : "Print"}
        </button>
      </div>

      <div className="max-w-4xl mx-auto space-y-6">
        {/* PAGE 1: COVER */}
        <section className="print-page card border-2 border-primary">
          <div className="text-center border-b-2 border-primary pb-4 mb-5">
            <img src="/nembo.png" alt="URT" className="mx-auto mb-2 h-16 w-16 object-contain" />
            <p className="text-xs text-inkSoft uppercase tracking-widest">{sw ? "Jamhuri ya Muungano wa Tanzania" : "United Republic of Tanzania"}</p>
            <p className="text-xs text-inkSoft">{sw ? "Mfumo wa Kidijitali wa Kumbukumbu za Mali na Urithi wa Familia" : "Digital Family Property & Succession Records System"}</p>
            <h2 className="text-xl font-bold text-primary mt-2">{sw ? "RIPOTI YA URITHI WA MALI" : "SUCCESSION ESTATE REPORT"}</h2>
          </div>

          <div className="grid grid-cols-2 gap-6 text-sm mb-5">
            <div>
              <p className="text-xs text-inkSoft uppercase mb-1">{sw ? "Jina la Ripoti" : "Report Title"}</p>
              <p className="text-ink font-medium">{plan.title}</p>
              <p className="text-xs text-inkSoft uppercase mb-1 mt-3">{sw ? "Imeandaliwa Kwa" : "Prepared For"}</p>
              <p className="text-ink font-medium">{owner?.full_name ?? "—"}</p>
              <p className="text-xs text-inkSoft uppercase mb-1 mt-3">{sw ? "Imetengenezwa" : "Generated"}</p>
              <p className="text-ink font-medium">{new Date().toLocaleDateString()}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-inkSoft uppercase mb-1">{sw ? "Thamani ya Mali" : "Estate Value"}</p>
              <p className="text-2xl font-bold text-primary">TZS {totalValue.toLocaleString()}</p>
              <p className="text-xs text-inkSoft uppercase mb-1 mt-3">{sw ? "Hadhi" : "Status"}</p>
              <StatusBadge status={plan.status} />
            </div>
          </div>

          <div className="grid grid-cols-4 gap-3 mb-5">
            <div className="border border-gray-300 text-center py-3">
              <p className="text-lg font-bold text-ink">{properties.length}</p>
              <p className="text-[11px] text-inkSoft">{sw ? "Mali" : "Properties"}</p>
            </div>
            <div className="border border-gray-300 text-center py-3">
              <p className="text-lg font-bold text-ink">{new Set(allocations.map((a) => a.dfp_beneficiaries?.full_name)).size}</p>
              <p className="text-[11px] text-inkSoft">{sw ? "Wanufaika" : "Beneficiaries"}</p>
            </div>
            <div className="border border-gray-300 text-center py-3">
              <p className="text-lg font-bold text-ink">{witnessesApproved}/{witnesses.length}</p>
              <p className="text-[11px] text-inkSoft">{sw ? "Mashahidi" : "Witnesses"}</p>
            </div>
            <div className="border border-gray-300 text-center py-3">
              <p className="text-lg font-bold text-ink">{leader ? (leader.decision === "approved" ? "✓" : "—") : "—"}</p>
              <p className="text-[11px] text-inkSoft">{sw ? "Kiongozi" : "Gov. Leader"}</p>
            </div>
          </div>

          <div className="border-t border-gray-300 pt-4">
            <p className="text-xs text-inkSoft uppercase mb-2">{sw ? "Hatua Inayofuata" : "Next Required Action"}</p>
            <p className="text-sm font-semibold text-primary">{nextAction}</p>
          </div>

          <p className="text-[11px] text-inkSoft mt-6 text-center border-t border-gray-200 pt-3">
            {sw ? "Hii ni ripoti iliyotengenezwa na mfumo. Taarifa zote ni sahihi kufikia tarehe iliyoonyeshwa." : "This is a system-generated report. All information is accurate as of the date shown above."}
          </p>
        </section>

        {/* PAGE 2: PROPERTY INVENTORY */}
        <section className="print-page card">
          <h2 className="font-bold text-primary text-base mb-1 flex items-center gap-2"><Home size={18} aria-hidden="true" /> {sw ? "Orodha ya Mali" : "Property Inventory"}</h2>
          <p className="text-xs text-inkSoft mb-4">{sw ? "Muhtasari wa mali zote zilizosajiliwa kwenye mali hii." : "Summary of all registered properties in this estate."}</p>
          <div className="space-y-4">
            {properties.map((p) => {
              const meta = categoryMeta(p.category);
              const Icon = meta.icon;
              return (
                <div key={p.id} className="border border-gray-300 p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Icon size={18} style={{ color: meta.color }} aria-hidden="true" />
                    <p className="font-semibold text-ink">{p.name}</p>
                    <span className="ml-auto badge" style={{ backgroundColor: p.status === "verified" ? "#F0FDF4" : "#FFFBEB", color: p.status === "verified" ? "#15803D" : "#B45309", borderColor: p.status === "verified" ? "#15803D" : "#B45309" }}>
                      {p.status === "verified" ? (sw ? "Imethibitishwa" : "Verified") : sw ? "Inasubiri" : "Pending"}
                    </span>
                  </div>
                  <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                    <div className="flex justify-between"><dt className="text-inkSoft">{sw ? "Kitambulisho" : "Property ID"}</dt><dd className="text-ink">{p.property_number ?? "—"}</dd></div>
                    <div className="flex justify-between"><dt className="text-inkSoft">{sw ? "Mahali" : "Location"}</dt><dd className="text-ink">{p.location ?? "—"}</dd></div>
                    <div className="flex justify-between"><dt className="text-inkSoft">{sw ? "Umiliki" : "Ownership"}</dt><dd className="text-ink capitalize">{p.ownership_type ?? "—"}</dd></div>
                    <div className="flex justify-between"><dt className="text-inkSoft">{sw ? "Thamani" : "Value"}</dt><dd className="text-ink font-medium">TZS {Number(p.estimated_value ?? 0).toLocaleString()}</dd></div>
                    <div className="flex justify-between"><dt className="text-inkSoft">{sw ? "Ilisajiliwa" : "Registered"}</dt><dd className="text-ink">{new Date(p.created_at).toLocaleDateString()}</dd></div>
                    <div className="flex justify-between"><dt className="text-inkSoft">{sw ? "Hati" : "Documents"}</dt><dd className="text-ink">{docCounts[p.id] ?? 0} {sw ? "zilizopakiwa" : "uploaded"}</dd></div>
                  </dl>
                </div>
              );
            })}
            {properties.length === 0 && <p className="text-sm text-inkSoft">{sw ? "Hakuna mali zilizosajiliwa." : "No properties registered."}</p>}
          </div>
        </section>

        {/* PAGE 3: BENEFICIARY ALLOCATION */}
        <section className="print-page card">
          <h2 className="font-bold text-primary text-base mb-1 flex items-center gap-2"><Users size={18} aria-hidden="true" /> {sw ? "Ugawaji wa Wanufaika" : "Beneficiary Allocation"}</h2>
          <p className="text-xs text-inkSoft mb-4">{sw ? "Mgawanyo wa mali kwa wanufaika." : "Distribution of estate assets to beneficiaries."}</p>
          {properties.filter((p) => allocations.some((a) => a.property_id === p.id)).map((p) => {
            const rows = allocations.filter((a) => a.property_id === p.id);
            const total = rows.reduce((s, r) => s + (Number(r.share_percentage) || 0), 0);
            return (
              <div key={p.id} className="mb-4">
                <div className="flex items-center justify-between border-b border-gray-300 pb-1 mb-1">
                  <p className="font-semibold text-ink">{p.name}</p>
                  <p className="text-sm text-inkSoft">TZS {Number(p.estimated_value ?? 0).toLocaleString()}</p>
                </div>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-inkSoft">
                      <th className="py-1 pr-3 font-normal">{sw ? "Mnufaika" : "Beneficiary"}</th>
                      <th className="py-1 pr-3 font-normal">{sw ? "Uhusiano" : "Relationship"}</th>
                      <th className="py-1 pr-3 font-normal">{sw ? "Sehemu" : "Share"}</th>
                      <th className="py-1 font-normal">{sw ? "Thamani" : "Value"}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.id} className="border-t border-gray-200">
                        <td className="py-1.5 pr-3 text-ink">{r.dfp_beneficiaries?.full_name}</td>
                        <td className="py-1.5 pr-3 text-inkSoft">{r.dfp_beneficiaries?.relationship}</td>
                        <td className="py-1.5 pr-3 text-ink font-medium">{r.share_percentage}%</td>
                        <td className="py-1.5 text-ink">TZS {Math.round((Number(p.estimated_value ?? 0) * r.share_percentage) / 100).toLocaleString()}</td>
                      </tr>
                    ))}
                    <tr className="border-t border-gray-300">
                      <td colSpan={2} className="py-1.5 text-xs text-inkSoft uppercase">{sw ? "Jumla" : "Total"}</td>
                      <td className="py-1.5 font-semibold text-ink">{total}%</td>
                      <td></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            );
          })}
          {allocations.length === 0 && <p className="text-sm text-inkSoft">{sw ? "Hakuna ugawaji uliowekwa." : "No allocations recorded."}</p>}
        </section>

        {/* PAGE 4: FAMILY STRUCTURE */}
        <section className="print-page card">
          <h2 className="font-bold text-primary text-base mb-1">{sw ? "Muundo wa Familia" : "Family Structure"}</h2>
          <p className="text-xs text-inkSoft mb-4">{sw ? "Muhtasari wa wanafamilia." : "Overview of the family members."}</p>
          <div className="border border-gray-300 p-4 mb-4">
            <p className="font-semibold text-ink mb-2">{owner?.full_name} <span className="text-xs text-inkSoft font-normal">({sw ? "Mmiliki" : "Owner"})</span></p>
            <ul className="pl-4 space-y-1">
              {roots.map((f) => (
                <li key={f.id} className="text-sm text-ink">
                  • {f.full_name} <span className="text-xs text-inkSoft capitalize">({f.relationship_type})</span>
                  {children(f.id).length > 0 && (
                    <ul className="pl-4">
                      {children(f.id).map((c) => (
                        <li key={c.id} className="text-sm text-inkSoft">— {c.full_name} <span className="text-xs capitalize">({c.relationship_type})</span></li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
              {family.length === 0 && <li className="text-sm text-inkSoft">{sw ? "Hakuna wanafamilia waliosajiliwa." : "No family members recorded."}</li>}
            </ul>
          </div>
          <dl className="grid grid-cols-2 gap-2 text-sm border border-gray-300 p-4">
            <div className="flex justify-between"><dt className="text-inkSoft">{sw ? "Jumla ya Wanafamilia" : "Total Family Members"}</dt><dd className="text-ink font-medium">{family.length}</dd></div>
            <div className="flex justify-between"><dt className="text-inkSoft">{sw ? "Wategemezi" : "Dependents"}</dt><dd className="text-ink font-medium">{dependentsCount}</dd></div>
          </dl>
        </section>

        {/* PAGE 5: EXECUTORS */}
        <section className="print-page card">
          <h2 className="font-bold text-primary text-base mb-1 flex items-center gap-2"><ShieldCheck size={18} aria-hidden="true" /> {sw ? "Wasimamizi na Wawakilishi" : "Executors & Representatives"}</h2>
          <p className="text-xs text-inkSoft mb-4">{sw ? "Watu wenye jukumu la kusimamia mali." : "Individuals responsible for managing the estate."}</p>
          {executors.length === 0 ? (
            <p className="text-sm text-inkSoft">{sw ? "Hakuna msimamizi aliyeteuliwa." : "No executor appointed."}</p>
          ) : (
            <div className="space-y-3">
              {executors.map((e) => (
                <div key={e.id} className="border border-gray-300 p-4 flex items-start justify-between">
                  <dl className="text-sm space-y-1">
                    <div><dt className="inline text-inkSoft">{sw ? "Jina: " : "Name: "}</dt><dd className="inline text-ink font-medium">{e.full_name}</dd></div>
                    <div><dt className="inline text-inkSoft">{sw ? "Aina: " : "Role: "}</dt><dd className="inline text-ink capitalize">{e.role_type}</dd></div>
                    <div><dt className="inline text-inkSoft">{sw ? "Simu: " : "Phone: "}</dt><dd className="inline text-ink">{e.phone_number ?? "—"}</dd></div>
                    <div><dt className="inline text-inkSoft">{sw ? "Akaunti: " : "Account: "}</dt><dd className="inline text-ink">{e.linked_user_id ? (sw ? "Imeunganishwa" : "Linked") : sw ? "Haijaunganishwa" : "Not linked"}</dd></div>
                  </dl>
                  <StatusBadge status={e.status} />
                </div>
              ))}
            </div>
          )}
        </section>

        {/* PAGE 6: WITNESS VERIFICATION */}
        <section className="print-page card">
          <h2 className="font-bold text-primary text-base mb-1 flex items-center gap-2"><ClipboardCheck size={18} aria-hidden="true" /> {sw ? "Uthibitisho wa Mashahidi" : "Witness Verification"}</h2>
          <p className="text-xs text-inkSoft mb-4">{sw ? "Mashahidi wa familia wanathibitisha usahihi wa taarifa." : "Family witnesses confirm the accuracy of the information."}</p>
          <div className="space-y-4">
            {witnesses.map((w, i) => (
              <div key={w.id} className="border border-gray-300 p-4">
                <p className="text-sm font-semibold text-ink mb-1">{sw ? `Shahidi ${i + 1}` : `Witness ${i + 1}`}: {w.dfp_profiles?.full_name}</p>
                <div className="flex items-center gap-2 mb-1">
                  <StatusBadge status={w.decision} />
                  {w.decided_at && <span className="text-xs text-inkSoft">{new Date(w.decided_at).toLocaleDateString()}</span>}
                </div>
                {w.comment && <p className="text-sm text-inkSoft italic mb-2">&quot;{w.comment}&quot;</p>}
                {w.signature_data ? (
                  <img src={w.signature_data} alt="signature" className="h-10 border-b border-gray-400" />
                ) : (
                  <p className="text-xs text-inkSoft italic">{sw ? "hakuna sahihi" : "no signature on file"}</p>
                )}
              </div>
            ))}
            {witnesses.length === 0 && <p className="text-sm text-inkSoft">{sw ? "Hakuna mashahidi bado." : "No witnesses yet."}</p>}
          </div>
        </section>

        {/* PAGE 7: GOVERNMENT VERIFICATION */}
        <section className="print-page card">
          <h2 className="font-bold text-primary text-base mb-1">{sw ? "Uthibitisho wa Serikali za Mitaa" : "Local Government Verification"}</h2>
          <p className="text-xs text-inkSoft mb-4">{sw ? "Mapitio na uthibitisho wa kiongozi wa mtaa." : "Review and verification by the local government leader."}</p>
          {leader ? (
            <div className="border border-gray-300 p-4">
              <p className="text-sm font-semibold text-ink mb-1">{leader.dfp_profiles?.full_name}</p>
              <div className="flex items-center gap-2 mb-2">
                <StatusBadge status={leader.decision} />
                {leader.decided_at && <span className="text-xs text-inkSoft">{new Date(leader.decided_at).toLocaleDateString()}</span>}
              </div>
              {leader.comment && <p className="text-sm text-inkSoft italic mb-2">&quot;{leader.comment}&quot;</p>}
              {leader.signature_data ? (
                <img src={leader.signature_data} alt="signature" className="h-10 border-b border-gray-400" />
              ) : (
                <p className="text-xs text-inkSoft italic">{sw ? "hakuna sahihi" : "no signature on file"}</p>
              )}
            </div>
          ) : (
            <p className="text-sm text-inkSoft">{sw ? "Bado hajapangiwa kiongozi." : "No leader assigned yet."}</p>
          )}
          {legal && (
            <div className="border border-gray-300 p-4 mt-3">
              <p className="text-sm font-semibold text-ink mb-1">{legal.dfp_profiles?.full_name} ({sw ? "Afisa Sheria" : "Legal Officer"})</p>
              <div className="flex items-center gap-2 mb-2">
                <StatusBadge status={legal.decision} />
                {legal.decided_at && <span className="text-xs text-inkSoft">{new Date(legal.decided_at).toLocaleDateString()}</span>}
              </div>
              {legal.signature_data ? (
                <img src={legal.signature_data} alt="signature" className="h-10 border-b border-gray-400" />
              ) : (
                <p className="text-xs text-inkSoft italic">{sw ? "hakuna sahihi" : "no signature on file"}</p>
              )}
            </div>
          )}
        </section>

        {/* PAGE 8: RISK ANALYSIS */}
        <section className="print-page card">
          <h2 className="font-bold text-primary text-base mb-1 flex items-center gap-2"><AlertTriangle size={18} aria-hidden="true" /> {sw ? "Uchambuzi wa Hatari" : "Risk Analysis & Recommendations"}</h2>
          <p className="text-xs text-inkSoft mb-4">{sw ? "Tathmini ya hatari zinazowezekana." : "Assessment of potential risks in this succession."}</p>
          <div className="space-y-2 mb-4">
            {[
              { label: sw ? "Hatari ya Mgogoro wa Umiliki" : "Ownership Conflict Risk", level: ownershipRisk },
              { label: sw ? "Hatari ya Hati Zinazokosekana" : "Missing Documents Risk", level: docsRisk },
              { label: sw ? "Hatari ya Kisheria" : "Legal Challenge Risk", level: legalRisk },
              { label: sw ? "Hatari ya Uthibitisho wa Serikali" : "Government Verification Risk", level: govRisk },
            ].map((r) => (
              <div key={r.label} className="flex items-center justify-between text-sm border-b border-gray-200 pb-1.5">
                <span className="text-ink">{r.label}</span>
                <span className="font-semibold" style={{ color: riskColor(r.level) }}>● {riskLabel(r.level, sw)}</span>
              </div>
            ))}
          </div>
          <div className="border-2 p-4 text-center mb-4" style={{ borderColor: riskColor(overallRisk), backgroundColor: overallRisk === "low" ? "#F0FDF4" : overallRisk === "medium" ? "#FFFBEB" : "#FEF2F2" }}>
            <p className="text-xs text-inkSoft uppercase">{sw ? "Kiwango cha Hatari cha Jumla" : "Overall Estate Risk Level"}</p>
            <p className="text-xl font-bold" style={{ color: riskColor(overallRisk) }}>{riskLabel(overallRisk, sw).toUpperCase()}</p>
          </div>
          <div>
            <p className="text-xs font-semibold text-inkSoft uppercase mb-2">{sw ? "Mapendekezo" : "Recommendations"}</p>
            <ul className="text-sm text-ink space-y-1 list-disc list-inside">
              {docsRisk !== "low" && <li>{sw ? "Pakia hati za umiliki zinazokosekana." : "Upload missing property ownership documents."}</li>}
              {legalRisk !== "low" && <li>{sw ? "Shughulikia masuala ya kisheria yaliyoashiriwa." : "Address the flagged legal concerns."}</li>}
              {govRisk !== "low" && <li>{sw ? "Kamilisha uthibitisho wa serikali za mitaa." : "Complete local government verification."}</li>}
              {overallRisk === "low" && <li>{sw ? "Endelea kupitia mpango wa urithi mara kwa mara." : "Continue to review the estate plan periodically."}</li>}
            </ul>
          </div>
        </section>

        {/* PAGE 9: CERTIFICATE SUMMARY */}
        <section className="print-page card border-2 border-primary">
          <h2 className="font-bold text-primary text-base mb-1 flex items-center gap-2"><FileCheck2 size={18} aria-hidden="true" /> {sw ? "Cheti cha Urithi" : "Succession Certificate"}</h2>
          <p className="text-xs text-inkSoft mb-4">
            {sw ? "Cheti hiki kinathibitisha kuwa mchakato wa urithi umepitiwa na kuidhinishwa." : "This certificate confirms that the estate succession process has been reviewed and approved."}
          </p>
          {plan.status === "verified" ? (
            <div className="flex flex-col sm:flex-row items-center gap-6">
              {qrDataUrl && <img src={qrDataUrl} alt="Verification QR Code" className="border border-gray-300" />}
              <dl className="text-sm space-y-1.5 flex-1">
                <div className="flex justify-between"><dt className="text-inkSoft">{sw ? "Namba ya Cheti" : "Certificate Number"}</dt><dd className="font-mono font-semibold text-ink">{certNumber ?? "—"}</dd></div>
                <div className="flex justify-between"><dt className="text-inkSoft">{sw ? "Mmiliki" : "Owner"}</dt><dd className="text-ink">{owner?.full_name}</dd></div>
                <div className="flex justify-between"><dt className="text-inkSoft">{sw ? "Thamani" : "Estate Value"}</dt><dd className="text-ink">TZS {totalValue.toLocaleString()}</dd></div>
                <div className="flex justify-between"><dt className="text-inkSoft">{sw ? "Hadhi" : "Status"}</dt><dd><StatusBadge status="verified" /></dd></div>
                <div className="flex justify-between"><dt className="text-inkSoft">{sw ? "Tarehe ya Kutolewa" : "Issued Date"}</dt><dd className="text-ink">{plan.finalized_at ? new Date(plan.finalized_at).toLocaleDateString() : "—"}</dd></div>
              </dl>
            </div>
          ) : (
            <p className="text-sm text-amber-800 bg-amber-50 border border-amber-700 px-3 py-2">
              {sw ? "Cheti kitatolewa baada ya uidhinishaji wa mwisho kukamilika." : "The certificate will be issued once final approval is complete."}
            </p>
          )}
          <div className="mt-4">
            <Link href={`/owner/succession-plans/${params.id}/certificate`} className="text-sm text-primary underline">
              {sw ? "Fungua Cheti Kamili" : "Open Full Certificate"}
            </Link>
          </div>
        </section>
      </div>
    </DashboardShell>
  );
}
