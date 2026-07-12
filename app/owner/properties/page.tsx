"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Landmark, FileText, Eye, Pencil, Upload, TrendingUp, Users2, HeartPulse, AlertTriangle, History, Lightbulb } from "lucide-react";
import DashboardShell from "@/components/DashboardShell";
import { EmptyState } from "@/components/EmptyState";
import { PageGuide } from "@/components/PageGuide";
import { DonutChartWithLegend } from "@/components/DonutChart";
import { createClient } from "@/lib/supabase/client";
import { useLanguage } from "@/lib/i18n";
import { PROPERTY_CATEGORIES, categoryMeta } from "@/lib/propertyCategories";

const PROPERTIES_GUIDE = {
  purpose: { en: "Keep a complete record of every asset you own, in one place.", sw: "Kuhifadhi kumbukumbu kamili ya kila mali unayomiliki, mahali pamoja." },
  why: {
    en: "A succession record can only include properties that are registered here first — this is the foundation everything else builds on.",
    sw: "Kumbukumbu ya urithi inaweza kujumuisha tu mali zilizosajiliwa hapa kwanza — hii ndiyo msingi wa kila kitu kingine.",
  },
  example: { en: "House in Moshi, Farm in Arusha, Toyota Hilux, Family Business.", sw: "Nyumba Moshi, Shamba Arusha, Toyota Hilux, Biashara ya Familia." },
  mistakes: {
    en: "Forgetting to add bank accounts, vehicles, or businesses — not just land and houses.",
    sw: "Kusahau kuongeza akaunti za benki, magari, au biashara — sio ardhi na nyumba tu.",
  },
  nextStep: { en: "After adding your properties, go to Family Structure Registry to record your family.", sw: "Baada ya kuongeza mali zako, nenda Sajili ya Muundo wa Familia kuandika familia yako." },
};

type Property = {
  id: string;
  property_number: string | null;
  name: string;
  category: string;
  ownership_type: string | null;
  estimated_value: number | null;
  location: string | null;
  status: string;
};

