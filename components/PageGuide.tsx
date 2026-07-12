"use client";

import { useState } from "react";
import { Info, X } from "lucide-react";
import { useLanguage } from "@/lib/i18n";

type GuideContent = {
  purpose: { en: string; sw: string };
  why: { en: string; sw: string };
  example: { en: string; sw: string };
  mistakes: { en: string; sw: string };
  nextStep: { en: string; sw: string };
};

export function PageGuide({ content }: { content: GuideContent }) {
  const { lang } = useLanguage();
  const [open, setOpen] = useState(false);

  const rows: { label: { en: string; sw: string }; value: { en: string; sw: string } }[] = [
    { label: { en: "Purpose", sw: "Madhumuni" }, value: content.purpose },
    { label: { en: "Why this page matters", sw: "Kwa nini ukurasa huu ni muhimu" }, value: content.why },
    { label: { en: "Example", sw: "Mfano" }, value: content.example },
    { label: { en: "Common mistakes", sw: "Makosa ya Kawaida" }, value: content.mistakes },
    { label: { en: "Next step", sw: "Hatua Inayofuata" }, value: content.nextStep },
  ];

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-primary border border-primary px-3"
        style={{ minHeight: 36 }}
        aria-label={lang === "en" ? "Page Guide" : "Mwongozo wa Ukurasa"}
      >
        <Info size={16} aria-hidden="true" />
        {lang === "en" ? "Page Guide" : "Mwongozo"}
      </button>

      {open && (
        <div className="fixed inset-0 z-[70] flex items-start justify-end" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} aria-hidden="true" />
          <div className="relative bg-white w-full max-w-sm h-full shadow-2xl overflow-y-auto border-l border-gray-300">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
              <h2 className="text-base font-semibold text-primary flex items-center gap-2">
                <Info size={18} aria-hidden="true" />
                {lang === "en" ? "Page Guide" : "Mwongozo wa Ukurasa"}
              </h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label={lang === "en" ? "Close" : "Funga"}
                className="p-2 text-neutralDark"
              >
                <X size={20} aria-hidden="true" />
              </button>
            </div>
            <div className="p-5 space-y-5">
              {rows.map((r, i) => (
                <div key={i}>
                  <p className="text-xs font-semibold text-inkSoft uppercase tracking-wide mb-1">{r.label[lang]}</p>
                  <p className="text-sm text-neutralDark leading-relaxed">{r.value[lang]}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
