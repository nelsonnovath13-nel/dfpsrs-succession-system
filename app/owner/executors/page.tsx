"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import DashboardShell from "@/components/DashboardShell";
import { EmptyState } from "@/components/EmptyState";
import { StatusBadge } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import { useLanguage } from "@/lib/i18n";
import { withTimeout } from "@/lib/withTimeout";

type Executor = {
  id: string;
  full_name: string;
  phone_number: string | null;
  national_id: string | null;
  role_type: string;
  status: string;
  linked_user_id: string | null;
};

type LinkableUser = { id: string; full_name: string; phone_number: string | null };
type FamilyMember = { id: string; full_name: string };

const ROLE_TYPES = ["executor", "family_representative", "trusted_contact", "legal_representative"];
const ROLE_TYPE_LABEL: Record<string, string> = {
  executor: "Estate Executor",
  family_representative: "Family Representative",
  trusted_contact: "Trusted Contact",
  legal_representative: "Legal Representative",
};

function ExecutorsForm() {
  const supabase = createClient();
  const router = useRouter();
  const searchParams = useSearchParams();
  const onboarding = searchParams.get("onboarding") === "1";
  const { lang } = useLanguage();
  const [list, setList] = useState<Executor[]>([]);
  const [linkable, setLinkable] = useState<LinkableUser[]>([]);
  const [familyMembers, setFamilyMembers] = useState<FamilyMember[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    full_name: "",
    role_type: "executor",
    phone_number: "",
    national_id: "",
    family_member_id: "",
    linked_user_id: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [gate, setGate] = useState<"ask" | "count" | "filling" | "idle">("idle");
  const [targetCountInput, setTargetCountInput] = useState("1");
  const [targetCount, setTargetCount] = useState(1);
  const [filledCount, setFilledCount] = useState(0);

  async function load() {
    setLoading(true);
    try {
      const {
        data: { user },
      } = await withTimeout(supabase.auth.getUser(), 8000, { data: { user: null } } as any);
      if (!user) return;

      const emptyList = { data: [] as any[] };
      const [listRes, usersRes, familyRes] = await Promise.all([
        withTimeout(
          supabase
            .from("dfp_executors")
            .select("id, full_name, phone_number, national_id, role_type, status, linked_user_id")
            .eq("owner_id", user.id)
            .order("appointed_at", { ascending: false }),
          8000,
          emptyList as any
        ),
        withTimeout(supabase.from("dfp_profiles").select("id, full_name, phone_number"), 8000, emptyList as any),
        withTimeout(
          supabase.from("dfp_family_members").select("id, full_name").eq("owner_id", user.id),
          8000,
          emptyList as any
        ),
      ]);
      setList(listRes.data ?? []);
      setLinkable(usersRes.data ?? []);
      setFamilyMembers(familyRes.data ?? []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (onboarding) setGate("ask");
  }, [onboarding]);

  function answerAdd(yes: boolean) {
    if (!yes) {
      router.push("/owner/succession-plans/new?onboarding=1");
      return;
    }
    setGate("count");
  }

  function startFilling(e: React.FormEvent) {
    e.preventDefault();
    const n = Math.max(1, Math.min(20, Number(targetCountInput) || 1));
    setTargetCount(n);
    setFilledCount(0);
    setGate("filling");
    setShowForm(true);
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return; // guards against a double-click firing this twice
    setSaving(true);
    setError(null);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setError(lang === "sw" ? "Kikao chako kimeisha. Tafadhali ingia tena." : "Your session has expired. Please sign in again.");
        return;
      }
      const { error } = await supabase.from("dfp_executors").insert({
        owner_id: user.id,
        full_name: form.full_name,
        role_type: form.role_type,
        phone_number: form.phone_number || null,
        national_id: form.national_id || null,
        family_member_id: form.family_member_id || null,
        linked_user_id: form.linked_user_id || null,
      });
      if (error) {
        setError(error.message);
        return;
      }
      setForm({ full_name: "", role_type: "executor", phone_number: "", national_id: "", family_member_id: "", linked_user_id: "" });

      if (gate === "filling") {
        const justFilled = filledCount + 1;
        if (justFilled < targetCount) {
          setFilledCount(justFilled);
          load();
          return;
        }
        router.push("/owner/succession-plans/new?onboarding=1");
        return;
      }

      setShowForm(false);
      load();
    } catch (err: any) {
      setError(err?.message ?? (lang === "sw" ? "Hitilafu isiyotarajiwa. Jaribu tena." : "An unexpected error occurred. Please try again."));
    } finally {
      setSaving(false);
    }
  }

  async function handleRevoke(id: string) {
    if (!confirm("Revoke this appointment? They will lose any access already granted.")) return;
    await supabase.from("dfp_executors").update({ status: "revoked" }).eq("id", id);
    load();
  }

  return (
    <DashboardShell role="owner">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-primary">Executors & Representatives</h1>
        {gate === "idle" && (
          <button className="btn-primary text-sm" onClick={() => setShowForm((s) => !s)}>
            {showForm ? "Cancel" : "+ Appoint"}
          </button>
        )}
      </div>
      <p className="text-sm text-neutralDark mb-6">
        Appoint an estate executor, family representative, trusted contact, or legal
        representative. If linked to a registered account, they can sign in to track your
        estate&apos;s progress and receive notifications once the succession release workflow begins.
      </p>

      {gate === "ask" && (
        <div className="card mb-6 max-w-md">
          <p className="font-medium text-ink mb-3">
            {lang === "sw" ? "Je, unataka kuteua msimamizi/mwakilishi sasa?" : "Do you want to appoint an executor/representative now?"}
          </p>
          <div className="flex gap-3">
            <button className="btn-primary" onClick={() => answerAdd(true)}>{lang === "sw" ? "Ndiyo" : "Yes"}</button>
            <button className="btn-outline" onClick={() => answerAdd(false)}>{lang === "sw" ? "Hapana" : "No"}</button>
          </div>
        </div>
      )}

      {gate === "count" && (
        <form onSubmit={startFilling} className="card mb-6 max-w-md space-y-4">
          <div>
            <label className="label">{lang === "sw" ? "Wasimamizi/wawakilishi wangapi unataka kuongeza?" : "How many executors/representatives do you want to add?"}</label>
            <input type="number" required min={1} max={20} className="input-field" value={targetCountInput} onChange={(e) => setTargetCountInput(e.target.value)} />
          </div>
          <button type="submit" className="btn-primary">{lang === "sw" ? "Endelea" : "Continue"}</button>
        </form>
      )}

      {gate === "filling" && targetCount > 1 && (
        <p className="text-sm font-medium text-primary mb-3">
          {lang === "sw" ? `Namba ${filledCount + 1} kati ya ${targetCount}` : `Number ${filledCount + 1} of ${targetCount}`}
        </p>
      )}

      {showForm && (
        <form onSubmit={handleAdd} className="card mb-6 space-y-4 max-w-xl">
          {error && (
            <div role="alert" className="bg-white text-red-800 border border-red-800 text-sm px-3 py-2">{error}</div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Full Name</label>
              <input required className="input-field" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
            </div>
            <div>
              <label className="label">Appointment Type</label>
              <select className="input-field" value={form.role_type} onChange={(e) => setForm({ ...form, role_type: e.target.value })}>
                {ROLE_TYPES.map((t) => (
                  <option key={t} value={t}>{ROLE_TYPE_LABEL[t]}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Phone Number</label>
              <input className="input-field" value={form.phone_number} onChange={(e) => setForm({ ...form, phone_number: e.target.value })} />
            </div>
            <div>
              <label className="label">National ID</label>
              <input className="input-field" value={form.national_id} onChange={(e) => setForm({ ...form, national_id: e.target.value })} />
            </div>
          </div>
          <div>
            <label className="label">Link to a family member record (optional)</label>
            <select className="input-field" value={form.family_member_id} onChange={(e) => setForm({ ...form, family_member_id: e.target.value })}>
              <option value="">Not linked</option>
              {familyMembers.map((m) => (
                <option key={m.id} value={m.id}>{m.full_name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Link to a registered account (optional)</label>
            <select className="input-field" value={form.linked_user_id} onChange={(e) => setForm({ ...form, linked_user_id: e.target.value })}>
              <option value="">Not linked — record only</option>
              {linkable.map((u) => (
                <option key={u.id} value={u.id}>{u.full_name} {u.phone_number ? `(${u.phone_number})` : ""}</option>
              ))}
            </select>
            <p className="text-xs text-neutralDark mt-1">
              Linking lets this person sign in as &quot;Estate Executor&quot; to track progress and
              receive notifications. They must register first.
            </p>
          </div>
          <button type="submit" disabled={saving} className="btn-primary">{saving ? "Saving…" : "Save Appointment"}</button>
        </form>
      )}

      {loading ? (
        <p className="text-sm text-neutralDark">Loading…</p>
      ) : list.length === 0 ? (
        <EmptyState
          icon={ShieldCheck}
          title={lang === "sw" ? "Bado hujateua msimamizi wa urithi." : "You haven't appointed an estate executor yet."}
          description={
            lang === "sw"
              ? "Msimamizi wa urithi ni mtu unayemwamini kufuatilia mchakato wa urithi wako baada ya wewe kufariki — anaweza kuwa mwanafamilia, wakili, au mtu mwingine unayemwamini."
              : "An executor is someone you trust to follow through on your succession plan after you pass away — a family member, a lawyer, or anyone else you trust."
          }
          examples={
            lang === "sw"
              ? ["Msimamizi wa Mirathi", "Mwakilishi wa Familia", "Mtu wa Kuaminika", "Mwakilishi wa Kisheria"]
              : ["Estate Executor", "Family Representative", "Trusted Contact", "Legal Representative"]
          }
          action={{ label: lang === "sw" ? "Teua wa Kwanza" : "Appoint your first executor", onClick: () => setShowForm(true) }}
          helpHref="/help"
          helpLabel={lang === "sw" ? "Nahitaji msaada zaidi" : "I need more help"}
        />
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-neutralDark border-b border-gray-300">
                <th className="py-2 pr-4">Name</th>
                <th className="py-2 pr-4">Type</th>
                <th className="py-2 pr-4">Phone</th>
                <th className="py-2 pr-4">Account</th>
                <th className="py-2 pr-4">Status</th>
                <th className="py-2"></th>
              </tr>
            </thead>
            <tbody>
              {list.map((ex) => (
                <tr key={ex.id} className="border-b border-gray-200 last:border-0">
                  <td className="py-2 pr-4 font-medium text-neutralDark">{ex.full_name}</td>
                  <td className="py-2 pr-4 text-neutralDark">{ROLE_TYPE_LABEL[ex.role_type]}</td>
                  <td className="py-2 pr-4 text-neutralDark">{ex.phone_number ?? "—"}</td>
                  <td className="py-2 pr-4">
                    {ex.linked_user_id ? (
                      <span className="badge bg-white text-secondary border-secondary">Linked</span>
                    ) : (
                      <span className="badge bg-neutralLight text-neutralDark border-gray-400">Not linked</span>
                    )}
                  </td>
                  <td className="py-2 pr-4"><StatusBadge status={ex.status} /></td>
                  <td className="py-2 text-right">
                    {ex.status === "active" && (
                      <button onClick={() => handleRevoke(ex.id)} className="text-xs text-red-800 hover:underline">
                        Revoke
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </DashboardShell>
  );
}

export default function ExecutorsPage() {
  return (
    <Suspense fallback={null}>
      <ExecutorsForm />
    </Suspense>
  );
}
