"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Landmark, Users, HeartHandshake, FileText, AlertTriangle } from "lucide-react";
import DashboardShell from "@/components/DashboardShell";
import { WelcomeWizard } from "@/components/WelcomeWizard";
import { StatCard, StatusBadge, VerificationTimeline } from "@/components/ui";
import { PageGuide } from "@/components/PageGuide";
import { createClient } from "@/lib/supabase/client";
import { useLanguage } from "@/lib/i18n";
import { withTimeout } from "@/lib/withTimeout";

const DASHBOARD_GUIDE = {
  purpose: { en: "See your overall progress and jump to whatever needs attention next.", sw: "Kuona maendeleo yako ya jumla na kuruka moja kwa moja kwenye kinachohitaji uangalizi." },
  why: {
    en: "Your readiness score reflects how complete your estate records are — properties, family, beneficiaries, executors, and succession records.",
    sw: "Alama yako ya utayari inaonyesha jinsi kumbukumbu zako za mali zilivyo kamili — mali, familia, wanufaika, wasimamizi, na kumbukumbu za urithi.",
  },
  example: { en: "A 100% score means every step is complete and your succession record can be submitted for verification.", sw: "Alama ya 100% inamaanisha kila hatua imekamilika na kumbukumbu yako ya urithi inaweza kuwasilishwa kwa uthibitisho." },
  mistakes: { en: "Creating a succession record before adding properties or beneficiaries — complete those first.", sw: "Kutengeneza kumbukumbu ya urithi kabla ya kuongeza mali au wanufaika — kamilisha hivyo kwanza." },
  nextStep: { en: "Follow the setup checklist below in order, from Register Property through Create Record.", sw: "Fuata orodha ya hatua hapa chini kwa mfuatano, kuanzia Sajili Mali hadi Tengeneza Kumbukumbu." },
};

type SuccessionRecord = {
  id: string;
  title: string;
  status: string;
  created_at: string;
  report_generated_at: string | null;
};

const QUICK_ACTIONS = [
  { icon: Landmark, href: "/owner/properties/new", en: "Register Property", sw: "Sajili Mali" },
  { icon: Users, href: "/owner/family", en: "Add Family Member", sw: "Ongeza Mwanafamilia" },
  { icon: HeartHandshake, href: "/owner/beneficiaries", en: "Add Beneficiary", sw: "Ongeza Mnufaika" },
  { icon: FileText, href: "/owner/succession-plans/new", en: "New Succession Record", sw: "Kumbukumbu Mpya" },
];

