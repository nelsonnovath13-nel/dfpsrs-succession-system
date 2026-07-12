"use client";

import { useEffect, useState } from "react";
import { ShieldCheck, FileText, MapPin } from "lucide-react";
import DashboardShell from "@/components/DashboardShell";
import { StatusBadge } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import { useLanguage } from "@/lib/i18n";
import { verifierTypeLabel, verifierDocLabel } from "@/lib/verifierTypes";

type VerifierRow = {
  id: string;
  user_id: string;
  verifier_type: string;
  status: string;
  region: string | null;
  district: string | null;
  ward: string | null;
  national_id: string | null;
  license_number: string | null;
  submitted_at: string;
  dfp_profiles: { full_name: string } | null;
};

type VDoc = { id: string; doc_type: string; file_name: string; file_path: string; status: string };

const TABS = ["pending_review", "approved", "rejected", "suspended"] as const;

export default function AdminVerifiersPage() {
  const supabase = createClient();
  const { lang } = useLanguage();
  const sw = lang === "sw";

  const [list, setList] = useState<VerifierRow[]>([]);
  const [tab, setTab] = useState<(typeof TABS)[number]>("pending_review");
  const [selected, setSelected] = useState<VerifierRow | null>(null);
  const [docs, setDocs] = useState<VDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [reason, setReason] = useState("");
  const [deciding, setDeciding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from("dfp_verifiers")
      .select("id, user_id, verifier_type, status, region, district, ward, national_id, license_number, submitted_at, dfp_profiles!user_id(full_name)")
      .order("submitted_at", { ascending: false });
    setList((data as any) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function openDetail(v: VerifierRow) {
    setSelected(v);
    setReason("");
    setError(null);
    const { data } = await supabase.from("dfp_verifier_documents").select("id, doc_type, file_name, file_path, status").eq("verifier_id", v.id);
    setDocs(data ?? []);
  }

  async function viewFile(path: string) {
    const newTab = window.open("", "_blank");
    const { data, error: signErr } = await supabase.storage.from("dfp-documents").createSignedUrl(path, 60);
    if (signErr || !data) {
      newTab?.close();
      alert(sw ? "Imeshindikana kufungua faili." : "Could not open file.");
      return;
    }
    if (newTab) newTab.location.href = data.signedUrl;
  }

  async function decide(decision: "approved" | "rejected" | "suspended") {
    if (!selected) return;
    if (decision !== "approved" && !reason.trim()) {
      setError(sw ? "Toa sababu." : "Please give a reason.");
      return;
    }
    setDeciding(true);
    setError(null);
    const res = await fetch("/api/verifiers/decide", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ verifierId: selected.id, decision, reason: reason || null }),
    });
    const json = await res.json();
    setDeciding(false);
    if (!res.ok) {
      setError(json.error ?? "Failed");
      return;
    }
    setSelected(null);
    load();
  }

  async function reviewDoc(docId: string, status: "approved" | "rejected") {
    await supabase.rpc("dfp_review_verifier_document", { p_document_id: docId, p_status: status, p_note: null });
    if (selected) {
      const { data } = await supabase.from("dfp_verifier_documents").select("id, doc_type, file_name, file_path, status").eq("verifier_id", selected.id);
      setDocs(data ?? []);
    }
  }

  const filtered = list.filter((v) => v.status === tab);

  return (
    <DashboardShell role="admin">
      <h1 className="text-xl font-semibold text-primary mb-2 flex items-center gap-2">
        <ShieldCheck size={22} aria-hidden="true" /> {sw ? "Usimamizi wa Wathibitishaji" : "Verifier Management"}
      </h1>
      <p className="text-sm text-inkSoft mb-6 max-w-2xl">
        {sw
          ? "Kagua na uidhinishe watu wanaotaka kuwa wathibitishaji rasmi (viongozi, maafisa wa serikali, wanasheria) kabla ya kushiriki katika uhakiki wa kumbukumbu za urithi."
          : "Review and approve applicants who want to become official verifiers (leaders, government officers, legal professionals) before they can take part in succession record reviews."}
      </p>

      <div className="flex gap-2 mb-4 flex-wrap">
        {TABS.map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`btn-outline text-xs ${tab === t ? "bg-neutralLight" : ""}`}>
            <StatusBadge status={t} />
          </button>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div>
          {loading ? (
            <p className="text-sm text-neutralDark">{sw ? "Inapakia…" : "Loading…"}</p>
          ) : filtered.length === 0 ? (
            <div className="card text-center py-8 text-sm text-inkSoft">{sw ? "Hakuna maombi hapa." : "No applications here."}</div>
          ) : (
            <div className="border border-gray-300 divide-y divide-gray-200">
              {filtered.map((v) => (
                <button
                  key={v.id}
                  onClick={() => openDetail(v)}
                  className={`w-full text-left px-4 py-3 hover:bg-neutralLight ${selected?.id === v.id ? "bg-neutralLight" : ""}`}
                  style={{ minHeight: 64 }}
                >
                  <p className="text-sm font-medium text-ink">{v.dfp_profiles?.full_name ?? "—"}</p>
                  <p className="text-xs text-inkSoft">{verifierTypeLabel(v.verifier_type, lang)}</p>
                  {(v.region || v.district) && (
                    <p className="text-xs text-inkSoft flex items-center gap-1 mt-0.5">
                      <MapPin size={10} aria-hidden="true" /> {[v.ward, v.district, v.region].filter(Boolean).join(", ")}
                    </p>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        <div>
          {selected ? (
            <div className="card space-y-4">
              <div>
                <h2 className="font-semibold text-ink">{selected.dfp_profiles?.full_name}</h2>
                <p className="text-sm text-inkSoft">{verifierTypeLabel(selected.verifier_type, lang)}</p>
                <div className="mt-1"><StatusBadge status={selected.status} /></div>
              </div>
              <div className="text-sm text-inkSoft space-y-1">
                <p>{sw ? "NIDA" : "National ID"}: {selected.national_id ?? "—"}</p>
                <p>{sw ? "Namba ya Leseni" : "License Number"}: {selected.license_number ?? "—"}</p>
                <p>{sw ? "Eneo" : "Jurisdiction"}: {[selected.ward, selected.district, selected.region].filter(Boolean).join(", ") || "—"}</p>
              </div>

              <div>
                <p className="text-xs font-semibold text-inkSoft uppercase tracking-wide mb-2">{sw ? "Hati Zilizopakiwa" : "Uploaded Documents"}</p>
                {docs.length === 0 ? (
                  <p className="text-sm text-inkSoft">{sw ? "Hakuna hati." : "No documents."}</p>
                ) : (
                  <div className="border border-gray-300 divide-y divide-gray-200">
                    {docs.map((d) => (
                      <div key={d.id} className="flex items-center justify-between px-3 py-2 gap-2 flex-wrap">
                        <button onClick={() => viewFile(d.file_path)} className="flex items-center gap-2 text-sm text-primary min-w-0">
                          <FileText size={14} className="shrink-0" aria-hidden="true" />
                          <span className="truncate underline">{verifierDocLabel(d.doc_type, lang)}</span>
                        </button>
                        <div className="flex items-center gap-2 shrink-0">
                          <StatusBadge status={d.status} />
                          {d.status === "pending" && (
                            <>
                              <button onClick={() => reviewDoc(d.id, "approved")} className="text-xs text-secondary underline">
                                {sw ? "Kubali" : "Approve"}
                              </button>
                              <button onClick={() => reviewDoc(d.id, "rejected")} className="text-xs text-danger underline">
                                {sw ? "Kataa" : "Reject"}
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {error && <div role="alert" className="bg-white text-red-800 border border-red-800 text-sm px-3 py-2">{error}</div>}
              <div>
                <label className="label">{sw ? "Sababu (ni lazima ukikataa au kusimamisha)" : "Reason (required if rejecting/suspending)"}</label>
                <textarea className="input-field" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} />
              </div>
              <div className="flex gap-2 flex-wrap">
                <button disabled={deciding} onClick={() => decide("approved")} className="btn-secondary text-sm">
                  {sw ? "Idhinisha" : "Approve"}
                </button>
                <button disabled={deciding} onClick={() => decide("rejected")} className="btn-danger text-sm">
                  {sw ? "Kataa" : "Reject"}
                </button>
                <button disabled={deciding} onClick={() => decide("suspended")} className="btn-outline text-sm">
                  {sw ? "Simamisha" : "Suspend"}
                </button>
              </div>
            </div>
          ) : (
            <div className="card text-sm text-inkSoft text-center py-8">{sw ? "Chagua ombi upande wa kushoto." : "Select an application on the left."}</div>
          )}
        </div>
      </div>
    </DashboardShell>
  );
}
