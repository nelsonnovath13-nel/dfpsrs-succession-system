"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, XCircle } from "lucide-react";
import DashboardShell from "@/components/DashboardShell";
import { StatCard, StatusBadge } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import { useLanguage } from "@/lib/i18n";

// Mirrors the exact English messages dfp_estate_completeness() returns in its `missing` array,
// so presence/absence in that array can drive a per-factor pass/fail breakdown without
// duplicating the scoring logic on the client.
const HEALTH_FACTORS = [
  { key: "properties", weight: 20, missingText: "Register at least one property", en: "Properties Registered", sw: "Mali Zilizosajiliwa" },
  { key: "documents", weight: 20, missingText: "Upload supporting documents for every property", en: "Property Documents Uploaded", sw: "Hati za Mali Zilizopakiwa" },
  { key: "confirmations", weight: 20, missingText: "Get all beneficiaries to confirm their allocation", en: "Beneficiary Confirmation", sw: "Uthibitisho wa Wanufaika" },
  { key: "witnesses", weight: 20, missingText: "Assign at least two witnesses", en: "Witness Verification", sw: "Uthibitisho wa Mashahidi" },
  { key: "leader", weight: 10, missingText: "Assign a local government leader", en: "Government Verification", sw: "Uthibitisho wa Serikali" },
  { key: "executor", weight: 10, missingText: "Appoint an estate executor", en: "Executor Assigned", sw: "Msimamizi Ameteuliwa" },
];

export default function EstateDashboardPage() {
  const supabase = createClient();
  const { lang } = useLanguage();
  const sw = lang === "sw";
  const [counts, setCounts] = useState({ properties: 0, beneficiaries: 0, value: 0, verified: 0, pending: 0 });
  const [completeness, setCompleteness] = useState<{ score: number; missing: string[] } | null>(null);
  const [deathStatus, setDeathStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data: properties } = await supabase
        .from("dfp_properties")
        .select("id, estimated_value, status")
        .eq("owner_id", user.id);

      const { data: beneficiaries } = await supabase
        .from("dfp_beneficiaries")
        .select("id")
        .eq("owner_id", user.id);

      const { data: records } = await supabase
        .from("dfp_succession_records")
        .select("status")
        .eq("owner_id", user.id);

      const totalValue = (properties ?? []).reduce((sum, p) => sum + (Number(p.estimated_value) || 0), 0);
      const verified = (properties ?? []).filter((p) => p.status === "verified").length;
      const pending = (records ?? []).filter((r) =>
        ["submitted", "witness_review", "local_leader_review", "legal_review"].includes(r.status)
      ).length;

      setCounts({
        properties: properties?.length ?? 0,
        beneficiaries: beneficiaries?.length ?? 0,
        value: totalValue,
        verified,
        pending,
      });

      const { data: comp } = await supabase.rpc("dfp_estate_completeness", { p_owner_id: user.id });
      if (comp) setCompleteness(comp as any);

      const { data: dv } = await supabase
        .from("dfp_death_verifications")
        .select("status")
        .eq("owner_id", user.id)
        .maybeSingle();
      setDeathStatus(dv?.status ?? null);

      setLoading(false);
    })();
  }, [supabase]);

  // A brand-new estate with no properties yet hasn't been analyzed -- calling it "High Risk"
  // is alarming and inaccurate. Only show a real risk level once there's meaningful data.
  const isSettingUp = counts.properties === 0;
  const riskLevel = isSettingUp
    ? sw
      ? "Inaanzishwa"
      : "Setup In Progress"
    : completeness && completeness.score >= 80
    ? sw
      ? "Chini"
      : "Low"
    : completeness && completeness.score >= 50
    ? sw
      ? "Wastani"
      : "Medium"
    : sw
    ? "Juu"
    : "High";
  const riskColor = isSettingUp
    ? "text-primary"
    : completeness && completeness.score >= 80
    ? "text-secondary"
    : completeness && completeness.score >= 50
    ? "text-amber-800"
    : "text-red-800";

  return (
    <DashboardShell role="owner">
      <h1 className="text-xl font-semibold text-primary mb-6">Estate Dashboard</h1>

      {loading ? (
        <p className="text-sm text-neutralDark">Loading…</p>
      ) : (
        <>
          {deathStatus && (
            <div className="card mb-6 flex items-center justify-between">
              <p className="text-sm text-neutralDark">Death Verification Status</p>
              <StatusBadge status={deathStatus} />
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
            <StatCard label="Total Properties" value={counts.properties} />
            <StatCard label="Total Beneficiaries" value={counts.beneficiaries} />
            <StatCard label="Estate Value (TZS)" value={counts.value.toLocaleString()} />
            <StatCard label="Verified Assets" value={counts.verified} />
            <StatCard label="Pending Verifications" value={counts.pending} />
            <div className="card">
              <p className={`text-3xl font-bold leading-tight ${riskColor}`}>{riskLevel}</p>
              <p className="text-xs text-neutralDark uppercase tracking-wide mt-1">Estate Risk Level</p>
            </div>
          </div>

          <div className="card mb-6">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-primary text-sm uppercase tracking-wide">
                {sw ? "Alama ya Afya ya Mali (Estate Health Score)" : "Estate Health Score"}
              </h2>
              <span className="text-2xl font-bold text-primary">{completeness?.score ?? 0}%</span>
            </div>
            <div className="w-full bg-gray-200 h-3 mb-5">
              <div className="bg-secondary h-3" style={{ width: `${completeness?.score ?? 0}%` }} />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-5">
              {HEALTH_FACTORS.map((f) => {
                const failed = completeness?.missing.includes(f.missingText) ?? true;
                return (
                  <div key={f.key} className="flex items-center gap-2 text-sm">
                    {failed ? (
                      <XCircle size={16} className="text-danger shrink-0" aria-hidden="true" />
                    ) : (
                      <CheckCircle2 size={16} className="text-secondary shrink-0" aria-hidden="true" />
                    )}
                    <span className={failed ? "text-inkSoft" : "text-ink"}>{sw ? f.sw : f.en}</span>
                    <span className="text-xs text-inkSoft ml-auto">{f.weight}%</span>
                  </div>
                );
              })}
            </div>

            {completeness && completeness.missing.length > 0 ? (
              <div className="border-t border-gray-200 pt-3">
                <p className="text-sm font-medium text-neutralDark mb-2">
                  {sw ? "Mapendekezo:" : "Recommendations:"}
                </p>
                <ul className="list-disc list-inside text-sm text-neutralDark space-y-1">
                  {completeness.missing.map((m, i) => (
                    <li key={i}>{m}</li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="text-sm text-secondary font-medium border-t border-gray-200 pt-3">
                {sw ? "Kumbukumbu ya mali yako iko kamili." : "Your estate record is complete."}
              </p>
            )}
          </div>
        </>
      )}
    </DashboardShell>
  );
}
