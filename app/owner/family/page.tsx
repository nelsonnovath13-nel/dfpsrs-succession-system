"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Users, User, ChevronDown, ChevronRight } from "lucide-react";
import DashboardShell from "@/components/DashboardShell";
import { EmptyState } from "@/components/EmptyState";
import { createClient } from "@/lib/supabase/client";
import { useLanguage } from "@/lib/i18n";

type Member = {
  id: string;
  full_name: string;
  relationship_type: string;
  phone_number: string | null;
  national_id: string | null;
  date_of_birth: string | null;
  parent_member_id: string | null;
};

const TYPES = ["father", "mother", "spouse", "child", "dependent", "extended"];
const TYPE_LABEL: Record<string, string> = {
  father: "Father",
  mother: "Mother",
  spouse: "Spouse",
  child: "Child",
  dependent: "Dependent",
  extended: "Extended Family",
};

function TreeNode({
  member,
  members,
  depth,
  onSelect,
  selectedId,
}: {
  member: Member;
  members: Member[];
  depth: number;
  onSelect: (id: string) => void;
  selectedId: string | null;
}) {
  const children = members.filter((m) => m.parent_member_id === member.id);
  const [expanded, setExpanded] = useState(true);
  const tierStyle =
    depth === 0
      ? "bg-white border-2 border-primary text-ink"
      : depth === 1
      ? "bg-white border border-gray-400 text-ink"
      : "bg-neutralLight border border-gray-300 text-inkSoft";

  return (
    <div className={depth > 0 ? "pl-5 border-l-2 border-gray-300 ml-3" : ""}>
      <div className="flex items-center gap-2 py-1.5">
        {children.length > 0 && (
          <button
            type="button"
            onClick={() => setExpanded((e) => !e)}
            aria-label={expanded ? "Funga" : "Fungua"}
            aria-expanded={expanded}
            className="text-neutralDark shrink-0"
          >
            {expanded ? <ChevronDown size={16} aria-hidden="true" /> : <ChevronRight size={16} aria-hidden="true" />}
          </button>
        )}
        <button
          type="button"
          onClick={() => onSelect(member.id)}
          className={`flex items-center gap-2 px-3 py-2 text-left ${tierStyle} ${
            selectedId === member.id ? "ring-2 ring-primary" : ""
          }`}
          style={{ minHeight: 44 }}
        >
          <User size={16} aria-hidden="true" className="shrink-0" />
          <span className="text-sm font-medium">{member.full_name}</span>
          <span className="text-xs opacity-75">({TYPE_LABEL[member.relationship_type]})</span>
        </button>
      </div>
      {expanded &&
        children.map((c) => (
          <TreeNode key={c.id} member={c} members={members} depth={depth + 1} onSelect={onSelect} selectedId={selectedId} />
        ))}
    </div>
  );
}

