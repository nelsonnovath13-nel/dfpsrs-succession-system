"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { X, Compass, LayoutGrid, LifeBuoy, CheckCircle2, type LucideIcon } from "lucide-react";
import { Landmark, Users, HeartHandshake, ShieldCheck, FileText, ClipboardCheck, FileBarChart } from "lucide-react";
import { useLanguage } from "@/lib/i18n";

type Role = "owner" | "witness" | "leader" | "admin" | "beneficiary" | "legal" | "auditor" | "executor";

type OwnerStep = {
  icon: LucideIcon;
  color: string;
  bg: string;
  title: { en: string; sw: string };
  body: { en: string; sw: string };
  examples: { en: string[]; sw: string[] };
  href: string;
};

const OWNER_STEPS: OwnerStep[] = [
  {
    icon: Landmark,
    color: "#1D4ED8",
    bg: "#EFF6FF",
    title: { en: "Register Your Property", sw: "Sajili Mali Yako" },
    body: {
      en: "Add every asset you own — houses, land, farms, vehicles, businesses, bank accounts and other valuable property.",
      sw: "Ongeza kila mali unayomiliki — nyumba, ardhi, mashamba, magari, biashara, akaunti za benki na mali nyingine za thamani.",
    },
    examples: { en: ["House in Moshi", "Farm in Arusha", "Toyota Hilux", "Family Business"], sw: ["Nyumba Moshi", "Shamba Arusha", "Toyota Hilux", "Biashara ya Familia"] },
    href: "/owner/properties",
  },
  {
    icon: Users,
    color: "#7C3AED",
    bg: "#F5F3FF",
    title: { en: "Build Your Family Tree", sw: "Jenga Muundo wa Familia Yako" },
    body: {
      en: "Record family members and relationships so the system understands your family structure.",
      sw: "Andika wanafamilia na uhusiano wao ili mfumo uelewe muundo wa familia yako.",
    },
    examples: { en: ["Father", "Mother", "Children", "Spouse"], sw: ["Baba", "Mama", "Watoto", "Mwenza"] },
    href: "/owner/family",
  },
  {
    icon: HeartHandshake,
    color: "#15803D",
    bg: "#F0FDF4",
    title: { en: "Choose Beneficiaries", sw: "Chagua Wanufaika" },
    body: {
      en: "Beneficiaries are people who may inherit your assets in the future.",
      sw: "Wanufaika ni watu wanaoweza kurithi mali yako siku zijazo.",
    },
    examples: { en: ["Children", "Spouse", "Parents"], sw: ["Watoto", "Mwenza", "Wazazi"] },
    href: "/owner/beneficiaries",
  },
  {
    icon: ShieldCheck,
    color: "#C2410C",
    bg: "#FFF7ED",
    title: { en: "Appoint Trusted Representatives", sw: "Teua Wawakilishi wa Kuaminika" },
    body: {
      en: "Choose people who will help oversee and support succession processes.",
      sw: "Chagua watu watakaosaidia kusimamia mchakato wa urithi.",
    },
    examples: { en: ["Lawyer", "Trusted Family Member", "Family Representative"], sw: ["Wakili", "Mwanafamilia wa Kuaminika", "Mwakilishi wa Familia"] },
    href: "/owner/executors",
  },
  {
    icon: FileText,
    color: "#4338CA",
    bg: "#EEF2FF",
    title: { en: "Create Succession Instructions", sw: "Tengeneza Maelekezo ya Urithi" },
    body: {
      en: "Connect your assets with beneficiaries and specify inheritance allocations, property by property.",
      sw: "Unganisha mali yako na wanufaika kisha eleza ugawaji wa urithi, mali kwa mali.",
    },
    examples: { en: ["House → Rahima", "Farm → John", "Business → Rahima 50%, Amina 50%"], sw: ["Nyumba → Rahima", "Shamba → John", "Biashara → Rahima 50%, Amina 50%"] },
    href: "/owner/succession-plans",
  },
  {
    icon: ClipboardCheck,
    color: "#0F766E",
    bg: "#F0FDFA",
    title: { en: "Verification Workflow", sw: "Mchakato wa Uthibitishaji" },
    body: {
      en: "Records are reviewed by witnesses and authorized officials before approval.",
      sw: "Kumbukumbu hupitiwa na mashahidi na maafisa walioidhinishwa kabla ya kuthibitishwa.",
    },
    examples: { en: ["Family Witness", "Village Officer", "Legal Officer"], sw: ["Shahidi wa Familia", "Afisa wa Kijiji", "Afisa Sheria"] },
    href: "/owner/succession-plans",
  },
  {
    icon: FileBarChart,
    color: "#A16207",
    bg: "#FEFCE8",
    title: { en: "Generate Reports & Certificates", sw: "Pata Taarifa na Vyeti" },
    body: {
      en: "Download, print and review succession documents and summaries once verified.",
      sw: "Pakua, chapisha na pitia hati na muhtasari wa urithi baada ya kuthibitishwa.",
    },
    examples: { en: [], sw: [] },
    href: "/owner/reports",
  },
];

