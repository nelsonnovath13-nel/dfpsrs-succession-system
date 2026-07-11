"use client";

import { useEffect, useState } from "react";
import DashboardShell from "@/components/DashboardShell";
import { createClient } from "@/lib/supabase/client";

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

function TreeNode({ member, members, depth }: { member: Member; members: Member[]; depth: number }) {
  const children = members.filter((m) => m.parent_member_id === member.id);
  return (
    <div style={{ marginLeft: depth * 20 }} className="py-1">
      <div className="flex items-center gap-2 text-sm">
        <span className="text-neutralDark">{depth > 0 ? "└─" : ""}</span>
        <span className="font-medium text-neutralDark">{member.full_name}</span>
        <span className="text-xs text-neutralDark">({TYPE_LABEL[member.relationship_type]})</span>
      </div>
      {children.map((c) => (
        <TreeNode key={c.id} member={c} members={members} depth={depth + 1} />
      ))}
    </div>
  );
}

export default function FamilyStructurePage() {
  const supabase = createClient();
  const [members, setMembers] = useState<Member[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ full_name: "", relationship_type: "child", phone_number: "", national_id: "", date_of_birth: "", parent_member_id: "" });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

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
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
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
    load();
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
            <div className="bg-white text-red-800 border border-red-800 text-sm px-3 py-2">{error}</div>
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
          <button type="submit" className="btn-primary">Save</button>
        </form>
      )}

      {loading ? (
        <p className="text-sm text-neutralDark">Loading…</p>
      ) : (
        <div className="space-y-6">
          {members.length > 0 && (
            <div className="card">
              <h2 className="text-sm font-semibold text-primary uppercase tracking-wide mb-3">Family Tree</h2>
              {members
                .filter((m) => !m.parent_member_id)
                .map((m) => (
                  <TreeNode key={m.id} member={m} members={members} depth={0} />
                ))}
            </div>
          )}
          {TYPES.map((type) => {
            const group = members.filter((m) => m.relationship_type === type);
            if (group.length === 0) return null;
            return (
              <div key={type} className="card">
                <h2 className="text-sm font-semibold text-primary uppercase tracking-wide mb-3">
                  {TYPE_LABEL[type]}
                </h2>
                <table className="w-full text-sm">
                  <tbody>
                    {group.map((m) => (
                      <tr key={m.id} className="border-b border-gray-200 last:border-0">
                        <td className="py-2 pr-4 font-medium text-neutralDark">{m.full_name}</td>
                        <td className="py-2 pr-4 text-neutralDark">{m.phone_number ?? "—"}</td>
                        <td className="py-2 pr-4 text-neutralDark">{m.national_id ?? "—"}</td>
                        <td className="py-2 pr-4 text-neutralDark">{m.date_of_birth ?? "—"}</td>
                        <td className="py-2 text-right">
                          <button onClick={() => handleDelete(m.id)} className="text-xs text-red-800 hover:underline">
                            Remove
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          })}
          {members.length === 0 && (
            <div className="card text-center py-10 text-neutralDark">
              No family members recorded yet. Family structure information provides context for
              succession planning and is separate from the formal Beneficiary Registry.
            </div>
          )}
        </div>
      )}
    </DashboardShell>
  );
}
