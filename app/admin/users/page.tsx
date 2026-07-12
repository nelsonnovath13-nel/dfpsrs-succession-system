"use client";

import { useEffect, useState } from "react";
import DashboardShell from "@/components/DashboardShell";
import { createClient } from "@/lib/supabase/client";
import { useLanguage } from "@/lib/i18n";

type Profile = {
  id: string;
  full_name: string;
  phone_number: string | null;
  role: string;
  is_suspended: boolean;
  created_at: string;
};

export default function AdminUsersPage() {
  const supabase = createClient();
  const { lang } = useLanguage();
  const sw = lang === "sw";
  const [users, setUsers] = useState<Profile[]>([]);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from("dfp_profiles")
      .select("id, full_name, phone_number, role, is_suspended, created_at")
      .order("created_at", { ascending: false });
    setUsers(data ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function toggleSuspend(id: string, current: boolean) {
    await supabase.from("dfp_profiles").update({ is_suspended: !current }).eq("id", id);
    load();
  }

  const filtered = users.filter((u) => {
    const matchesSearch = u.full_name.toLowerCase().includes(search.toLowerCase());
    const matchesRole = roleFilter === "all" || u.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  return (
    <DashboardShell role="admin">
      <h1 className="text-xl font-semibold text-primary mb-6">{sw ? "Usimamizi wa Watumiaji" : "User Management"}</h1>

      <div className="flex gap-3 mb-4">
        <input
          className="input-field max-w-xs"
          placeholder={sw ? "Tafuta kwa jina…" : "Search by name…"}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select className="input-field max-w-xs" value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
          <option value="all">{sw ? "Majukumu Yote" : "All roles"}</option>
          <option value="owner">{sw ? "Mmiliki wa Mali" : "Property Owner"}</option>
          <option value="beneficiary">{sw ? "Mnufaika" : "Beneficiary"}</option>
          <option value="witness">{sw ? "Shahidi wa Familia" : "Family Witness"}</option>
          <option value="leader">{sw ? "Kiongozi wa Serikali ya Mtaa" : "Local Government Leader"}</option>
          <option value="legal">{sw ? "Afisa Sheria" : "Legal Officer"}</option>
          <option value="admin">{sw ? "Msimamizi" : "Administrator"}</option>
          <option value="auditor">{sw ? "Mkaguzi wa Mfumo" : "System Auditor"}</option>
        </select>
      </div>

      <div className="card overflow-x-auto">
        {loading ? (
          <p className="text-sm text-neutralDark">{sw ? "Inapakia…" : "Loading…"}</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-neutralDark border-b border-gray-300">
                <th className="py-2 pr-4">{sw ? "Jina" : "Name"}</th>
                <th className="py-2 pr-4">{sw ? "Simu" : "Phone"}</th>
                <th className="py-2 pr-4">{sw ? "Jukumu" : "Role"}</th>
                <th className="py-2 pr-4">{sw ? "Alijiunga" : "Joined"}</th>
                <th className="py-2 pr-4">{sw ? "Hadhi" : "Status"}</th>
                <th className="py-2"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((u) => (
                <tr key={u.id} className="border-b border-gray-200 last:border-0">
                  <td className="py-2 pr-4 font-medium text-neutralDark">{u.full_name}</td>
                  <td className="py-2 pr-4 text-neutralDark">{u.phone_number ?? "—"}</td>
                  <td className="py-2 pr-4">
                    <span className="badge bg-neutralLight text-primary border-primary capitalize">
                      {u.role}
                    </span>
                  </td>
                  <td className="py-2 pr-4 text-neutralDark">{new Date(u.created_at).toLocaleDateString()}</td>
                  <td className="py-2 pr-4">
                    {u.is_suspended ? (
                      <span className="badge bg-white text-red-800 border-red-800">{sw ? "Amesimamishwa" : "Suspended"}</span>
                    ) : (
                      <span className="badge bg-white text-secondary border-secondary">{sw ? "Hai" : "Active"}</span>
                    )}
                  </td>
                  <td className="py-2 text-right">
                    <button
                      onClick={() => toggleSuspend(u.id, u.is_suspended)}
                      className="text-xs text-primary hover:underline"
                    >
                      {u.is_suspended ? (sw ? "Rejesha" : "Reactivate") : (sw ? "Simamisha" : "Suspend")}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </DashboardShell>
  );
}
