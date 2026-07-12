"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { CheckCircle2, FileText, Download, Eye } from "lucide-react";
import DashboardShell from "@/components/DashboardShell";
import { StatusBadge, VerificationTimeline } from "@/components/ui";
import { SignaturePad } from "@/components/SignaturePad";
import { VerifierBadge } from "@/components/VerifierBadge";
import { createClient } from "@/lib/supabase/client";
import { useLanguage } from "@/lib/i18n";

type Allocation = {
  id: string;
  property_id: string;
  beneficiary_id: string;
  share_percentage: number;
  notes: string | null;
  dfp_properties: { name: string; category: string; estimated_value: number | null; property_number: string | null } | null;
  dfp_beneficiaries: { full_name: string; relationship: string; date_of_birth: string | null } | null;
};

type Property = {
  id: string;
  name: string;
  category: string;
  estimated_value: number | null;
  location: string | null;
  ownership_type: string | null;
  status: string;
  property_number: string | null;
};

type FamilyMember = { id: string; full_name: string; relationship_type: string };

type Doc = { id: string; property_id: string; file_name: string; category: string | null; file_path: string };

function isMinorDob(dob: string | null | undefined): boolean {
  if (!dob) return false;
  const birth = new Date(dob);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age < 18;
}

const RISK_FLAG_OPTIONS = [
  { key: "ownership_conflict", en: "Possible ownership conflict", sw: "Mgogoro wa umiliki unawezekana" },
  { key: "missing_family_member", en: "Missing family member", sw: "Mwanafamilia hajaorodheshwa" },
  { key: "community_dispute", en: "Community dispute reported", sw: "Mgogoro wa jamii umeripotiwa" },
  { key: "unclear_ownership", en: "Property ownership unclear", sw: "Umiliki wa mali si wazi" },
  { key: "suspected_fraud", en: "Fraud suspected", sw: "Utapeli unashukiwa" },
  { key: "legal_action_pending", en: "Legal action pending", sw: "Hatua za kisheria zinasubiri" },
];

