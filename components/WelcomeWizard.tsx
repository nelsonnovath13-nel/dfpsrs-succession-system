"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Check, Landmark, Users, HeartHandshake, ShieldCheck, FileText, Send } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useLanguage } from "@/lib/i18n";

type StepKey = "properties" | "family" | "beneficiaries" | "executors" | "record" | "submit";

const STEP_META: { key: StepKey; icon: typeof Landmark; href: string }[] = [
  { key: "properties", icon: Landmark, href: "/owner/properties/new?onboarding=1" },
  { key: "family", icon: Users, href: "/owner/family?onboarding=1" },
  { key: "beneficiaries", icon: HeartHandshake, href: "/owner/beneficiaries?onboarding=1" },
  { key: "executors", icon: ShieldCheck, href: "/owner/executors?onboarding=1" },
  { key: "record", icon: FileText, href: "/owner/succession-plans/new?onboarding=1" },
  { key: "submit", icon: Send, href: "/owner/succession-plans" },
];

const LABEL: Record<StepKey, { en: string; sw: string }> = {
  properties: { en: "Register Property", sw: "Sajili Mali" },
  family: { en: "Register Family", sw: "Sajili Familia" },
  beneficiaries: { en: "Register Beneficiaries", sw: "Sajili Wanufaika" },
  executors: { en: "Choose Executors", sw: "Chagua Wasimamizi" },
  record: { en: "Create Record", sw: "Tengeneza Kumbukumbu" },
  submit: { en: "Submit for Review", sw: "Tuma kwa Uhakiki" },
};

export function WelcomeWizard() {
  const supabase = createClient();
  const { lang } = useLanguage();
  const [done, setDone] = useState<Record<StepKey, boolean>>({
    properties: false,
    family: false,
    beneficiaries: false,
    executors: false,
    record: false,
    submit: false,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const [{ count: properties }, { count: family }, { count: beneficiaries }, { count: executors }, { data: records }] =
        await Promise.all([
          supabase.from("dfp_properties").select("id", { count: "exact", head: true }).eq("owner_id", user.id),
          supabase.from("dfp_family_members").select("id", { count: "exact", head: true }).eq("owner_id", user.id),
          supabase.from("dfp_beneficiaries").select("id", { count: "exact", head: true }).eq("owner_id", user.id),
          supabase.from("dfp_executors").select("id", { count: "exact", head: true }).eq("owner_id", user.id).eq("status", "active"),
          supabase.from("dfp_succession_records").select("status").eq("owner_id", user.id),
        ]);

      setDone({
        properties: (properties ?? 0) > 0,
        family: (family ?? 0) > 0,
        beneficiaries: (beneficiaries ?? 0) > 0,
        executors: (executors ?? 0) > 0,
        record: (records ?? []).length > 0,
        submit: (records ?? []).some((r) => r.status !== "draft"),
      });
      setLoading(false);
    })();
  }, [supabase]);

  if (loading) return null;

  const completedCount = Object.values(done).filter(Boolean).length;
  const nextStep = STEP_META.find((s) => !done[s.key]);

  return (
    <div className="card mb-6">
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-primary">
          {lang === "sw"
            ? "Karibu kwenye Mfumo wa Kumbukumbu za Mali na Urithi"
            : "Welcome to the Family Property & Succession Records System"}
        </h2>
        <p className="text-sm text-inkSoft mt-1">
          {lang === "sw"
            ? "Ili kuandaa kumbukumbu zako za urithi, fuata hatua hizi sita kwa mpangilio."
            : "To prepare your succession records, follow these six steps in order."}
        </p>
      </div>

      <div
        role="progressbar"
        aria-valuenow={completedCount}
        aria-valuemin={0}
        aria-valuemax={6}
        aria-label={lang === "sw" ? "Maendeleo ya usanidi" : "Setup progress"}
        className="w-full bg-gray-200 h-3 mb-6"
      >
        <div className="bg-secondary h-3 transition-all" style={{ width: `${(completedCount / 6) * 100}%` }} />
      </div>

      <ol className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {STEP_META.map((step, i) => {
          const isDone = done[step.key];
          const isNext = !isDone && step === nextStep;
          const Icon = step.icon;
          return (
            <li key={step.key}>
              <Link
                href={step.href}
                className={`flex flex-col items-center text-center gap-2 p-3 border ${
                  isDone
                    ? "border-secondary bg-green-50"
                    : isNext
                    ? "border-primary bg-blue-50 border-2"
                    : "border-gray-300 bg-white"
                }`}
                style={{ minHeight: 96 }}
              >
                <span
                  className={`flex items-center justify-center w-8 h-8 rounded-full ${
                    isDone ? "bg-secondary text-white" : isNext ? "bg-primary text-white" : "bg-gray-200 text-inkSoft"
                  }`}
                >
                  {isDone ? <Check size={18} aria-hidden="true" /> : <Icon size={18} aria-hidden="true" />}
                </span>
                <span className="text-xs font-medium text-ink">
                  {i + 1}. {lang === "sw" ? LABEL[step.key].sw : LABEL[step.key].en}
                </span>
              </Link>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
