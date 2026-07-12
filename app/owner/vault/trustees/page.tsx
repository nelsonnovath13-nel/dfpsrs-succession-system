"use client";

import { useEffect, useState } from "react";
import { ShieldCheck, KeyRound, Trash2, Search } from "lucide-react";
import DashboardShell from "@/components/DashboardShell";
import { PageNav } from "@/components/PageNav";
import { createClient } from "@/lib/supabase/client";
import { useLanguage } from "@/lib/i18n";

type Trustee = {
  id: string;
  full_name: string;
  relationship: string;
  verifier_role: string;
  verified_at: string;
  trustee_user_id: string;
};
type Profile = { id: string; full_name: string; phone_number: string | null; role: string };

const MAX_TRUSTEES = 3;

export default function VaultTrusteesPage() {
  const supabase = createClient();
  const { lang } = useLanguage();
  const sw = lang === "sw";

  const [trustees, setTrustees] = useState<Trustee[]>([]);
  const [leaders, setLeaders] = useState<Profile[]>([]);
  const [legalOfficers, setLegalOfficers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);

  const [showForm, setShowForm] = useState(false);
  const [searchPhone, setSearchPhone] = useState("");
  const [searchResults, setSearchResults] = useState<Profile[]>([]);
  const [searched, setSearched] = useState(false);
  const [selectedUser, setSelectedUser] = useState<Profile | null>(null);
  const [relationship, setRelationship] = useState("");
  const [verifierId, setVerifierId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newPin, setNewPin] = useState<{ trusteeName: string; pin: string } | null>(null);

  async function load() {
    setLoading(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const [trusteesRes, leadersRes, legalRes] = await Promise.all([
      supabase.from("dfp_vault_trustees").select("id, full_name, relationship, verifier_role, verified_at, trustee_user_id").eq("owner_id", user.id),
      supabase.from("dfp_profiles").select("id, full_name, phone_number, role").eq("role", "leader"),
      supabase.from("dfp_profiles").select("id, full_name, phone_number, role").eq("role", "legal"),
    ]);
    setTrustees(trusteesRes.data ?? []);
    setLeaders(leadersRes.data ?? []);
    setLegalOfficers(legalRes.data ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function searchUsers() {
    const raw = searchPhone.trim();
    if (!raw) return;
    setSearched(true);
    // Tanzanian numbers are entered as either 0XXXXXXXXX or +255XXXXXXXXX -- match on the
    // last 9 digits (the part that's actually unique) so either format finds the same person.
    const digitsOnly = raw.replace(/\D/g, "");
    const last9 = digitsOnly.slice(-9);
    const { data } = await supabase
      .from("dfp_profiles")
      .select("id, full_name, phone_number, role")
      .ilike("phone_number", `%${last9 || raw}%`)
      .limit(5);
    setSearchResults(data ?? []);
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!selectedUser) {
      setError(sw ? "Tafadhali tafuta na chagua mtumiaji." : "Please search for and select a user.");
      return;
    }
    if (!relationship.trim()) {
      setError(sw ? "Tafadhali ingiza uhusiano." : "Please enter the relationship.");
      return;
    }
    if (!verifierId) {
      setError(sw ? "Tafadhali chagua mthibitishaji (kiongozi au afisa sheria)." : "Please select a verifier (leader or legal officer).");
      return;
    }
    setSaving(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setSaving(false);
      return;
    }
    const verifier = [...leaders, ...legalOfficers].find((v) => v.id === verifierId);
    const { data: trustee, error: insertErr } = await supabase
      .from("dfp_vault_trustees")
      .insert({
        owner_id: user.id,
        trustee_user_id: selectedUser.id,
        full_name: selectedUser.full_name,
        relationship,
        verifier_id: verifierId,
        verifier_role: verifier?.role === "legal" ? "legal" : "leader",
      })
      .select("id")
      .single();
    if (insertErr || !trustee) {
      setSaving(false);
      setError(insertErr?.message ?? (sw ? "Imeshindikana kuongeza mtu wa kuaminika." : "Could not add trustee."));
      return;
    }

    const { data: pin, error: pinErr } = await supabase.rpc("dfp_set_vault_trustee_pin", { p_trustee_id: trustee.id });
    setSaving(false);
    if (pinErr) {
      setError(pinErr.message);
      return;
    }
    setNewPin({ trusteeName: selectedUser.full_name, pin: pin as string });
    setSelectedUser(null);
    setSearchPhone("");
    setSearchResults([]);
    setRelationship("");
    setVerifierId("");
    setShowForm(false);
    load();
  }

  async function regeneratePin(trusteeId: string, name: string) {
    const { data: pin, error: pinErr } = await supabase.rpc("dfp_set_vault_trustee_pin", { p_trustee_id: trusteeId });
    if (pinErr) {
      setError(pinErr.message);
      return;
    }
    setNewPin({ trusteeName: name, pin: pin as string });
  }

  async function removeTrustee(id: string) {
    if (!confirm(sw ? "Ondoa mtu huyu wa kuaminika?" : "Remove this trustee?")) return;
    await supabase.from("dfp_vault_trustees").delete().eq("id", id);
    load();
  }

  const verifierOptions = [...leaders, ...legalOfficers];

  return (
    <DashboardShell role="owner">
      <PageNav exitHref="/owner/vault" />
      <h1 className="text-xl font-semibold text-primary mb-2 flex items-center gap-2">
        <ShieldCheck size={22} aria-hidden="true" /> {sw ? "Watu wa Kuaminika wa Hazina" : "Trusted Vault Access"}
      </h1>
      <p className="text-sm text-inkSoft mb-6 max-w-xl">
        {sw
          ? "Teua hadi watu 3 wa kuaminika wenye akaunti kwenye mfumo huu wanaoweza kufungua Hazina yako ya Familia kwa PIN ya siri, wakithibitishwa na Kiongozi wa Serikali za Mitaa au Afisa Sheria."
          : "Designate up to 3 trusted people with an account on this system who can unlock your Family Legacy Vault using a secret PIN, verified by a Local Government Leader or Legal Officer."}
      </p>

      {newPin && (
        <div className="card mb-6 border-2 border-secondary bg-green-50 max-w-xl">
          <p className="font-semibold text-secondary mb-1 flex items-center gap-2">
            <KeyRound size={18} aria-hidden="true" /> {sw ? "PIN Mpya Imetengenezwa" : "New PIN Generated"}
          </p>
          <p className="text-sm text-ink mb-2">
            {sw ? `PIN ya ${newPin.trusteeName}:` : `PIN for ${newPin.trusteeName}:`} <span className="font-mono text-lg font-bold">{newPin.pin}</span>
          </p>
          <p className="text-xs text-inkSoft">
            {sw
              ? "Andika au ushiriki PIN hii na mtu huyo mara moja kwa njia salama (ana kwa ana au simu). Haitaonyeshwa tena."
              : "Write down or share this PIN with them now, securely (in person or by phone). It will not be shown again."}
          </p>
          <button onClick={() => setNewPin(null)} className="btn-outline text-xs mt-3">{sw ? "Nimeshahifadhi" : "I've saved it"}</button>
        </div>
      )}

      {loading ? (
        <p className="text-sm text-neutralDark">{sw ? "Inapakia…" : "Loading…"}</p>
      ) : (
        <>
          <div className="border border-gray-300 divide-y divide-gray-200 max-w-xl mb-6">
            {trustees.length === 0 && (
              <p className="text-sm text-inkSoft px-4 py-6 text-center">{sw ? "Hakuna watu wa kuaminika bado." : "No trusted access set up yet."}</p>
            )}
            {trustees.map((t) => (
              <div key={t.id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-ink">{t.full_name}</p>
                  <p className="text-xs text-inkSoft">
                    {t.relationship} · {sw ? "Aliyethibitisha" : "Verified by"}: {t.verifier_role === "legal" ? (sw ? "Afisa Sheria" : "Legal Officer") : sw ? "Kiongozi" : "Leader"} · {new Date(t.verified_at).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <button onClick={() => regeneratePin(t.id, t.full_name)} className="text-xs text-primary font-medium">
                    {sw ? "Tengeneza PIN Mpya" : "Regenerate PIN"}
                  </button>
                  <button onClick={() => removeTrustee(t.id)} className="text-danger" aria-label={sw ? "Ondoa" : "Remove"}>
                    <Trash2 size={16} aria-hidden="true" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {trustees.length < MAX_TRUSTEES && !showForm && (
            <button className="btn-primary text-sm" onClick={() => setShowForm(true)}>
              {sw ? "Ongeza Mtu wa Kuaminika" : "Add Trusted Person"}
            </button>
          )}

          {showForm && (
            <form onSubmit={handleAdd} className="card max-w-xl space-y-4">
              {error && <div role="alert" className="bg-white text-red-800 border border-red-800 text-sm px-3 py-2">{error}</div>}

              <div>
                <label className="label">{sw ? "Tafuta kwa Namba ya Simu" : "Search by Phone Number"}</label>
                <div className="flex gap-2">
                  <input
                    className="input-field"
                    value={searchPhone}
                    onChange={(e) => {
                      setSearchPhone(e.target.value);
                      setSearched(false);
                    }}
                    placeholder="+255… au 0…"
                  />
                  <button type="button" onClick={searchUsers} className="btn-outline text-sm inline-flex items-center gap-1 shrink-0">
                    <Search size={14} aria-hidden="true" /> {sw ? "Tafuta" : "Search"}
                  </button>
                </div>
                {searched && searchResults.length === 0 && (
                  <p className="text-xs text-amber-800 bg-amber-50 border border-amber-700 px-3 py-2 mt-2">
                    {sw
                      ? "Hakuna akaunti yenye namba hii kwenye mfumo. Mtu huyu lazima ajisajili kwenye mfumo kwanza kabla ya kuweza kuteuliwa kama mtu wa kuaminika."
                      : "No account exists with this number on the system. This person must register an account first before they can be designated as a trusted contact."}
                  </p>
                )}
                {searchResults.length > 0 && (
                  <div className="border border-gray-300 divide-y divide-gray-200 mt-2">
                    {searchResults.map((u) => (
                      <button
                        type="button"
                        key={u.id}
                        onClick={() => setSelectedUser(u)}
                        className={`w-full text-left px-3 py-2 text-sm ${selectedUser?.id === u.id ? "bg-blue-50 text-primary font-medium" : "text-ink"}`}
                      >
                        {u.full_name} ({u.phone_number})
                      </button>
                    ))}
                  </div>
                )}
                {selectedUser && (
                  <p className="text-xs text-secondary mt-1">✓ {sw ? "Aliyechaguliwa" : "Selected"}: {selectedUser.full_name}</p>
                )}
              </div>

              <div>
                <label className="label">{sw ? "Uhusiano" : "Relationship"}</label>
                <input required className="input-field" value={relationship} onChange={(e) => setRelationship(e.target.value)} placeholder={sw ? "mfano: Dada, Mtoto" : "e.g. Sister, Child"} />
              </div>

              <div>
                <label className="label">{sw ? "Athibitishwe na (Kiongozi/Afisa Sheria)" : "Verified by (Leader/Legal Officer)"}</label>
                <select className="input-field" value={verifierId} onChange={(e) => setVerifierId(e.target.value)}>
                  <option value="">{sw ? "Chagua…" : "Select…"}</option>
                  {verifierOptions.map((v) => (
                    <option key={v.id} value={v.id}>{v.full_name} ({v.role === "legal" ? (sw ? "Afisa Sheria" : "Legal") : sw ? "Kiongozi" : "Leader"})</option>
                  ))}
                </select>
              </div>

              <div className="flex gap-2">
                <button type="submit" disabled={saving} className="btn-primary text-sm">
                  {saving ? (sw ? "Inaongeza…" : "Adding…") : sw ? "Ongeza na Tengeneza PIN" : "Add & Generate PIN"}
                </button>
                <button type="button" onClick={() => setShowForm(false)} className="btn-outline text-sm">{sw ? "Ghairi" : "Cancel"}</button>
              </div>
            </form>
          )}
        </>
      )}
    </DashboardShell>
  );
}
