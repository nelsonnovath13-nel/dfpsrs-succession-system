"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import DashboardShell from "@/components/DashboardShell";
import { PageNav } from "@/components/PageNav";
import { Stepper } from "@/components/Stepper";
import { PageGuide } from "@/components/PageGuide";
import { createClient } from "@/lib/supabase/client";
import { useLanguage } from "@/lib/i18n";
import { withTimeout } from "@/lib/withTimeout";

const SUCCESSION_GUIDE = {
  purpose: { en: "Connect your properties to your beneficiaries and state exactly who inherits what.", sw: "Kuunganisha mali zako na wanufaika na kueleza hasa nani anarithi nini." },
  why: {
    en: "This record is what witnesses, a local leader, and (if assigned) a legal officer will review and verify before it becomes an official succession document.",
    sw: "Kumbukumbu hii ndiyo watakayopitia mashahidi, kiongozi wa mtaa, na (ikiwa amepangiwa) afisa sheria kabla haijawa hati rasmi ya urithi.",
  },
  example: { en: "House A → Rahima 100%. Shop B → Rahima 50%, Amina 50%.", sw: "Nyumba A → Rahima 100%. Duka B → Rahima 50%, Amina 50%." },
  mistakes: {
    en: "Splitting one property's shares so they don't add up to exactly 100% — each property must total 100% on its own.",
    sw: "Kugawa asilimia za mali moja bila kufikia 100% kamili — kila mali lazima ifikie 100% peke yake.",
  },
  nextStep: { en: "After submitting, your witnesses and local leader will be notified to review the record.", sw: "Baada ya kuwasilisha, mashahidi wako na kiongozi wa mtaa wataarifiwa kupitia kumbukumbu hiyo." },
};

type Property = { id: string; name: string; category: string; estimated_value: number | null };
type Beneficiary = { id: string; full_name: string; relationship: string; linked_user_id: string | null; date_of_birth?: string | null };
type Profile = { id: string; full_name: string };
type AllocRow = { id: string; propertyId: string; beneficiaryId: string; share: string; notes: string };

const STEP_LABELS_SW = ["Taarifa za Kumbukumbu", "Ugawaji wa Mali", "Mashahidi na Uongozi", "Pitia na Thibitisha"];
const STEP_LABELS_EN = ["Record Details", "Property Allocation", "Witnesses & Officials", "Review & Confirm"];

let allocRowCounter = 0;
function newAllocRowId() {
  allocRowCounter += 1;
  return `alloc-${Date.now()}-${allocRowCounter}`;
}

// Postgres/Supabase errors (constraint names, FK details) are meaningless to a family filling
// out a succession record -- translate them into something a non-technical person can act on,
// while still logging the raw detail to the console for debugging.
function toFriendlyError(raw: string | undefined | null, sw: boolean): string {
  const msg = (raw ?? "").toLowerCase();
  if (!msg) return sw ? "Hitilafu isiyotarajiwa. Jaribu tena." : "An unexpected error occurred. Please try again.";
  if (msg.includes("foreign key") || msg.includes("constraint") || msg.includes("violates")) {
    return sw
      ? "Imeshindikana kuhifadhi kumbukumbu kwa sababu ya hitilafu ya mfumo. Timu yetu imearifiwa; tafadhali jaribu tena."
      : "We couldn't save this record because of a system error. Our team has been notified — please try again.";
  }
  if (msg.includes("duplicate key") || msg.includes("already exists")) {
    return sw ? "Kumbukumbu hii tayari ipo." : "This record already exists.";
  }
  if (msg.includes("timeout") || msg.includes("timed out")) {
    return sw
      ? "Muunganisho ulichelewa sana. Tafadhali angalia mtandao wako na ujaribu tena."
      : "The connection took too long. Please check your internet and try again.";
  }
  if (msg.includes("permission") || msg.includes("policy") || msg.includes("rls")) {
    return sw
      ? "Huna ruhusa ya kufanya hatua hii. Wasiliana na msaada kama hii si sahihi."
      : "You don't have permission to do this. Contact support if this seems wrong.";
  }
  return raw as string;
}

function isMinorDob(dob: string | null | undefined): boolean {
  if (!dob) return false;
  const birth = new Date(dob);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age < 18;
}

