"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import DashboardShell from "@/components/DashboardShell";
import { StatusBadge } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import { useLanguage } from "@/lib/i18n";

const ROLE_HOME: Record<string, string> = {
  witness: "/witness/death-verifications",
  leader: "/leader/death-verifications",
  legal: "/legal/death-verifications",
};

export default function DeathVerificationReview({ role }: { role: "witness" | "leader" | "legal" }) {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const supabase = createClient();
  const { lang } = useLanguage();
  const sw = lang === "sw";

  const [step, setStep] = useState<any>(null);
  const [deathVerification, setDeathVerification] = useState<any>(null);
  const [ownerName, setOwnerName] = useState<string>("");
  const [comment, setComment] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data: s } = await supabase
        .from("dfp_death_verification_steps")
        .select("*")
        .eq("id", params.id)
        .single();
      setStep(s);
      if (!s) return;

      const { data: dv } = await supabase
        .from("dfp_death_verifications")
        .select("*")
        .eq("id", s.death_verification_id)
        .single();
      setDeathVerification(dv);

      if (dv?.owner_id) {
        const { data: owner } = await supabase
          .from("dfp_profiles")
          .select("full_name")
          .eq("id", dv.owner_id)
          .maybeSingle();
        setOwnerName(owner?.full_name ?? "");
      }
    })();
  }, [supabase, params.id]);

  async function decide(decision: "approved" | "rejected") {
    setError(null);
    if (decision === "rejected" && !comment.trim()) {
      setError(sw ? "Tafadhali eleza kwa nini unakataa hatua hii." : "Please explain why you're rejecting this step.");
      return;
    }
    if (decision === "approved" && !confirmed) {
      setError(sw ? "Thibitisha taarifa iliyo hapa chini kabla ya kukubali." : "Confirm the statement below before approving.");
      return;
    }
    setLoading(true);
    const { error } = await supabase
      .from("dfp_death_verification_steps")
      .update({ decision, comment: comment || null, decided_at: new Date().toISOString() })
      .eq("id", params.id);
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    router.push(ROLE_HOME[role]);
  }

  if (!step || !deathVerification) {
    return (
      <DashboardShell role={role}>
        <p className="text-sm text-neutralDark">{sw ? "Inapakia…" : "Loading…"}</p>
      </DashboardShell>
    );
  }

  const alreadyDecided = step.decision !== "pending";
  const STEP_LABEL: Record<string, { en: string; sw: string }> = {
    witness_confirmation: { en: "Family Witness Confirmation", sw: "Uthibitisho wa Shahidi wa Familia" },
    local_government_confirmation: { en: "Local Government Confirmation", sw: "Uthibitisho wa Serikali za Mitaa" },
    legal_review: { en: "Legal Review", sw: "Uhakiki wa Kisheria" },
  };

  return (
    <DashboardShell role={role}>
      <div className="max-w-2xl">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-xl font-semibold text-primary">{sw ? "Uhakiki wa Kifo" : "Death Verification"} — {ownerName}</h1>
          <StatusBadge status={deathVerification.status} />
        </div>
        <p className="text-sm text-neutralDark mb-6">
          {sw ? (
            <>
              Unaombwa kuthibitisha hatua ya <strong>{STEP_LABEL[step.step]?.sw ?? step.step}</strong> katika mchakato huu
              wa uhakiki wa kifo. Kumbukumbu za mirathi hii zitabaki kizuizini hadi hatua zote zikamilike.
            </>
          ) : (
            <>
              You are being asked to confirm the <strong>{STEP_LABEL[step.step]?.en ?? step.step}</strong> step of this
              death verification workflow. Records for this estate remain restricted until every stage
              is complete.
            </>
          )}
        </p>

        {alreadyDecided ? (
          <div className="card">
            <p className="text-sm text-neutralDark mb-2">{sw ? "Tayari umewasilisha uamuzi:" : "You already submitted a decision:"}</p>
            <StatusBadge status={step.decision} />
            {step.comment && <p className="text-sm text-neutralDark mt-3">&quot;{step.comment}&quot;</p>}
          </div>
        ) : (
          <div className="card space-y-4">
            <h2 className="font-semibold text-primary text-sm uppercase tracking-wide">{sw ? "Uamuzi Wako" : "Your Decision"}</h2>
            {error && (
              <div role="alert" className="bg-white text-red-800 border border-red-800 text-sm px-3 py-2">{error}</div>
            )}

            <label className="flex items-start gap-2 text-sm bg-neutralLight border border-gray-400 p-3">
              <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} className="mt-0.5" />
              <span>
                {role === "witness" &&
                  (sw
                    ? "Ninathibitisha, kama shahidi wa familia, kwamba mtu huyu amefariki, kwa kadri ninavyofahamu."
                    : "I confirm, as a family witness, that this person has passed away, to the best of my knowledge.")}
                {role === "leader" &&
                  (sw
                    ? "Ninathibitisha kwamba ripoti hii ya kifo inaendana na kumbukumbu zilizopo katika ofisi hii ya serikali za mitaa."
                    : "I confirm this death report is consistent with records held by this local government office.")}
                {role === "legal" &&
                  (sw
                    ? "Nimepitia uhakiki huu wa kifo kwa usahihi wa kisheria na uzingatiaji wa sheria kabla ya kuachilia mirathi."
                    : "I have reviewed this death verification for legal soundness and compliance before succession release.")}
              </span>
            </label>

            <div>
              <label className="label">{sw ? "Maoni (ni lazima ukikataa)" : "Comment (required if rejecting)"}</label>
              <textarea className="input-field" rows={3} value={comment} onChange={(e) => setComment(e.target.value)} />
            </div>

            <div className="flex gap-3">
              <button disabled={loading} onClick={() => decide("approved")} className="btn-secondary">
                {loading ? (sw ? "Inawasilisha…" : "Submitting…") : sw ? "Thibitisha" : "Confirm"}
              </button>
              <button disabled={loading} onClick={() => decide("rejected")} className="btn-danger">
                {sw ? "Kataa" : "Reject"}
              </button>
            </div>
          </div>
        )}
      </div>
    </DashboardShell>
  );
}