export default function VerificationReview({ role }: { role: "witness" | "leader" | "legal" }) {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const supabase = createClient();
  const { lang } = useLanguage();
  const sw = lang === "sw";

  const [verification, setVerification] = useState<any>(null);
  const [plan, setPlan] = useState<any>(null);
  const [owner, setOwner] = useState<any>(null);
  const [allocations, setAllocations] = useState<Allocation[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [familyMembers, setFamilyMembers] = useState<FamilyMember[]>([]);
  const [documents, setDocuments] = useState<Doc[]>([]);

  const [comment, setComment] = useState("");
  const [declarations, setDeclarations] = useState<boolean[]>([]);
  const [confidence, setConfidence] = useState("");
  const [communityKnowledge, setCommunityKnowledge] = useState("");
  const [knownDisputes, setKnownDisputes] = useState("");
  const [residesInJurisdiction, setResidesInJurisdiction] = useState("");
  const [riskFlags, setRiskFlags] = useState<string[]>([]);
  const [rejectReasonCategory, setRejectReasonCategory] = useState("correction");
  const [signatureData, setSignatureData] = useState<string | null>(null);
  const [lateSignature, setLateSignature] = useState<string | null>(null);
  const [savingLateSignature, setSavingLateSignature] = useState(false);
  const [lateSignatureSaved, setLateSignatureSaved] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [missingDeclarations, setMissingDeclarations] = useState<string[]>([]);
  const [justDecided, setJustDecided] = useState<"approved" | "rejected" | null>(null);
  const declarationsRef = useRef<HTMLDivElement>(null);

  const [flagIssue, setFlagIssue] = useState("");
  const [flagRecommendation, setFlagRecommendation] = useState("");
  const [flagSubmitting, setFlagSubmitting] = useState(false);
  const [flagSubmitted, setFlagSubmitted] = useState(false);

  const [usingReportSnapshot, setUsingReportSnapshot] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: ver } = await supabase.from("dfp_verifications").select("*").eq("id", params.id).single();
      setVerification(ver);
      if (!ver) return;

      const { data: planData } = await supabase
        .from("dfp_succession_records")
        .select("*")
        .eq("id", ver.succession_record_id)
        .single();
      setPlan(planData);
      if (!planData) return;

      // Witnesses and leaders must verify the frozen report that was generated at submission
      // time -- not whatever the live tables say right now -- so an owner cannot edit a
      // property after generating the report and have the verifier unknowingly see different
      // data than what was actually reviewed. Older records created before this feature existed
      // have no snapshot, so those fall back to a live read for backward compatibility.
      const snapshot = planData.report_snapshot;
      if (snapshot) {
        setUsingReportSnapshot(true);
        setOwner(snapshot.owner ?? null);
        setFamilyMembers(
          (snapshot.family_members ?? []).map((m: any, i: number) => ({ id: `snap-${i}`, full_name: m.full_name, relationship_type: m.relationship_type }))
        );
        const allocFromSnapshot: Allocation[] = (snapshot.allocations ?? []).map((a: any, i: number) => ({
          id: `snap-${i}`,
          property_id: a.property_id,
          beneficiary_id: a.beneficiary_id,
          share_percentage: a.share_percentage,
          notes: a.notes,
          dfp_properties: { name: a.property_name, category: a.property_category, estimated_value: a.property_value, property_number: null },
          dfp_beneficiaries: { full_name: a.beneficiary_name, relationship: a.beneficiary_relationship, date_of_birth: a.beneficiary_date_of_birth },
        }));
        setAllocations(allocFromSnapshot);
        const propsMap = new Map<string, Property>();
        (snapshot.allocations ?? []).forEach((a: any) => {
          propsMap.set(a.property_id, {
            id: a.property_id,
            name: a.property_name,
            category: a.property_category,
            estimated_value: a.property_value,
            location: a.property_location,
            ownership_type: null,
            status: "verified",
            property_number: null,
          });
        });
        const propsFromSnapshot: Property[] = Array.from(propsMap.values());
        setProperties(propsFromSnapshot);
        setDocuments(
          (snapshot.documents ?? []).map((d: any, i: number) => ({ id: `snap-${i}`, property_id: d.property_id, file_name: d.file_name, category: d.category, file_path: "" }))
        );
        return;
      }

      setUsingReportSnapshot(false);
      // national_id is no longer selectable via a plain table read (closed a cross-user PII
      // exposure) -- this RPC only returns the owner's identity to someone actually assigned
      // to verify their record (or the owner themselves, or admin/auditor).
      const [ownerRpcRes, allocRes, propsRes, familyRes] = await Promise.all([
        supabase.rpc("dfp_get_owner_identity_for_verification", { p_owner_id: planData.owner_id }),
        supabase
          .from("dfp_property_allocations")
          .select(
            "id, property_id, beneficiary_id, share_percentage, notes, dfp_properties(name, category, estimated_value, property_number), dfp_beneficiaries(full_name, relationship, date_of_birth)"
          )
          .eq("succession_record_id", ver.succession_record_id),
        supabase
          .from("dfp_properties")
          .select("id, name, category, estimated_value, location, ownership_type, status, property_number")
          .eq("owner_id", planData.owner_id),
        supabase.from("dfp_family_members").select("id, full_name, relationship_type").eq("owner_id", planData.owner_id),
      ]);
      setOwner(ownerRpcRes.data);
      setAllocations((allocRes.data as any) ?? []);
      setProperties(propsRes.data ?? []);
      setFamilyMembers(familyRes.data ?? []);

      const propertyIds = (propsRes.data ?? []).map((p) => p.id);
      if (propertyIds.length > 0) {
        const { data: docsData } = await supabase
          .from("dfp_property_documents")
          .select("id, property_id, file_name, category, file_path")
          .in("property_id", propertyIds);
        setDocuments(docsData ?? []);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase, params.id]);

  const declarationTexts =
    role === "legal"
      ? [
          sw
            ? "Nimepitia kumbukumbu hii ya urithi kwa ajili ya uzingatiaji wa kisheria na sheria husika za mali na urithi."
            : "I have reviewed this succession record for legal soundness and compliance with applicable succession and property law.",
        ]
      : role === "leader"
      ? [
          sw ? "Nimepitia taarifa zilizotolewa kwenye ombi hili la urithi." : "I have reviewed the information provided in this succession request.",
          sw
            ? "Nina mamlaka ya kutoa uthibitisho huu kwa nafasi yangu rasmi kama Kiongozi wa Serikali za Mitaa."
            : "I am authorized to provide this verification in my official capacity as a Local Government Leader.",
          sw ? "Taarifa hii inaonyesha uelewa wangu bora na kumbukumbu rasmi za jamii." : "The information reflects my best knowledge and official community records.",
          sw
            ? "Naelewa kuwa uthibitisho wa uongo unaweza kusababisha madhara ya kisheria chini ya sheria za Tanzania."
            : "I understand that false verification may result in legal consequences under the laws of Tanzania.",
          sw ? "Sina maslahi binafsi au ya kifedha katika suala hili la urithi." : "I have no personal or financial interest in this succession matter.",
        ]
      : [
          sw ? "Ninaifahamu familia hii binafsi." : "I personally know the family.",
          sw ? "Naamini taarifa zilizoorodheshwa ni sahihi kwa uelewa wangu bora." : "I believe the listed information is accurate to the best of my knowledge.",
          sw
            ? "Naelewa kuwa uthibitisho wa uongo unaweza kuwa na madhara ya kisheria chini ya sheria za Tanzania."
            : "I understand that false verification may carry legal consequences under the laws of Tanzania.",
          sw ? "Sina mgongano wowote wa kimaslahi kwenye suala hili." : "I have no conflict of interest in this matter.",
        ];

  useEffect(() => {
    setDeclarations(new Array(declarationTexts.length).fill(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role]);

  function toggleRiskFlag(key: string) {
    setRiskFlags((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  }

  async function decide(decision: "approved" | "rejected") {
    setError(null);
    setMissingDeclarations([]);

    if (decision === "rejected" && !comment.trim()) {
      setError(sw ? "Tafadhali eleza kwa nini unakataa kumbukumbu hii." : "Please explain why you're rejecting this record.");
      return;
    }

    if (decision === "approved") {
      const missing = declarationTexts.filter((_, i) => !declarations[i]);
      if (missing.length > 0) {
        setMissingDeclarations(missing);
        setError(
          sw
            ? `Imezuiwa kuidhinishwa. Vipengele vilivyokosekana: ${missing.length}`
            : `Approval blocked. Missing items: ${missing.length}`
        );
        declarationsRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
        console.error("[VerificationReview] approval blocked: missing declarations", { role, verificationId: params.id, missing });
        return;
      }
      if (documents.length === 0) {
        setError(
          sw
            ? "Hakuna hati zinazoambatana zilizopakiwa. Omba hati kabla ya kuidhinisha."
            : "No supporting documents uploaded. Request supporting documents before approval."
        );
        console.error("[VerificationReview] approval blocked: zero documents", { role, verificationId: params.id, recordId: plan?.id });
        return;
      }
      if (!signatureData) {
        setError(sw ? "Tafadhali weka sahihi yako kabla ya kuidhinisha." : "Please provide your signature before approving.");
        console.error("[VerificationReview] approval blocked: no signature", { role, verificationId: params.id });
        return;
      }
    }

    setLoading(true);
    const payload: Record<string, any> = {
      decision,
      comment: decision === "rejected" ? `[${rejectReasonCategory}] ${comment}` : comment || null,
      decided_at: new Date().toISOString(),
      device_info: typeof navigator !== "undefined" ? navigator.userAgent : null,
      signature_data: decision === "approved" ? signatureData : null,
    };
    if (role === "witness") {
      payload.confidence_level = confidence || null;
    }
    if (role === "leader") {
      payload.community_knowledge = communityKnowledge || null;
      payload.known_disputes = knownDisputes || null;
      payload.resides_in_jurisdiction = residesInJurisdiction || null;
      payload.risk_flags = riskFlags.length > 0 ? riskFlags : null;
    }
    console.info("[VerificationReview] submitting decision", {
      role,
      verificationId: params.id,
      recordId: plan?.id,
      decision,
      allocationCount: allocations.length,
      propertyCount: properties.length,
      documentCount: documents.length,
    });
    const { error } = await supabase.from("dfp_verifications").update(payload).eq("id", params.id);
    setLoading(false);
    if (error) {
      console.error("[VerificationReview] decision update failed", { role, verificationId: params.id, payload, error });
      setError(sw ? "Imeshindikana kuhifadhi uamuzi wako. Jaribu tena." : "We couldn't save your decision. Please try again.");
      return;
    }
    setJustDecided(decision);
  }

  async function saveLateSignature() {
    if (!lateSignature) return;
    setSavingLateSignature(true);
    const { error } = await supabase.from("dfp_verifications").update({ signature_data: lateSignature }).eq("id", params.id);
    setSavingLateSignature(false);
    if (error) {
      console.error("[VerificationReview] failed to save late signature", { verificationId: params.id, error });
      return;
    }
    setLateSignatureSaved(true);
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
        <p className="text-sm text-neutralDark">{sw ? "Inapakia…" : "Loading…"}</p>
      </DashboardShell>
    );
  }

  const dashboardHref = role === "witness" ? "/witness/dashboard" : role === "leader" ? "/leader/dashboard" : "/legal/dashboard";

  if (justDecided) {
    return (
      <DashboardShell role={role}>
        <div className="max-w-xl">
          <div className="card text-center py-10">
            <div className="mx-auto mb-4 w-14 h-14 rounded-full bg-green-50 flex items-center justify-center">
              <CheckCircle2 size={28} className="text-secondary" aria-hidden="true" />
            </div>
            <h1 className="text-xl font-semibold text-primary mb-2">
              {sw ? "Uthibitisho Umetumwa" : "Verification Submitted"}
            </h1>
            <dl className="text-sm border border-gray-300 divide-y divide-gray-200 text-left mb-6 mt-6">
              <div className="flex justify-between px-4 py-2">
                <dt className="text-inkSoft">{sw ? "Uamuzi" : "Decision"}</dt>
                <dd className="font-medium text-ink">
                  <StatusBadge status={justDecided} />
                </dd>
              </div>
              <div className="flex justify-between px-4 py-2">
                <dt className="text-inkSoft">{sw ? "Muda" : "Timestamp"}</dt>
                <dd className="font-medium text-ink">{new Date().toLocaleString()}</dd>
              </div>
            </dl>
            <p className="text-sm text-inkSoft mb-6">
              {justDecided === "approved"
                ? sw
                  ? "Kumbukumbu itaendelea hatua inayofuata ya uthibitishaji."
                  : "The record will proceed to the next verification stage."
                : sw
                ? "Mmiliki ataarifiwa kuhusu uamuzi wako ili afanye masahihisho."
                : "The owner will be notified of your decision so they can make corrections."}
            </p>
            <div className="flex items-center justify-center gap-3">
              <Link href={dashboardHref} className="btn-primary">
                {sw ? "Rudi Dashibodi" : "Return to Dashboard"}
              </Link>
            </div>
          </div>
        </div>
      </DashboardShell>
    );
  }

  const alreadyDecided = verification.decision !== "pending";
  const familyCounts = familyMembers.reduce<Record<string, number>>((acc, m) => {
    acc[m.relationship_type] = (acc[m.relationship_type] ?? 0) + 1;
    return acc;
  }, {});
  const allocatedBeneficiaryNames = new Set(allocations.map((a) => a.dfp_beneficiaries?.full_name).filter(Boolean));
  const unallocatedFamilyMembers = familyMembers.filter((m) => !allocatedBeneficiaryNames.has(m.full_name));

  const totalPropertyValue = properties.reduce((sum, p) => sum + (Number(p.estimated_value) || 0), 0);
  const categoryTotals = properties.reduce<Record<string, number>>((acc, p) => {
    acc[p.category] = (acc[p.category] ?? 0) + 1;
    return acc;
  }, {});

  const allocationsByProperty = allocations.reduce<Record<string, Allocation[]>>((acc, a) => {
    (acc[a.property_id] ??= []).push(a);
    return acc;
  }, {});
  const hasMinorBeneficiary = allocations.some((a) => isMinorDob(a.dfp_beneficiaries?.date_of_birth));


  return (
    <DashboardShell role={role}>
      <div className="max-w-3xl">
        {usingReportSnapshot && (
          <div className="bg-blue-50 border border-primary text-primary text-sm px-3 py-2 mb-4 flex items-center gap-2">
            <FileText size={16} aria-hidden="true" />
            {sw
              ? `Unaangalia Ripoti Rasmi ya Ukaguzi iliyotengenezwa saa ${new Date(plan.report_generated_at).toLocaleString()}. Mabadiliko yoyote ya mmiliki baada ya wakati huu hayaonekani hapa.`
              : `You are viewing the official Review Report generated at ${new Date(plan.report_generated_at).toLocaleString()}. Any changes the owner makes after this point are not reflected here.`}
          </div>
        )}
        {verification?.verifier_id && (
          <div className="mb-4">
            <VerifierBadge userId={verification.verifier_id} />
          </div>
        )}
        {/* Case Summary */}
        <div className="card mb-6">
          <div className="flex items-center justify-between mb-3">
            <h1 className="text-xl font-semibold text-primary">{plan.title}</h1>
            <StatusBadge status={plan.status} />
          </div>
          {plan.instructions && <p className="text-sm text-neutralDark mb-3">{plan.instructions}</p>}
          <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-inkSoft border-t border-gray-200 pt-3">
            <span>{sw ? "Mmiliki" : "Owner"}: <strong className="text-ink">{owner?.full_name ?? "—"}</strong></span>
            <span>
              {sw ? "Imewasilishwa" : "Submitted"}:{" "}
              <strong className="text-ink">{plan.submitted_at ? new Date(plan.submitted_at).toLocaleDateString() : "—"}</strong>
            </span>
          </div>
          <div className="mt-4">
            <VerificationTimeline status={plan.status} reportGenerated={!!plan.report_generated_at} />
          </div>
        </div>

        {/* Owner Information */}
        <div className="card mb-6">
          <h2 className="font-semibold text-primary mb-3 text-sm uppercase tracking-wide">{sw ? "Taarifa za Mmiliki" : "Owner Information"}</h2>
          <dl className="text-sm space-y-1">
            <div className="flex justify-between"><dt className="text-inkSoft">{sw ? "Jina Kamili" : "Full Name"}</dt><dd className="text-ink font-medium">{owner?.full_name ?? "—"}</dd></div>
            <div className="flex justify-between"><dt className="text-inkSoft">{sw ? "Namba ya NIDA" : "National ID"}</dt><dd className="text-ink">{owner?.national_id ?? (sw ? "Haijawekwa" : "Not provided")}</dd></div>
            <div className="flex justify-between"><dt className="text-inkSoft">{sw ? "Namba ya Simu" : "Phone Number"}</dt><dd className="text-ink">{owner?.phone_number ?? "—"}</dd></div>
          </dl>
        </div>

        {/* Family Overview */}
        <div className="card mb-6">
          <h2 className="font-semibold text-primary mb-3 text-sm uppercase tracking-wide">{sw ? "Muhtasari wa Familia" : "Family Overview"}</h2>
          <div className="flex flex-wrap gap-4 mb-3">
            {Object.entries(familyCounts).map(([rel, count]) => (
              <div key={rel} className="text-sm">
                <span className="capitalize text-inkSoft">{rel}</span>: <strong className="text-ink">{count}</strong>
              </div>
            ))}
            {familyMembers.length === 0 && <p className="text-sm text-inkSoft">{sw ? "Hakuna wanafamilia waliosajiliwa." : "No family members recorded."}</p>}
          </div>
          {unallocatedFamilyMembers.length > 0 && (
            <div className="bg-amber-50 border border-amber-700 text-amber-800 text-sm px-3 py-2">
              <p className="font-medium mb-1">
                {sw ? "Baadhi ya wanafamilia hawajapewa sehemu ya mali kwenye kumbukumbu hii." : "Some family members have not been allocated a share in this record."}
              </p>
              <ul className="list-disc pl-4">
                {unallocatedFamilyMembers.map((m) => (
                  <li key={m.id}>{m.full_name} ({m.relationship_type})</li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Property Summary */}
        <div className="card mb-6">
          <h2 className="font-semibold text-primary mb-3 text-sm uppercase tracking-wide">{sw ? "Muhtasari wa Mali" : "Property Summary"}</h2>
          <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm mb-3">
            <span>{sw ? "Jumla ya Mali" : "Total Properties"}: <strong className="text-ink">{properties.length}</strong></span>
            <span>{sw ? "Thamani ya Jumla" : "Total Estimated Value"}: <strong className="text-ink">TZS {totalPropertyValue.toLocaleString()}</strong></span>
          </div>
          <div className="flex flex-wrap gap-4 text-sm text-inkSoft mb-4">
            {Object.entries(categoryTotals).map(([cat, count]) => (
              <span key={cat} className="capitalize">{cat}: <strong className="text-ink">{count}</strong></span>
            ))}
          </div>
          <div className="border border-gray-300 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-inkSoft border-b border-gray-300 bg-neutralLight">
                  <th className="py-2 px-3 font-medium">{sw ? "Mali" : "Property"}</th>
                  <th className="py-2 px-3 font-medium">{sw ? "Aina" : "Category"}</th>
                  <th className="py-2 px-3 font-medium">{sw ? "Eneo" : "Location"}</th>
                  <th className="py-2 px-3 font-medium">{sw ? "Thamani" : "Value"}</th>
                  <th className="py-2 px-3 font-medium">{sw ? "Hati" : "Docs"}</th>
                </tr>
              </thead>
              <tbody>
                {properties.map((p) => (
                  <tr key={p.id} className="border-b border-gray-200 last:border-0">
                    <td className="py-2 px-3 font-medium text-ink">{p.name}</td>
                    <td className="py-2 px-3 text-inkSoft capitalize">{p.category}</td>
                    <td className="py-2 px-3 text-inkSoft">{p.location ?? "—"}</td>
                    <td className="py-2 px-3 text-inkSoft whitespace-nowrap">
                      {p.estimated_value ? `TZS ${Number(p.estimated_value).toLocaleString()}` : "—"}
                    </td>
                    <td className="py-2 px-3 text-inkSoft">{documents.filter((d) => d.property_id === p.id).length}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Leader-only: Property Location Review */}
        {role === "leader" && (
          <div className="card mb-6">
            <h2 className="font-semibold text-primary mb-3 text-sm uppercase tracking-wide">{sw ? "Mapitio ya Eneo la Mali" : "Property Location Review"}</h2>
            <div className="space-y-4">
              {properties.map((p) => (
                <div key={p.id} className="border-b border-gray-200 last:border-0 pb-3 last:pb-0">
                  <p className="text-sm font-medium text-ink">{p.name}</p>
                  <p className="text-xs text-inkSoft">
                    {sw ? "Eneo" : "Location"}: {p.location ?? "—"} · {sw ? "Umiliki" : "Ownership"}: {p.ownership_type ?? "—"}
                  </p>
                </div>
              ))}
              {properties.length === 0 && <p className="text-sm text-inkSoft">{sw ? "Hakuna mali zilizosajiliwa." : "No properties registered."}</p>}
            </div>
          </div>
        )}

        {/* Proposed Distribution */}
        <div className="card mb-6">
          <h2 className="font-semibold text-primary mb-3 text-sm uppercase tracking-wide">{sw ? "Ugawaji Uliopendekezwa" : "Proposed Distribution"}</h2>
          {hasMinorBeneficiary && (
            <p className="text-sm text-amber-800 bg-amber-50 border border-amber-700 px-3 py-2 mb-3">
              {sw ? "Kuna mnufaika mchanga (chini ya miaka 18) kwenye ugawaji huu." : "This distribution includes a minor beneficiary (under 18)."}
            </p>
          )}
          {Object.entries(allocationsByProperty).map(([pid, rows]) => {
            const prop = properties.find((p) => p.id === pid) ?? rows[0]?.dfp_properties;
            const total = rows.reduce((sum, r) => sum + (Number(r.share_percentage) || 0), 0);
            return (
              <div key={pid} className="mb-4">
                <p className="text-sm font-medium text-ink flex justify-between border-b border-gray-300 pb-1 mb-1">
                  <span>{(prop as any)?.name}</span>
                  <span className="text-inkSoft">
                    {(prop as any)?.estimated_value ? `TZS ${Number((prop as any).estimated_value).toLocaleString()}` : "—"}
                  </span>
                </p>
                {rows.map((r) => (
                  <p key={r.id} className="text-sm text-inkSoft flex justify-between pl-3">
                    <span>
                      {r.dfp_beneficiaries?.full_name} ({r.dfp_beneficiaries?.relationship})
                      {isMinorDob(r.dfp_beneficiaries?.date_of_birth) ? ` — ${sw ? "Mchanga" : "Minor"}` : ""}
                    </span>
                    <span>{r.share_percentage}%</span>
                  </p>
                ))}
                <p className={`text-xs mt-1 pl-3 ${total === 100 ? "text-secondary" : "text-danger"}`}>
                  {sw ? "Jumla" : "Total"}: {total}% {total === 100 ? "✓" : sw ? "(lazima iwe 100%)" : "(must total 100%)"}
                </p>
              </div>
            );
          })}
          {allocations.length === 0 && <p className="text-sm text-inkSoft">{sw ? "Hakuna ugawaji uliowekwa." : "No allocations recorded."}</p>}
        </div>

        {/* Supporting Documents */}
        <div className="card mb-6">
          <h2 className="font-semibold text-primary mb-3 text-sm uppercase tracking-wide">{sw ? "Hati Zinazoambatana" : "Supporting Documents"}</h2>
          {documents.length === 0 ? (
            <p className="text-sm text-inkSoft">{sw ? "Hakuna hati zilizopakiwa." : "No documents uploaded."}</p>
          ) : (
            <div className="border border-gray-300 divide-y divide-gray-200">
              {documents.map((d) => (
                <div key={d.id} className="flex items-center justify-between px-3 py-2 text-sm">
                  <span className="flex items-center gap-2 text-ink">
                    <FileText size={16} className="text-inkSoft shrink-0" aria-hidden="true" />
                    {d.file_name}
                    <span className="text-xs text-inkSoft">({d.category ?? "—"})</span>
                  </span>
                  <a
                    href={d.file_path}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-primary border border-primary px-2"
                    style={{ minHeight: 30 }}
                  >
                    <Eye size={14} aria-hidden="true" /> {sw ? "Tazama" : "View"}
                  </a>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Legal role: existing flag flow, unchanged */}
        {role === "legal" && (
          <div className="card mb-6">
            <h2 className="font-semibold text-primary mb-3 text-sm uppercase tracking-wide">Flag a Compliance Issue</h2>
            {flagSubmitted && <p className="text-sm text-secondary mb-3">Issue flagged. Visible on your Compliance Flags queue.</p>}
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
            <p className="text-sm text-neutralDark mb-2">{sw ? "Tayari umewasilisha uamuzi:" : "You already submitted a decision:"}</p>
            <StatusBadge status={verification.decision} />
            {verification.comment && <p className="text-sm text-neutralDark mt-3">&quot;{verification.comment}&quot;</p>}

            {verification.decision === "approved" && !verification.signature_data && (
              <div className="mt-4 pt-4 border-t border-gray-200">
                {lateSignatureSaved ? (
                  <p className="text-sm text-secondary font-medium">
                    {sw ? "✓ Sahihi yako imehifadhiwa. Itaonekana kwenye cheti." : "✓ Your signature has been saved. It will appear on the certificate."}
                  </p>
                ) : (
                  <>
                    <p className="text-sm font-medium text-ink mb-2">
                      {sw
                        ? "Uliidhinisha kabla ya kipengele cha sahihi kuongezwa. Ongeza sahihi yako sasa ili ionekane kwenye cheti."
                        : "You approved before signature capture was added. Add your signature now so it appears on the certificate."}
                    </p>
                    <SignaturePad onChange={setLateSignature} />
                    <button
                      type="button"
                      onClick={saveLateSignature}
                      disabled={!lateSignature || savingLateSignature}
                      className="btn-primary text-sm mt-2"
                    >
                      {savingLateSignature ? (sw ? "Inahifadhi…" : "Saving…") : sw ? "Hifadhi Sahihi" : "Save Signature"}
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        ) : (
          <>
            {/* Witness confidence / Leader community assessment */}
            {role === "witness" && (
              <div className="card mb-6">
                <h2 className="font-semibold text-primary mb-3 text-sm uppercase tracking-wide">{sw ? "Kiwango cha Uhakika" : "Witness Confidence Level"}</h2>
                <p className="text-sm text-inkSoft mb-2">{sw ? "Una uhakika kiasi gani na uthibitisho huu?" : "How confident are you in this verification?"}</p>
                <div className="space-y-2">
                  {[
                    { v: "very_confident", en: "Very Confident — I know this family personally and all details are accurate", sw: "Nina Uhakika Sana — Ninaifahamu familia hii binafsi na taarifa zote ni sahihi" },
                    { v: "confident", en: "Confident — I know the family and believe the information is generally correct", sw: "Nina Uhakika — Ninaifahamu familia na naamini taarifa ni sahihi kwa ujumla" },
                    { v: "not_sure", en: "Not Sure — I have limited knowledge of this family's affairs", sw: "Sina Uhakika — Nina uelewa mdogo wa mambo ya familia hii" },
                    { v: "need_more_info", en: "Need More Information — I require additional documentation", sw: "Nahitaji Taarifa Zaidi — Nahitaji hati za ziada" },
                    { v: "suspected_fraud", en: "Suspected Fraud — I believe there may be deliberate misrepresentation", sw: "Nashuku Utapeli — Naamini kunaweza kuwa na upotoshaji wa makusudi" },
                  ].map((opt) => (
                    <label key={opt.v} className="flex items-center gap-2 text-sm cursor-pointer">
                      <input type="radio" name="confidence" checked={confidence === opt.v} onChange={() => setConfidence(opt.v)} />
                      {sw ? opt.sw : opt.en}
                    </label>
                  ))}
                </div>
              </div>
            )}

            {role === "leader" && (
              <>
                <div className="card mb-6 space-y-4">
                  <h2 className="font-semibold text-primary text-sm uppercase tracking-wide">{sw ? "Tathmini ya Maarifa ya Jamii" : "Community Knowledge Assessment"}</h2>
                  <div>
                    <p className="text-sm text-inkSoft mb-1">{sw ? "Unaifahamu familia hii kiasi gani?" : "How well do you know this family?"}</p>
                    {[
                      { v: "very_well", en: "Very Well — I know them personally for many years", sw: "Sana — Ninawafahamu binafsi kwa miaka mingi" },
                      { v: "well", en: "Well — I am familiar with them", sw: "Vizuri — Ninawafahamu" },
                      { v: "limited", en: "Limited Knowledge — I have basic knowledge", sw: "Kidogo — Nina uelewa wa kawaida" },
                      { v: "not_known", en: "Not Known — I do not know this family", sw: "Sijui — Siwafahamu familia hii" },
                    ].map((opt) => (
                      <label key={opt.v} className="flex items-center gap-2 text-sm cursor-pointer">
                        <input type="radio" name="community_knowledge" checked={communityKnowledge === opt.v} onChange={() => setCommunityKnowledge(opt.v)} />
                        {sw ? opt.sw : opt.en}
                      </label>
                    ))}
                  </div>
                  <div>
                    <p className="text-sm text-inkSoft mb-1">{sw ? "Je, kuna migogoro inayojulikana?" : "Are there known disputes?"}</p>
                    {[
                      { v: "none", en: "No known disputes", sw: "Hakuna mgogoro unaojulikana" },
                      { v: "minor", en: "Minor dispute exists", sw: "Kuna mgogoro mdogo" },
                      { v: "active", en: "Active dispute exists", sw: "Kuna mgogoro unaoendelea" },
                      { v: "multiple", en: "Multiple disputes reported", sw: "Migogoro mingi imeripotiwa" },
                    ].map((opt) => (
                      <label key={opt.v} className="flex items-center gap-2 text-sm cursor-pointer">
                        <input type="radio" name="known_disputes" checked={knownDisputes === opt.v} onChange={() => setKnownDisputes(opt.v)} />
                        {sw ? opt.sw : opt.en}
                      </label>
                    ))}
                  </div>
                  <div>
                    <p className="text-sm text-inkSoft mb-1">{sw ? "Je, familia hii inaishi kwenye eneo lako?" : "Does this family reside in your jurisdiction?"}</p>
                    {[
                      { v: "yes", en: "Yes — They live in this ward", sw: "Ndiyo — Wanaishi kata hii" },
                      { v: "partially", en: "Partially — Some members live here", sw: "Kiasi — Baadhi wanaishi hapa" },
                      { v: "no", en: "No — They live elsewhere", sw: "Hapana — Wanaishi mahali pengine" },
                    ].map((opt) => (
                      <label key={opt.v} className="flex items-center gap-2 text-sm cursor-pointer">
                        <input type="radio" name="resides" checked={residesInJurisdiction === opt.v} onChange={() => setResidesInJurisdiction(opt.v)} />
                        {sw ? opt.sw : opt.en}
                      </label>
                    ))}
                  </div>
                </div>

                <div className="card mb-6">
                  <h2 className="font-semibold text-primary mb-3 text-sm uppercase tracking-wide">{sw ? "Alama za Hatari" : "Risk Flags"}</h2>
                  <div className="space-y-1.5">
                    {RISK_FLAG_OPTIONS.map((opt) => (
                      <label key={opt.key} className="flex items-center gap-2 text-sm cursor-pointer">
                        <input type="checkbox" checked={riskFlags.includes(opt.key)} onChange={() => toggleRiskFlag(opt.key)} />
                        {sw ? opt.sw : opt.en}
                      </label>
                    ))}
                  </div>
                </div>
              </>
            )}

            <div className="card mb-6">
              <h2 className="font-semibold text-primary mb-2 text-sm uppercase tracking-wide">
                {role === "leader" ? (sw ? "Maoni Rasmi" : "Official Comment") : sw ? "Maelezo ya Shahidi" : "Witness Notes"}
              </h2>
              <textarea
                className="input-field"
                rows={4}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder={sw ? "Toa maelezo, mashaka, au taarifa za ziada…" : "Provide any information, concerns, or observations…"}
              />
            </div>

            <div ref={declarationsRef} className="card mb-6 space-y-2">
              <h2 className="font-semibold text-primary text-sm uppercase tracking-wide">{sw ? "Tamko la Kisheria" : role === "leader" ? "Official Declaration" : "Legal Declaration"}</h2>
              {declarationTexts.map((text, i) => {
                const isMissing = missingDeclarations.includes(text);
                return (
                  <label
                    key={i}
                    className={`flex items-start gap-2 text-sm cursor-pointer p-1 ${isMissing ? "bg-red-50 border border-danger" : ""}`}
                  >
                    <input
                      type="checkbox"
                      checked={declarations[i] ?? false}
                      onChange={(e) =>
                        setDeclarations((prev) => {
                          const next = [...prev];
                          next[i] = e.target.checked;
                          setMissingDeclarations((miss) => miss.filter((m) => m !== text));
                          return next;
                        })
                      }
                      className="mt-0.5"
                    />
                    <span>{text}</span>
                  </label>
                );
              })}
              {missingDeclarations.length > 0 && (
                <div role="alert" className="bg-white border border-danger text-danger text-sm px-3 py-2">
                  <p className="font-medium mb-1">{sw ? "Imezuiwa kuidhinishwa. Vipengele vilivyokosekana:" : "Approval blocked. Missing items:"}</p>
                  <ul className="space-y-0.5">
                    {missingDeclarations.map((m, i) => (
                      <li key={i}>☐ {m}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <div className="card space-y-4">
              <h2 className="font-semibold text-primary text-sm uppercase tracking-wide">{sw ? "Uamuzi Wako" : "Your Decision"}</h2>
              {error && <div role="alert" className="bg-white text-red-800 border border-red-800 text-sm px-3 py-2">{error}</div>}

              {documents.length === 0 && (
                <div className="bg-amber-50 border border-amber-700 text-amber-800 text-sm px-3 py-2">
                  {sw
                    ? "Hakuna hati zinazoambatana zilizopakiwa. Omba hati kabla ya kuidhinisha."
                    : "No supporting documents uploaded. Request supporting documents before approval."}
                </div>
              )}

              <div>
                <label className="label">{sw ? "Aina ya sababu (ikikataliwa)" : "Reason category (if rejecting)"}</label>
                <select className="input-field" value={rejectReasonCategory} onChange={(e) => setRejectReasonCategory(e.target.value)}>
                  <option value="correction">{sw ? "Marekebisho yanahitajika" : "Correction needed"}</option>
                  <option value="more_documents">{sw ? "Hati zaidi zinahitajika" : "More documents needed"}</option>
                  <option value="investigation">{sw ? "Uchunguzi unahitajika" : "Investigation needed"}</option>
                  <option value="fraud">{sw ? "Utapeli unashukiwa" : "Suspected fraud"}</option>
                  <option value="other">{sw ? "Nyingine" : "Other"}</option>
                </select>
              </div>

              <div>
                <label className="label">{sw ? "Sahihi Yako (inahitajika kuidhinisha)" : "Your Signature (required to approve)"}</label>
                <SignaturePad onChange={setSignatureData} />
              </div>

              <div className="flex gap-3">
                <button disabled={loading || documents.length === 0} onClick={() => decide("approved")} className="btn-secondary">
                  {loading ? (sw ? "Inatuma…" : "Submitting…") : sw ? "Idhinisha" : "Approve"}
                </button>
                <button disabled={loading} onClick={() => decide("rejected")} className="btn-danger">
                  {sw ? "Kataa" : "Reject"}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </DashboardShell>
  );
}