export default function NewSuccessionPlanPage() {
  const supabase = createClient();
  const router = useRouter();
  const { lang } = useLanguage();
  const sw = lang === "sw";

  const [properties, setProperties] = useState<Property[]>([]);
  const [beneficiaries, setBeneficiaries] = useState<Beneficiary[]>([]);
  const [witnessOptions, setWitnessOptions] = useState<Profile[]>([]);
  const [leaderOptions, setLeaderOptions] = useState<Profile[]>([]);
  const [legalOptions, setLegalOptions] = useState<Profile[]>([]);
  const [dataLoading, setDataLoading] = useState(true);

  const [step, setStep] = useState(0);
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  const [title, setTitle] = useState("");
  const [instructions, setInstructions] = useState("");

  const [allocRows, setAllocRows] = useState<AllocRow[]>([]);

  const [selectedWitnesses, setSelectedWitnesses] = useState<string[]>([]);
  const [selectedLeader, setSelectedLeader] = useState("");
  const [selectedLegal, setSelectedLegal] = useState("");

  const [confirmAccurate, setConfirmAccurate] = useState(false);
  const [confirmResponsibility, setConfirmResponsibility] = useState(false);
  const [confirmLimitations, setConfirmLimitations] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [doneRecord, setDoneRecord] = useState<{ id: string; title: string } | null>(null);

  // The 10-stage realistic workflow requires a Generate Review Report step, producing a
  // frozen snapshot, before Submit For Verification is even allowed -- both here (disabling
  // the button) and on the server (dfp_submit_succession_record now rejects otherwise).
  const [recordId, setRecordId] = useState<string | null>(null);
  const [reportSnapshot, setReportSnapshot] = useState<any>(null);
  const [generatingReport, setGeneratingReport] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [loadError, setLoadError] = useState<string | null>(null);

  // Distinguishes "genuinely timed out" from "the query came back with a real error" or
  // "came back fine but empty" -- silently treating all three the same (as an earlier
  // version did) is what made a slow/failed query look identical to "you truly have zero
  // properties," which was actively misleading.
  async function raceWithTimeout<T>(queryPromise: PromiseLike<{ data: T | null; error: any }>, ms: number) {
    let timedOut = false;
    const timeout = new Promise<"TIMEOUT">((resolve) => {
      setTimeout(() => {
        timedOut = true;
        resolve("TIMEOUT");
      }, ms);
    });
    const result = await Promise.race([Promise.resolve(queryPromise), timeout]);
    if (result === "TIMEOUT" || timedOut) {
      return { data: null as T | null, error: null, timedOut: true };
    }
    return { ...result, timedOut: false };
  }

  async function loadFormData() {
    setDataLoading(true);
    setLoadError(null);
    try {
      const {
        data: { user },
      } = await withTimeout(supabase.auth.getUser(), 15000, { data: { user: null } } as any);
      if (!user) {
        setLoadError(
          sw
            ? "Imeshindikana kupata kikao chako. Onyesha upya ukurasa (refresh) au ingia tena."
            : "Could not confirm your session. Refresh the page or sign in again."
        );
        return;
      }

      const [propsRes, bensRes, witnessesRes, leadersRes, legalRes] = await Promise.all([
        raceWithTimeout(supabase.from("dfp_properties").select("id, name, category, estimated_value").eq("owner_id", user.id), 15000),
        raceWithTimeout(
          supabase
            .from("dfp_beneficiaries")
            .select("id, full_name, relationship, linked_user_id, date_of_birth")
            .eq("owner_id", user.id),
          15000
        ),
        raceWithTimeout(supabase.from("dfp_profiles").select("id, full_name").eq("role", "witness"), 15000),
        raceWithTimeout(supabase.from("dfp_profiles").select("id, full_name").eq("role", "leader"), 15000),
        raceWithTimeout(supabase.from("dfp_profiles").select("id, full_name").eq("role", "legal"), 15000),
      ]);

      const failures = [propsRes, bensRes].filter((r) => r.timedOut || r.error);
      if (failures.length > 0) {
        const detail = failures.map((f) => (f.timedOut ? "timeout" : f.error?.message)).join("; ");
        setLoadError(
          sw
            ? `Imeshindikana kupakia mali/wanufaika wako (${detail}). Bonyeza "Jaribu Tena".`
            : `Could not load your properties/beneficiaries (${detail}). Click "Try Again".`
        );
      }

      setProperties(propsRes.data ?? []);
      setBeneficiaries(bensRes.data ?? []);
      setWitnessOptions(witnessesRes.data ?? []);
      setLeaderOptions(leadersRes.data ?? []);
      setLegalOptions(legalRes.data ?? []);
    } finally {
      setDataLoading(false);
    }
  }

  useEffect(() => {
    loadFormData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase]);

  function addAllocationRow() {
    setAllocRows((rows) => [...rows, { id: newAllocRowId(), propertyId: "", beneficiaryId: "", share: "", notes: "" }]);
  }
  function removeAllocationRow(id: string) {
    setAllocRows((rows) => rows.filter((r) => r.id !== id));
  }
  function updateAllocationRow(id: string, field: keyof AllocRow, value: string) {
    setAllocRows((rows) => rows.map((r) => (r.id === id ? { ...r, [field]: value } : r)));
  }
  // Evenly redistributes 100% across every row currently allocated to one property, so a
  // property split between several children doesn't force manual arithmetic (e.g. 3 heirs
  // at 33/33/34, not 33/33/33 landing on 99%).
  function splitPropertyEvenly(propertyId: string) {
    setAllocRows((rows) => {
      const ids = rows.filter((r) => r.propertyId === propertyId).map((r) => r.id);
      const n = ids.length;
      if (n === 0) return rows;
      const base = Math.floor(100 / n);
      const remainder = 100 - base * n;
      let i = 0;
      return rows.map((r) => {
        if (r.propertyId !== propertyId) return r;
        const share = base + (i === n - 1 ? remainder : 0);
        i += 1;
        return { ...r, share: String(share) };
      });
    });
  }

  const referencedPropertyIds = Array.from(new Set(allocRows.map((r) => r.propertyId).filter(Boolean)));
  const referencedBeneficiaryIds = Array.from(new Set(allocRows.map((r) => r.beneficiaryId).filter(Boolean)));

  const totalValue = properties
    .filter((p) => referencedPropertyIds.includes(p.id))
    .reduce((sum, p) => sum + (Number(p.estimated_value) || 0), 0);

  // Each property's allocated rows must sum to exactly 100% -- properties are allocated
  // independently, so a 3-way split on one property and a 100%-to-one-heir on another are both
  // valid at the same time.
  const perPropertyTotals: Record<string, number> = {};
  for (const row of allocRows) {
    if (!row.propertyId) continue;
    perPropertyTotals[row.propertyId] = (perPropertyTotals[row.propertyId] ?? 0) + (Number(row.share) || 0);
  }
  const invalidPropertyIds = referencedPropertyIds.filter((id) => perPropertyTotals[id] !== 100);
  const incompleteRow = allocRows.find((r) => !r.propertyId || !r.beneficiaryId || !r.share || Number(r.share) <= 0);

  // A witness who is also a linked beneficiary account cannot verify their own inheritance.
  const linkedBeneficiaryUserIds = new Set(
    beneficiaries.filter((b) => referencedBeneficiaryIds.includes(b.id) && b.linked_user_id).map((b) => b.linked_user_id)
  );
  const witnessConflict = witnessOptions.find((w) => selectedWitnesses.includes(w.id) && linkedBeneficiaryUserIds.has(w.id));

  const stepErrors: Record<number, string | null> = {
    0: !title.trim() ? (sw ? "Tafadhali ingiza jina la kumbukumbu" : "Please enter the record title") : null,
    1:
      allocRows.length === 0
        ? sw
          ? "Ongeza angalau mgao mmoja (Property + Beneficiary + Asilimia)"
          : "Add at least one allocation row (Property + Beneficiary + Share %)"
        : incompleteRow
        ? sw
          ? "Kamilisha safu zote: chagua mali, mnufaika, na asilimia kwa kila mgao"
          : "Complete every row: select a property, a beneficiary, and a share % for each allocation"
        : invalidPropertyIds.length > 0
        ? sw
          ? `Asilimia za mali "${properties.find((p) => p.id === invalidPropertyIds[0])?.name ?? ""}" lazima zifike 100% (sasa ni ${
              perPropertyTotals[invalidPropertyIds[0]]
            }%)`
          : `Shares for "${properties.find((p) => p.id === invalidPropertyIds[0])?.name ?? ""}" must total exactly 100% (currently ${
              perPropertyTotals[invalidPropertyIds[0]]
            }%)`
        : null,
    2:
      selectedWitnesses.length < 2
        ? sw
          ? "Lazima uchague angalau mashahidi 2"
          : "Select at least two family witnesses"
        : !selectedLeader
        ? sw
          ? "Tafadhali chagua kiongozi wa Serikali za Mitaa"
          : "Select a local government leader"
        : witnessConflict
        ? sw
          ? `${witnessConflict.full_name} ni mnufaika — hawezi kuwa shahidi`
          : `${witnessConflict.full_name} is a beneficiary — they cannot also be a witness`
        : null,
    3:
      !confirmAccurate || !confirmResponsibility || !confirmLimitations
        ? sw
          ? "Tafadhali thibitisha vipengele vyote vitatu hapo chini kabla ya kutuma"
          : "Please acknowledge all three declarations below before submitting"
        : null,
  };

  function next() {
    setTouched((t) => ({ ...t, [step]: true }));
    if (stepErrors[step]) return;
    setStep((s) => Math.min(s + 1, 3));
  }
  function back() {
    setStep((s) => Math.max(s - 1, 0));
  }

  // Stage 5 (Create Succession Plan) + Stage 6 (Generate Review Report): saves the draft
  // record and its allocations/witnesses/officials if not already saved, then generates the
  // frozen report snapshot that witnesses and the local leader will actually review.
  async function handleGenerateReport() {
    if (generatingReport) return; // guards against a double-click firing this twice
    setTouched((t) => ({ ...t, 3: true }));
    if (stepErrors[3]) return;

    setGeneratingReport(true);
    setError(null);

    let userId: string | undefined;
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setError(sw ? "Kikao chako kimeisha. Tafadhali ingia tena." : "Your session has expired. Please sign in again.");
        return;
      }
      userId = user.id;

      let activeRecordId = recordId;
      if (!activeRecordId) {
        const { data: record, error: recErr } = await supabase
          .from("dfp_succession_records")
          .insert({ owner_id: user.id, title, instructions: instructions || null })
          .select("id")
          .single();

        if (recErr || !record) {
          console.error("[succession-plans/new] record insert failed", { userId: user.id, title, error: recErr });
          setError(toFriendlyError(recErr?.message, sw));
          return;
        }
        activeRecordId = record.id;
        setRecordId(record.id);

        const allocationRows = allocRows.map((r) => ({
          succession_record_id: record.id,
          property_id: r.propertyId,
          beneficiary_id: r.beneficiaryId,
          share_percentage: Number(r.share) || 0,
          notes: r.notes || null,
        }));

        const { error: allocErr } = await supabase.from("dfp_property_allocations").insert(allocationRows);
        if (allocErr) {
          console.error("[succession-plans/new] allocation insert failed", {
            userId: user.id,
            recordId: record.id,
            allocationRows,
            error: allocErr,
          });
          setError(toFriendlyError(allocErr.message, sw));
          return;
        }

        await supabase.from("dfp_witnesses").insert(
          selectedWitnesses.map((w) => ({ succession_record_id: record.id, witness_user_id: w }))
        );
        await supabase.from("dfp_leaders").insert({
          succession_record_id: record.id,
          leader_user_id: selectedLeader,
        });
        if (selectedLegal) {
          await supabase.from("dfp_legal_officers").insert({
            succession_record_id: record.id,
            legal_officer_id: selectedLegal,
          });
        }
      }

      const { data: snapshot, error: reportErr } = await supabase.rpc("dfp_generate_succession_report", {
        p_record_id: activeRecordId,
      });
      if (reportErr) {
        console.error("[succession-plans/new] report generation failed", { userId, recordId: activeRecordId, error: reportErr });
        setError(toFriendlyError(reportErr.message, sw));
        return;
      }
      setReportSnapshot(snapshot);
    } catch (err: any) {
      console.error("[succession-plans/new] unexpected report generation failure", { userId, recordId, error: err });
      setError(toFriendlyError(err?.message, sw));
    } finally {
      setGeneratingReport(false);
    }
  }

  // Stage 7 (Submit For Verification): only reachable once a report has been generated --
  // the button itself stays disabled until reportSnapshot is set, and the server independently
  // rejects the call if report_generated_at is still null, so this cannot be bypassed.
  async function handleFinalSubmit() {
    if (submitting || !recordId || !reportSnapshot) return;
    setSubmitting(true);
    setError(null);
    const { error: submitErr } = await supabase.rpc("dfp_submit_succession_record", { p_record_id: recordId });
    setSubmitting(false);
    if (submitErr) {
      console.error("[succession-plans/new] submit rpc failed", { recordId, error: submitErr });
      setError(toFriendlyError(submitErr.message, sw));
      return;
    }
    setDoneRecord({ id: recordId, title });
  }

  const STEP_LABELS = sw ? STEP_LABELS_SW : STEP_LABELS_EN;
  const missingPrereqs = !dataLoading && (properties.length === 0 || beneficiaries.length === 0);

  return (
    <DashboardShell role="owner">
      <PageNav exitHref="/owner/succession-plans" />

      {doneRecord ? (
        <div className="max-w-2xl">
          <div
            role="progressbar"
            aria-valuenow={5}
            aria-valuemin={1}
            aria-valuemax={5}
            className="flex items-center w-full mb-6"
          >
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className={`h-2 flex-1 mx-0.5 ${i < 5 ? "bg-secondary" : "bg-gray-300"}`} />
            ))}
          </div>
          <div className="card text-center py-10">
            <div className="mx-auto mb-4 w-14 h-14 rounded-full bg-green-50 flex items-center justify-center">
              <Check size={28} className="text-secondary" aria-hidden="true" />
            </div>
            <h1 className="text-xl font-semibold text-primary mb-2">
              {sw ? "Kumbukumbu Imetumwa kwa Uhakiki!" : "Record Submitted for Verification!"}
            </h1>
            <p className="text-sm text-inkSoft mb-6">
              {sw
                ? "Kumbukumbu yako imetumwa kikamilifu kwa mashahidi na kiongozi kwa uhakiki."
                : "Your record has been sent to your witnesses and local leader for verification."}
            </p>
            <dl className="text-sm border border-gray-300 divide-y divide-gray-200 text-left mb-6">
              <div className="flex justify-between px-4 py-2">
                <dt className="text-inkSoft">{sw ? "Jina" : "Title"}</dt>
                <dd className="font-medium text-ink">{doneRecord.title}</dd>
              </div>
              <div className="flex justify-between px-4 py-2">
                <dt className="text-inkSoft">{sw ? "Mali" : "Properties"}</dt>
                <dd className="font-medium text-ink">{referencedPropertyIds.length}</dd>
              </div>
              <div className="flex justify-between px-4 py-2">
                <dt className="text-inkSoft">{sw ? "Wanufaika" : "Beneficiaries"}</dt>
                <dd className="font-medium text-ink">{referencedBeneficiaryIds.length}</dd>
              </div>
              <div className="flex justify-between px-4 py-2">
                <dt className="text-inkSoft">{sw ? "Mashahidi" : "Witnesses"}</dt>
                <dd className="font-medium text-ink">{selectedWitnesses.length}</dd>
              </div>
            </dl>
            <div className="flex items-center justify-center gap-3">
              <Link href={`/owner/succession-plans/${doneRecord.id}`} className="btn-primary">
                {sw ? "Tazama Kumbukumbu" : "View Record"}
              </Link>
              <Link href="/owner/dashboard" className="btn-outline">
                {sw ? "Nenda Dashibodi" : "Go to Dashboard"}
              </Link>
            </div>
          </div>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-xl font-semibold text-primary">
              {sw ? "Kumbukumbu Mpya za Urithi" : "New Succession Record"}
            </h1>
            <PageGuide content={SUCCESSION_GUIDE} />
          </div>

          {dataLoading ? (
            <p className="text-sm text-neutralDark mb-6">{sw ? "Inapakia…" : "Loading…"}</p>
          ) : loadError ? (
            <div role="alert" className="card mb-6 bg-white border-red-800 text-red-800 text-sm space-y-3">
              <p>{loadError}</p>
              <button type="button" onClick={() => loadFormData()} className="btn-outline text-sm">
                {sw ? "Jaribu Tena" : "Try Again"}
              </button>
            </div>
          ) : missingPrereqs ? (
            <div className="card mb-6 bg-white border-amber-700 text-amber-800 text-sm space-y-2">
              <p className="font-medium">
                {sw ? "Huwezi kuunda kumbukumbu bado." : "You can't build a record yet."}
              </p>
              {properties.length === 0 && (
                <p>
                  {sw ? "Lazima uwe na angalau mali 1 — " : "You need at least one property — "}
                  <Link href="/owner/properties/new" className="underline font-medium">
                    {sw ? "sajili mali" : "register a property"}
                  </Link>
                  .
                </p>
              )}
              {beneficiaries.length === 0 && (
                <p>
                  {sw ? "Lazima uwe na angalau mnufaika 1 — " : "You need at least one beneficiary — "}
                  <Link href="/owner/beneficiaries" className="underline font-medium">
                    {sw ? "ongeza mnufaika" : "add a beneficiary"}
                  </Link>
                  .
                </p>
              )}
              <button type="button" onClick={() => loadFormData()} className="text-xs text-primary underline mt-2">
                {sw ? "Onyesha upya (Refresh)" : "Refresh"}
              </button>
            </div>
          ) : (
            <div className="max-w-2xl">
              <Stepper steps={STEP_LABELS} currentStep={step} />

              {error && (
                <div role="alert" className="bg-white text-red-800 border border-red-800 text-sm px-3 py-2 mb-4">{error}</div>
              )}

              <div className="card">
                {step === 0 && (
                  <div className="space-y-4">
                    <h2 className="font-semibold text-primary text-sm uppercase tracking-wide">
                      {sw ? "Taarifa za Kumbukumbu" : "Record Details"}
                    </h2>
                    <div>
                      <label className="label">{sw ? "Jina la Kumbukumbu" : "Record Title"}</label>
                      <input
                        required
                        className="input-field"
                        placeholder={sw ? "mfano: Kumbukumbu ya Mali za Familia 2026" : "e.g. Family Succession Record 2026"}
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                      />
                      {touched[0] && stepErrors[0] && (
                        <p role="alert" className="text-sm text-danger mt-1">{stepErrors[0]}</p>
                      )}
                    </div>
                    <div>
                      <label className="label">{sw ? "Maelezo (hiari)" : "Instructions (optional)"}</label>
                      <textarea className="input-field" rows={3} value={instructions} onChange={(e) => setInstructions(e.target.value)} />
                    </div>
                  </div>
                )}

                {step === 1 && (
                  <div className="space-y-5">
                    <h2 className="font-semibold text-primary text-sm uppercase tracking-wide">
                      {sw ? "Ugawaji wa Mali" : "Property Allocation"}
                    </h2>
                    <p className="text-xs text-inkSoft">
                      {sw
                        ? "Kwa kila mali, chagua nani atapokea sehemu gani. Mali moja inaweza kugawiwa wanufaika wengi. Asilimia za kila mali lazima zifike 100% peke yake."
                        : "For each property, choose who receives which share. One property can be split between several beneficiaries. Each property's shares must total exactly 100% on their own."}
                    </p>

                    <div className="border border-gray-300 overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-left text-inkSoft border-b border-gray-300 bg-neutralLight">
                            <th className="py-2 px-3 font-medium">{sw ? "Mali" : "Property"}</th>
                            <th className="py-2 px-3 font-medium">{sw ? "Mnufaika" : "Beneficiary"}</th>
                            <th className="py-2 px-3 font-medium">{sw ? "Asilimia %" : "Share %"}</th>
                            <th className="py-2 px-3 font-medium">{sw ? "Thamani" : "Value"}</th>
                            <th className="py-2 px-3 font-medium">{sw ? "Maelezo" : "Notes"}</th>
                            <th className="py-2 px-3"></th>
                          </tr>
                        </thead>
                        <tbody>
                          {allocRows.length === 0 && (
                            <tr>
                              <td colSpan={6} className="py-6 px-3 text-center text-inkSoft text-sm">
                                {sw ? "Hakuna mgao bado. Bonyeza \"Ongeza Mgao\" kuanza." : "No allocations yet. Click \"Add Allocation\" to start."}
                              </td>
                            </tr>
                          )}
                          {allocRows.map((row) => {
                            const prop = properties.find((p) => p.id === row.propertyId);
                            const value = prop?.estimated_value
                              ? (Number(prop.estimated_value) * (Number(row.share) || 0)) / 100
                              : 0;
                            return (
                              <tr key={row.id} className="border-b border-gray-200 last:border-0 align-top">
                                <td className="py-2 px-3">
                                  <select
                                    className="input-field"
                                    style={{ minHeight: 40 }}
                                    value={row.propertyId}
                                    onChange={(e) => updateAllocationRow(row.id, "propertyId", e.target.value)}
                                    aria-label={sw ? "Mali" : "Property"}
                                  >
                                    <option value="">{sw ? "Chagua mali…" : "Select property…"}</option>
                                    {properties.map((p) => (
                                      <option key={p.id} value={p.id}>{p.name}</option>
                                    ))}
                                  </select>
                                </td>
                                <td className="py-2 px-3">
                                  <select
                                    className="input-field"
                                    style={{ minHeight: 40 }}
                                    value={row.beneficiaryId}
                                    onChange={(e) => updateAllocationRow(row.id, "beneficiaryId", e.target.value)}
                                    aria-label={sw ? "Mnufaika" : "Beneficiary"}
                                  >
                                    <option value="">{sw ? "Chagua mnufaika…" : "Select beneficiary…"}</option>
                                    {beneficiaries.map((b) => (
                                      <option key={b.id} value={b.id}>
                                        {b.full_name} ({b.relationship}){isMinorDob(b.date_of_birth) ? ` — ${sw ? "Mchanga" : "Minor"}` : ""}
                                      </option>
                                    ))}
                                  </select>
                                </td>
                                <td className="py-2 px-3">
                                  <input
                                    type="number"
                                    min={1}
                                    max={100}
                                    className="input-field w-20"
                                    style={{ minHeight: 40 }}
                                    value={row.share}
                                    onChange={(e) => updateAllocationRow(row.id, "share", e.target.value)}
                                    aria-label={sw ? "Asilimia" : "Share percentage"}
                                  />
                                </td>
                                <td className="py-2 px-3 text-inkSoft whitespace-nowrap">
                                  {value ? `TZS ${Math.round(value).toLocaleString()}` : "—"}
                                </td>
                                <td className="py-2 px-3">
                                  <input
                                    className="input-field"
                                    style={{ minHeight: 40 }}
                                    value={row.notes}
                                    onChange={(e) => updateAllocationRow(row.id, "notes", e.target.value)}
                                    placeholder={sw ? "hiari" : "optional"}
                                  />
                                </td>
                                <td className="py-2 px-3 text-right">
                                  <button
                                    type="button"
                                    onClick={() => removeAllocationRow(row.id)}
                                    className="text-xs text-danger hover:underline"
                                    aria-label={sw ? "Ondoa mgao" : "Remove allocation"}
                                  >
                                    {sw ? "Ondoa" : "Remove"}
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    <button type="button" onClick={addAllocationRow} className="btn-outline text-sm">
                      + {sw ? "Ongeza Mgao" : "Add Allocation"}
                    </button>

                    {referencedPropertyIds.length > 0 && (
                      <div className="space-y-1.5">
                        {referencedPropertyIds.map((pid) => {
                          const prop = properties.find((p) => p.id === pid);
                          const total = perPropertyTotals[pid] ?? 0;
                          const valid = total === 100;
                          return (
                            <div
                              key={pid}
                              className={`flex items-center justify-between px-3 py-2 text-sm border ${
                                valid ? "border-secondary bg-green-50" : "border-danger bg-white"
                              }`}
                            >
                              <span className="font-medium text-ink">{prop?.name ?? pid}</span>
                              <span className="flex items-center gap-3">
                                <span className={valid ? "text-secondary" : "text-danger"}>
                                  {total}% {valid ? "✓" : sw ? "(lazima iwe 100%)" : "(must total 100%)"}
                                </span>
                                {!valid && (
                                  <button
                                    type="button"
                                    onClick={() => splitPropertyEvenly(pid)}
                                    className="text-xs font-medium text-primary border border-primary px-2"
                                    style={{ minHeight: 26 }}
                                  >
                                    {sw ? "Gawa Sawa" : "Split Evenly"}
                                  </button>
                                )}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    <div className="bg-neutralLight border border-gray-300 px-4 py-3 text-sm flex flex-wrap gap-x-6 gap-y-1">
                      <span>
                        {sw ? "Mali" : "Properties"}: <strong>{referencedPropertyIds.length}</strong>
                      </span>
                      <span>
                        {sw ? "Thamani ya Jumla" : "Total Value"}: <strong>TZS {totalValue.toLocaleString()}</strong>
                      </span>
                      <span>
                        {sw ? "Wanufaika" : "Beneficiaries"}: <strong>{referencedBeneficiaryIds.length}</strong>
                      </span>
                    </div>

                    {touched[1] && stepErrors[1] && (
                      <p role="alert" className="text-sm text-danger">{stepErrors[1]}</p>
                    )}
                  </div>
                )}

                {step === 2 && (
                  <div className="space-y-5">
                    <h2 className="font-semibold text-primary text-sm uppercase tracking-wide">
                      {sw ? "Chagua Mashahidi na Uongozi" : "Select Witnesses & Officials"}
                    </h2>
                    <p className="text-sm text-inkSoft">
                      {sw
                        ? "Mashahidi ni watu wenye akaunti ya “Shahidi wa Familia” kwenye mfumo huu ambao watathibitisha kumbukumbu yako."
                        : "Witnesses are people with a “Family Witness” account on this system who will verify your record."}
                    </p>

                    <div>
                      <label className="label">{sw ? "Mashahidi (chagua angalau 2)" : "Family Witnesses (select at least 2)"}</label>
                      {witnessOptions.length === 0 && (
                        <p className="text-xs text-inkSoft">
                          {sw
                            ? "Hakuna akaunti za mashahidi bado. Waombe wanafamilia wajisajili kama “Shahidi wa Familia”."
                            : "No witness accounts exist yet. Ask family members to register as “Family Witness”."}
                        </p>
                      )}
                      <div className="border border-gray-300 divide-y divide-gray-200">
                        {witnessOptions.map((w) => (
                          <label key={w.id} className="flex items-center gap-2 px-3 py-2.5 text-sm cursor-pointer" style={{ minHeight: 44 }}>
                            <input
                              type="checkbox"
                              checked={selectedWitnesses.includes(w.id)}
                              onChange={(e) =>
                                setSelectedWitnesses((prev) => (e.target.checked ? [...prev, w.id] : prev.filter((id) => id !== w.id)))
                              }
                            />
                            {w.full_name}
                          </label>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="label">{sw ? "Kiongozi wa Serikali za Mitaa" : "Local Government Leader"}</label>
                      <select className="input-field" value={selectedLeader} onChange={(e) => setSelectedLeader(e.target.value)}>
                        <option value="">{sw ? "Chagua kiongozi…" : "Select leader…"}</option>
                        {leaderOptions.map((l) => (
                          <option key={l.id} value={l.id}>{l.full_name}</option>
                        ))}
                      </select>
                      {leaderOptions.length === 0 && (
                        <p className="text-xs text-inkSoft mt-1">
                          {sw
                            ? "Hakuna akaunti za viongozi bado. Mwombe kiongozi wako wa Serikali za Mitaa ajisajili."
                            : "No leader accounts exist yet. Ask your local leader to register as “Local Government Leader”."}
                        </p>
                      )}
                    </div>

                    <div>
                      <label className="label">{sw ? "Afisa Sheria (hiari)" : "Legal Officer (optional)"}</label>
                      <select className="input-field" value={selectedLegal} onChange={(e) => setSelectedLegal(e.target.value)}>
                        <option value="">{sw ? "Hakuna mapitio ya kisheria yanayohitajika" : "No legal review required"}</option>
                        {legalOptions.map((l) => (
                          <option key={l.id} value={l.id}>{l.full_name}</option>
                        ))}
                      </select>
                    </div>

                    {touched[2] && stepErrors[2] && (
                      <p role="alert" className="text-sm text-danger">{stepErrors[2]}</p>
                    )}
                  </div>
                )}

                {step === 3 && (
                  <div className="space-y-5">
                    <h2 className="font-semibold text-primary text-sm uppercase tracking-wide">
                      {sw ? "Pitia na Thibitisha" : "Review & Confirm"}
                    </h2>

                    <div>
                      <p className="text-xs font-semibold text-inkSoft uppercase mb-1">{sw ? "Taarifa" : "Details"}</p>
                      <p className="text-sm text-ink">{title}</p>
                      {instructions && <p className="text-sm text-inkSoft">{instructions}</p>}
                    </div>

                    <div>
                      <p className="text-xs font-semibold text-inkSoft uppercase mb-1">{sw ? "Ugawaji wa Mali" : "Property Allocation"}</p>
                      {referencedPropertyIds.map((pid) => {
                        const prop = properties.find((p) => p.id === pid);
                        const rows = allocRows.filter((r) => r.propertyId === pid);
                        return (
                          <div key={pid} className="mb-2">
                            <p className="text-sm font-medium text-ink flex justify-between">
                              <span>{prop?.name ?? pid}</span>
                              <span className="text-inkSoft">
                                {prop?.estimated_value ? `TZS ${Number(prop.estimated_value).toLocaleString()}` : "—"}
                              </span>
                            </p>
                            {rows.map((r) => {
                              const b = beneficiaries.find((x) => x.id === r.beneficiaryId);
                              return (
                                <p key={r.id} className="text-sm text-inkSoft flex justify-between pl-3">
                                  <span>
                                    {b?.full_name ?? "—"} ({b?.relationship})
                                    {isMinorDob(b?.date_of_birth) ? ` — ${sw ? "Mnufaika Mchanga" : "Minor Beneficiary"}` : ""}
                                  </span>
                                  <span>{r.share || 0}%</span>
                                </p>
                              );
                            })}
                          </div>
                        );
                      })}
                    </div>

                    <div>
                      <p className="text-xs font-semibold text-inkSoft uppercase mb-1">{sw ? "Mashahidi na Uongozi" : "Witnesses & Officials"}</p>
                      {witnessOptions.filter((w) => selectedWitnesses.includes(w.id)).map((w) => (
                        <p key={w.id} className="text-sm text-ink flex justify-between">
                          <span>✓ {w.full_name}</span>
                          <span className="text-inkSoft text-xs">{sw ? "Shahidi wa Familia" : "Family Witness"}</span>
                        </p>
                      ))}
                      {selectedLeader && (
                        <p className="text-sm text-ink flex justify-between">
                          <span>✓ {leaderOptions.find((l) => l.id === selectedLeader)?.full_name}</span>
                          <span className="text-inkSoft text-xs">{sw ? "Kiongozi wa Serikali za Mitaa" : "Local Government Leader"}</span>
                        </p>
                      )}
                      {selectedLegal && (
                        <p className="text-sm text-ink flex justify-between">
                          <span>✓ {legalOptions.find((l) => l.id === selectedLegal)?.full_name}</span>
                          <span className="text-inkSoft text-xs">{sw ? "Afisa Sheria" : "Legal Officer"}</span>
                        </p>
                      )}
                    </div>

                    <div className="space-y-2 bg-neutralLight border border-gray-400 p-3">
                      <p className="text-xs font-semibold text-inkSoft uppercase">{sw ? "Tamko la Kisheria" : "Legal Declaration"}</p>
                      <label className="flex items-start gap-2 text-sm cursor-pointer">
                        <input
                          type="checkbox"
                          checked={confirmAccurate}
                          onChange={(e) => setConfirmAccurate(e.target.checked)}
                          className="mt-0.5"
                        />
                        <span>
                          {sw
                            ? "Nathibitisha kuwa taarifa zote nilizowasilisha hapo juu ni za kweli na sahihi kwa uelewa wangu bora."
                            : "I confirm that all information submitted above is true and accurate to the best of my knowledge."}
                        </span>
                      </label>
                      <label className="flex items-start gap-2 text-sm cursor-pointer">
                        <input
                          type="checkbox"
                          checked={confirmResponsibility}
                          onChange={(e) => setConfirmResponsibility(e.target.checked)}
                          className="mt-0.5"
                        />
                        <span>
                          {sw
                            ? "Naelewa kuwa ninawajibika kisheria kwa usahihi wa taarifa hizi, na kuwasilisha taarifa za uongo kwa makusudi kunaweza kuwa na madhara ya kisheria."
                            : "I understand that I am legally responsible for the accuracy of this information, and knowingly submitting false information may carry legal consequences."}
                        </span>
                      </label>
                      <label className="flex items-start gap-2 text-sm cursor-pointer">
                        <input
                          type="checkbox"
                          checked={confirmLimitations}
                          onChange={(e) => setConfirmLimitations(e.target.checked)}
                          className="mt-0.5"
                        />
                        <span>
                          {sw
                            ? "Naelewa kuwa kumbukumbu hii inasaidia mipango ya urithi lakini haichukui nafasi ya taratibu rasmi za mahakama za mirathi chini ya sheria za Tanzania."
                            : "I understand this record supports succession planning but does not replace formal probate procedures under Tanzanian law."}
                        </span>
                      </label>
                    </div>
                    {touched[3] && stepErrors[3] && (
                      <p role="alert" className="text-sm text-danger">{stepErrors[3]}</p>
                    )}

                    {reportSnapshot ? (
                      <div className="border border-secondary bg-green-50 p-4 space-y-2">
                        <p className="text-sm font-semibold text-secondary flex items-center gap-2">
                          <Check size={16} aria-hidden="true" /> {sw ? "Ripoti ya Ukaguzi Imetengenezwa" : "Review Report Generated"}
                        </p>
                        <p className="text-xs text-inkSoft">
                          {sw
                            ? `Muhtasari kamili wa mali ${reportSnapshot.allocations?.length ?? 0}, familia ${
                                reportSnapshot.family_members?.length ?? 0
                              }, mashahidi ${reportSnapshot.witnesses?.length ?? 0} umetengenezwa saa ${new Date(
                                reportSnapshot.generated_at
                              ).toLocaleTimeString()}. Mashahidi na kiongozi watapitia ripoti hii hasa, si data ghafi.`
                            : `A complete summary of ${reportSnapshot.allocations?.length ?? 0} allocation(s), ${
                                reportSnapshot.family_members?.length ?? 0
                              } family member(s), and ${reportSnapshot.witnesses?.length ?? 0} witness(es) was generated at ${new Date(
                                reportSnapshot.generated_at
                              ).toLocaleTimeString()}. Witnesses and the leader will review this exact report, not live records.`}
                        </p>
                      </div>
                    ) : (
                      <div className="border border-amber-700 bg-amber-50 p-3">
                        <p className="text-sm text-amber-800">
                          {sw
                            ? "Lazima utengeneze Ripoti ya Ukaguzi kabla ya kuweza kuwasilisha kwa uthibitisho."
                            : "You must generate a Review Report before you can submit this record for verification."}
                        </p>
                      </div>
                    )}
                  </div>
                )}

                <div className="flex items-center justify-between gap-3 mt-6">
                  <button type="button" onClick={back} disabled={step === 0} className="btn-outline">
                    {sw ? "Nyuma" : "Previous"}
                  </button>
                  {step < 3 ? (
                    <button type="button" onClick={next} className="btn-primary">
                      {sw ? "Endelea" : "Continue"}
                    </button>
                  ) : !reportSnapshot ? (
                    <button type="button" onClick={handleGenerateReport} disabled={generatingReport} className="btn-primary">
                      {generatingReport ? (sw ? "Inatengeneza…" : "Generating…") : sw ? "Tengeneza Ripoti ya Ukaguzi" : "Generate Review Report"}
                    </button>
                  ) : (
                    <button type="button" onClick={handleFinalSubmit} disabled={submitting} className="btn-primary">
                      {submitting ? (sw ? "Inatuma…" : "Submitting…") : sw ? "Wasilisha kwa Uthibitisho" : "Submit For Verification"}
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </DashboardShell>
  );
}
