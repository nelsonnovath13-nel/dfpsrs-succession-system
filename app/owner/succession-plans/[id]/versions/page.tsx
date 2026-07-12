"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import DashboardShell from "@/components/DashboardShell";
import { PageNav } from "@/components/PageNav";
import { createClient } from "@/lib/supabase/client";
import { useLanguage } from "@/lib/i18n";

type Version = {
  id: string;
  version_number: number;
  snapshot: any;
  action: string;
  reason: string | null;
  created_at: string;
  changed_by: string | null;
};

export default function VersionHistoryPage() {
  const params = useParams<{ id: string }>();
  const supabase = createClient();
  const { lang } = useLanguage();
  const sw = lang === "sw";
  const [record, setRecord] = useState<any>(null);
  const [versions, setVersions] = useState<Version[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [restoring, setRestoring] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const { data: rec } = await supabase
      .from("dfp_succession_records")
      .select("id, title, is_locked, current_version")
      .eq("id", params.id)
      .single();
    setRecord(rec);

    const { data } = await supabase
      .from("dfp_succession_record_versions")
      .select("id, version_number, snapshot, action, reason, created_at, changed_by")
      .eq("succession_record_id", params.id)
      .order("version_number", { ascending: false });
    setVersions(data ?? []);

    const userIds = Array.from(new Set((data ?? []).map((v) => v.changed_by).filter(Boolean))) as string[];
    if (userIds.length > 0) {
      const { data: profiles } = await supabase.from("dfp_profiles").select("id, full_name").in("id", userIds);
      const map: Record<string, string> = {};
      (profiles ?? []).forEach((p) => (map[p.id] = p.full_name));
      setNames(map);
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleRestore(versionNumber: number) {
    if (
      !confirm(
        sw
          ? `Rejesha toleo ${versionNumber}? Hii itaunda toleo jipya lenye maudhui hayo.`
          : `Restore version ${versionNumber}? This creates a new version with that content.`
      )
    )
      return;
    setError(null);
    setRestoring(versionNumber);
    const { error } = await supabase.rpc("dfp_restore_version", {
      p_record_id: params.id,
      p_version_number: versionNumber,
    });
    setRestoring(null);
    if (error) {
      setError(error.message);
      return;
    }
    load();
  }

  if (loading || !record) {
    return (
      <DashboardShell role="owner">
        <p className="text-sm text-neutralDark">{sw ? "Inapakia…" : "Loading…"}</p>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell role="owner">
      <PageNav exitHref={`/owner/succession-plans/${params.id}`} />
      <h1 className="text-xl font-semibold text-primary mb-2">{sw ? "Historia ya Matoleo" : "Version History"} — {record.title}</h1>
      <p className="text-sm text-neutralDark mb-6">
        {record.is_locked
          ? sw
            ? "Kumbukumbu hii imefungwa kwa sababu imethibitishwa kikamilifu. Kurejesha toleo la awali kunahitaji msimamizi kuifungua kwanza."
            : "This record is locked because it has been fully verified. Restoring an earlier version requires an administrator to unlock it first."
          : sw
          ? "Kila hifadhi huunda toleo jipya. Unaweza kurejesha toleo la awali wakati wowote kumbukumbu ikiwa haijafungwa."
          : "Every save creates a new version. You can restore an earlier version at any time while the record is unlocked."}
      </p>

      {error && (
        <div role="alert" className="bg-white text-red-800 border border-red-800 text-sm px-3 py-2 mb-4">{error}</div>
      )}

      {versions.length === 0 ? (
        <div className="card text-center py-10 text-neutralDark">{sw ? "Bado hakuna historia ya matoleo." : "No version history yet."}</div>
      ) : (
        <div className="space-y-3">
          {versions.map((v) => (
            <div key={v.id} className="card">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <p className="font-medium text-neutralDark">
                    {sw ? "Toleo" : "Version"} {v.version_number}
                    {v.version_number === record.current_version && (
                      <span className="badge bg-white text-secondary border-secondary ml-2">{sw ? "Sasa" : "Current"}</span>
                    )}
                  </p>
                  <p className="text-xs text-neutralDark capitalize">
                    {v.action} {sw ? "na" : "by"} {names[v.changed_by ?? ""] ?? (sw ? "mfumo" : "system")} · {new Date(v.created_at).toLocaleString()}
                  </p>
                </div>
                {v.version_number !== record.current_version && !record.is_locked && (
                  <button
                    disabled={restoring === v.version_number}
                    onClick={() => handleRestore(v.version_number)}
                    className="btn-outline text-xs"
                  >
                    {restoring === v.version_number ? (sw ? "Inarejesha…" : "Restoring…") : (sw ? "Rejesha" : "Restore")}
                  </button>
                )}
              </div>
              <p className="text-sm text-neutralDark">{v.snapshot?.title}</p>
              {v.snapshot?.instructions && (
                <p className="text-xs text-neutralDark mt-1">{v.snapshot.instructions}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </DashboardShell>
  );
}
