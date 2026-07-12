"use client";

import { useEffect, useState } from "react";
import DashboardShell from "@/components/DashboardShell";
import { StatusBadge } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import { useLanguage } from "@/lib/i18n";

type Confirmation = {
  id: string;
  status: string;
  succession_record_id: string;
  dfp_succession_records: { title: string; status: string; finalized_at: string | null } | null;
};

type Allocation = {
  id: string;
  share_percentage: number;
  succession_record_id: string;
  dfp_properties: { name: string; category: string } | null;
};

export default function BeneficiaryDashboardPage() {
  const supabase = createClient();
  const { lang } = useLanguage();
  const sw = lang === "sw";
  const [confirmations, setConfirmations] = useState<Confirmation[]>([]);
  const [allocations, setAllocations] = useState<Allocation[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { data: myBeneficiaryRows } = await supabase
      .from("dfp_beneficiaries")
      .select("id")
      .eq("linked_user_id", user.id);
    const beneficiaryIds = (myBeneficiaryRows ?? []).map((b) => b.id);

    if (beneficiaryIds.length === 0) {
      setConfirmations([]);
      setAllocations([]);
      setLoading(false);
      return;
    }

    const { data: conf } = await supabase
      .from("dfp_beneficiary_confirmations")
      .select("id, status, succession_record_id, dfp_succession_records(title, status, finalized_at)")
      .in("beneficiary_id", beneficiaryIds);
    setConfirmations((conf as any) ?? []);

    const { data: allocs } = await supabase
      .from("dfp_property_allocations")
      .select("id, share_percentage, succession_record_id, dfp_properties(name, category)")
      .in("beneficiary_id", beneficiaryIds);
    setAllocations((allocs as any) ?? []);

    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function respond(id: string, status: "accepted" | "declined") {
    await supabase
      .from("dfp_beneficiary_confirmations")
      .update({ status, responded_at: new Date().toISOString() })
      .eq("id", id);
    load();
  }

  return (
    <DashboardShell role="beneficiary">
      <h1 className="text-xl font-semibold text-primary mb-2">{sw ? "Urithi Wangu" : "My Inheritance"}</h1>
      <p className="text-sm text-neutralDark mb-6">
        {sw
          ? "Hii inaonyesha kumbukumbu za urithi ambazo umetajwa kama mnufaika, mara zinapothibitishwa kikamilifu."
          : "This shows succession records where you are a named beneficiary, once fully verified."}
      </p>

      {loading ? (
        <p className="text-sm text-neutralDark">{sw ? "Inapakia…" : "Loading…"}</p>
      ) : confirmations.length === 0 ? (
        <div className="card text-center py-10 text-neutralDark">
          {sw
            ? "Bado hakuna kitu cha kuonyesha. Ukurasa huu husasishwa kiotomatiki mara mwanafamilia anapokutaja kwenye kumbukumbu ya urithi iliyothibitishwa — hakikisha mmiliki anaunganisha kumbukumbu yako ya mnufaika na akaunti hii (kwa nambari yako ya simu) anapokuongeza."
            : "Nothing to show yet. This page updates automatically once a family member names you in a verified succession record — make sure the owner links your beneficiary record to this account (by your phone number) when they add you."}
        </div>
      ) : (
        <div className="space-y-4">
          {confirmations.map((c) => {
            const myAllocations = allocations.filter(
              (a) => a.succession_record_id === c.succession_record_id
            );
            return (
              <div key={c.id} className="card">
                <div className="flex items-center justify-between mb-3">
                  <p className="font-medium text-neutralDark">{c.dfp_succession_records?.title}</p>
                  <StatusBadge status={c.status} />
                </div>
                <table className="w-full text-sm mb-4">
                  <tbody>
                    {myAllocations.map((a) => (
                      <tr key={a.id} className="border-b border-gray-200 last:border-0">
                        <td className="py-1.5 text-neutralDark">
                          {a.dfp_properties?.name}{" "}
                          <span className="text-xs text-neutralDark capitalize">
                            ({a.dfp_properties?.category})
                          </span>
                        </td>
                        <td className="py-1.5 text-right font-medium">{a.share_percentage}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {c.status === "pending" ? (
                  <div className="flex gap-3">
                    <button onClick={() => respond(c.id, "accepted")} className="btn-secondary text-sm">
                      {sw ? "Kubali Nafasi Yangu" : "Accept My Role"}
                    </button>
                    <button onClick={() => respond(c.id, "declined")} className="btn-danger text-sm">
                      {sw ? "Kataa" : "Decline"}
                    </button>
                  </div>
                ) : (
                  <p className="text-xs text-neutralDark">
                    {sw
                      ? `Uli${c.status === "accepted" ? "kubali" : "kataa"} nafasi hii.`
                      : `You ${c.status} this role.`}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </DashboardShell>
  );
}
