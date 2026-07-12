"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { HeartHandshake } from "lucide-react";
import DashboardShell from "@/components/DashboardShell";
import { EmptyState } from "@/components/EmptyState";
import { PageGuide } from "@/components/PageGuide";
import { createClient } from "@/lib/supabase/client";
import { useLanguage } from "@/lib/i18n";
import { withTimeout } from "@/lib/withTimeout";

const BENEFICIARIES_GUIDE = {
  purpose: { en: "Choose the people who may inherit a share of your property.", sw: "Chagua watu wanaoweza kurithi sehemu ya mali yako." },
  why: {
    en: "Beneficiaries must exist here before you can allocate any property to them in a succession record.",
    sw: "Wanufaika lazima wawepo hapa kabla hujaweza kuwagawia mali yoyote kwenye kumbukumbu ya urithi.",
  },
  example: { en: "Your children, your spouse, or a parent you support.", sw: "Watoto wako, mwenza wako, au mzazi unayemtunza." },
  mistakes: { en: "Forgetting to mark a beneficiary as a minor — this affects what information is required.", sw: "Kusahau kuweka mnufaika kama mchanga — hii inaathiri taarifa zinazohitajika." },
  nextStep: { en: "Once you have your beneficiaries, create a Succession Record to allocate your properties to them.", sw: "Ukishakuwa na wanufaika wako, tengeneza Kumbukumbu ya Urithi kuwagawia mali zako." },
};

type Beneficiary = {
  id: string;
  full_name: string;
  relationship: string;
  phone_number: string | null;
  national_id: string | null;
  linked_user_id: string | null;
  date_of_birth: string | null;
  guardian_name: string | null;
  guardian_phone: string | null;
  guardian_relationship: string | null;
};

type LinkableUser = { id: string; full_name: string; phone_number: string | null };

function calculateAge(dob: string): number {
  const birth = new Date(dob);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
}

function isMinor(dob: string | null): boolean {
  if (!dob) return false;
  return calculateAge(dob) < 18;
}

