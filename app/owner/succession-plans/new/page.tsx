"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import DashboardShell from "@/components/DashboardShell";
import { PageNav } from "@/components/PageNav";
import { createClient } from "@/lib/supabase/client";

type Property = { id: string; name: string; category: string };
type Beneficiary = { id: string; full_name: string; relationship: string };
type Profile = { id: string; full_name: string };
type Allocation = { property_id: string; beneficiary_id: string; share_percentage: string };

export default function NewSuccessionPlanPage() {
  const supabase = createClient();
  const router = useRouter();

  const [properties, setProperties] = useState<Property[]>([]);
  const [beneficiaries, setBeneficiaries] = useState<Beneficiary[]>([]);
  const [witnessOptions, setWitnessOptions] = useState<Profile[]>([]);
  const [leaderOptions, setLeaderOptions] = useState<Profile[]>([]);
  const [legalOptions, setLegalOptions] = useState<Profile[]>([]);

  const [title, setTitle] = useState("");
  const [instructions, setInstructions] = useState("");
  const [allocations, setAllocations] = useState<Allocation[]>([]);
  const [selectedWitnesses, setSelectedWitnesses] = useState<string[]>([]);
  const [selectedLeader, setSelectedLeader] = useState("");
  const [selectedLegal, setSelectedLegal] = useState("");

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const [{ data: props }, { data: bens }, { data: witnesses }, { data: leaders }, { data: legalOfficers }] =
        await Promise.all([
          supabase.from("dfp_properties").select("id, name, category").eq("owner_id", user.id),
          supabase.from("dfp_beneficiaries").select("id, full_name, relationship").eq("owner_id", user.id),
          supabase.from("dfp_profiles").select("id, full_name").eq("role", "witness"),
          supabase.from("dfp_profiles").select("id, full_name").eq("role", "leader"),
          supabase.from("dfp_profiles").select("id, full_name").eq("role", "legal"),
        ]);

      setProperties(props ?? []);
      setBeneficiaries(bens ?? []);
      setWitnessOptions(witnesses ?? []);
      setLeaderOptions(leaders ?? []);
      setLegalOptions(legalOfficers ?? []);
    })();
  }, [supabase]);

  function addAllocationRow() {
    setAllocations([...allocations, { property_id: "", beneficiary_id: "", share_percentage: "" }]);
  }

  function updateAllocation(i: number, patch: Partial<Allocation>) {
    setAllocations((rows) => rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }

  function removeAllocation(i: number) {
    setAllocations((rows) => rows.filter((_, idx) => idx !== i));
  }

  function totalForProperty(propertyId: string) {
    return allocations
      .filter((a) => a.property_id === propertyId)
      .reduce((sum, a) => sum + (Number(a.share_percentage) || 0), 0);
  }

  const allocationErrors = properties
    .map((p) => ({ property: p, total: totalForProperty(p.id) }))
    .filter((x) => x.total > 100);

  const propertiesWithNoAllocation = properties.filter((p) => totalForProperty(p.id) === 0);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return; // guards against a double-click firing this twice
    setError(null);

    if (allocations.length === 0) {
      setError("Add at least one property allocation before submitting.");
      return;
    }
    if (allocationErrors.length > 0) {
      setError(`Allocation for "${allocationErrors[0].property.name}" exceeds 100%.`);
      return;
    }
    if (selectedWitnesses.length < 2) {
      setError("Select at least two family witnesses.");
      return;
    }
    if (!selectedLeader) {
      setError("Select a local government leader to finalize verification.");
      return;
    }

    setLoading(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setError("Your session has expired. Please sign in again.");
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

      const allocationRows = allocations
        .filter((a) => a.property_id && a.beneficiary_id && a.share_percentage)
        .map((a) => ({
          succession_record_id: record.id,
          property_id: a.property_id,
          beneficiary_id: a.beneficiary_id,
          share_percentage: Number(a.share_percentage),
        }));

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

      router.push(`/owner/succession-plans/${record.id}`);
    } catch (err: any) {
      setError(err?.message ?? "An unexpected error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <DashboardShell role="owner">
      <PageNav exitHref="/owner/succession-plans" />
      <h1 className="text-xl font-semibold text-primary mb-6">New Succession Record</h1>

      {(properties.length === 0 || beneficiaries.length === 0) && (
        <div className="card mb-6 bg-white border-amber-700 text-amber-800 text-sm">
          You need at least one property and one beneficiary before building a succession record.
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6 max-w-3xl">
        {error && (
          <div role="alert" className="bg-white text-red-800 border border-red-800 text-sm px-3 py-2">{error}</div>
        )}

        <div className="card space-y-4">
          <h2 className="font-semibold text-primary text-sm uppercase tracking-wide">1. Record Details</h2>
          <div>
            <label className="label">Record Title</label>
            <input
              required
              className="input-field"
              placeholder="e.g. Family Succession Record 2026"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
          <div>
            <label className="label">Instructions (optional)</label>
            <textarea
              className="input-field"
              rows={3}
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
            />
          </div>
        </div>

        <div className="card space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-primary text-sm uppercase tracking-wide">2. Allocate Properties to Beneficiaries</h2>
            <button type="button" onClick={addAllocationRow} className="btn-outline text-xs">
              Add Row
            </button>
          </div>

          {allocations.length === 0 && (
            <p className="text-sm text-neutralDark">No allocations yet. Click &quot;Add Row&quot;.</p>
          )}

          {allocations.map((row, i) => (
            <div key={i} className="grid grid-cols-12 gap-2 items-center">
              <select
                className="input-field col-span-5"
                value={row.property_id}
                onChange={(e) => updateAllocation(i, { property_id: e.target.value })}
              >
                <option value="">Select property…</option>
                {properties.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
              <select
                className="input-field col-span-4"
                value={row.beneficiary_id}
                onChange={(e) => updateAllocation(i, { beneficiary_id: e.target.value })}
              >
                <option value="">Select beneficiary…</option>
                {beneficiaries.map((b) => (
                  <option key={b.id} value={b.id}>{b.full_name} ({b.relationship})</option>
                ))}
              </select>
              <input
                type="number"
                min={1}
                max={100}
                placeholder="%"
                className="input-field col-span-2"
                value={row.share_percentage}
                onChange={(e) => updateAllocation(i, { share_percentage: e.target.value })}
              />
              <button
                type="button"
                onClick={() => removeAllocation(i)}
                className="col-span-1 text-red-800 text-xs"
              >
                Remove
              </button>
            </div>
          ))}

          {allocationErrors.length > 0 && (
            <div className="text-xs text-red-800">
              {allocationErrors.map((x) => (
                <p key={x.property.id}>
                  &quot;{x.property.name}&quot; is allocated {x.total}% — reduce to 100% or less.
                </p>
              ))}
            </div>
          )}
          {propertiesWithNoAllocation.length > 0 && allocations.length > 0 && (
            <div className="text-xs text-amber-800">
              Not yet allocated: {propertiesWithNoAllocation.map((p) => p.name).join(", ")}
            </div>
          )}
        </div>

        <div className="card space-y-4">
          <h2 className="font-semibold text-primary text-sm uppercase tracking-wide">3. Select Verifiers</h2>
          <div>
            <label className="label">Family Witnesses (select at least 2)</label>
            {witnessOptions.length === 0 && (
              <p className="text-xs text-neutralDark">
                No witness accounts exist yet. Ask family members to register as &quot;Family
                Witness&quot;.
              </p>
            )}
            <div className="space-y-1">
              {witnessOptions.map((w) => (
                <label key={w.id} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={selectedWitnesses.includes(w.id)}
                    onChange={(e) =>
                      setSelectedWitnesses((prev) =>
                        e.target.checked ? [...prev, w.id] : prev.filter((id) => id !== w.id)
                      )
                    }
                  />
                  {w.full_name}
                </label>
              ))}
            </div>
          </div>
          <div>
            <label className="label">Local Government Leader</label>
            <select
              className="input-field"
              value={selectedLeader}
              onChange={(e) => setSelectedLeader(e.target.value)}
            >
              <option value="">Select leader…</option>
              {leaderOptions.map((l) => (
                <option key={l.id} value={l.id}>{l.full_name}</option>
              ))}
            </select>
            {leaderOptions.length === 0 && (
              <p className="text-xs text-neutralDark mt-1">
                No leader accounts exist yet. Ask your local leader to register as &quot;Local
                Government Leader&quot;.
              </p>
            )}
          </div>
          <div>
            <label className="label">Legal Officer (optional)</label>
            <select
              className="input-field"
              value={selectedLegal}
              onChange={(e) => setSelectedLegal(e.target.value)}
            >
              <option value="">No legal review required</option>
              {legalOptions.map((l) => (
                <option key={l.id} value={l.id}>{l.full_name}</option>
              ))}
            </select>
            <p className="text-xs text-neutralDark mt-1">
              If assigned, this record undergoes an additional legal review step after leader
              verification, before it is marked verified.
            </p>
          </div>
        </div>

        <button type="submit" disabled={loading} className="btn-primary">
          {loading ? "Submitting…" : "Submit for Verification"}
        </button>
      </form>
    </DashboardShell>
  );
}