function FamilyStructureForm() {
  const supabase = createClient();
  const router = useRouter();
  const searchParams = useSearchParams();
  const onboarding = searchParams.get("onboarding") === "1";
  const { lang } = useLanguage();
  const [members, setMembers] = useState<Member[]>([]);
  const [ownerName, setOwnerName] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ full_name: "", relationship_type: "child", phone_number: "", national_id: "", date_of_birth: "", parent_member_id: "" });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase
      .from("dfp_family_members")
      .select("id, full_name, relationship_type, phone_number, national_id, date_of_birth, parent_member_id")
      .eq("owner_id", user.id)
      .order("created_at", { ascending: true });
    setMembers(data ?? []);

    const { data: profile } = await supabase.from("dfp_profiles").select("full_name").eq("id", user.id).maybeSingle();
    setOwnerName(profile?.full_name ?? "");

    setLoading(false);
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
      } = await supabase.auth.getUser();
      if (!user) {
        setError(lang === "sw" ? "Kikao chako kimeisha. Tafadhali ingia tena." : "Your session has expired. Please sign in again.");
        return;
      }
      const { error } = await supabase.from("dfp_family_members").insert({
        owner_id: user.id,
        full_name: form.full_name,
        relationship_type: form.relationship_type,
        phone_number: form.phone_number || null,
        national_id: form.national_id || null,
        date_of_birth: form.date_of_birth || null,
        parent_member_id: form.parent_member_id || null,
      });
      if (error) {
        setError(error.message);
        return;
      }
      setForm({ full_name: "", relationship_type: "child", phone_number: "", national_id: "", date_of_birth: "", parent_member_id: "" });
      setShowForm(false);

      // Navigate immediately on a hardcoded next step -- no extra query gates this,
      // so a slow/stuck network call can never leave the user stranded here.
      if (onboarding) {
        router.push("/owner/beneficiaries?onboarding=1");
        return;
      }
      load();
    } catch (err: any) {
      setError(err?.message ?? (lang === "sw" ? "Hitilafu isiyotarajiwa. Jaribu tena." : "An unexpected error occurred. Please try again."));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Remove this family member record?")) return;
    await supabase.from("dfp_family_members").delete().eq("id", id);
    load();
  }

  return (
    <DashboardShell role="owner">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-primary">Family Structure Registry</h1>
        <button className="btn-primary text-sm" onClick={() => setShowForm((s) => !s)}>
          {showForm ? "Cancel" : "+ Add Family Member"}
        </button>
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
              <select className="input-field" value={form.relationship_type} onChange={(e) => setForm({ ...form, relationship_type: e.target.value })}>
                {TYPES.map((t) => (
                  <option key={t} value={t}>{TYPE_LABEL[t]}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="label">Phone Number</label>
              <input className="input-field" value={form.phone_number} onChange={(e) => setForm({ ...form, phone_number: e.target.value })} />
            </div>
            <div>
              <label className="label">National ID</label>
              <input className="input-field" value={form.national_id} onChange={(e) => setForm({ ...form, national_id: e.target.value })} />
            </div>
            <div>
              <label className="label">Date of Birth</label>
              <input type="date" className="input-field" value={form.date_of_birth} onChange={(e) => setForm({ ...form, date_of_birth: e.target.value })} />
            </div>
          </div>
          <div>
            <label className="label">Parent / Reports To (optional, for family tree)</label>
            <select className="input-field" value={form.parent_member_id} onChange={(e) => setForm({ ...form, parent_member_id: e.target.value })}>
              <option value="">None (root of the tree)</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>{m.full_name} ({TYPE_LABEL[m.relationship_type]})</option>
              ))}
            </select>
          </div>
          <button type="submit" disabled={saving} className="btn-primary">{saving ? "Saving…" : "Save"}</button>
        </form>
      )}

      {loading ? (
        <p className="text-sm text-neutralDark">Loading…</p>
      ) : (
        <div className="space-y-6">
          {members.length > 0 && (
            <div className="card">
              <h2 className="text-sm font-semibold text-primary uppercase tracking-wide mb-4">
                {lang === "sw" ? "Mti wa Familia" : "Family Tree"}
              </h2>

              <div
                className="inline-flex items-center gap-2 px-4 py-2 mb-2 text-white"
                style={{ backgroundColor: "#003E7E" }}
              >
                <User size={18} aria-hidden="true" />
                <div>
                  <p className="text-sm font-semibold leading-tight">{ownerName || "…"}</p>
                  <p className="text-[11px] opacity-80 leading-tight">
                    {lang === "sw" ? "Mmiliki wa Mali" : "Property Owner"}
                  </p>
                </div>
              </div>

              <div className="pl-5 border-l-2 border-gray-300 ml-3">
                {members
                  .filter((m) => !m.parent_member_id)
                  .map((m) => (
                    <TreeNode key={m.id} member={m} members={members} depth={1} onSelect={setSelectedId} selectedId={selectedId} />
                  ))}
              </div>

              {selectedId &&
                (() => {
                  const m = members.find((x) => x.id === selectedId);
                  if (!m) return null;
                  return (
                    <div className="card mt-4 bg-neutralLight">
                      <div className="flex items-center justify-between mb-2">
                        <p className="font-semibold text-ink">{m.full_name}</p>
                        <button onClick={() => setSelectedId(null)} className="text-xs text-neutralDark underline">
                          {lang === "sw" ? "Funga" : "Close"}
                        </button>
                      </div>
                      <dl className="text-sm text-inkSoft space-y-1">
                        <div><dt className="inline font-medium">{lang === "sw" ? "Uhusiano: " : "Relationship: "}</dt><dd className="inline">{TYPE_LABEL[m.relationship_type]}</dd></div>
                        <div><dt className="inline font-medium">{lang === "sw" ? "Simu: " : "Phone: "}</dt><dd className="inline">{m.phone_number ?? "—"}</dd></div>
                        <div><dt className="inline font-medium">{lang === "sw" ? "NIDA: " : "National ID: "}</dt><dd className="inline">{m.national_id ?? "—"}</dd></div>
                        <div><dt className="inline font-medium">{lang === "sw" ? "Tarehe ya Kuzaliwa: " : "Date of Birth: "}</dt><dd className="inline">{m.date_of_birth ?? "—"}</dd></div>
                      </dl>
                      <button
                        onClick={() => {
                          handleDelete(m.id);
                          setSelectedId(null);
                        }}
                        className="text-xs text-danger underline mt-3"
                      >
                        {lang === "sw" ? "Ondoa" : "Remove"}
                      </button>
                    </div>
                  );
                })()}
            </div>
          )}
          {members.length === 0 && (
            <EmptyState
              icon={Users}
              title={lang === "sw" ? "Bado hujasajili familia yako." : "You haven't recorded your family yet."}
              description={
                lang === "sw"
                  ? "Sajili baba, mama, mke/mume, watoto na wategemezi wako. Hii inasaidia kuonyesha muundo wa familia yako kwa uwazi — ni tofauti na Sajili ya Wanufaika."
                  : "Record your father, mother, spouse, children, and dependents. This shows your family structure clearly and is separate from the formal Beneficiary Registry."
              }
              examples={
                lang === "sw"
                  ? ["Baba", "Mama", "Mke/Mume", "Mtoto", "Mtegemezi"]
                  : ["Father", "Mother", "Spouse", "Child", "Dependent"]
              }
              action={{ label: lang === "sw" ? "Ongeza Mwanafamilia wa Kwanza" : "Add your first family member", onClick: () => setShowForm(true) }}
              helpHref="/help"
              helpLabel={lang === "sw" ? "Nahitaji msaada zaidi" : "I need more help"}
            />
          )}
        </div>
      )}
    </DashboardShell>
  );
}

export default function FamilyStructurePage() {
  return (
    <Suspense fallback={null}>
      <FamilyStructureForm />
    </Suspense>
  );
}