function BeneficiariesForm() {
  const supabase = createClient();
  const router = useRouter();
  const searchParams = useSearchParams();
  const onboarding = searchParams.get("onboarding") === "1";
  const { lang } = useLanguage();
  const [list, setList] = useState<Beneficiary[]>([]);
  const [linkable, setLinkable] = useState<LinkableUser[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    full_name: "",
    relationship: "",
    phone_number: "",
    national_id: "",
    linked_user_id: "",
    date_of_birth: "",
    guardian_name: "",
    guardian_phone: "",
    guardian_relationship: "",
  });
  const formIsMinor = isMinor(form.date_of_birth || null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const {
        data: { user },
      } = await withTimeout(supabase.auth.getUser(), 15000, { data: { user: null } } as any);
      if (!user) return;

      const emptyList = { data: [] as any[] };
      const [listRes, usersRes] = await Promise.all([
        withTimeout(
          supabase
            .from("dfp_beneficiaries")
            .select(
              "id, full_name, relationship, phone_number, national_id, linked_user_id, date_of_birth, guardian_name, guardian_phone, guardian_relationship"
            )
            .eq("owner_id", user.id)
            .order("created_at", { ascending: false }),
          15000,
          emptyList as any
        ),
        withTimeout(
          supabase.from("dfp_profiles").select("id, full_name, phone_number").eq("role", "beneficiary"),
          15000,
          emptyList as any
        ),
      ]);
      setList(listRes.data ?? []);
      setLinkable(usersRes.data ?? []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (onboarding) setShowForm(true);
  }, [onboarding]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return; // guards against a double-click firing this twice
    setSaving(true);
    setError(null);
    try {
      const {
        data: { user },
      } = await withTimeout(supabase.auth.getUser(), 15000, { data: { user: null } } as any);
      if (!user) {
        setError(lang === "sw" ? "Kikao chako kimeisha. Tafadhali ingia tena." : "Your session has expired. Please sign in again.");
        return;
      }
      if (formIsMinor && !form.guardian_name.trim()) {
        setError(
          lang === "sw"
            ? "Kwa mnufaika mchanga (chini ya miaka 18), jina la mlezi linahitajika."
            : "For a minor beneficiary (under 18), the guardian's name is required."
        );
        return;
      }
      const { error } = await withTimeout(
        supabase.from("dfp_beneficiaries").insert({
          owner_id: user.id,
          full_name: form.full_name,
          relationship: form.relationship,
          phone_number: form.phone_number || null,
          national_id: form.national_id || null,
          linked_user_id: form.linked_user_id || null,
          date_of_birth: form.date_of_birth || null,
          guardian_name: formIsMinor ? form.guardian_name || null : null,
          guardian_phone: formIsMinor ? form.guardian_phone || null : null,
          guardian_relationship: formIsMinor ? form.guardian_relationship || null : null,
        }),
        15000,
        { error: { message: lang === "sw" ? "Muunganisho ulichelewa sana. Jaribu tena." : "The connection took too long. Please try again." } } as any
      );
      if (error) {
        setError(error.message);
        return;
      }
      setForm({
        full_name: "",
        relationship: "",
        phone_number: "",
        national_id: "",
        linked_user_id: "",
        date_of_birth: "",
        guardian_name: "",
        guardian_phone: "",
        guardian_relationship: "",
      });

      // Continue to the next step automatically the first time this list goes from empty
      // to non-empty -- regardless of how this page was reached -- but don't force a returning
      // owner who already has beneficiaries through the chain again just for adding one more.
      if (list.length === 0) {
        router.push("/owner/executors?onboarding=1");
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

  async function handleDelete(id: string) {
    if (!confirm("Remove this beneficiary?")) return;
    await supabase.from("dfp_beneficiaries").delete().eq("id", id);
    load();
  }

  return (
    <DashboardShell role="owner">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-primary">Beneficiary Registry</h1>
        <div className="flex items-center gap-2">
          <PageGuide content={BENEFICIARIES_GUIDE} />
          <button className="btn-primary text-sm" onClick={() => setShowForm((s) => !s)}>
            {showForm ? "Cancel" : "Add Beneficiary"}
          </button>
        </div>
      </div>

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
              <label className="label">Relationship</label>
              <input required className="input-field" placeholder="e.g. Daughter" value={form.relationship} onChange={(e) => setForm({ ...form, relationship: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Phone Number</label>
              <input className="input-field" value={form.phone_number} onChange={(e) => setForm({ ...form, phone_number: e.target.value })} />
            </div>
            <div>
              <label className="label">Date of Birth</label>
              <input
                type="date"
                className="input-field"
                value={form.date_of_birth}
                onChange={(e) => setForm({ ...form, date_of_birth: e.target.value })}
                max={new Date().toISOString().slice(0, 10)}
              />
            </div>
          </div>
          <div>
            <label className="label">
              National ID {formIsMinor ? "(optional for minors)" : ""}
            </label>
            <input className="input-field" value={form.national_id} onChange={(e) => setForm({ ...form, national_id: e.target.value })} />
          </div>

          {formIsMinor && (
            <div className="border border-amber-700 bg-amber-50 p-3 space-y-3">
              <p className="text-sm font-medium text-amber-800">
                Minor Beneficiary — under 18. A guardian must be recorded.
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Guardian Name</label>
                  <input
                    required
                    className="input-field"
                    value={form.guardian_name}
                    onChange={(e) => setForm({ ...form, guardian_name: e.target.value })}
                  />
                </div>
                <div>
                  <label className="label">Guardian Phone</label>
                  <input
                    className="input-field"
                    value={form.guardian_phone}
                    onChange={(e) => setForm({ ...form, guardian_phone: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <label className="label">Guardian Relationship to Child</label>
                <input
                  className="input-field"
                  placeholder="e.g. Mother, Father, Aunt"
                  value={form.guardian_relationship}
                  onChange={(e) => setForm({ ...form, guardian_relationship: e.target.value })}
                />
              </div>
            </div>
          )}

          <div>
            <label className="label">Link to a registered account (optional)</label>
            <select
              className="input-field"
              value={form.linked_user_id}
              onChange={(e) => setForm({ ...form, linked_user_id: e.target.value })}
            >
              <option value="">Not linked — record only</option>
              {linkable.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.full_name} {u.phone_number ? `(${u.phone_number})` : ""}
                </option>
              ))}
            </select>
            <p className="text-xs text-neutralDark mt-1">
              Linking lets this person sign in as &quot;Beneficiary&quot; to confirm their role
              once your succession record is verified. They must register first.
            </p>
          </div>
          <button type="submit" disabled={saving} className="btn-primary">{saving ? "Saving…" : "Save Beneficiary"}</button>
        </form>
      )}

      {loading ? (
        <p className="text-sm text-neutralDark">Loading…</p>
      ) : list.length === 0 ? (
        <EmptyState
          icon={HeartHandshake}
          title={lang === "sw" ? "Bado hujaongeza wanufaika." : "You haven't added any beneficiaries yet."}
          description={
            lang === "sw"
              ? "Mnufaika ni mtu anayepaswa kupokea sehemu ya mali yako baada ya wewe kufariki — kwa mfano mtoto wako, mke/mume wako, au mtu mwingine unayemtaka."
              : "A beneficiary is a person who should receive a share of your property after you pass away — for example your child, spouse, or someone else you choose."
          }
          examples={lang === "sw" ? ["Mtoto wako", "Mke/Mume", "Ndugu"] : ["Your child", "Your spouse", "A sibling"]}
          action={{ label: lang === "sw" ? "Ongeza Mnufaika wa Kwanza" : "Add your first beneficiary", onClick: () => setShowForm(true) }}
          helpHref="/help"
          helpLabel={lang === "sw" ? "Nahitaji msaada zaidi" : "I need more help"}
        />
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-neutralDark border-b border-gray-300">
                <th className="py-2 pr-4">Name</th>
                <th className="py-2 pr-4">Relationship</th>
                <th className="py-2 pr-4">Phone</th>
                <th className="py-2 pr-4">National ID</th>
                <th className="py-2 pr-4">Account</th>
                <th className="py-2"></th>
              </tr>
            </thead>
            <tbody>
              {list.map((b) => (
                <tr key={b.id} className="border-b border-gray-200 last:border-0">
                  <td className="py-2 pr-4 font-medium text-neutralDark">
                    {b.full_name}
                    {isMinor(b.date_of_birth) && (
                      <span className="badge bg-amber-50 text-amber-800 border-amber-700 ml-2">Minor</span>
                    )}
                  </td>
                  <td className="py-2 pr-4 text-neutralDark">{b.relationship}</td>
                  <td className="py-2 pr-4 text-neutralDark">{b.phone_number ?? "—"}</td>
                  <td className="py-2 pr-4 text-neutralDark">{b.national_id ?? "—"}</td>
                  <td className="py-2 pr-4">
                    {b.linked_user_id ? (
                      <span className="badge bg-white text-secondary border-secondary">Linked</span>
                    ) : (
                      <span className="badge bg-neutralLight text-neutralDark border-gray-400">Not linked</span>
                    )}
                  </td>
                  <td className="py-2 text-right">
                    <button onClick={() => handleDelete(b.id)} className="text-xs text-red-800 hover:underline">
                      Remove
                    </button>
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

export default function BeneficiariesPage() {
  return (
    <Suspense fallback={null}>
      <BeneficiariesForm />
    </Suspense>
  );
}
