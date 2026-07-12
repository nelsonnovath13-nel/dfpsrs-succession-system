"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import DashboardShell from "@/components/DashboardShell";
import { StatusBadge } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import { useLanguage } from "@/lib/i18n";

type Appointment = {
  id: string;
  owner_id: string;
  role_type: string;
  status: string;
  dfp_profiles: { full_name: string } | null;
};

type DeathStatus = { owner_id: string; status: string };

export default function ExecutorDashboardPage() {
  const supabase = createClient();
  const { lang } = useLanguage();
  const sw = lang === "sw";
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [deathStatuses, setDeathStatuses] = useState<DeathStatus[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from("dfp_executors")
        .select("id, owner_id, role_type, status, dfp_profiles!dfp_executors_owner_id_fkey(full_name)")
        .eq("linked_user_id", user.id)
        .eq("status", "active");
      setAppointments((data as any) ?? []);

      const ownerIds = (data ?? []).map((a: any) => a.owner_id);
      if (ownerIds.length > 0) {
        const { data: statuses } = await supabase
          .from("dfp_death_verifications")
          .select("owner_id, status")
          .in("owner_id", ownerIds);
        setDeathStatuses(statuses ?? []);
      }

      setLoading(false);
    })();
  }, [supabase]);

  return (
    <DashboardShell role="executor">
      <h1 className="text-xl font-semibold text-primary mb-2">{sw ? "Dashibodi ya Msimamizi wa Mirathi" : "Executor Dashboard"}</h1>
      <p className="text-sm text-neutralDark mb-6">
        {sw
          ? "Mali ambazo umeteuliwa kama msimamizi wa mirathi, mwakilishi wa familia, mtu wa kuaminika, au mwakilishi wa kisheria."
          : "Estates where you have been appointed as executor, family representative, trusted contact, or legal representative."}
      </p>

      {loading ? (
        <p className="text-sm text-neutralDark">{sw ? "Inapakia…" : "Loading…"}</p>
      ) : appointments.length === 0 ? (
        <div className="card text-center py-10 text-neutralDark">
          {sw
            ? "Bado hakuna uteuzi. Mwombe mmiliki wa mali kuunganisha akaunti yako kwa nambari ya simu kwenye ukurasa wake wa Wasimamizi na Wawakilishi."
            : "No appointments yet. Ask the property owner to link your account by phone number on their Executors & Representatives page."}
        </div>
      ) : (
        <div className="space-y-4">
          {appointments.map((a) => {
            const death = deathStatuses.find((d) => d.owner_id === a.owner_id);
            return (
              <div key={a.id} className="card flex items-center justify-between">
                <div>
                  <p className="font-medium text-neutralDark">{a.dfp_profiles?.full_name}</p>
                  <p className="text-xs text-neutralDark capitalize">{a.role_type.replace(/_/g, " ")}</p>
                </div>
                <div className="flex items-center gap-4">
                  {death ? (
                    <StatusBadge status={death.status} />
                  ) : (
                    <span className="text-xs text-neutralDark">{sw ? "Mchakato wa uhakiki wa kifo haujaanza" : "No death verification workflow started"}</span>
                  )}
                  <Link href="/executor/estate" className="text-sm text-primary font-medium underline">
                    {sw ? "Angalia mali" : "View estate"}
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </DashboardShell>
  );
}
