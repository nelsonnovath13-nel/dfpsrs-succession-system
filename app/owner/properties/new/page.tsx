"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import DashboardShell from "@/components/DashboardShell";
import { createClient } from "@/lib/supabase/client";

const CATEGORIES = [
  "land", "house", "farm", "vehicle", "business", "livestock", "bank_account", "investment", "other",
];

export default function NewPropertyPage() {
  const supabase = createClient();
  const router = useRouter();
  const [form, setForm] = useState({
    name: "",
    category: "land",
    ownership_type: "sole",
    estimated_value: "",
    location: "",
    description: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase.from("dfp_properties").insert({
      owner_id: user.id,
      name: form.name,
      category: form.category,
      ownership_type: form.ownership_type,
      estimated_value: form.estimated_value ? Number(form.estimated_value) : null,
      location: form.location || null,
      description: form.description || null,
    });
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    router.push("/owner/properties");
  }

  return (
    <DashboardShell role="owner">
      <h1 className="text-xl font-semibold text-primary mb-6">Register Property</h1>
      <form onSubmit={handleSubmit} className="card max-w-xl space-y-4">
        {error && (
          <div className="bg-white text-red-800 border border-red-800 text-sm px-3 py-2">{error}</div>
        )}
        <div>
          <label className="label">Property Name</label>
          <input
            required
            className="input-field"
            placeholder="e.g. Family home, Mbezi"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
        </div>
        <div>
          <label className="label">Property Category</label>
          <select
            className="input-field"
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c.replace("_", " ")}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Ownership Type</label>
          <select
            className="input-field"
            value={form.ownership_type}
            onChange={(e) => setForm({ ...form, ownership_type: e.target.value })}
          >
            <option value="sole">Sole Ownership</option>
            <option value="joint">Joint Ownership</option>
            <option value="family">Family Ownership</option>
            <option value="customary">Customary Ownership</option>
            <option value="leasehold">Leasehold</option>
            <option value="other">Other</option>
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Estimated Value (TZS)</label>
            <input
              type="number"
              min={0}
              className="input-field"
              value={form.estimated_value}
              onChange={(e) => setForm({ ...form, estimated_value: e.target.value })}
            />
          </div>
          <div>
            <label className="label">Location</label>
            <input
              className="input-field"
              value={form.location}
              onChange={(e) => setForm({ ...form, location: e.target.value })}
            />
          </div>
        </div>
        <div>
          <label className="label">Description (optional)</label>
          <textarea
            className="input-field"
            rows={3}
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
        </div>
        <p className="text-xs text-neutralDark">
          A registry number is assigned automatically. After saving, you can upload supporting
          documents (title deed, certificate, photographs) from the Property Registry.
        </p>
        <div className="flex gap-3">
          <button type="submit" disabled={loading} className="btn-primary">
            {loading ? "Saving…" : "Save Property"}
          </button>
        </div>
      </form>
    </DashboardShell>
  );
}
