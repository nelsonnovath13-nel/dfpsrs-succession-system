"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { LifeBuoy, BookOpen, X } from "lucide-react";
import { useLanguage } from "@/lib/i18n";

const PAGE_HELP: Record<string, { en: string; sw: string }> = {
  "/owner/dashboard": {
    en: "This is your overview — your readiness score, quick actions, and a summary of everything you've registered so far.",
    sw: "Huu ndio muhtasari wako — kiwango cha utayari, vitendo vya haraka, na muhtasari wa kila kitu ulichosajili.",
  },
  "/owner/properties": {
    en: "A property is anything of value you want to pass on: a house, land, a vehicle, a business, or a bank account.",
    sw: "Mali ni kitu chochote chenye thamani unachotaka kukirithisha: nyumba, shamba, gari, biashara, au akaunti ya benki.",
  },
  "/owner/family": {
    en: "Record your father, mother, spouse, children, and dependents to show your family structure clearly.",
    sw: "Sajili baba, mama, mke/mume, watoto na wategemezi ili kuonyesha muundo wa familia yako kwa uwazi.",
  },
  "/owner/beneficiaries": {
    en: "A beneficiary is a person who should receive a share of your property after you pass away.",
    sw: "Mnufaika ni mtu anayepaswa kupokea sehemu ya mali yako baada ya wewe kufariki.",
  },
  "/owner/executors": {
    en: "An executor is someone you trust to follow through on your succession plan after you pass away.",
    sw: "Msimamizi wa urithi ni mtu unayemwamini kufuatilia mchakato wa urithi wako baada ya wewe kufariki.",
  },
  "/owner/succession-plans": {
    en: "A succession record links your properties to your beneficiaries and sends it for verification.",
    sw: "Kumbukumbu ya urithi inaunganisha mali zako na wanufaika wako na kuituma kwa uhakiki.",
  },
  "/owner/estate": {
    en: "This shows how complete and ready your estate records are, with a checklist of what's still missing.",
    sw: "Hapa unaona jinsi kumbukumbu za mali yako zilivyo kamili, pamoja na orodha ya kilichobaki.",
  },
  "/owner/disputes": {
    en: "Open a dispute if there's a disagreement about a succession record that needs to be resolved.",
    sw: "Fungua mgogoro iwapo kuna kutoelewana kuhusu kumbukumbu ya urithi kunakohitaji kutatuliwa.",
  },
};

const DEFAULT_HELP = {
  en: "If anything on this page is unclear, the full Help Center explains every term in simple language.",
  sw: "Iwapo kitu chochote kwenye ukurasa huu hakielewiki, Kituo cha Msaada kinaeleza kila neno kwa lugha rahisi.",
};

export function HelpButton() {
  const pathname = usePathname();
  const { lang, t: tr } = useLanguage();
  const [open, setOpen] = useState(false);

  const content = PAGE_HELP[pathname] ?? DEFAULT_HELP;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
        className="fixed right-4 bottom-20 lg:right-6 lg:bottom-6 inline-flex items-center gap-2 text-white font-medium shadow-lg no-print z-30"
        style={{ minHeight: 48, backgroundColor: "#003E7E", padding: "12px 20px" }}
      >
        <LifeBuoy size={20} aria-hidden="true" />
        <span>{tr("need_help")}</span>
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center no-print">
          <div className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} aria-hidden="true" />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="help-modal-title"
            className="relative bg-white border border-gray-300 w-full sm:max-w-md max-h-[80vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
              <h2 id="help-modal-title" className="font-semibold text-primary">
                {tr("need_help")}
              </h2>
              <button type="button" aria-label={tr("close")} onClick={() => setOpen(false)} className="p-1 text-neutralDark">
                <X size={22} aria-hidden="true" />
              </button>
            </div>
            <div className="p-5">
              <p className="text-sm text-inkSoft leading-relaxed mb-4">
                {lang === "sw" ? content.sw : content.en}
              </p>
              <Link
                href="/help"
                className="inline-flex items-center gap-2 border border-primary text-primary font-medium text-sm px-4"
                style={{ minHeight: 44 }}
              >
                <BookOpen size={16} aria-hidden="true" />
                {tr("read_full_help")}
              </Link>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
