"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useLanguage } from "@/lib/i18n";

type Result = {
  status: string;
  title: string;
  finalized_at: string | null;
  content_hash: string;
};

export default function PublicVerifyPage() {
  const params = useParams<{ token: string }>();
  const supabase = createClient();
  const { lang } = useLanguage();
  const sw = lang === "sw";
  const [result, setResult] = useState<Result | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.rpc("dfp_get_public_verification", {
        p_token: params.token,
      });
      setLoading(false);
      if (error || !data || data.length === 0) {
        setNotFound(true);
        return;
      }
      setResult(data[0]);
    })();
  }, [supabase, params.token]);

  return (
    <main className="min-h-screen bg-white flex flex-col">
      <header className="official-header">
        <div className="px-6 py-3">
          <p className="text-sm font-semibold text-primary">
            {sw ? "Kumbukumbu za Mali na Urithi wa Familia — Uthibitishaji wa Umma" : "Family Property & Succession Records — Public Verification"}
          </p>
        </div>
      </header>
      <div className="flex-1 flex items-center justify-center px-6">
        <div className="max-w-md w-full border border-gray-300 p-8 text-center">
          {loading ? (
            <p className="text-sm text-neutralDark">{sw ? "Inathibitisha…" : "Verifying…"}</p>
          ) : notFound || !result ? (
            <>
              <p className="text-red-800 font-semibold mb-2">{sw ? "Kumbukumbu Haikupatikana" : "Record Not Found"}</p>
              <p className="text-sm text-neutralDark">
                {sw
                  ? "Hakuna kumbukumbu ya urithi iliyothibitishwa inayolingana na msimbo huu wa uthibitisho. Hii inaweza kuashiria msimbo batili au uliobadilishwa."
                  : "No verified succession record matches this verification code. This may indicate an invalid or tampered code."}
              </p>
            </>
          ) : result.status === "verified" ? (
            <>
              <p className="text-secondary font-semibold text-lg mb-2">{sw ? "Kumbukumbu Halisi Iliyothibitishwa" : "Verified Authentic Record"}</p>
              <p className="text-sm text-neutralDark mb-4">
                {sw
                  ? "Kumbukumbu hii ya urithi imethibitishwa kuwa halisi na Mfumo wa Kidijitali wa Kumbukumbu za Mali na Urithi wa Familia."
                  : "This succession record has been confirmed authentic by the Digital Family Property & Succession Records System."}
              </p>
              <div className="text-left text-sm border-t border-gray-200 pt-4 space-y-1">
                <p><span className="text-neutralDark">{sw ? "Kichwa cha Kumbukumbu" : "Record Title"}:</span> <span className="font-medium">{result.title}</span></p>
                <p><span className="text-neutralDark">{sw ? "Imekamilishwa" : "Finalized"}:</span> <span className="font-medium">{result.finalized_at ? new Date(result.finalized_at).toLocaleDateString() : "—"}</span></p>
                <p className="break-all"><span className="text-neutralDark">{sw ? "Alama ya Uadilifu" : "Integrity Hash"}:</span> <span className="font-mono text-xs">{result.content_hash.slice(0, 24)}…</span></p>
              </div>
              <p className="text-xs text-neutralDark mt-4">
                {sw
                  ? "Hakuna maelezo binafsi ya mali, mnufaika, au familia yanayoonyeshwa kwenye ukurasa huu wa umma."
                  : "No private property, beneficiary, or family details are displayed on this public page."}
              </p>
            </>
          ) : (
            <>
              <p className="text-amber-800 font-semibold mb-2">{sw ? "Kumbukumbu Bado Haijakamilishwa" : "Record Not Yet Finalized"}</p>
              <p className="text-sm text-neutralDark">{sw ? "Kumbukumbu hii ipo lakini haijakamilisha uthibitisho wa mwisho." : "This record exists but has not completed final verification."}</p>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