const GENERIC_STEPS = [
  {
    icon: Compass,
    title: { en: "Welcome", sw: "Karibu" },
    body: {
      en: "This system helps you review and verify family property and succession records, step by step.",
      sw: "Mfumo huu unakusaidia kupitia na kuthibitisha mali za familia na kumbukumbu za urithi, hatua kwa hatua.",
    },
  },
  {
    icon: LayoutGrid,
    title: { en: "Find your way around", sw: "Tembea kwenye mfumo" },
    body: {
      en: "Use the menu on the left (or the bottom bar on your phone) to move between sections.",
      sw: "Tumia menyu upande wa kushoto (au mstari wa chini kwenye simu) kuhamia kati ya sehemu mbalimbali.",
    },
  },
  {
    icon: LifeBuoy,
    title: { en: "Help is always nearby", sw: "Msaada upo karibu kila wakati" },
    body: {
      en: "Tap the Help button anytime you're unsure what to do next, or to chat with our support team on WhatsApp.",
      sw: "Bofya kitufe cha Msaada wakati wowote hujui la kufanya, au kuongea na timu yetu ya msaada kupitia WhatsApp.",
    },
  },
];

export function FirstLoginTour({ storageKey, role }: { storageKey: string; role?: Role }) {
  const { lang } = useLanguage();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const seen = window.localStorage.getItem(storageKey);
    if (!seen) setOpen(true);
  }, [storageKey]);

  function close() {
    window.localStorage.setItem(storageKey, "1");
    setOpen(false);
  }

  if (!open) return null;

  if (role === "owner") {
    const total = OWNER_STEPS.length;
    const current = OWNER_STEPS[step];
    const Icon = current.icon;
    const isLast = step === total - 1;

    return (
      <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 sm:p-8" role="dialog" aria-modal="true" aria-label="Onboarding">
        <div className="absolute inset-0 bg-black/60" onClick={close} aria-hidden="true" />
        <div className="relative bg-white w-full max-w-2xl shadow-2xl border border-gray-300 max-h-full overflow-y-auto">
          <button
            type="button"
            onClick={close}
            aria-label={lang === "en" ? "Skip onboarding" : "Ruka mwongozo"}
            className="absolute top-3 right-3 p-2 text-neutralDark hover:bg-neutralLight"
            style={{ minHeight: 40, minWidth: 40 }}
          >
            <X size={22} aria-hidden="true" />
          </button>

          <div className="px-6 sm:px-10 pt-10 pb-8">
            <div className="flex items-center gap-1.5 mb-6">
              {OWNER_STEPS.map((_, i) => (
                <span key={i} className={`h-1.5 flex-1 rounded-full ${i <= step ? "bg-primary" : "bg-gray-200"}`} aria-hidden="true" />
              ))}
            </div>
            <p className="text-xs font-semibold text-inkSoft uppercase tracking-wide mb-4">
              {lang === "en" ? `Step ${step + 1} of ${total}` : `Hatua ${step + 1} kati ya ${total}`}
            </p>

            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center mb-5"
              style={{ backgroundColor: current.bg }}
            >
              <Icon size={32} aria-hidden="true" style={{ color: current.color }} />
            </div>

            <h2 className="text-2xl font-bold text-primary mb-3">{current.title[lang]}</h2>
            <p className="text-base text-neutralDark leading-relaxed mb-5">{current.body[lang]}</p>

            {current.examples[lang].length > 0 && (
              <div className="flex flex-wrap gap-2 mb-2">
                {current.examples[lang].map((ex, i) => (
                  <span
                    key={i}
                    className="text-sm px-3 py-1.5 rounded-full font-medium"
                    style={{ backgroundColor: current.bg, color: current.color }}
                  >
                    {ex}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center justify-between gap-3 px-6 sm:px-10 py-5 border-t border-gray-200 bg-neutralLight">
            <button
              type="button"
              onClick={close}
              className="text-sm text-inkSoft font-medium"
              style={{ minHeight: 44 }}
            >
              {lang === "en" ? "Skip" : "Ruka"}
            </button>
            <div className="flex items-center gap-3">
              {step > 0 && (
                <button type="button" onClick={() => setStep((s) => s - 1)} className="btn-outline" style={{ minHeight: 44 }}>
                  {lang === "en" ? "Previous" : "Nyuma"}
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  if (isLast) {
                    close();
                    router.push(current.href);
                  } else {
                    setStep((s) => s + 1);
                  }
                }}
                className="btn-primary inline-flex items-center gap-2"
                style={{ minHeight: 44 }}
              >
                {isLast ? <CheckCircle2 size={18} aria-hidden="true" /> : null}
                {isLast ? (lang === "en" ? "Get Started" : "Anza") : lang === "en" ? "Next" : "Endelea"}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const current = GENERIC_STEPS[step];
  const Icon = current.icon;
  const isLast = step === GENERIC_STEPS.length - 1;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Tour">
      <div className="absolute inset-0 bg-black/50" onClick={close} aria-hidden="true" />
      <div className="relative bg-white w-full max-w-sm shadow-xl border border-gray-300">
        <button
          type="button"
          onClick={close}
          aria-label={lang === "en" ? "Close" : "Funga"}
          className="absolute top-2 right-2 p-2 text-neutralDark"
        >
          <X size={20} aria-hidden="true" />
        </button>
        <div className="p-6 pt-8">
          <div className="w-12 h-12 rounded-full bg-blue-50 text-primary flex items-center justify-center mb-4">
            <Icon size={24} aria-hidden="true" />
          </div>
          <h2 className="text-lg font-semibold text-primary mb-2">{current.title[lang]}</h2>
          <p className="text-sm text-neutralDark leading-relaxed">{current.body[lang]}</p>

          <div className="flex items-center gap-1.5 mt-6 mb-4">
            {GENERIC_STEPS.map((_, i) => (
              <span key={i} className={`h-1.5 flex-1 ${i <= step ? "bg-primary" : "bg-gray-200"}`} aria-hidden="true" />
            ))}
          </div>

          <div className="flex items-center justify-between gap-3">
            <button type="button" onClick={close} className="text-sm text-inkSoft font-medium" style={{ minHeight: 44 }}>
              {lang === "en" ? "Skip" : "Ruka"}
            </button>
            <button
              type="button"
              onClick={() => (isLast ? close() : setStep((s) => s + 1))}
              className="btn-primary inline-flex items-center gap-2"
              style={{ minHeight: 44 }}
            >
              {isLast ? <CheckCircle2 size={18} aria-hidden="true" /> : null}
              {isLast ? (lang === "en" ? "Get Started" : "Anza") : lang === "en" ? "Next" : "Endelea"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
