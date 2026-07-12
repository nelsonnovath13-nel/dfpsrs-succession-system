"use client";

import { useEffect, useState } from "react";
import { ShieldCheck, BadgeCheck, Clock, CheckCircle2, XCircle, MapPin } from "lucide-react";
import DashboardShell from "@/components/DashboardShell";
import { StatCard, StatusBadge } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import { useLanguage } from "@/lib/i18n";
import { verifierTypeLabel } from "@/lib/verifierTypes";
import Link from "next/link";

type Role = "owner" | "witness" | "leader" | "admin" | "beneficiary" | "legal" | "auditor" | "executor";

export default function VerifierDashboardPage() {
  const supabase = createClient();
  const { lang } = useLanguage();
  const sw = lang === "sw";

  const [role, setRole] = useState<Role | null>(null);
  const [fullName, setFullName] = useState("");
  const [verifier, setVerifier] = useState<any>(null);
  const [decisions, setDecisions] = useState<any[]>([]);
  const [trust, setTrust] = useState<{ verification_count: number; approved_count: number; trust_score: number | null } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }
      const { data: profile } = await supabase.from("dfp_profiles").select("role, full_name").eq("id", user.id).maybeSingle();
      setRole((profile?.role as Role) ?? "owner");
      setFullName(profile?.full_name ?? "");

      const { data: v } = await supabase.from("dfp_verifiers").select("*").eq("user_id", user.id).maybeSingle();
      setVerifier(v);

      const { data: decs } = await supabase
        .from("dfp_verifications")
        .select("id, succession_record_id, verifier_role, decision, decided_at, dfp_succession_records(title)")
        .eq("verifier_id", user.id)
        .order("decided_at", { ascending: false, nullsFirst: false })
        .limit(20);
      setDecisions(decs ?? []);

      const { data: trustData } = await supabase.rpc("dfp_verifier_trust_score", { p_user_id: user.id });
      setTrust(trustData);

      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading || !role) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-sm text-neutralDark">{sw ? "Inapakia…" : "Loading…"}</p>
      </div>
    );
  }

  const pendingCount = decisions.filter((d) => !d.decision || d.decision === "pending").length;
  const approvedCount = decisions.filter((d) => d.decision === "approved").length;
  const rejectedCount = decisions.filter((d) => d.decision === "rejected").length;

  return (
    <DashboardShell role={role}>
      <h1 className="text-xl font-semibold text-primary mb-6 flex items-center gap-2">
        <ShieldCheck size={22} aria-hidden="true" /> {sw ? "Dashibodi ya Mthibitishaji" : "Verifier Dashboard"}
      </h1>

      {!verifier ? (
        <div className="card max-w-xl text-center py-8">
          <p className="text-sm text-inkSoft mb-4">
            {sw ? "Bado hujajisajili kama mthibitishaji rasmi." : "You haven't registered as an official verifier yet."}
          </p>
          <Link href="/verifier/apply" className="btn-primary text-sm">
            {sw ? "Wasilisha Ombi" : "Submit Application"}
          </Link>
        </div>
      ) : (
        <>
          <div className="card max-w-xl mb-6 flex items-center gap-4">
            <span className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <BadgeCheck size={28} className="text-primary" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="font-semibold text-ink truncate">{fullName}</p>
              <p className="text-xs text-inkSoft">{verifierTypeLabel(verifier.verifier_type, lang)}</p>
              <div className="flex items-center gap-2 mt-1">
                <StatusBadge status={verifier.status} />
                {(verifier.region || verifier.district) && (
                  <span className="text-xs text-inkSoft flex items-center gap-1">
                    <MapPin size={11} aria-hidden="true" />
                    {[verifier.ward, verifier.district, verifier.region].filter(Boolean).join(", ")}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6 max-w-3xl">
            <StatCard label={sw ? "Jumla ya Maombi" : "Total Requests"} value={decisions.length} />
            <StatCard label={sw ? "Yanasubiri" : "Pending"} value={pendingCount} />
            <StatCard label={sw ? "Yamekubaliwa" : "Approved"} value={approvedCount} />
            <StatCard label={sw ? "Yamekataliwa" : "Rejected"} value={rejectedCount} />
          </div>

          <div className="card max-w-xl mb-6">
            <p className="text-xs font-semibold text-inkSoft uppercase tracking-wide mb-2">{sw ? "Alama ya Uaminifu" : "Trust Score"}</p>
            {trust && trust.trust_score !== null ? (
              <>
                <p className="text-2xl font-bold text-primary">{trust.trust_score}%</p>
                <p className="text-xs text-inkSoft mt-1">
                  {sw
                    ? `Kutokana na maamuzi halisi ${trust.verification_count} (${trust.approved_count} yalikubaliwa)`
                    : `Based on ${trust.verification_count} real decisions (${trust.approved_count} approved)`}
                </p>
              </>
            ) : (
              <p className="text-sm text-inkSoft">{sw ? "Bado hakuna historia ya uthibitishaji." : "No verification history yet."}</p>
            )}
          </div>

          <h2 className="text-sm font-semibold text-inkSoft uppercase tracking-wide mb-3">{sw ? "Historia ya Uthibitishaji" : "Verification History"}</h2>
          {decisions.length === 0 ? (
            <div className="card max-w-xl text-sm text-inkSoft">{sw ? "Bado hujathibitisha kumbukumbu yoyote." : "You haven't reviewed any records yet."}</div>
          ) : (
            <div className="border border-gray-300 divide-y divide-gray-200 max-w-xl">
              {decisions.map((d) => (
                <div key={d.id} className="flex items-center justify-between px-4 py-3 gap-2">
                  <div className="min-w-0">
                    <p className="text-sm text-ink truncate">{d.dfp_succession_records?.title ?? "—"}</p>
                    <p className="text-xs text-inkSoft">{d.decided_at ? new Date(d.decided_at).toLocaleDateString() : sw ? "Inasubiri" : "Pending"}</p>
                  </div>
                  {d.decision === "approved" ? (
                    <CheckCircle2 size={18} className="text-secondary shrink-0" aria-hidden="true" />
                  ) : d.decision === "rejected" ? (
                    <XCircle size={18} className="text-danger shrink-0" aria-hidden="true" />
                  ) : (
                    <Clock size={18} className="text-amber-600 shrink-0" aria-hidden="true" />
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </DashboardShell>
  );
}
