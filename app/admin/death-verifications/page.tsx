"use client";

import { useEffect, useState } from "react";
import DashboardShell from "@/components/DashboardShell";
import { StatusBadge } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";

type DeathVerification = {
  id: string;
  owner_id: string;
  status: string;
  reported_at: string;
};

type Owner = { id: string; full_name: string };

export default function AdminDeathVerificationsPage() {
  const supabase = createClient();
  const [list, setList] = useState<DeathVerification[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [owners, setOwners] = useState<Owner[]>([]);
  const [selectedOwner, setSelectedOwner] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from("dfp_death_verifications")
      .select("id, owner_id, status, reported_at")
      .order("reported_at", { ascending: false });
    setList(data ?? []);

    const ownerIds = (data ?? []).map((d) => d.owner_id);
    const { data: profiles } = await supabase.from("dfp_profiles").select("id, full_name").eq("role", "owner");
    setOwners(profiles ?? []);
    const map: Record<string, string> = {};
    (profiles ?? []).forEach((p) => (map[p.id] = p.full_name));
    setNames(map);

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
    const { error } = await supabase.rpc("dfp_report_death", { p_owner_id: selectedOwner });
    setSubmitting(false);
    if (error) {
      setError(error.message);
      return;
    }
    setSelectedOwner("");
    setShowForm(false);
    load();
  }

  const alreadyReported = new Set(list.map((d) => d.owner_id));
  const reportable = owners.filter((o) => !alreadyReported.has(o.id));

  return (
    <DashboardShell role="admin">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-primary">Death Verification</h1>
        <button className="btn-primary text-sm" onClick={() => setShowForm((s) => !s)}>
          {showForm ? "Cancel" : "Report a Death"}
        </button>
      </div>
      <p className="text-sm text-neutralDark mb-6">
        Admin fallback for filing a death report when no witness or leader is available to do so.
        Starts the multi-stage verification workflow: family witnesses, then local government,
        then legal review (if a legal officer is assigned), then succession release.
      </p>

      {showForm && (
        <form onSubmit={handleReport} className="card mb-6 space-y-4 max-w-md">
          {error && (
            <div role="alert" className="bg-white text-red-800 border border-red-800 text-sm px-3 py-2">{error}</div>
          )}
          <div>
            <label className="label">Property Owner</label>
            <select required className="input-field" value={selectedOwner} onChange={(e) => setSelectedOwner(e.target.value)}>
              <option value="">Select…</option>
              {reportable.map((o) => (
                <option key={o.id} value={o.id}>{o.full_name}</option>
              ))}
            </select>
          </div>
          <button disabled={submitting} type="submit" className="btn-primary">
            {submitting ? "Submitting…" : "File Death Report"}
          </button>
        </form>
      )}

      {loading ? (
        <p className="text-sm text-neutralDark">Loading…</p>
      ) : list.length === 0 ? (
        <div className="card text-center py-10 text-neutralDark">No death verification workflows in progress.</div>
      ) : (
        <div className="space-y-3">
          {list.map((d) => (
            <div key={d.id} className="card flex items-center justify-between">
              <div>
                <p className="font-medium text-neutralDark">{names[d.owner_id] ?? "—"}</p>
                <p className="text-xs text-neutralDark">Reported {new Date(d.reported_at).toLocaleDateString()}</p>
              </div>
              <StatusBadge status={d.status} />
            </div>
          ))}
        </div>
      )}
    </DashboardShell>
  );
}
