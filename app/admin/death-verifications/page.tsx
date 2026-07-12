"use client";

import { useEffect, useState } from "react";
import DashboardShell from "@/components/DashboardShell";
import { StatusBadge } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import { useLanguage } from "@/lib/i18n";
import { AlertTriangle, Clock, FileText, ShieldAlert } from "lucide-react";

type DeathVerification = {
  id: string;
  owner_id: string;
  status: string;
  reported_at: string;
  confirmed_at: string | null;
  released_at: string | null;
  earliest_release_at: string | null;
  certificate_file_path: string | null;
  burial_permit_file_path: string | null;
};

type Owner = { id: string; full_name: string; owner_status: string };

const STATUS_LABEL: Record<string, { en: string; sw: string }> = {
  reported_deceased: { en: "Reported - awaiting confirmations", sw: "Imeripotiwa - inasubiri uthibitisho" },
  witness_confirmed: { en: "Witnesses confirmed", sw: "Mashahidi wamethibitisha" },
  leader_confirmed: { en: "Leader confirmed", sw: "Kiongozi amethibitisha" },
  legal_reviewed: { en: "Legal review complete", sw: "Uhakiki wa kisheria umekamilika" },
  confirmed: { en: "Confirmed - in waiting period", sw: "Imethibitishwa - kwenye kipindi cha kusubiri" },
  released: { en: "Released - estate active", sw: "Imeachiliwa - mirathi imefunguliwa" },
};

