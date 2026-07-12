"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import QRCode from "qrcode";
import DashboardShell from "@/components/DashboardShell";
import { StatusBadge, VerificationTimeline } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import { useLanguage } from "@/lib/i18n";

type Allocation = {
  id: string;
  share_percentage: number;
  dfp_properties: { name: string; property_number: string | null } | null;
  dfp_beneficiaries: { full_name: string } | null;
};

type Verification = {
  id: string;
  verifier_role: string;
  decision: string;
  comment: string | null;
  decided_at: string | null;
  dfp_profiles: { full_name: string } | null;
};

export default function SuccessionPlanDetailPage() {
  const params = useParams<{ id: string }>();
  const supabase = createClient();
  const { lang } = useLanguage();
  const sw = lang === "sw";
  const [plan, setPlan] = useState<any>(null);
  const [allocations, setAllocations] = useState<Allocation[]>([]);
  const [verifications, setVerifications] = useState<Verification[]>([]);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [verifyUrl, setVerifyUrl] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data: planData } = await supabase
        .from("dfp_succession_records")
        .select("*")
        .eq("id", params.id)
        .single();
      setPlan(planData);

      const { data: allocData } = await supabase
        .from("dfp_property_allocations")
        .select("id, share_percentage, dfp_properties(name, property_number), dfp_beneficiaries(full_name)")
        .eq("succession_record_id", params.id);
      setAllocations((allocData as any) ?? []);

      const { data: verData } = await supabase
        .from("dfp_verifications")
        .select("id, verifier_role, decision, comment, decided_at, dfp_profiles(full_name)")
        .eq("succession_record_id", params.id);
      setVerifications((verData as any) ?? []);

      if (planData?.status === "verified") {
        const { data: pub } = await supabase
          .from("dfp_public_verifications")
          .select("public_token, certificate_number")
          .eq("succession_record_id", params.id)
          .maybeSingle();
        if (pub?.public_token) {
          const url = `${window.location.origin}/verify/${pub.public_token}`;
          setVerifyUrl(url);
          const dataUrl = await QRCode.toDataURL(url, { margin: 1, width: 180 });
          setQrDataUrl(dataUrl);
        }
      }
    })();
  }, [supabase, params.id]);

  if (!plan) {
    return (
      <DashboardShell role="owner">
        <p className="text-sm text-neutralDark">{sw ? "Inapakia…" : "Loading…"}</p>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell role="owner">
      <div className="flex items-center justify-between mb-2">
        <h1 className="text-xl font-semibold text-primary">{plan.title}</h1>
        <div className="flex items-center gap-3">
          {plan.is_locked && (
            <span className="badge bg-gray-100 text-neutralDark border-gray-400">{sw ? "Imefungwa" : "Locked"}</span>
          )}
          <StatusBadge status={plan.status} />
        </div>
      </div>
      <div className="flex items-center gap-4 flex-wrap">
        <Link href={`/owner/succession-plans/${params.id}/versions`} className="text-sm text-primary underline">
          {sw ? "Angalia Historia ya Matoleo" : "View version history"}
        </Link>
        <Link href={`/owner/succession-plans/${params.id}/report`} className="text-sm text-primary underline">
          {sw ? "Angalia Ripoti Kamili ya Mali" : "View Full Estate Report"}
        </Link>
      </div>
      {plan.instructions && <p className="text-sm text-neutralDark mb-6 mt-2">{plan.instructions}</p>}

      <div className="card mb-6">
        <h2 className="font-semibold text-primary mb-4 text-sm uppercase tracking-wide">{sw ? "Maendeleo ya Uhakiki" : "Verification Progress"}</h2>
        <VerificationTimeline status={plan.status} reportGenerated={!!plan.report_generated_at} />
      </div>

      {qrDataUrl && (
        <div className="card mb-6 flex flex-col sm:flex-row items-center gap-6">
          <img src={qrDataUrl} alt={sw ? "Msimbo wa QR wa Uthibitisho" : "Verification QR Code"} className="border border-gray-300" />
          <div>
            <p className="font-semibold text-primary mb-1 text-sm uppercase tracking-wide">
              {sw ? "Cheti cha Uthibitisho" : "Verification Certificate"}
            </p>
            <p className="text-sm text-neutralDark mb-2">
              {sw
                ? "Kumbukumbu hii imekamilishwa. Changanua msimbo au tumia kiungo hapa chini kuthibitisha uhalisi wake hadharani bila kufichua maelezo binafsi."
                : "This record has been finalized. Scan the code or use the link below to publicly verify its authenticity without exposing private details."}
            </p>
            <a href={verifyUrl ?? "#"} target="_blank" className="text-sm text-primary underline break-all">
              {verifyUrl}
            </a>
            <div className="mt-3">
              <Link
                href={`/owner/succession-plans/${params.id}/certificate`}
                className="inline-flex items-center gap-2 border border-primary text-primary font-medium text-sm px-4"
                style={{ minHeight: 40 }}
              >
                {sw ? "Angalia Cheti Kamili" : "View Full Certificate"}
              </Link>
            </div>
          </div>
        </div>
      )}

      <div className="card mb-6">
        <h2 className="font-semibold text-primary mb-4 text-sm uppercase tracking-wide">{sw ? "Ugawaji wa Mali" : "Property Allocations"}</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-neutralDark border-b border-gray-300">
              <th className="py-2 pr-4">{sw ? "Mali" : "Property"}</th>
              <th className="py-2 pr-4">{sw ? "Mnufaika" : "Beneficiary"}</th>
              <th className="py-2">{sw ? "Sehemu" : "Share"}</th>
            </tr>
          </thead>
          <tbody>
            {allocations.map((a) => (
              <tr key={a.id} className="border-b border-gray-200 last:border-0">
                <td className="py-2 pr-4">
                  {a.dfp_properties?.name}
                  {a.dfp_properties?.property_number && (
                    <span className="block text-[11px] text-neutralDark font-mono">
                      {a.dfp_properties.property_number}
                    </span>
                  )}
                </td>
                <td className="py-2 pr-4">{a.dfp_beneficiaries?.full_name}</td>
                <td className="py-2 font-medium">{a.share_percentage}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card no-print">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-primary text-sm uppercase tracking-wide">{sw ? "Maamuzi ya Wathibitishaji" : "Verifier Decisions"}</h2>
          <button onClick={() => window.print()} className="btn-outline text-xs">{sw ? "Chapisha Kumbukumbu" : "Print Record"}</button>
        </div>
        {verifications.length === 0 ? (
          <p className="text-sm text-neutralDark">{sw ? "Bado haijawasilishwa kwa uhakiki." : "Not yet submitted for verification."}</p>
        ) : (
          <ul className="space-y-3">
            {verifications.map((v) => (
              <li key={v.id} className="flex items-start justify-between border-b border-gray-200 last:border-0 pb-3">
                <div>
                  <p className="text-sm font-medium text-neutralDark">
                    {v.dfp_profiles?.full_name}{" "}
                    <span className="text-xs text-neutralDark capitalize">({v.verifier_role})</span>
                  </p>
                  {v.comment && <p className="text-xs text-neutralDark mt-0.5">&quot;{v.comment}&quot;</p>}
                  {v.decided_at && (
                    <p className="text-xs text-neutralDark">{new Date(v.decided_at).toLocaleString()}</p>
                  )}
                </div>
                <StatusBadge status={v.decision} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </DashboardShell>
  );
}
