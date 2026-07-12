"use client";

import { useEffect, useState } from "react";
import { Vault, KeyRound, Eye, FileText, Fingerprint } from "lucide-react";
import { startAuthentication } from "@simplewebauthn/browser";
import DashboardShell from "@/components/DashboardShell";
import { createClient } from "@/lib/supabase/client";
import { useLanguage } from "@/lib/i18n";
import { DOC_CATEGORY_META, docCategoryLabel, docCategoryMeta } from "@/lib/propertyCategories";

type Role = "owner" | "witness" | "leader" | "admin" | "beneficiary" | "legal" | "auditor" | "executor";
// `full_name` on dfp_vault_trustees is a snapshot of the TRUSTEE's own name (captured when the
// owner added them) -- the vault owner's name must come from a separate join, otherwise the
// unlock screen ends up labelled with the trustee's own name instead of whose vault it is.
type TrusteeLink = { id: string; owner_id: string; full_name: string; relationship: string; ownerName: string };
type VaultDoc = { id: string; category: string; file_name: string; file_path: string; uploaded_at: string };

export default function VaultAccessPage() {
  const supabase = createClient();
  const { lang } = useLanguage();
  const sw = lang === "sw";

  const [role, setRole] = useState<Role | null>(null);
  const [links, setLinks] = useState<TrusteeLink[]>([]);
  const [selected, setSelected] = useState<TrusteeLink | null>(null);
  const [pin, setPin] = useState("");
  const [unlocking, setUnlocking] = useState(false);
  const [unlocked, setUnlocked] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [docs, setDocs] = useState<VaultDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasPasskey, setHasPasskey] = useState(false);
  const [pinVerified, setPinVerified] = useState(false);
  const [verifyingPasskey, setVerifyingPasskey] = useState(false);

  useEffect(() => {
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }
      const [profileRes, linksRes, passkeyRes] = await Promise.all([
        supabase.from("dfp_profiles").select("role").eq("id", user.id).maybeSingle(),
        supabase
          .from("dfp_vault_trustees")
          .select("id, owner_id, full_name, relationship, dfp_profiles!owner_id(full_name)")
          .eq("trustee_user_id", user.id),
        supabase.from("dfp_webauthn_credentials").select("id", { count: "exact", head: true }).eq("user_id", user.id),
      ]);
      setRole(profileRes.data?.role ?? "owner");
      setHasPasskey((passkeyRes.count ?? 0) > 0);
      setLinks(
        (linksRes.data ?? []).map((l: any) => ({
          id: l.id,
          owner_id: l.owner_id,
          full_name: l.full_name,
          relationship: l.relationship,
          ownerName: l.dfp_profiles?.full_name ?? (sw ? "Mmiliki" : "Owner"),
        }))
      );
      setLoading(false);
    })();
  }, [supabase]);

  async function loadDocsAndUnlock() {
    if (!selected) return;
    const { data } = await supabase
      .from("dfp_vault_documents")
      .select("id, category, file_name, file_path, uploaded_at")
      .eq("owner_id", selected.owner_id)
      .order("uploaded_at", { ascending: false });
    setDocs(data ?? []);
    setUnlocked(true);
  }

  async function unlock(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) return;
    setError(null);
    setUnlocking(true);
    const { data: ok, error: verifyErr } = await supabase.rpc("dfp_verify_vault_pin", {
      p_owner_id: selected.owner_id,
      p_pin: pin,
    });
    setUnlocking(false);
    if (verifyErr || !ok) {
      setError(sw ? "PIN si sahihi. Jaribu tena." : "Incorrect PIN. Please try again.");
      return;
    }
    if (hasPasskey) {
      // Second factor: the PIN alone is no longer enough once this trustee has registered a
      // device passkey, so require proof of the physical device (fingerprint/Face ID) too.
      setPinVerified(true);
      return;
    }
    await loadDocsAndUnlock();
  }

  async function verifyPasskeyStep() {
    if (!selected) return;
    setError(null);
    setVerifyingPasskey(true);
    try {
      const optionsRes = await fetch("/api/webauthn/authenticate/options", { method: "POST" });
      const options = await optionsRes.json();
      if (!optionsRes.ok) throw new Error(options.error ?? (sw ? "Imeshindikana kuanzisha uthibitisho." : "Could not start passkey verification."));

      const authResp = await startAuthentication({ optionsJSON: options });

      const verifyRes = await fetch("/api/webauthn/authenticate/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ response: authResp, vaultOwnerId: selected.owner_id }),
      });
      const verifyJson = await verifyRes.json();
      if (!verifyRes.ok || !verifyJson.verified) throw new Error(verifyJson.error ?? (sw ? "Alama ya kidole haikuthibitishwa." : "Fingerprint could not be verified."));

      await loadDocsAndUnlock();
    } catch (e: any) {
      setError(
        e?.name === "NotAllowedError"
          ? sw
            ? "Uthibitisho umeghairiwa."
            : "Verification was cancelled."
          : e.message ?? (sw ? "Imeshindikana kuthibitisha." : "Could not verify.")
      );
    } finally {
      setVerifyingPasskey(false);
    }
  }

  async function viewDoc(path: string) {
    // Opening the tab AFTER an awaited network call is what browsers' popup blockers treat
    // as a non-user-initiated popup and silently block -- open the tab synchronously inside
    // the click handler first, then redirect it once the signed URL comes back.
    const newTab = window.open("", "_blank");
    const { data, error: signErr } = await supabase.storage.from("dfp-documents").createSignedUrl(path, 60);
    if (signErr || !data) {
      newTab?.close();
      alert(sw ? "Imeshindikana kufungua hati." : "Could not open document.");
      return;
    }
    if (newTab) newTab.location.href = data.signedUrl;
  }

  function reset() {
    setSelected(null);
    setUnlocked(false);
    setPin("");
    setDocs([]);
    setError(null);
    setPinVerified(false);
  }

  if (loading || !role) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-sm text-neutralDark">{sw ? "Inapakia…" : "Loading…"}</p>
      </div>
    );
  }

  return (
    <DashboardShell role={role}>
      <h1 className="text-xl font-semibold text-primary mb-2 flex items-center gap-2">
        <Vault size={22} aria-hidden="true" /> {sw ? "Ufikiaji wa Hazina ya Familia" : "Family Vault Access"}
      </h1>
      <p className="text-sm text-inkSoft mb-6 max-w-xl">
        {sw
          ? "Kama umeteuliwa kama mtu wa kuaminika wa hazina ya familia ya mtu mwingine, unaweza kuifungua hapa kwa PIN yako ya siri."
          : "If you've been designated as a trusted vault contact for someone else's family, you can unlock it here using your secret PIN."}
      </p>

      {links.length === 0 ? (
        <div className="card max-w-xl">
          <p className="text-sm text-inkSoft">
            {sw
              ? "Hujateuliwa kama mtu wa kuaminika wa hazina ya mtu yeyote kwa sasa."
              : "You have not been designated as a trusted vault contact for anyone yet."}
          </p>
        </div>
      ) : !selected ? (
        <div className="border border-gray-300 divide-y divide-gray-200 max-w-xl">
          {links.map((l) => (
            <button
              key={l.id}
              onClick={() => setSelected(l)}
              className="w-full text-left px-4 py-3 text-sm hover:bg-neutralLight"
              style={{ minHeight: 56 }}
            >
              <p className="font-medium text-ink">{l.ownerName}</p>
              <p className="text-xs text-inkSoft">{sw ? "Uhusiano wako" : "Your relationship"}: {l.relationship}</p>
            </button>
          ))}
        </div>
      ) : pinVerified && hasPasskey ? (
        <div className="card max-w-sm">
          <p className="text-sm font-medium text-ink mb-1 flex items-center gap-2">
            <Fingerprint size={18} className="text-primary" aria-hidden="true" />
            {sw ? "Hatua ya Pili: Thibitisha kwa Alama ya Kidole" : "Second Step: Verify With Your Fingerprint"}
          </p>
          <p className="text-xs text-inkSoft mb-3">
            {sw
              ? "PIN yako ni sahihi. Kwa usalama zaidi, thibitisha pia kwa kifaa chako kilichosajiliwa (alama ya kidole, uso, au PIN ya kifaa)."
              : "Your PIN was correct. For extra security, also verify with your registered device (fingerprint, face, or device PIN)."}
          </p>
          {error && <div role="alert" className="bg-white text-red-800 border border-red-800 text-sm px-3 py-2 mb-3">{error}</div>}
          <div className="flex gap-2">
            <button
              onClick={verifyPasskeyStep}
              disabled={verifyingPasskey}
              className="btn-primary text-sm inline-flex items-center gap-2"
            >
              <Fingerprint size={16} aria-hidden="true" />
              {verifyingPasskey ? (sw ? "Inathibitisha…" : "Verifying…") : sw ? "Thibitisha" : "Verify"}
            </button>
            <button type="button" onClick={reset} className="btn-outline text-sm">{sw ? "Ghairi" : "Cancel"}</button>
          </div>
        </div>
      ) : !unlocked ? (
        <div className="card max-w-sm">
          <p className="text-sm font-medium text-ink mb-3">
            {sw ? `Fungua hazina ya ${selected.ownerName}` : `Unlock ${selected.ownerName}'s vault`}
          </p>
          {error && <div role="alert" className="bg-white text-red-800 border border-red-800 text-sm px-3 py-2 mb-3">{error}</div>}
          <form onSubmit={unlock} className="space-y-3">
            <div>
              <label className="label">{sw ? "PIN ya Siri" : "Secret PIN"}</label>
              <input
                type="password"
                inputMode="numeric"
                required
                className="input-field text-center text-lg tracking-widest"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                maxLength={6}
              />
            </div>
            {!hasPasskey && (
              <p className="text-xs text-inkSoft">
                {sw
                  ? "Kidokezo: sajili alama ya kidole kwenye Wasifu Wangu kwa hatua ya ziada ya usalama wakati wa kufungua hazina."
                  : "Tip: register a fingerprint under My Profile for an extra security step when unlocking a vault."}
              </p>
            )}
            <div className="flex gap-2">
              <button type="submit" disabled={unlocking} className="btn-primary text-sm inline-flex items-center gap-2">
                <KeyRound size={16} aria-hidden="true" /> {unlocking ? (sw ? "Inafungua…" : "Unlocking…") : sw ? "Fungua" : "Unlock"}
              </button>
              <button type="button" onClick={reset} className="btn-outline text-sm">{sw ? "Ghairi" : "Cancel"}</button>
            </div>
          </form>
        </div>
      ) : (
        <div className="max-w-xl">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm font-medium text-ink">{sw ? `Hazina ya ${selected.ownerName}` : `${selected.ownerName}'s Vault`}</p>
            <button onClick={reset} className="text-xs text-primary underline">{sw ? "Funga" : "Lock"}</button>
          </div>
          {docs.length === 0 ? (
            <p className="text-sm text-inkSoft">{sw ? "Hakuna hati bado." : "No documents yet."}</p>
          ) : (
            <div className="border border-gray-300 divide-y divide-gray-200">
              {docs.map((d) => {
                const DocIcon = docCategoryMeta(d.category).icon;
                return (
                  <div key={d.id} className="flex items-center justify-between px-4 py-3">
                    <span className="flex items-center gap-2 text-sm text-ink min-w-0">
                      <DocIcon size={16} className="text-inkSoft shrink-0" aria-hidden="true" />
                      <span className="truncate">{d.file_name}</span>
                      <span className="text-xs text-inkSoft shrink-0">({docCategoryLabel(d.category, lang)})</span>
                    </span>
                    <button onClick={() => viewDoc(d.file_path)} className="text-primary shrink-0" aria-label={sw ? "Tazama" : "View"}>
                      <Eye size={18} aria-hidden="true" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </DashboardShell>
  );
}
