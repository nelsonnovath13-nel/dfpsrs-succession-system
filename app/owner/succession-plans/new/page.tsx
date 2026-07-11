"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import DashboardShell from "@/components/DashboardShell";
import { PageNav } from "@/components/PageNav";
import { Stepper } from "@/components/Stepper";
import { createClient } from "@/lib/supabase/client";
import { useLanguage } from "@/lib/i18n";
import { withTimeout } from "@/lib/withTimeout";

type Property = { id: string; name: string; category: string; estimated_value: number | null };
type Beneficiary = { id: string; full_name: string; relationship: string; linked_user_id: string | null };
type Profile = { id: string; full_name: string };

const STEP_LABELS_SW = ["Taarifa za Kumbukumbu", "Mali na Wanufaika", "Mashahidi na Uongozi", "Pitia na Thibitisha"];
const STEP_LABELS_EN = ["Record Details", "Properties & Beneficiaries", "Witnesses & Officials", "Review & Confirm"];

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

  const [selectedPropertyIds, setSelectedPropertyIds] = useState<string[]>([]);
  const [selectedBeneficiaryIds, setSelectedBeneficiaryIds] = useState<string[]>([]);
  const [shares, setShares] = useState<Record<string, string>>({});

  const [selectedWitnesses, setSelectedWitnesses] = useState<string[]>([]);
  const [selectedLeader, setSelectedLeader] = useState("");
  const [selectedLegal, setSelectedLegal] = useState("");

  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [doneRecord, setDoneRecord] = useState<{ id: string; title: string } | null>(null);

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
          supabase.from("dfp_beneficiaries").select("id, full_name, relationship, linked_user_id").eq("owner_id", user.id),
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

  function togglePropertyId(id: string) {
    setSelectedPropertyIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }
  function toggleBeneficiaryId(id: string) {
    setSelectedBeneficiaryIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  const totalValue = properties
    .filter((p) => selectedPropertyIds.includes(p.id))
    .reduce((sum, p) => sum + (Number(p.estimated_value) || 0), 0);

  const totalShare = selectedBeneficiaryIds.reduce((sum, id) => sum + (Number(shares[id]) || 0), 0);

  // A witness who is also a linked beneficiary account cannot verify their own inheritance.
  const linkedBeneficiaryUserIds = new Set(
    beneficiaries.filter((b) => selectedBeneficiaryIds.includes(b.id) && b.linked_user_id).map((b) => b.linked_user_id)
  );
  const witnessConflict = witnessOptions.find((w) => selectedWitnesses.includes(w.id) && linkedBeneficiaryUserIds.has(w.id));

  const stepErrors: Record<number, string | null> = {
    0: !title.trim() ? (sw ? "Tafadhali ingiza jina la kumbukumbu" : "Please enter the record title") : null,
    1:
      selectedPropertyIds.length === 0
        ? sw
          ? "Tafadhali chagua angalau mali 1"
          : "Please select at least one property"
        : selectedBeneficiaryIds.length === 0
        ? sw
          ? "Tafadhali chagua angalau mnufaika 1"
          : "Please select at least one beneficiary"
        : totalShare !== 100
        ? sw
          ? `Asilimia zote lazima ziwe 100% (sasa ni ${totalShare}%)`
          : `Shares must add up to 100% (currently ${totalShare}%)`
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
    3: !confirmed ? (sw ? "Tafadhali thibitisha kuwa taarifa zote ni sahihi" : "Please confirm the information is correct") : null,
  };

  function next() {
    setTouched((t) => ({ ...t, [step]: true }));
    if (stepErrors[step]) return;
    setStep((s) => Math.min(s + 1, 3));
  }
  function back() {
    setStep((s) => Math.max(s - 1, 0));
  }

  async function handleSubmit() {
    if (loading) return; // guards against a double-click firing this twice
    setTouched((t) => ({ ...t, 3: true }));
    if (stepErrors[3]) return;

    setLoading(true);
    setError(null);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setError(sw ? "Kikao chako kimeisha. Tafadhali ingia tena." : "Your session has expired. Please sign in again.");
        return;
      }

      const { data: record, error: recErr } = await supabase
        .from("dfp_succession_records")
        .insert({ owner_id: user.id, title, instructions: instructions || null })
        .select("id")
        .single();

      if (recErr || !record) {
        setError(recErr?.message ?? "Could not create succession record.");
        return;
      }

      // Every selected property gets the same beneficiary/share split -- this matches
      // "split my estate among these heirs at these percentages" rather than requiring a
      // separate allocation per property, while still writing one row per (property,
      // beneficiary) pair as the schema expects.
      const allocationRows = selectedPropertyIds.flatMap((propertyId) =>
        selectedBeneficiaryIds.map((beneficiaryId) => ({
          succession_record_id: record.id,
          property_id: propertyId,
          beneficiary_id: beneficiaryId,
          share_percentage: Number(shares[beneficiaryId]) || 0,
        }))
      );

      const { error: allocErr } = await supabase.from("dfp_property_allocations").insert(allocationRows);
      if (allocErr) {
        setError(allocErr.message);
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

      const { error: submitErr } = await supabase.rpc("dfp_submit_succession_record", {
        p_record_id: record.id,
      });
      if (submitErr) {
        setError(submitErr.message);
        return;
      }

      setDoneRecord({ id: record.id, title });
    } catch (err: any) {
      setError(err?.message ?? (sw ? "Hitilafu isiyotarajiwa. Jaribu tena." : "An unexpected error occurred. Please try again."));
    } finally {
      setLoading(false);
    }
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
                <dd className="font-medium text-ink">{selectedPropertyIds.length}</dd>
              </div>
              <div className="flex justify-between px-4 py-2">
                <dt className="text-inkSoft">{sw ? "Wanufaika" : "Beneficiaries"}</dt>
                <dd className="font-medium text-ink">{selectedBeneficiaryIds.length}</dd>
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
          <h1 className="text-xl font-semibold text-primary mb-6">
            {sw ? "Kumbukumbu Mpya za Urithi" : "New Succession Record"}
          </h1>

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
                      {sw ? "Chagua Mali na Wanufaika" : "Select Properties & Beneficiaries"}
                    </h2>

                    <div>
                      <p className="label mb-2">{sw ? "Mali Zilizochaguliwa" : "Selected Properties"}</p>
                      <div className="border border-gray-300 divide-y divide-gray-200">
                        {properties.map((p) => (
                          <label key={p.id} className="flex items-center justify-between px-3 py-2.5 text-sm cursor-pointer" style={{ minHeight: 44 }}>
                            <span className="flex items-center gap-2">
                              <input type="checkbox" checked={selectedPropertyIds.includes(p.id)} onChange={() => togglePropertyId(p.id)} />
                              <span className="font-medium text-ink">{p.name}</span>
                              <span className="text-xs text-inkSoft capitalize">({p.category})</span>
                            </span>
                            <span className="text-inkSoft">{p.estimated_value ? `TZS ${Number(p.estimated_value).toLocaleString()}` : "—"}</span>
                          </label>
                        ))}
                      </div>
                    </div>

                    <div>
                      <p className="label mb-2">{sw ? "Wanufaika Waliochaguliwa" : "Selected Beneficiaries"}</p>
                      <div className="border border-gray-300 divide-y divide-gray-200">
                        {beneficiaries.map((b) => (
                          <div key={b.id} className="flex items-center justify-between px-3 py-2.5 text-sm" style={{ minHeight: 44 }}>
                            <label className="flex items-center gap-2 cursor-pointer">
                              <input type="checkbox" checked={selectedBeneficiaryIds.includes(b.id)} onChange={() => toggleBeneficiaryId(b.id)} />
                              <span className="font-medium text-ink">{b.full_name}</span>
                              <span className="text-xs text-inkSoft">({b.relationship})</span>
                            </label>
                            {selectedBeneficiaryIds.includes(b.id) && (
                              <span className="flex items-center gap-1">
                                <input
                                  type="number"
                                  min={1}
                                  max={100}
                                  className="input-field w-20 text-right"
                                  style={{ minHeight: 36 }}
                                  value={shares[b.id] ?? ""}
                                  onChange={(e) => setShares((s) => ({ ...s, [b.id]: e.target.value }))}
                                  aria-label={sw ? `Asilimia ya ${b.full_name}` : `Share for ${b.full_name}`}
                                />
                                <span className="text-inkSoft">%</span>
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="bg-neutralLight border border-gray-300 px-4 py-3 text-sm flex flex-wrap gap-x-6 gap-y-1">
                      <span>
                        {sw ? "Mali" : "Properties"}: <strong>{selectedPropertyIds.length}</strong>
                      </span>
                      <span>
                        {sw ? "Thamani" : "Value"}: <strong>TZS {totalValue.toLocaleString()}</strong>
                      </span>
                      <span>
                        {sw ? "Wanufaika" : "Beneficiaries"}: <strong>{selectedBeneficiaryIds.length}</strong>
                      </span>
                      <span className={totalShare === 100 ? "text-secondary" : "text-danger"}>
                        {sw ? "Asilimia" : "Total share"}: <strong>{totalShare}%</strong> {totalShare === 100 ? "✓" : ""}
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
                      <p className="text-xs font-semibold text-inkSoft uppercase mb-1">{sw ? "Mali" : "Properties"}</p>
                      {properties.filter((p) => selectedPropertyIds.includes(p.id)).map((p) => (
                        <p key={p.id} className="text-sm text-ink flex justify-between">
                          <span>{p.name}</span>
                          <span>{p.estimated_value ? `TZS ${Number(p.estimated_value).toLocaleString()}` : "—"}</span>
                        </p>
                      ))}
                    </div>

                    <div>
                      <p className="text-xs font-semibold text-inkSoft uppercase mb-1">{sw ? "Wanufaika" : "Beneficiaries"}</p>
                      {beneficiaries.filter((b) => selectedBeneficiaryIds.includes(b.id)).map((b) => (
                        <p key={b.id} className="text-sm text-ink flex justify-between">
                          <span>{b.full_name} ({b.relationship})</span>
                          <span>{shares[b.id] ?? 0}%</span>
                        </p>
                      ))}
                    </div>

                    <div>
                      <p className="text-xs font-semibold text-inkSoft uppercase mb-1">{sw ? "Mashahidi na Uongozi" : "Witnesses & Officials"}</p>
                      {witnessOptions.filter((w) => selectedWitnesses.includes(w.id)).map((w) => (
                        <p key={w.id} className="text-sm text-ink">✓ {w.full_name}</p>
                      ))}
                      {selectedLeader && (
                        <p className="text-sm text-ink">
                          ✓ {leaderOptions.find((l) => l.id === selectedLeader)?.full_name}
                        </p>
                      )}
                      {selectedLegal && (
                        <p className="text-sm text-ink">
                          ✓ {legalOptions.find((l) => l.id === selectedLegal)?.full_name} ({sw ? "Afisa Sheria" : "Legal"})
                        </p>
                      )}
                    </div>

                    <label className="flex items-start gap-2 text-sm bg-neutralLight border border-gray-400 p-3 cursor-pointer">
                      <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} className="mt-0.5" />
                      <span>{sw ? "Nimehakikisha taarifa zote ni sahihi." : "I confirm that all the information above is correct."}</span>
                    </label>
                    {touched[3] && stepErrors[3] && (
                      <p role="alert" className="text-sm text-danger">{stepErrors[3]}</p>
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
                  ) : (
                    <button type="button" onClick={handleSubmit} disabled={loading} className="btn-primary">
                      {loading ? (sw ? "Inatuma…" : "Submitting…") : sw ? "Thibitisha na Tuma" : "Confirm & Submit"}
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
