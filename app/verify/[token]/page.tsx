"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Result = {
  status: string;
  title: string;
  finalized_at: string | null;
  content_hash: string;
};

export default function PublicVerifyPage() {
  const params = useParams<{ token: string }>();
  const supabase = createClient();
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
          <p className="text-sm font-semibold text-primary">Family Property &amp; Succession Records — Public Verification</p>
        </div>
      </header>
      <div className="flex-1 flex items-center justify-center px-6">
        <div className="max-w-md w-full border border-gray-300 p-8 text-center">
          {loading ? (
            <p className="text-sm text-neutralDark">Verifying…</p>
          ) : notFound || !result ? (
            <>
              <p className="text-red-800 font-semibold mb-2">Record Not Found</p>
              <p className="text-sm text-neutralDark">
                No verified succession record matches this verification code. This may indicate
                an invalid or tampered code.
              </p>
            </>
          ) : result.status === "verified" ? (
            <>
              <p className="text-secondary font-semibold text-lg mb-2">Verified Authentic Record</p>
              <p className="text-sm text-neutralDark mb-4">
                This succession record has been confirmed authentic by the Digital Family
                Property &amp; Succession Records System.
              </p>
              <div className="text-left text-sm border-t border-gray-200 pt-4 space-y-1">
                <p><span className="text-neutralDark">Record Title:</span> <span className="font-medium">{result.title}</span></p>
                <p><span className="text-neutralDark">Finalized:</span> <span className="font-medium">{result.finalized_at ? new Date(result.finalized_at).toLocaleDateString() : "—"}</span></p>
                <p className="break-all"><span className="text-neutralDark">Integrity Hash:</span> <span className="font-mono text-xs">{result.content_hash.slice(0, 24)}…</span></p>
              </div>
              <p className="text-xs text-neutralDark mt-4">
                No private property, beneficiary, or family details are displayed on this public page.
              </p>
            </>
          ) : (
            <>
              <p className="text-amber-800 font-semibold mb-2">Record Not Yet Finalized</p>
              <p className="text-sm text-neutralDark">This record exists but has not completed final verification.</p>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
