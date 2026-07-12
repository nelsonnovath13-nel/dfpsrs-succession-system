"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useLanguage, LanguageToggle } from "@/lib/i18n";

const ROLES = [
  { value: "owner", en: "Property Owner", sw: "Mmiliki wa Mali" },
  { value: "beneficiary", en: "Beneficiary", sw: "Mnufaika" },
  { value: "executor", en: "Estate Executor", sw: "Msimamizi wa Mirathi" },
  { value: "witness", en: "Family Witness", sw: "Shahidi wa Familia" },
  { value: "leader", en: "Local Government Leader", sw: "Kiongozi wa Serikali za Mitaa" },
  { value: "legal", en: "Legal Officer / Advocate / Lawyer", sw: "Afisa Sheria / Wakili / Mwanasheria" },
];

export default function CompleteProfilePage() {
  const supabase = createClient();
  const router = useRouter();
  const { lang } = useLanguage();
  const sw = lang === "sw";
  const [role, setRole] = useState("owner");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const { error: rpcError } = await supabase.rpc("dfp_confirm_my_role", { p_role: role });
    setSaving(false);
    if (rpcError) {
      setError(rpcError.message);
      return;
    }
    router.refresh();
    router.push("/");
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-6 py-10 bg-surface">
      <div className="w-full max-w-md">
        <div className="flex justify-end mb-3">
          <LanguageToggle />
        </div>
        <div className="text-center mb-6">
          <img src="/nembo.png" alt="URT" className="mx-auto mb-3 h-12 w-12 object-contain" />
          <h1 className="text-xl font-semibold text-neutralDark">{sw ? "Umebaki Hatua Moja" : "One More Step"}</h1>
          <p className="text-sm text-inkSoft mt-1">
            {sw
              ? "Umeingia kwa mafanikio. Tuambie unajisajili kama nani ili tuweze kukuonyesha sehemu sahihi ya mfumo."
              : "You're signed in. Tell us who you are so we can show you the right part of the system."}
          </p>
        </div>
        <form onSubmit={handleSubmit} className="card space-y-4">
          {error && <div role="alert" className="bg-white text-red-800 border border-red-800 text-sm px-3 py-2">{error}</div>}
          <div className="grid grid-cols-1 gap-2">
            {ROLES.map((r) => (
              <label
                key={r.value}
                className={`flex items-center gap-3 border p-3 cursor-pointer transition ${
                  role === r.value ? "border-primary bg-primary/5" : "border-gray-200"
                }`}
              >
                <input type="radio" name="role" value={r.value} checked={role === r.value} onChange={() => setRole(r.value)} />
                <span className="text-sm font-medium text-neutralDark">{sw ? r.sw : r.en}</span>
              </label>
            ))}
          </div>
          <button type="submit" disabled={saving} className="btn-primary w-full">
            {saving ? (sw ? "Inahifadhi…" : "Saving…") : sw ? "Endelea" : "Continue"}
          </button>
        </form>
      </div>
    </main>
  );
}