export default function PropertiesPage() {
  const supabase = createClient();
  const { lang } = useLanguage();
  const sw = lang === "sw";
  const [properties, setProperties] = useState<Property[]>([]);
  const [docCounts, setDocCounts] = useState<Record<string, number>>({});
  const [beneficiaryCount, setBeneficiaryCount] = useState(0);
  const [healthScore, setHealthScore] = useState<{ score: number; missing: string[] } | null>(null);
  const [disputeCount, setDisputeCount] = useState(0);
  const [recentActivity, setRecentActivity] = useState<{ id: string; action: string; created_at: string }[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    const [propsRes, benRes, healthRes, disputeRes, activityRes] = await Promise.all([
      supabase
        .from("dfp_properties")
        .select("id, property_number, name, category, ownership_type, estimated_value, location, status")
        .eq("owner_id", user.id)
        .order("created_at", { ascending: false }),
      supabase.from("dfp_beneficiaries").select("id", { count: "exact", head: true }).eq("owner_id", user.id),
      supabase.rpc("dfp_estate_completeness", { p_owner_id: user.id }),
      supabase
        .from("dfp_disputes")
        .select("id, dfp_succession_records!inner(owner_id)", { count: "exact", head: true })
        .eq("dfp_succession_records.owner_id", user.id),
      supabase.from("dfp_audit_logs").select("id, action, created_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(6),
    ]);
    const data = propsRes.data;
    setProperties(data ?? []);
    setBeneficiaryCount(benRes.count ?? 0);
    if (healthRes.data) setHealthScore(healthRes.data as any);
    setDisputeCount(disputeRes.count ?? 0);
    setRecentActivity(activityRes.data ?? []);

    if (data && data.length > 0) {
      const { data: docRows } = await supabase
        .from("dfp_property_documents")
        .select("property_id")
        .in("property_id", data.map((p) => p.id));
      const counts: Record<string, number> = {};
      (docRows ?? []).forEach((d) => {
        counts[d.property_id] = (counts[d.property_id] ?? 0) + 1;
      });
      setDocCounts(counts);
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleDelete(id: string) {
    if (!confirm(sw ? "Futa mali hii? Hatua hii haiwezi kutenduliwa." : "Delete this property? This cannot be undone.")) return;
    await supabase.from("dfp_properties").delete().eq("id", id);
    load();
  }

  const totalValue = properties.reduce((sum, p) => sum + (Number(p.estimated_value) || 0), 0);
  const totalDocs = Object.values(docCounts).reduce((a, b) => a + b, 0);
  const categoryCounts = properties.reduce<Record<string, number>>((acc, p) => {
    acc[p.category] = (acc[p.category] ?? 0) + 1;
    return acc;
  }, {});
  const verifiedCount = properties.filter((p) => p.status === "verified").length;
  const pendingCount = properties.length - verifiedCount;
  const usedCategories = PROPERTY_CATEGORIES.filter((c) => categoryCounts[c.key] > 0);
  const categoryValueTotals: Record<string, number> = {};
  properties.forEach((p) => {
    categoryValueTotals[p.category] = (categoryValueTotals[p.category] ?? 0) + (Number(p.estimated_value) || 0);
  });
  const missingDocsCount = properties.filter((p) => !docCounts[p.id]).length;

  // Real, computable risk factors -- not fabricated scores.
  const ownershipRisk: "low" | "medium" | "high" = disputeCount === 0 ? "low" : disputeCount <= 1 ? "medium" : "high";
  const docsRisk: "low" | "medium" | "high" = properties.length === 0 || missingDocsCount === 0 ? "low" : missingDocsCount < properties.length ? "medium" : "high";
  const verificationRisk: "low" | "medium" | "high" = properties.length === 0 ? "low" : pendingCount === 0 ? "low" : pendingCount < properties.length ? "medium" : "high";
  const familyDisputeRisk: "low" | "medium" | "high" = disputeCount === 0 ? "low" : "medium";
  const riskDot = (level: "low" | "medium" | "high") => (level === "low" ? "#15803D" : level === "medium" ? "#D97706" : "#B91C1C");
  const riskText = (level: "low" | "medium" | "high") => (level === "low" ? (sw ? "Chini" : "Low") : level === "medium" ? (sw ? "Wastani" : "Medium") : sw ? "Juu" : "High");

  const recommendations: string[] = [];
  if (missingDocsCount > 0) recommendations.push(sw ? "Pakia hati za mali zinazokosekana." : "Upload documents for properties missing them.");
  if (beneficiaryCount === 0) recommendations.push(sw ? "Ongeza angalau mnufaika mmoja." : "Add at least one beneficiary.");
  if (pendingCount > 0) recommendations.push(sw ? "Kamilisha uthibitisho wa mali zinazosubiri." : "Complete verification for pending properties.");
  if (healthScore && healthScore.score < 100 && healthScore.missing[0]) recommendations.push(healthScore.missing[0]);
  if (recommendations.length === 0) recommendations.push(sw ? "Mali yako iko katika hali nzuri — endelea kuipitia mara kwa mara." : "Your estate is in good shape — keep reviewing it periodically.");

  return (
    <DashboardShell role="owner">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-primary">{sw ? "Sajili ya Mali" : "Property Registry"}</h1>
        <div className="flex items-center gap-2">
          <PageGuide content={PROPERTIES_GUIDE} />
          <Link href="/owner/properties/new" className="btn-primary text-sm">
            {sw ? "Sajili Mali" : "Register Property"}
          </Link>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-neutralDark">{sw ? "Inapakia…" : "Loading…"}</p>
      ) : properties.length === 0 ? (
        <EmptyState
          icon={Landmark}
          title={sw ? "🏠 Sajili Mali Yako ya Kwanza" : "🏠 Register Your First Property"}
          description={
            sw
              ? "Mali ndio msingi wa kumbukumbu yako ya urithi. Ni kila kitu chenye thamani unachotaka kiwarithishe familia yako."
              : "Properties form the foundation of your succession record. A property is anything of value you want to pass on to your family."
          }
          examples={sw ? ["Nyumba", "Shamba", "Gari", "Biashara", "Akaunti ya Benki"] : ["House", "Farm", "Vehicle", "Business", "Bank Account"]}
          action={{ label: sw ? "Sajili Mali" : "Register Property", href: "/owner/properties/new" }}
          helpHref="/help"
          helpLabel={sw ? "Nahitaji msaada zaidi" : "I need more help"}
        />
      ) : (
        <>
          {/* My Estate summary */}
          <div className="card mb-6">
            <h2 className="font-semibold text-primary mb-4 text-sm uppercase tracking-wide">{sw ? "Mali Yangu" : "My Estate"}</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-5">
              {usedCategories.map((c) => {
                const CatIcon = c.icon;
                return (
                  <div key={c.key} className="text-center border border-gray-200 py-3" style={{ backgroundColor: c.bg }}>
                    <CatIcon size={26} className="mx-auto mb-1.5" aria-hidden="true" style={{ color: c.color }} />
                    <p className="text-lg font-bold" style={{ color: c.color }}>{categoryCounts[c.key]}</p>
                    <p className="text-[11px] text-inkSoft">{c.label[lang]}</p>
                  </div>
                );
              })}
              <div className="text-center border border-gray-200 py-3 bg-neutralLight">
                <FileText size={26} className="mx-auto mb-1.5 text-inkSoft" aria-hidden="true" />
                <p className="text-lg font-bold text-ink">{totalDocs}</p>
                <p className="text-[11px] text-inkSoft">{sw ? "Hati" : "Documents"}</p>
              </div>
            </div>
            <div className="border-t border-gray-200 pt-4">
              <p className="text-xs text-inkSoft uppercase tracking-wide">{sw ? "Thamani Inayokadiriwa ya Jumla" : "Estimated Total Value"}</p>
              <p className="text-2xl font-bold text-primary">TZS {totalValue.toLocaleString()}</p>
            </div>
          </div>

          {/* Executive Estate Analytics */}
          <div className="mb-6">
            <h2 className="text-sm font-semibold text-inkSoft uppercase tracking-wide mb-3">{sw ? "Uchambuzi wa Mali" : "Estate Analytics"}</h2>

            {/* KPI cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
              <div className="card">
                <TrendingUp size={18} className="text-primary mb-2" aria-hidden="true" />
                <p className="text-xl font-bold text-ink">TZS {totalValue.toLocaleString()}</p>
                <p className="text-[11px] text-inkSoft uppercase">{sw ? "Thamani ya Mali" : "Total Estate Value"}</p>
              </div>
              <div className="card">
                <Landmark size={18} className="text-primary mb-2" aria-hidden="true" />
                <p className="text-xl font-bold text-ink">{properties.length}</p>
                <p className="text-[11px] text-inkSoft uppercase">{sw ? "Mali" : "Total Assets"}</p>
              </div>
              <div className="card">
                <Users2 size={18} className="text-primary mb-2" aria-hidden="true" />
                <p className="text-xl font-bold text-ink">{beneficiaryCount}</p>
                <p className="text-[11px] text-inkSoft uppercase">{sw ? "Wanufaika" : "Total Beneficiaries"}</p>
              </div>
              <div className="card">
                <HeartPulse size={18} className="text-primary mb-2" aria-hidden="true" />
                <p className="text-xl font-bold text-ink">{healthScore?.score ?? 0}%</p>
                <p className="text-[11px] text-inkSoft uppercase">{sw ? "Alama ya Afya" : "Estate Health Score"}</p>
              </div>
            </div>

            {/* Donuts */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div className="card">
                <DonutChartWithLegend
                  title={sw ? "Mgawanyo wa Thamani kwa Aina" : "Property Value Distribution"}
                  centerValue={`${properties.length}`}
                  centerLabel={sw ? "Mali" : "Assets"}
                  segments={usedCategories.map((c) => ({ label: c.label[lang], value: categoryValueTotals[c.key] ?? 0, color: c.color }))}
                />
              </div>
              <div className="card">
                <DonutChartWithLegend
                  title={sw ? "Hadhi ya Uthibitishaji" : "Verification Status"}
                  centerValue={`${properties.length}`}
                  centerLabel={sw ? "Mali" : "Assets"}
                  segments={[
                    { label: sw ? "Zimethibitishwa" : "Verified", value: verifiedCount, color: "#15803D" },
                    { label: sw ? "Zinasubiri" : "Pending", value: pendingCount, color: "#D97706" },
                  ]}
                />
                <p className="text-[11px] text-inkSoft mt-2">
                  {sw
                    ? "Mali huwa \"Zimethibitishwa\" pale tu kumbukumbu yake ya urithi inapopitishwa na mashahidi na kiongozi. \"Zinasubiri\" haimaanishi hitilafu — inasubiri sahihi hizo."
                    : "A property becomes \"Verified\" only once its succession record is approved by witnesses and a leader. \"Pending\" isn't an error — it's waiting on those signatures."}
                </p>
              </div>
            </div>

            {/* Health + Risk */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div className="card">
                <p className="text-xs font-semibold text-inkSoft uppercase tracking-wide mb-2 flex items-center gap-2">
                  <HeartPulse size={14} aria-hidden="true" /> {sw ? "Afya ya Mali" : "Estate Health"}
                </p>
                <div className="w-full bg-gray-200 h-2.5 mb-1">
                  <div className="bg-secondary h-2.5" style={{ width: `${healthScore?.score ?? 0}%` }} />
                </div>
                <p className="text-xs text-inkSoft">{healthScore?.score ?? 0}% {sw ? "kamili" : "complete"}</p>
              </div>
              <div className="card">
                <p className="text-xs font-semibold text-inkSoft uppercase tracking-wide mb-2 flex items-center gap-2">
                  <AlertTriangle size={14} aria-hidden="true" /> {sw ? "Uchambuzi wa Hatari" : "Risk Analysis"}
                </p>
                <div className="space-y-1">
                  {[
                    { label: sw ? "Umiliki" : "Ownership Risk", level: ownershipRisk },
                    { label: sw ? "Hati Zinazokosekana" : "Missing Documents", level: docsRisk },
                    { label: sw ? "Uthibitishaji" : "Verification Risk", level: verificationRisk },
                    { label: sw ? "Mgogoro wa Familia" : "Family Dispute Risk", level: familyDisputeRisk },
                  ].map((r) => (
                    <div key={r.label} className="flex items-center justify-between text-xs">
                      <span className="text-inkSoft">{r.label}</span>
                      <span className="font-medium" style={{ color: riskDot(r.level) }}>● {riskText(r.level)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Activity + Recommendations */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="card">
                <p className="text-xs font-semibold text-inkSoft uppercase tracking-wide mb-3 flex items-center gap-2">
                  <History size={14} aria-hidden="true" /> {sw ? "Shughuli za Hivi Karibuni" : "Recent Activity"}
                </p>
                {recentActivity.length === 0 ? (
                  <p className="text-xs text-inkSoft">{sw ? "Hakuna shughuli bado." : "No activity yet."}</p>
                ) : (
                  <ul className="space-y-1.5">
                    {recentActivity.map((a) => (
                      <li key={a.id} className="text-xs flex justify-between gap-2">
                        <span className="text-ink truncate">{a.action}</span>
                        <span className="text-inkSoft shrink-0">{new Date(a.created_at).toLocaleDateString()}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="card">
                <p className="text-xs font-semibold text-inkSoft uppercase tracking-wide mb-3 flex items-center gap-2">
                  <Lightbulb size={14} aria-hidden="true" /> {sw ? "Mapendekezo" : "Action Recommendations"}
                </p>
                <ul className="space-y-1.5 text-xs text-ink list-disc list-inside">
                  {recommendations.map((r, i) => (
                    <li key={i}>{r}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          {/* Property cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {properties.map((p) => {
              const meta = categoryMeta(p.category);
              const Icon = meta.icon;
              return (
                <div key={p.id} className="card border-t-4" style={{ borderTopColor: meta.color }}>
                  <div className="flex items-start justify-between mb-3">
                    <span
                      className="w-10 h-10 rounded-lg flex items-center justify-center"
                      style={{ backgroundColor: meta.bg }}
                    >
                      <Icon size={20} aria-hidden="true" style={{ color: meta.color }} />
                    </span>
                    <span
                      className="badge"
                      style={{ backgroundColor: p.status === "verified" ? "#F0FDF4" : "#FFFBEB", color: p.status === "verified" ? "#15803D" : "#B45309", borderColor: p.status === "verified" ? "#15803D" : "#B45309" }}
                    >
                      {p.status === "verified" ? `✅ ${sw ? "Imethibitishwa" : "Verified"}` : `⏳ ${sw ? "Inasubiri" : "Pending"}`}
                    </span>
                  </div>

                  <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: meta.color }}>{meta.label[lang]}</p>
                  <p className="font-semibold text-ink text-base mb-1">{p.name}</p>
                  {p.property_number && <p className="text-[11px] text-inkSoft font-mono mb-2">{p.property_number}</p>}

                  <dl className="text-xs text-inkSoft space-y-1 mb-3">
                    {p.location && (
                      <div className="flex justify-between gap-2">
                        <dt>{sw ? "Mahali" : "Location"}</dt>
                        <dd className="text-ink text-right">{p.location}</dd>
                      </div>
                    )}
                    {p.ownership_type && (
                      <div className="flex justify-between gap-2">
                        <dt>{sw ? "Umiliki" : "Ownership"}</dt>
                        <dd className="text-ink capitalize">{p.ownership_type}</dd>
                      </div>
                    )}
                    {p.estimated_value != null && (
                      <div className="flex justify-between gap-2">
                        <dt>{sw ? "Thamani" : "Value"}</dt>
                        <dd className="text-ink font-semibold">TZS {Number(p.estimated_value).toLocaleString()}</dd>
                      </div>
                    )}
                    <div className="flex justify-between gap-2">
                      <dt className="flex items-center gap-1"><FileText size={12} aria-hidden="true" />{sw ? "Hati" : "Documents"}</dt>
                      <dd className="text-ink">{docCounts[p.id] ?? 0} {sw ? "zilizopakiwa" : "Uploaded"}</dd>
                    </div>
                  </dl>

                  <div className="flex items-center gap-2 border-t border-gray-200 pt-3">
                    <Link
                      href={`/owner/properties/${p.id}`}
                      className="inline-flex items-center gap-1 text-xs font-medium text-primary border border-primary px-2"
                      style={{ minHeight: 32 }}
                    >
                      <Eye size={14} aria-hidden="true" /> {sw ? "Tazama" : "View"}
                    </Link>
                    <Link
                      href={`/owner/properties/${p.id}?edit=1`}
                      className="inline-flex items-center gap-1 text-xs font-medium text-inkSoft border border-gray-300 px-2"
                      style={{ minHeight: 32 }}
                    >
                      <Pencil size={14} aria-hidden="true" /> {sw ? "Hariri" : "Edit"}
                    </Link>
                    <Link
                      href={`/owner/properties/${p.id}?upload=1`}
                      className="inline-flex items-center gap-1 text-xs font-medium text-inkSoft border border-gray-300 px-2"
                      style={{ minHeight: 32 }}
                    >
                      <Upload size={14} aria-hidden="true" /> {sw ? "Pakia" : "Upload"}
                    </Link>
                    <button
                      onClick={() => handleDelete(p.id)}
                      className="ml-auto text-xs text-danger hover:underline"
                    >
                      {sw ? "Futa" : "Delete"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </DashboardShell>
  );
}
