"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import QRCode from "qrcode";
import { ShieldCheck, Printer } from "lucide-react";
import DashboardShell from "@/components/DashboardShell";
import { PageNav } from "@/components/PageNav";
import { createClient } from "@/lib/supabase/client";
import { useLanguage } from "@/lib/i18n";

type Allocation = {
  id: string;
  share_percentage: number;
  dfp_properties: { name: string; category: string; estimated_value: number | null; property_number: string | null } | null;
  dfp_beneficiaries: { full_name: string; relationship: string } | null;
};
type Verification = {
  id: string;
  verifier_role: string;
  decision: string;
  decided_at: string | null;
  signature_data: string | null;
  dfp_profiles: { full_name: string } | null;
};

export default function CertificatePage() {
  const params = useParams<{ id: string }>();
  const supabase = createClient();
  const { lang } = useLanguage();
  const sw = lang === "sw";

  const [plan, setPlan] = useState<any>(null);
  const [owner, setOwner] = useState<any>(null);
  const [allocations, setAllocations] = useState<Allocation[]>([]);
  const [verifications, setVerifications] = useState<Verification[]>([]);
  const [certNumber, setCertNumber] = useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [verifyUrl, setVerifyUrl] = useState<string | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: planData } = await supabase.from("dfp_succession_records").select("*").eq("id", params.id).single();
      setPlan(planData);
      if (!planData) {
        setLoading(false);
        return;
      }

      const [ownerRes, allocRes, verRes, pubRes] = await Promise.all([
        supabase.from("dfp_profiles").select("full_name, national_id, phone_number, avatar_path").eq("id", planData.owner_id).maybeSingle(),
        supabase
          .from("dfp_property_allocations")
          .select("id, share_percentage, dfp_properties(name, category, estimated_value, property_number), dfp_beneficiaries(full_name, relationship)")
          .eq("succession_record_id", params.id),
        supabase
          .from("dfp_verifications")
          .select("id, verifier_role, decision, decided_at, signature_data, dfp_profiles(full_name)")
          .eq("succession_record_id", params.id),
        supabase.from("dfp_public_verifications").select("public_token, certificate_number").eq("succession_record_id", params.id).maybeSingle(),
      ]);
      setOwner(ownerRes.data);
      setAllocations((allocRes.data as any) ?? []);
      setVerifications((verRes.data as any) ?? []);
      setCertNumber(pubRes.data?.certificate_number ?? null);

      if (ownerRes.data?.avatar_path) {
        const { data: signed } = await supabase.storage.from("dfp-documents").createSignedUrl(ownerRes.data.avatar_path, 3600);
        if (signed) setPhotoUrl(signed.signedUrl);
      }

      if (pubRes.data?.public_token) {
        const url = `${window.location.origin}/verify/${pubRes.data.public_token}`;
        setVerifyUrl(url);
        setQrDataUrl(await QRCode.toDataURL(url, { margin: 1, width: 160 }));
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

  if (!plan || plan.status !== "verified") {
    return (
      <DashboardShell role="owner">
        <PageNav exitHref={`/owner/succession-plans/${params.id}`} />
        <div className="card max-w-xl">
          <p className="text-sm text-neutralDark">
            {sw
              ? "Cheti kinapatikana tu baada ya kumbukumbu kuthibitishwa kikamilifu."
              : "A certificate is only available once this record has been fully verified."}
          </p>
        </div>
      </DashboardShell>
    );
  }

  const witnesses = verifications.filter((v) => v.verifier_role === "witness");
  const leader = verifications.find((v) => v.verifier_role === "leader");
  const legal = verifications.find((v) => v.verifier_role === "legal");
  const totalValue = allocations.reduce((sum, a) => sum + (Number(a.dfp_properties?.estimated_value) || 0), 0);

  return (
    <DashboardShell role="owner">
      <PageNav exitHref={`/owner/succession-plans/${params.id}`} />
      <div className="flex items-center justify-between mb-4 no-print">
        <h1 className="text-xl font-semibold text-primary">{sw ? "Cheti cha Urithi" : "Succession Certificate"}</h1>
        <button onClick={() => window.print()} className="btn-outline text-sm inline-flex items-center gap-2">
          <Printer size={16} aria-hidden="true" /> {sw ? "Chapisha" : "Print"}
        </button>
      </div>

      <div className="card max-w-3xl border-2 border-primary">
        <div className="text-center border-b border-gray-300 pb-4 mb-4">
          <img src="/nembo.png" alt="URT" className="mx-auto mb-2 h-14 w-14 object-contain" />
          <p className="text-xs text-inkSoft uppercase tracking-wide">{sw ? "Jamhuri ya Muungano wa Tanzania" : "United Republic of Tanzania"}</p>
          <h2 className="text-lg font-bold text-primary mt-1">{sw ? "Cheti cha Uthibitisho wa Urithi" : "Digital Succession Certificate"}</h2>
          <p className="text-sm font-mono text-ink mt-2 flex items-center justify-center gap-2">
            <ShieldCheck size={16} className="text-secondary" aria-hidden="true" />
            {certNumber ?? "—"}
          </p>
        </div>

        <div className="flex gap-5 mb-6">
          <span className="w-20 h-24 border-2 border-gray-400 bg-neutralLight flex items-center justify-center overflow-hidden shrink-0">
            {photoUrl ? (
              <img src={photoUrl} alt={owner?.full_name ?? ""} className="w-full h-full object-cover" />
            ) : (
              <span className="text-[10px] text-inkSoft text-center px-1">{sw ? "Hakuna Picha" : "No Photo"}</span>
            )}
          </span>
          <div className="grid grid-cols-2 gap-4 text-sm flex-1">
            <div>
              <p className="text-xs font-semibold text-inkSoft uppercase mb-1">{sw ? "Jina la Kumbukumbu" : "Record Title"}</p>
              <p className="text-ink font-medium">{plan.title}</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-inkSoft uppercase mb-1">{sw ? "Tarehe ya Uidhinishaji" : "Approval Date"}</p>
              <p className="text-ink font-medium">{plan.finalized_at ? new Date(plan.finalized_at).toLocaleDateString() : "—"}</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-inkSoft uppercase mb-1">{sw ? "Hadhi ya Cheti" : "Certificate Status"}</p>
              <p className="text-secondary font-semibold">✓ {sw ? "Halali" : "Valid"}</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-inkSoft uppercase mb-1">{sw ? "Mmiliki" : "Owner"}</p>
              <p className="text-ink font-medium">{owner?.full_name ?? "—"}</p>
            </div>
          </div>
        </div>

        <div className="mb-6">
          <p className="text-xs font-semibold text-inkSoft uppercase mb-2">{sw ? "Muhtasari wa Mali na Wanufaika" : "Property & Beneficiary Summary"}</p>
          <table className="w-full text-sm border border-gray-300">
            <thead>
              <tr className="text-left text-inkSoft border-b border-gray-300 bg-neutralLight">
                <th className="py-2 px-3">{sw ? "Mali" : "Property"}</th>
                <th className="py-2 px-3">{sw ? "Mnufaika" : "Beneficiary"}</th>
                <th className="py-2 px-3">{sw ? "Sehemu" : "Share"}</th>
              </tr>
            </thead>
            <tbody>
              {allocations.map((a) => (
                <tr key={a.id} className="border-b border-gray-200 last:border-0">
                  <td className="py-2 px-3">{a.dfp_properties?.name}</td>
                  <td className="py-2 px-3">{a.dfp_beneficiaries?.full_name} ({a.dfp_beneficiaries?.relationship})</td>
                  <td className="py-2 px-3 font-medium">{a.share_percentage}%</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-sm text-ink font-semibold mt-2">
            {sw ? "Thamani ya Jumla" : "Total Value"}: TZS {totalValue.toLocaleString()}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-6">
          <div>
            <p className="text-xs font-semibold text-inkSoft uppercase mb-2">{sw ? "Mashahidi" : "Witnesses"}</p>
            <div className="space-y-3">
              {witnesses.map((w) => (
                <div key={w.id}>
                  <p className="text-sm text-ink">✓ {w.dfp_profiles?.full_name}</p>
                  {w.signature_data ? (
                    <img src={w.signature_data} alt={`${w.dfp_profiles?.full_name} signature`} className="h-10 border-b border-gray-400" />
                  ) : (
                    <p className="text-xs text-inkSoft italic">{sw ? "hakuna sahihi" : "no signature on file"}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
          <div>
            <p className="text-xs font-semibold text-inkSoft uppercase mb-2">{sw ? "Uthibitisho wa Serikali" : "Government Verification"}</p>
            <div className="space-y-3">
              <div>
                <p className="text-sm text-ink">✓ {leader?.dfp_profiles?.full_name ?? "—"}</p>
                {leader?.signature_data ? (
                  <img src={leader.signature_data} alt="Leader signature" className="h-10 border-b border-gray-400" />
                ) : (
                  <p className="text-xs text-inkSoft italic">{sw ? "hakuna sahihi" : "no signature on file"}</p>
                )}
              </div>
              {legal && (
                <div>
                  <p className="text-sm text-ink">✓ {legal.dfp_profiles?.full_name} ({sw ? "Afisa Sheria" : "Legal"})</p>
                  {legal.signature_data ? (
                    <img src={legal.signature_data} alt="Legal officer signature" className="h-10 border-b border-gray-400" />
                  ) : (
                    <p className="text-xs text-inkSoft italic">{sw ? "hakuna sahihi" : "no signature on file"}</p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {qrDataUrl && (
          <div className="flex items-center gap-4 border-t border-gray-300 pt-4">
            <img src={qrDataUrl} alt="Verification QR Code" className="border border-gray-300" />
            <div>
              <p className="text-sm font-medium text-ink mb-1">{sw ? "Uthibitisho wa Umma" : "Public Verification"}</p>
              <p className="text-xs text-inkSoft mb-1">
                {sw ? "Changanua msimbo huu kuthibitisha uhalali wa cheti hiki." : "Scan this code to verify this certificate's authenticity."}
              </p>
              <Link href={verifyUrl ?? "#"} target="_blank" className="text-xs text-primary underline break-all">
                {verifyUrl}
              </Link>
            </div>
          </div>
        )}
      </div>
    </DashboardShell>
  );
}