export default function OwnerDashboardPage() {
  const supabase = createClient();
  const { lang } = useLanguage();
  const [counts, setCounts] = useState({ properties: 0, plans: 0, pending: 0, value: 0, beneficiaries: 0, family: 0, documents: 0 });
  const [activePlan, setActivePlan] = useState<SuccessionRecord | null>(null);
  const [completeness, setCompleteness] = useState<{ score: number; missing: string[] } | null>(null);
  const [witnessCount, setWitnessCount] = useState(0);
  const [recentActivity, setRecentActivity] = useState<{ id: string; action: string; created_at: string }[]>([]);

  useEffect(() => {
    (async () => {
      const {
        data: { user },
      } = await withTimeout(supabase.auth.getUser(), 15000, { data: { user: null } } as any);
      if (!user) return;

      const emptyList = { data: [] as any[] };
      const zeroCount = { count: 0 };
      const [propertiesRes, plansRes, beneficiariesRes, familyRes, witnessesRes, compRes] = await Promise.all([
        withTimeout(supabase.from("dfp_properties").select("id, estimated_value").eq("owner_id", user.id), 15000, emptyList as any),
        withTimeout(
          supabase
            .from("dfp_succession_records")
            .select("id, title, status, created_at, report_generated_at")
            .eq("owner_id", user.id)
            .order("created_at", { ascending: false }),
          15000,
          emptyList as any
        ),
        withTimeout(
          supabase.from("dfp_beneficiaries").select("id", { count: "exact", head: true }).eq("owner_id", user.id),
          15000,
          zeroCount as any
        ),
        withTimeout(
          supabase.from("dfp_family_members").select("id", { count: "exact", head: true }).eq("owner_id", user.id),
          15000,
          zeroCount as any
        ),
        withTimeout(
          supabase
            .from("dfp_witnesses")
            .select("id, dfp_succession_records!inner(owner_id)", { count: "exact", head: true })
            .eq("dfp_succession_records.owner_id", user.id),
          15000,
          zeroCount as any
        ),
        withTimeout(supabase.rpc("dfp_estate_completeness", { p_owner_id: user.id }), 15000, { data: null } as any),
      ]);

      const properties = propertiesRes.data;
      const plans = plansRes.data;

      let documentCount = 0;
      if (properties && properties.length > 0) {
        const docsRes = await withTimeout(
          supabase
            .from("dfp_property_documents")
            .select("id", { count: "exact", head: true })
            .in("property_id", properties.map((p: any) => p.id)),
          15000,
          zeroCount as any
        );
        documentCount = docsRes.count ?? 0;
      }

      const activityRes = await withTimeout(
        supabase.from("dfp_audit_logs").select("id, action, created_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(6),
        15000,
        emptyList as any
      );
      setRecentActivity(activityRes.data ?? []);

      const pending = (plans ?? []).filter((p: any) =>
        ["submitted", "witness_review", "local_leader_review", "legal_review"].includes(p.status)
      ).length;
      const totalValue = (properties ?? []).reduce(
        (sum: number, p: any) => sum + (Number(p.estimated_value) || 0),
        0
      );

      setCounts({
        properties: properties?.length ?? 0,
        plans: plans?.length ?? 0,
        pending,
        value: totalValue,
        beneficiaries: beneficiariesRes.count ?? 0,
        family: familyRes.count ?? 0,
        documents: documentCount,
      });
      setActivePlan((plans && plans[0]) ?? null);
      setWitnessCount(witnessesRes.count ?? 0);

      if (compRes.data) setCompleteness(compRes.data as any);
    })();
  }, [supabase]);

  const alerts: string[] = [];
  if (counts.properties > 0 && witnessCount === 0) {
    alerts.push(
      lang === "sw"
        ? "Hakuna shahidi aliyeteuliwa bado kwa mali zako."
        : "No witnesses have been assigned to your properties yet."
    );
  }
  if (counts.properties > 0 && counts.beneficiaries === 0) {
    alerts.push(
      lang === "sw" ? "Bado hujaongeza mnufaika yeyote." : "You haven't added any beneficiaries yet."
    );
  }

  return (
    <DashboardShell role="owner">
      <div className="mb-6 flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-xl font-semibold text-primary">
          {lang === "sw" ? "Dashibodi" : "Dashboard"}
        </h1>
        <div className="flex items-center gap-2">
          <PageGuide content={DASHBOARD_GUIDE} />
          <Link href="/owner/succession-plans/new" className="btn-primary text-sm">
            {lang === "sw" ? "Kumbukumbu Mpya ya Urithi" : "New Succession Record"}
          </Link>
        </div>
      </div>

      {completeness && completeness.score < 100 && <WelcomeWizard />}

      <div className="card mb-6">
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-semibold text-primary text-sm uppercase tracking-wide">
            {lang === "sw" ? "Kiwango cha Utayari wa Urithi" : "Succession Readiness Score"}
          </h2>
          <span className="text-2xl font-bold text-primary" aria-hidden="true">
            {completeness?.score ?? 0}%
          </span>
        </div>
        <div
          role="progressbar"
          aria-valuenow={completeness?.score ?? 0}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={lang === "sw" ? "Kiwango cha utayari" : "Readiness score"}
          className="w-full bg-gray-200 h-3"
        >
          <div className="bg-secondary h-3 transition-all" style={{ width: `${completeness?.score ?? 0}%` }} />
        </div>
        {completeness && completeness.score < 100 && completeness.missing.length > 0 && (
          <div className="mt-3 pt-3 border-t border-gray-200">
            <p className="text-xs font-medium text-inkSoft mb-1.5">
              {lang === "sw"
                ? "Hii ni tofauti na orodha ya \"Anza Hapa\" hapo juu — alama hizo huthibitisha umeanza kila hatua, ilhali asilimia hii inapima ukamilifu wa kina (mfano: kila mnufaika kuthibitisha, kila mali kuwa na hati, mashahidi wote kutia sahihi). Bado inakosekana:"
                : "This differs from the \"Get Started\" checklist above — those checkmarks confirm you began each step, while this percentage measures deeper completeness (e.g. every beneficiary confirming, every property having documents, every witness signing off). Still missing:"}
            </p>
            <ul className="text-xs text-inkSoft list-disc list-inside space-y-0.5">
              {completeness.missing.map((m, i) => (
                <li key={i}>{m}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {alerts.length > 0 && (
        <div role="alert" className="card mb-6 border-l-4" style={{ borderLeftColor: "#D97706" }}>
          <div className="flex items-start gap-2">
            <AlertTriangle size={20} className="text-warning shrink-0 mt-0.5" aria-hidden="true" />
            <div>
              <p className="text-sm font-semibold text-ink mb-1">
                {lang === "sw" ? "Tahadhari" : "Attention needed"}
              </p>
              <ul className="text-sm text-inkSoft list-disc list-inside space-y-0.5">
                {alerts.map((a, i) => (
                  <li key={i}>{a}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      <h2 className="text-sm font-semibold text-inkSoft uppercase tracking-wide mb-3">
        {lang === "sw" ? "Vitendo vya Haraka" : "Quick Actions"}
      </h2>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {QUICK_ACTIONS.map((a) => {
          const Icon = a.icon;
          return (
            <Link
              key={a.href}
              href={a.href}
              className="card flex flex-col items-center text-center gap-2 hover:bg-neutralLight transition"
              style={{ minHeight: 110 }}
            >
              <span className="flex items-center justify-center w-11 h-11 rounded-full bg-blue-50 text-primary">
                <Icon size={22} aria-hidden="true" />
              </span>
              <span className="text-sm font-medium text-ink">{lang === "sw" ? a.sw : a.en}</span>
            </Link>
          );
        })}
      </div>

      <h2 className="text-sm font-semibold text-inkSoft uppercase tracking-wide mb-3">
        {lang === "sw" ? "Muhtasari wa Urithi" : "Estate Summary"}
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        <StatCard label={lang === "sw" ? "Mali" : "Properties"} value={counts.properties} />
        <StatCard label={lang === "sw" ? "Familia" : "Family Members"} value={counts.family} />
        <StatCard label={lang === "sw" ? "Wanufaika" : "Beneficiaries"} value={counts.beneficiaries} />
        <StatCard label={lang === "sw" ? "Kumbukumbu za Urithi" : "Succession Records"} value={counts.plans} />
        <StatCard label={lang === "sw" ? "Hati Zilizopakiwa" : "Documents Uploaded"} value={counts.documents} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="card lg:col-span-2">
          <h2 className="font-semibold text-primary mb-4 text-sm uppercase tracking-wide">
            {lang === "sw" ? "Kumbukumbu ya Hivi Karibuni" : "Most Recent Succession Record"}
          </h2>
          {activePlan ? (
            <div>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="font-medium text-neutralDark">{activePlan.title}</p>
                  <StatusBadge status={activePlan.status} />
                </div>
                <Link
                  href={`/owner/succession-plans/${activePlan.id}`}
                  className="text-sm text-primary font-medium underline"
                >
                  {lang === "sw" ? "Tazama Maelezo" : "View details"}
                </Link>
              </div>
              <VerificationTimeline status={activePlan.status} reportGenerated={!!activePlan.report_generated_at} />
            </div>
          ) : (
            <p className="text-sm text-inkSoft">
              {lang === "sw" ? "Bado hujatengeneza kumbukumbu ya urithi." : "You haven't created a succession record yet."}{" "}
              <Link href="/owner/succession-plans/new" className="text-primary font-medium underline">
                {lang === "sw" ? "Tengeneza sasa" : "Create one now"}
              </Link>
              .
            </p>
          )}
        </div>

        <div className="card">
          <h2 className="font-semibold text-primary mb-4 text-sm uppercase tracking-wide">
            {lang === "sw" ? "Thamani ya Mali (TZS)" : "Estimated Total Value (TZS)"}
          </h2>
          <p className="text-2xl font-bold text-ink">{counts.value.toLocaleString()}</p>
          <p className="text-xs text-inkSoft mt-1">
            {counts.pending} {lang === "sw" ? "zinasubiri uhakiki" : "pending verification"}
          </p>
        </div>
      </div>

      <div className="card mt-6">
        <h2 className="font-semibold text-primary mb-3 text-sm uppercase tracking-wide">
          {lang === "sw" ? "Shughuli za Hivi Karibuni" : "Recent Activity"}
        </h2>
        {recentActivity.length === 0 ? (
          <p className="text-sm text-inkSoft">{lang === "sw" ? "Hakuna shughuli zilizorekodiwa bado." : "No activity recorded yet."}</p>
        ) : (
          <ul className="text-sm divide-y divide-gray-200">
            {recentActivity.map((a) => (
              <li key={a.id} className="flex justify-between py-1.5">
                <span className="text-ink">{a.action}</span>
                <span className="text-xs text-inkSoft">{new Date(a.created_at).toLocaleString()}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </DashboardShell>
  );
}
