"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import DashboardShell from "@/components/DashboardShell";
import { createClient } from "@/lib/supabase/client";

const CATEGORIES = ["boundary", "ownership", "allocation", "fraud", "other"];

export default function NewDisputePage() {
  const supabase = createClient();
  const router = useRouter();
  const [records, setRecords] = useState<{ id: string; title: string }[]>([]);
  const [form, setForm] = useState({ succession_record_id: "", category: "ownership", description: "" });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from("dfp_succession_records")
        .select("id, title")
        .eq("owner_id", user.id);
      setRecords(data ?? []);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("dfp_disputes")
      .insert({
        succession_record_id: form.succession_record_id,
        opened_by: user.id,
        category: form.category,
        description: form.description,
      })
      .select("id")
      .single();
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    router.push(`/owner/disputes/${data.id}`);
  }

  return (
    <DashboardShell role="owner">
      <h1 className="text-xl font-semibold text-primary mb-6">Open a Dispute</h1>
      <form onSubmit={handleSubmit} className="card max-w-xl space-y-4">
        {error && (
          <div role="alert" className="bg-white text-red-800 border border-red-800 text-sm px-3 py-2">{error}</div>
        )}
        <div>
          <label className="label">Succession Record</label>
          <select
            required
            className="input-field"
            value={form.succession_record_id}
            onChange={(e) => setForm({ ...form, succession_record_id: e.target.value })}
          >
            <option value="">Select…</option>
            {records.map((r) => (
              <option key={r.id} value={r.id}>{r.title}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Category</label>
          <select className="input-field" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Description</label>
          <textarea
            required
            className="input-field"
            rows={4}
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
        </div>
        <button disabled={loading} type="submit" className="btn-primary">
          {loading ? "Submitting…" : "Open Dispute"}
        </button>
      </form>
    </DashboardShell>
  );
}