export default function AdminDeathVerificationsPage() {
  const supabase = createClient();
  const { lang } = useLanguage();
  const sw = lang === "sw";
  const [list, setList] = useState<DeathVerification[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [ownerStatus, setOwnerStatus] = useState<Record<string, string>>({});
  const [disputeOwners, setDisputeOwners] = useState<Set<string>>(new Set());
  const [owners, setOwners] = useState<Owner[]>([]);
  const [selectedOwner, setSelectedOwner] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [certFile, setCertFile] = useState<File | null>(null);
  const [permitFile, setPermitFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [releasing, setReleasing] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from("dfp_death_verifications")
      .select("id, owner_id, status, reported_at, confirmed_at, released_at, earliest_release_at, certificate_file_path, burial_permit_file_path")
      .order("reported_at", { ascending: false });
    setList(data ?? []);

    const { data: profiles } = await supabase.from("dfp_profiles").select("id, full_name, owner_status").eq("role", "owner");
    setOwners((profiles as any) ?? []);
    const nameMap: Record<string, string> = {};
    const statusMap: Record<string, string> = {};
    (profiles ?? []).forEach((p: any) => {
      nameMap[p.id] = p.full_name;
      statusMap[p.id] = p.owner_status;
    });
    setNames(nameMap);
    setOwnerStatus(statusMap);

    const ownerIds = (data ?? []).map((d) => d.owner_id);
    if (ownerIds.length > 0) {
      const { data: disputes } = await supabase
        .from("dfp_disputes")
        .select("status, dfp_succession_records(owner_id)")
        .eq("status", "open");
      const set = new Set<string>();
      (disputes as any[] ?? []).forEach((d) => {
        const oid = d.dfp_succession_records?.owner_id;
        if (oid && ownerIds.includes(oid)) set.add(oid);
      });
      setDisputeOwners(set);
    }

    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleReport(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!selectedOwner) return;
    setSubmitting(true);

    const { data: dvId, error: reportError } = await supabase.rpc("dfp_report_death", { p_owner_id: selectedOwner });
    if (reportError) {
      setSubmitting(false);
      setError(reportError.message);
      return;
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    let certPath: string | null = null;
    let permitPath: string | null = null;

    if (user && certFile) {
      const path = `${user.id}/death-${selectedOwner}/certificate-${Date.now()}-${certFile.name}`;
      const { error: upErr } = await supabase.storage.from("dfp-documents").upload(path, certFile);
      if (!upErr) certPath = path;
    }
    if (user && permitFile) {
      const path = `${user.id}/death-${selectedOwner}/burial-permit-${Date.now()}-${permitFile.name}`;
      const { error: upErr } = await supabase.storage.from("dfp-documents").upload(path, permitFile);
      if (!upErr) permitPath = path;
    }

    if (certPath || permitPath) {
      await supabase.rpc("dfp_attach_death_documents", {
        p_death_verification_id: dvId,
        p_certificate_path: certPath,
        p_burial_permit_path: permitPath,
      });
    }

    setSubmitting(false);
    setSelectedOwner("");
    setCertFile(null);
    setPermitFile(null);
    setShowForm(false);
    load();
  }

  async function viewDoc(path: string) {
    const newTab = window.open("", "_blank");
    const { data, error } = await supabase.storage.from("dfp-documents").createSignedUrl(path, 60);
    if (error || !data) {
      newTab?.close();
      alert(sw ? "Imeshindikana kufungua faili." : "Could not open file.");
      return;
    }
    if (newTab) newTab.location.href = data.signedUrl;
  }

  async function handleToggleIncapacitated(ownerId: string, flag: boolean) {
    const reason = window.prompt(
      sw ? "Toa sababu fupi ya mabadiliko haya (kwa kumbukumbu ya ukaguzi):" : "Give a short reason for this change (for the audit record):"
    );
    if (reason === null) return;
    const { error: rpcError } = await supabase.rpc("dfp_set_owner_incapacitated", {
      p_owner_id: ownerId,
      p_flag: flag,
      p_reason: reason,
    });
    if (rpcError) {
      alert(rpcError.message);
      return;
    }
    load();
  }

  async function handleCheckRelease(ownerId: string) {
    setReleasing(ownerId);
    await supabase.rpc("dfp_try_release_death", { p_owner_id: ownerId });
    setReleasing(null);
    load();
  }

  const alreadyReported = new Set(list.map((d) => d.owner_id));
  const reportable = owners.filter((o) => !alreadyReported.has(o.id));

  return (
    <DashboardShell role="admin">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-primary">{sw ? "Uhakiki wa Kifo" : "Death Verification"}</h1>
        <button className="btn-primary text-sm" onClick={() => setShowForm((s) => !s)}>
          {showForm ? (sw ? "Ghairi" : "Cancel") : sw ? "Ripoti Kifo" : "Report a Death"}
        </button>
      </div>
      <p className="text-sm text-neutralDark mb-6">
        {sw
          ? "Njia mbadala kwa msimamizi kufungua ripoti ya kifo pale ambapo hakuna shahidi au kiongozi anayepatikana. Baada ya uthibitisho wa mashahidi, kiongozi, na (ikiwa yupo) afisa sheria, kipindi cha lazima cha kusubiri cha siku 7 huanza kabla ya mirathi kuachiliwa - hii inatoa nafasi ya mgogoro wowote kuletwa. Mirathi haitaachiliwa ikiwa kuna mgogoro wazi."
          : "Admin fallback for filing a death report when no witness or leader is available to do so. After witness, leader, and (if assigned) legal review confirm, a mandatory 7-day waiting period begins before the estate is released - giving time for any dispute to be raised. The estate will not release while an open dispute exists."}
      </p>

      {showForm && (
        <form onSubmit={handleReport} className="card mb-6 space-y-4 max-w-md">
          {error && (
            <div role="alert" className="bg-white text-red-800 border border-red-800 text-sm px-3 py-2">{error}</div>
          )}
          <div>
            <label className="label">{sw ? "Mmiliki wa Mali" : "Property Owner"}</label>
            <select required className="input-field" value={selectedOwner} onChange={(e) => setSelectedOwner(e.target.value)}>
              <option value="">{sw ? "Chagua..." : "Select…"}</option>
              {reportable.map((o) => (
                <option key={o.id} value={o.id}>{o.full_name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">{sw ? "Cheti cha Kifo (si lazima, kinaweza kuongezwa baadaye)" : "Death Certificate (optional, can be added later)"}</label>
            <input type="file" accept="application/pdf,image/*" className="input-field" onChange={(e) => setCertFile(e.target.files?.[0] ?? null)} />
          </div>
          <div>
            <label className="label">{sw ? "Kibali cha Mazishi (si lazima)" : "Burial Permit (optional)"}</label>
            <input type="file" accept="application/pdf,image/*" className="input-field" onChange={(e) => setPermitFile(e.target.files?.[0] ?? null)} />
          </div>
          <button disabled={submitting} type="submit" className="btn-primary">
            {submitting ? (sw ? "Inatuma..." : "Submitting…") : sw ? "Wasilisha Ripoti ya Kifo" : "File Death Report"}
          </button>
        </form>
      )}

      <div className="card mb-6">
        <h2 className="font-semibold text-primary text-sm uppercase tracking-wide mb-1">
          {sw ? "Hali ya Wamiliki" : "Owner Status"}
        </h2>
        <p className="text-xs text-inkSoft mb-3">
          {sw
            ? "\"Amelemaa\" (Incapacitated) ni tathmini ya kibinadamu inayowekwa na kiongozi/afisa sheria/msimamizi pale mmiliki hawezi kujiendesha mwenyewe kwa muda, bila kuwa amefariki. Haiwezi kuwekwa kama tayari ameripotiwa kufariki."
            : "\"Incapacitated\" is a human judgment call set by a leader, legal officer, or admin when an owner cannot act for themselves temporarily, without having died. It cannot be set once they are already recorded as deceased."}
        </p>
        <div className="border border-gray-300 divide-y divide-gray-200">
          {owners.filter((o) => o.owner_status !== "deceased").map((o) => (
            <div key={o.id} className="flex items-center justify-between px-3 py-2">
              <div>
                <p className="text-sm text-ink">{o.full_name}</p>
                <p className="text-xs text-inkSoft capitalize">{o.owner_status}</p>
              </div>
              <button
                onClick={() => handleToggleIncapacitated(o.id, o.owner_status !== "incapacitated")}
                className="btn-outline text-xs"
              >
                {o.owner_status === "incapacitated"
                  ? sw
                    ? "Rejesha kuwa Hai"
                    : "Restore to Active"
                  : sw
                  ? "Weka Amelemaa"
                  : "Mark Incapacitated"}
              </button>
            </div>
          ))}
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-neutralDark">{sw ? "Inapakia..." : "Loading…"}</p>
      ) : list.length === 0 ? (
        <div className="card text-center py-10 text-neutralDark">{sw ? "Hakuna mchakato wa uhakiki wa kifo unaoendelea." : "No death verification workflows in progress."}</div>
      ) : (
        <div className="space-y-3">
          {list.map((d) => {
            const hasDispute = disputeOwners.has(d.owner_id);
            const waitingPeriodOver = d.earliest_release_at ? new Date(d.earliest_release_at) <= new Date() : false;
            return (
              <div key={d.id} className="card">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <p className="font-medium text-neutralDark">{names[d.owner_id] ?? "—"}</p>
                    <p className="text-xs text-neutralDark">
                      {sw ? "Imeripotiwa" : "Reported"} {new Date(d.reported_at).toLocaleDateString()}
                      {" • "}
                      {sw ? "Hali ya Mmiliki" : "Owner Status"}: <span className="font-medium capitalize">{ownerStatus[d.owner_id] ?? "active"}</span>
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs px-2 py-1 border border-gray-300 bg-neutralLight">
                      {sw ? STATUS_LABEL[d.status]?.sw ?? d.status : STATUS_LABEL[d.status]?.en ?? d.status}
                    </span>
                    <StatusBadge status={d.status} />
                  </div>
                </div>

                <div className="flex items-center gap-3 mt-3 flex-wrap">
                  {d.certificate_file_path && (
                    <button onClick={() => viewDoc(d.certificate_file_path!)} className="inline-flex items-center gap-1 text-xs text-primary underline">
                      <FileText size={12} aria-hidden="true" /> {sw ? "Cheti cha Kifo" : "Death Certificate"}
                    </button>
                  )}
                  {d.burial_permit_file_path && (
                    <button onClick={() => viewDoc(d.burial_permit_file_path!)} className="inline-flex items-center gap-1 text-xs text-primary underline">
                      <FileText size={12} aria-hidden="true" /> {sw ? "Kibali cha Mazishi" : "Burial Permit"}
                    </button>
                  )}
                </div>

                {d.status === "confirmed" && (
                  <div className="mt-3 pt-3 border-t border-gray-200">
                    {hasDispute ? (
                      <div className="flex items-start gap-2 text-sm text-red-800">
                        <ShieldAlert size={16} className="shrink-0 mt-0.5" aria-hidden="true" />
                        <p>
                          {sw
                            ? "Imezuiwa: kuna mgogoro wazi kwenye kumbukumbu ya urithi ya mmiliki huyu. Suluhisha mgogoro kwanza kabla ya kuachilia mirathi."
                            : "Blocked: an open dispute exists on this owner's succession record. Resolve the dispute before the estate can be released."}
                        </p>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div className="flex items-center gap-2 text-sm text-inkSoft">
                          <Clock size={16} aria-hidden="true" />
                          {waitingPeriodOver
                            ? sw
                              ? "Kipindi cha kusubiri kimekwisha - tayari kuachiliwa."
                              : "Waiting period has elapsed - ready to release."
                            : sw
                            ? `Kipindi cha kusubiri kinaisha ${new Date(d.earliest_release_at!).toLocaleString()}`
                            : `Waiting period ends ${new Date(d.earliest_release_at!).toLocaleString()}`}
                        </div>
                        <button
                          disabled={!waitingPeriodOver || releasing === d.owner_id}
                          onClick={() => handleCheckRelease(d.owner_id)}
                          className="btn-primary text-xs"
                        >
                          {releasing === d.owner_id ? (sw ? "Inaachilia..." : "Releasing…") : sw ? "Kagua na Uachilie" : "Check & Release"}
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {d.status !== "released" && d.status !== "confirmed" && hasDispute && (
                  <div className="flex items-start gap-2 text-xs text-amber-800 mt-3 pt-3 border-t border-gray-200">
                    <AlertTriangle size={14} className="shrink-0 mt-0.5" aria-hidden="true" />
                    <p>
                      {sw
                        ? "Onyo: kuna mgogoro wazi kwenye kumbukumbu ya urithi ya mmiliki huyu tayari."
                        : "Note: an open dispute already exists on this owner's succession record."}
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </DashboardShell>
  );
}
