"use client";

import { useEffect, useState } from "react";
import { ShieldCheck, Upload, Camera, FileText, Trash2 } from "lucide-react";
import DashboardShell from "@/components/DashboardShell";
import { StatusBadge } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import { useLanguage } from "@/lib/i18n";
import { VERIFIER_TYPES, VERIFIER_DOC_TYPES, VERIFIER_STATUS_LABEL, verifierDocLabel } from "@/lib/verifierTypes";

type Role = "owner" | "witness" | "leader" | "admin" | "beneficiary" | "legal" | "auditor" | "executor";

type VerifierRow = {
  id: string;
  verifier_type: string;
  status: string;
  status_reason: string | null;
  gender: string | null;
  date_of_birth: string | null;
  nationality: string | null;
  national_id: string | null;
  voter_id: string | null;
  phone_number: string | null;
  email: string | null;
  physical_address: string | null;
  region: string | null;
  district: string | null;
  ward: string | null;
  village_or_street: string | null;
  license_number: string | null;
  passport_photo_path: string | null;
  selfie_photo_path: string | null;
  signature_path: string | null;
  stamp_path: string | null;
  seal_path: string | null;
};

type VDoc = { id: string; doc_type: string; file_name: string; file_path: string; status: string; review_note: string | null };

export default function VerifierApplyPage() {
  const supabase = createClient();
  const { lang } = useLanguage();
  const sw = lang === "sw";

  const [role, setRole] = useState<Role | null>(null);
  const [existing, setExisting] = useState<VerifierRow | null>(null);
  const [docs, setDocs] = useState<VDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingField, setUploadingField] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ type: "ok" | "error"; text: string } | null>(null);
  const [docType, setDocType] = useState("national_id");

  const [form, setForm] = useState({
    verifier_type: "village_chairperson",
    gender: "",
    date_of_birth: "",
    nationality: "Tanzanian",
    national_id: "",
    voter_id: "",
    phone_number: "",
    email: "",
    physical_address: "",
    region: "",
    district: "",
    ward: "",
    village_or_street: "",
    license_number: "",
  });

  async function load() {
    setLoading(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      return;
    }
    const { data: profile } = await supabase.from("dfp_profiles").select("role").eq("id", user.id).maybeSingle();
    setRole((profile?.role as Role) ?? "owner");

    const { data: verifier } = await supabase.from("dfp_verifiers").select("*").eq("user_id", user.id).maybeSingle();
    if (verifier) {
      setExisting(verifier as VerifierRow);
      setForm({
        verifier_type: verifier.verifier_type,
        gender: verifier.gender ?? "",
        date_of_birth: verifier.date_of_birth ?? "",
        nationality: verifier.nationality ?? "Tanzanian",
        national_id: verifier.national_id ?? "",
        voter_id: verifier.voter_id ?? "",
        phone_number: verifier.phone_number ?? "",
        email: verifier.email ?? "",
        physical_address: verifier.physical_address ?? "",
        region: verifier.region ?? "",
        district: verifier.district ?? "",
        ward: verifier.ward ?? "",
        village_or_street: verifier.village_or_street ?? "",
        license_number: verifier.license_number ?? "",
      });

      const { data: docRows } = await supabase
        .from("dfp_verifier_documents")
        .select("id, doc_type, file_name, file_path, status, review_note")
        .eq("verifier_id", verifier.id)
        .order("uploaded_at", { ascending: false });
      setDocs(docRows ?? []);
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const locked = existing?.status === "approved" || existing?.status === "suspended";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMsg(null);
    const { error } = await supabase.rpc("dfp_submit_verifier_application", {
      p_verifier_type: form.verifier_type,
      p_gender: form.gender || null,
      p_date_of_birth: form.date_of_birth || null,
      p_nationality: form.nationality || null,
      p_national_id: form.national_id || null,
      p_voter_id: form.voter_id || null,
      p_phone_number: form.phone_number || null,
      p_email: form.email || null,
      p_physical_address: form.physical_address || null,
      p_region: form.region || null,
      p_district: form.district || null,
      p_ward: form.ward || null,
      p_village_or_street: form.village_or_street || null,
      p_license_number: form.license_number || null,
    });
    setSaving(false);
    if (error) {
      setMsg({ type: "error", text: error.message });
      return;
    }
    setMsg({ type: "ok", text: sw ? "Ombi lako limewasilishwa kwa ukaguzi." : "Your application has been submitted for review." });
    load();
  }

  async function handleFileField(field: "passport_photo_path" | "selfie_photo_path" | "stamp_path" | "seal_path", file: File) {
    setUploadingField(field);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    const path = `${user.id}/verifier/${field}-${Date.now()}-${file.name}`;
    const { error: upErr } = await supabase.storage.from("dfp-documents").upload(path, file);
    if (upErr) {
      setUploadingField(null);
      setMsg({ type: "error", text: upErr.message });
      return;
    }
    await supabase.rpc("dfp_set_verifier_file", { p_field: field, p_path: path });
    setUploadingField(null);
    load();
  }

  async function handleDocUpload(file: File) {
    setUploadingField("document");
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user || !existing) return;
    const path = `${user.id}/verifier/doc-${docType}-${Date.now()}-${file.name}`;
    const { error: upErr } = await supabase.storage.from("dfp-documents").upload(path, file);
    if (upErr) {
      setUploadingField(null);
      setMsg({ type: "error", text: upErr.message });
      return;
    }
    const { error: rpcErr } = await supabase.rpc("dfp_upload_verifier_document", { p_doc_type: docType, p_file_path: path, p_file_name: file.name });
    setUploadingField(null);
    if (rpcErr) {
      setMsg({ type: "error", text: rpcErr.message });
      return;
    }
    load();
  }

  async function viewFile(path: string) {
    const newTab = window.open("", "_blank");
    const { data, error } = await supabase.storage.from("dfp-documents").createSignedUrl(path, 60);
    if (error || !data) {
      newTab?.close();
      alert(sw ? "Imeshindikana kufungua faili." : "Could not open file.");
      return;
    }
    if (newTab) newTab.location.href = data.signedUrl;
  }

  if (loading || !role) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-sm text-neutralDark">{sw ? "Inapakia…" : "Loading…"}</p>
      </div>
    );
  }

  return (
    <DashboardShell role={role}>
      <h1 className="text-xl font-semibold text-primary mb-2 flex items-center gap-2">
        <ShieldCheck size={22} aria-hidden="true" /> {sw ? "Kuwa Mthibitishaji Rasmi" : "Become an Official Verifier"}
      </h1>
      <p className="text-sm text-inkSoft mb-6 max-w-2xl">
        {sw
          ? "Sajili taarifa zako kama kiongozi, afisa wa serikali, au mtaalamu wa sheria ili uweze kuthibitishwa rasmi na kushiriki katika uhakiki wa kumbukumbu za urithi. Ombi lako litakaguliwa na msimamizi wa mfumo kabla ya kuidhinishwa."
          : "Register your details as a leader, government officer, or legal professional to become officially verified and take part in reviewing succession records. Your application is reviewed by a system administrator before approval."}
      </p>

      {existing && (
        <div className="card mb-6 max-w-2xl flex items-center justify-between flex-wrap gap-2">
          <div>
            <p className="text-sm font-medium text-ink">{sw ? "Hali ya Ombi Lako" : "Your Application Status"}</p>
            {existing.status_reason && <p className="text-xs text-inkSoft mt-1">&quot;{existing.status_reason}&quot;</p>}
          </div>
          <StatusBadge status={existing.status} />
        </div>
      )}

      {msg && (
        <div
          role="alert"
          className={`max-w-2xl mb-4 text-sm px-3 py-2 border ${msg.type === "ok" ? "bg-white text-secondary border-secondary" : "bg-white text-danger border-danger"}`}
        >
          {msg.text}
        </div>
      )}

      <form onSubmit={handleSubmit} className="card max-w-2xl space-y-4">
        <h2 className="font-semibold text-primary text-sm uppercase tracking-wide">{sw ? "Wasifu wa Kibinafsi" : "Personal Profile"}</h2>
        <div>
          <label className="label">{sw ? "Aina ya Mthibitishaji" : "Verifier Type"}</label>
          <select
            disabled={locked}
            required
            className="input-field"
            value={form.verifier_type}
            onChange={(e) => setForm((f) => ({ ...f, verifier_type: e.target.value }))}
          >
            {VERIFIER_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {sw ? t.sw : t.en}
              </option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">{sw ? "Jinsia" : "Gender"}</label>
            <select disabled={locked} className="input-field" value={form.gender} onChange={(e) => setForm((f) => ({ ...f, gender: e.target.value }))}>
              <option value="">{sw ? "Chagua…" : "Select…"}</option>
              <option value="male">{sw ? "Mwanaume" : "Male"}</option>
              <option value="female">{sw ? "Mwanamke" : "Female"}</option>
            </select>
          </div>
          <div>
            <label className="label">{sw ? "Tarehe ya Kuzaliwa" : "Date of Birth"}</label>
            <input disabled={locked} type="date" className="input-field" value={form.date_of_birth} onChange={(e) => setForm((f) => ({ ...f, date_of_birth: e.target.value }))} />
          </div>
          <div>
            <label className="label">{sw ? "Uraia" : "Nationality"}</label>
            <input disabled={locked} className="input-field" value={form.nationality} onChange={(e) => setForm((f) => ({ ...f, nationality: e.target.value }))} />
          </div>
          <div>
            <label className="label">{sw ? "Namba ya NIDA" : "National ID (NIDA)"}</label>
            <input disabled={locked} className="input-field" value={form.national_id} onChange={(e) => setForm((f) => ({ ...f, national_id: e.target.value }))} />
          </div>
          <div>
            <label className="label">{sw ? "Namba ya Mpiga Kura (si lazima)" : "Voter ID (optional)"}</label>
            <input disabled={locked} className="input-field" value={form.voter_id} onChange={(e) => setForm((f) => ({ ...f, voter_id: e.target.value }))} />
          </div>
          <div>
            <label className="label">{sw ? "Namba ya Simu" : "Phone Number"}</label>
            <input disabled={locked} className="input-field" value={form.phone_number} onChange={(e) => setForm((f) => ({ ...f, phone_number: e.target.value }))} />
          </div>
          <div>
            <label className="label">{sw ? "Barua Pepe" : "Email"}</label>
            <input disabled={locked} type="email" className="input-field" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
          </div>
          <div>
            <label className="label">{sw ? "Namba ya Leseni (kwa wanasheria)" : "License Number (for lawyers)"}</label>
            <input disabled={locked} className="input-field" value={form.license_number} onChange={(e) => setForm((f) => ({ ...f, license_number: e.target.value }))} />
          </div>
        </div>
        <div>
          <label className="label">{sw ? "Anwani ya Makazi" : "Physical Address"}</label>
          <input disabled={locked} className="input-field" value={form.physical_address} onChange={(e) => setForm((f) => ({ ...f, physical_address: e.target.value }))} />
        </div>

        <h2 className="font-semibold text-primary text-sm uppercase tracking-wide pt-2">{sw ? "Mamlaka ya Eneo (Jurisdiction)" : "Jurisdiction"}</h2>
        <p className="text-xs text-inkSoft -mt-2">
          {sw
            ? "Hii inaonyesha eneo unaloruhusiwa kuthibitisha rasmi. Kwa sasa ni taarifa ya kuonyesha tu -- haizuii moja kwa moja mfumo, ila itaonekana kwenye beji yako ya uthibitishaji."
            : "This shows the area you're authorized to verify within. For now it's informational/display only -- it doesn't hard-block the system, but it appears on your verification badge."}
        </p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">{sw ? "Mkoa" : "Region"}</label>
            <input disabled={locked} className="input-field" value={form.region} onChange={(e) => setForm((f) => ({ ...f, region: e.target.value }))} />
          </div>
          <div>
            <label className="label">{sw ? "Wilaya" : "District"}</label>
            <input disabled={locked} className="input-field" value={form.district} onChange={(e) => setForm((f) => ({ ...f, district: e.target.value }))} />
          </div>
          <div>
            <label className="label">{sw ? "Kata" : "Ward"}</label>
            <input disabled={locked} className="input-field" value={form.ward} onChange={(e) => setForm((f) => ({ ...f, ward: e.target.value }))} />
          </div>
          <div>
            <label className="label">{sw ? "Kijiji/Mtaa" : "Village/Street"}</label>
            <input disabled={locked} className="input-field" value={form.village_or_street} onChange={(e) => setForm((f) => ({ ...f, village_or_street: e.target.value }))} />
          </div>
        </div>

        {!locked && (
          <button type="submit" disabled={saving} className="btn-primary">
            {saving ? (sw ? "Inawasilisha…" : "Submitting…") : existing ? (sw ? "Sasisha na Wasilisha Tena" : "Update & Resubmit") : sw ? "Wasilisha Ombi" : "Submit Application"}
          </button>
        )}
      </form>

      {existing && (
        <div className="card max-w-2xl mt-6 space-y-4">
          <h2 className="font-semibold text-primary text-sm uppercase tracking-wide">{sw ? "Picha na Sahihi" : "Photos & Signature"}</h2>
          <div className="grid grid-cols-2 gap-4">
            {(
              [
                ["passport_photo_path", sw ? "Picha ya Pasipoti" : "Passport Photo"],
                ["selfie_photo_path", sw ? "Picha ya Kuthibitisha (Selfie)" : "Selfie Verification Photo"],
                ["stamp_path", sw ? "Muhuri Rasmi" : "Official Stamp"],
                ["seal_path", sw ? "Lakiri Rasmi" : "Official Seal"],
              ] as const
            ).map(([field, label]) => (
              <div key={field}>
                <label className="label flex items-center gap-1">
                  <Camera size={12} aria-hidden="true" /> {label}
                </label>
                {existing[field] ? (
                  <button type="button" onClick={() => viewFile(existing[field] as string)} className="text-xs text-primary underline block mb-1">
                    {sw ? "Tazama iliyopakiwa" : "View uploaded file"}
                  </button>
                ) : null}
                <label className="btn-outline text-xs cursor-pointer inline-flex items-center gap-1">
                  <Upload size={12} aria-hidden="true" />
                  {uploadingField === field ? (sw ? "Inapakia…" : "Uploading…") : sw ? "Pakia" : "Upload"}
                  <input
                    type="file"
                    accept=".jpg,.jpeg,.png"
                    className="hidden"
                    disabled={uploadingField === field}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleFileField(field, file);
                    }}
                  />
                </label>
              </div>
            ))}
          </div>
          <p className="text-xs text-inkSoft">
            {sw
              ? "Sahihi yako ya kidijitali huwekwa moja kwa moja unapotia sahihi kwenye kumbukumbu ya urithi kwa mara ya kwanza."
              : "Your digital signature is captured automatically the first time you sign off on a succession record."}
          </p>
        </div>
      )}

      {existing && (
        <div className="card max-w-2xl mt-6 space-y-4">
          <h2 className="font-semibold text-primary text-sm uppercase tracking-wide">{sw ? "Hati Rasmi" : "Official Documents"}</h2>
          <div className="flex flex-wrap gap-2 items-end">
            <div className="flex-1 min-w-[180px]">
              <label className="label">{sw ? "Aina ya Hati" : "Document Type"}</label>
              <select className="input-field" value={docType} onChange={(e) => setDocType(e.target.value)}>
                {VERIFIER_DOC_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {sw ? t.sw : t.en}
                  </option>
                ))}
              </select>
            </div>
            <label className="btn-outline text-sm cursor-pointer inline-flex items-center gap-2">
              <Upload size={14} aria-hidden="true" />
              {uploadingField === "document" ? (sw ? "Inapakia…" : "Uploading…") : sw ? "Pakia Hati" : "Upload Document"}
              <input
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                className="hidden"
                disabled={uploadingField === "document"}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleDocUpload(file);
                }}
              />
            </label>
          </div>
          {docs.length === 0 ? (
            <p className="text-sm text-inkSoft">{sw ? "Bado hakuna hati zilizopakiwa." : "No documents uploaded yet."}</p>
          ) : (
            <div className="border border-gray-300 divide-y divide-gray-200">
              {docs.map((d) => (
                <div key={d.id} className="flex items-center justify-between px-3 py-2 gap-2 flex-wrap">
                  <button onClick={() => viewFile(d.file_path)} className="flex items-center gap-2 text-sm text-ink min-w-0 text-left">
                    <FileText size={14} className="text-inkSoft shrink-0" aria-hidden="true" />
                    <span className="truncate">{verifierDocLabel(d.doc_type, lang)}</span>
                  </button>
                  <StatusBadge status={d.status} />
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </DashboardShell>
  );
}
