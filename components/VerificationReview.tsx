"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import DashboardShell from "@/components/DashboardShell";
import { StatusBadge } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";

type Allocation = {
  id: string;
  share_percentage: number;
  dfp_properties: { name: string; category: string; estimated_value: number | null; property_number: string | null } | null;
  dfp_beneficiaries: { full_name: string; relationship: string } | null;
};

export default function VerificationReview({ role }: { role: "witness" | "leader" | "legal" }) {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const supabase = createClient();

  const [verification, setVerification] = useState<any>(null);
  const [plan, setPlan] = useState<any>(null);
  const [allocations, setAllocations] = useState<Allocation[]>([]);
  const [comment, setComment] = useState("");
  const [idChecked, setIdChecked] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [flagIssue, setFlagIssue] = useState("");
  const [flagRecommendation, setFlagRecommendation] = useState("");
  const [flagSubmitting, setFlagSubmitting] = useState(false);
  const [flagSubmitted, setFlagSubmitted] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: ver } = await supabase
        .from("dfp_verifications")
        .select("*")
        .eq("id", params.id)
        .single();
      setVerification(ver);
      if (!ver) return;

      const { data: planData } = await supabase
        .from("dfp_succession_records")
        .select("*")
        .eq("id", ver.succession_record_id)
        .single();
      setPlan(planData);

      const { data: allocData } = await supabase
        .from("dfp_property_allocations")
        .select("id, share_percentage, dfp_properties(name, category, estimated_value, property_number), dfp_beneficiaries(full_name, relationship)")
        .eq("succession_record_id", ver.succession_record_id);
      setAllocations((allocData as any) ?? []);
    })();
  }, [supabase, params.id]);

  async function decide(decision: "approved" | "rejected") {
    setError(null);
    if (decision === "rejected" && !comment.trim()) {
      setError("Please explain why you're rejecting this record.");
      return;
    }
    if ((role === "leader" || role === "legal") && decision === "approved" && !idChecked) {
      setError("Confirm the required review statement before approving.");
      return;
    }
    setLoading(true);
    const { error } = await supabase
      .from("dfp_verifications")
      .update({ decision, comment: comment || null, decided_at: new Date().toISOString() })
      .eq("id", params.id);
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    router.push(
      role === "witness" ? "/witness/dashboard" : role === "leader" ? "/leader/dashboard" : "/legal/dashboard"
    );
  }

  async function submitFlag(e: React.FormEvent) {
    e.preventDefault();
    if (!flagIssue.trim()) return;
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    setFlagSubmitting(true);
    const { error } = await supabase.from("dfp_legal_flags").insert({
      succession_record_id: plan.id,
      legal_officer_id: user.id,
      issue: flagIssue,
      recommendation: flagRecommendation || null,
    });
    setFlagSubmitting(false);
    if (!error) {
      setFlagIssue("");
      setFlagRecommendation("");
      setFlagSubmitted(true);
    }
  }

  if (!verification || !plan) {
    return (
      <DashboardShell role={role}>
        <p className="text-sm text-neutralDark">Loading…</p>
      </DashboardShell>
    );
  }

  const alreadyDecided = verification.decision !== "pending";

  return (
    <DashboardShell role={role}>
      <div className="max-w-2xl">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-xl font-semibold text-primary">{plan.title}</h1>
          <StatusBadge status={plan.status} />
        </div>
        {plan.instructions && <p className="text-sm text-neutralDark mb-6">{plan.instructions}</p>}

        <div className="card mb-6">
          <h2 className="font-semibold text-primary mb-4 text-sm uppercase tracking-wide">Proposed Allocation</h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-neutralDark border-b border-gray-300">
                <th className="py-2 pr-4">Property</th>
                <th className="py-2 pr-4">Beneficiary</th>
                <th className="py-2">Share</th>
              </tr>
            </thead>
            <tbody>
              {allocations.map((a) => (
                <tr key={a.id} className="border-b border-gray-200 last:border-0">
                  <td className="py-2 pr-4">
                    {a.dfp_properties?.name}
                    {a.dfp_properties?.property_number && (
                      <span className="block text-[11px] text-neutralDark font-mono">{a.dfp_properties.property_number}</span>
                    )}
                    <span className="block text-xs text-neutralDark capitalize">{a.dfp_properties?.category}</span>
                  </td>
                  <td className="py-2 pr-4">
                    {a.dfp_beneficiaries?.full_name}
                    <span className="block text-xs text-neutralDark">{a.dfp_beneficiaries?.relationship}</span>
                  </td>
                  <td className="py-2 font-medium">{a.share_percentage}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {role === "legal" && (
          <div className="card mb-6">
            <h2 className="font-semibold text-primary mb-3 text-sm uppercase tracking-wide">
              Flag a Compliance Issue
            </h2>
            {flagSubmitted && (
              <p className="text-sm text-secondary mb-3">Issue flagged. Visible on your Compliance Flags queue.</p>
            )}
            <form onSubmit={submitFlag} className="space-y-3">
              <div>
                <label className="label">Issue</label>
                <textarea className="input-field" rows={2} value={flagIssue} onChange={(e) => setFlagIssue(e.target.value)} />
              </div>
              <div>
                <label className="label">Recommended Correction (optional)</label>
                <textarea className="input-field" rows={2} value={flagRecommendation} onChange={(e) => setFlagRecommendation(e.target.value)} />
              </div>
              <button disabled={flagSubmitting} type="submit" className="btn-outline text-sm">
                {flagSubmitting ? "Submitting…" : "Flag Issue"}
              </button>
            </form>
          </div>
        )}

        {alreadyDecided ? (
          <div className="card">
            <p className="text-sm text-neutralDark mb-2">You already submitted a decision:</p>
            <StatusBadge status={verification.decision} />
            {verification.comment && (
              <p className="text-sm text-neutralDark mt-3">&quot;{verification.comment}&quot;</p>
            )}
          </div>
        ) : (
          <div className="card space-y-4">
            <h2 className="font-semibold text-primary text-sm uppercase tracking-wide">Your Decision</h2>
            {error && (
              <div className="bg-white text-red-800 border border-red-800 text-sm px-3 py-2">{error}</div>
            )}

            {role === "leader" && (
              <label className="flex items-start gap-2 text-sm bg-neutralLight border border-gray-400 p-3">
                <input type="checkbox" checked={idChecked} onChange={(e) => setIdChecked(e.target.checked)} className="mt-0.5" />
                <span>
                  I have verified the owner&apos;s identity and confirm the details above are
                  consistent with records held by this local government office.
                </span>
              </label>
            )}
            {role === "legal" && (
              <label className="flex items-start gap-2 text-sm bg-neutralLight border border-gray-400 p-3">
                <input type="checkbox" checked={idChecked} onChange={(e) => setIdChecked(e.target.checked)} className="mt-0.5" />
                <span>
                  I have reviewed this succession record for legal soundness and compliance with
                  applicable succession and property law.
                </span>
              </label>
            )}

            <div>
              <label className="label">Comment (required if rejecting)</label>
              <textarea
                className="input-field"
                rows={3}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
              />
            </div>

            <div className="flex gap-3">
              <button disabled={loading} onClick={() => decide("approved")} className="btn-secondary">
                {loading ? "Submitting…" : "Approve"}
              </button>
              <button disabled={loading} onClick={() => decide("rejected")} className="btn-danger">
                Reject
              </button>
            </div>
          </div>
        )}
      </div>
    </DashboardShell>
  );
}
