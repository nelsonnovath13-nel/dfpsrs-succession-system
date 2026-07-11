"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft, X } from "lucide-react";
import { useLanguage } from "@/lib/i18n";

/**
 * Back/Exit controls for pages that are a step inside a flow (a "new" form, a wizard step,
 * a detail sub-page). Back uses router.back() so it respects however the user arrived;
 * Exit always jumps to a known-safe destination (typically this role's dashboard).
 */
export function PageNav({ exitHref, exitLabel }: { exitHref: string; exitLabel?: string }) {
  const router = useRouter();
  const { t: tr } = useLanguage();

  return (
    <div className="flex items-center gap-3 mb-4 no-print">
      <button
        type="button"
        onClick={() => router.back()}
        className="inline-flex items-center gap-2 text-white font-medium"
        style={{ minHeight: 48, backgroundColor: "#B91C1C", padding: "12px 24px" }}
      >
        <ArrowLeft size={18} aria-hidden="true" />
        <span>{tr("back")}</span>
      </button>
      <a
        href={exitHref}
        className="inline-flex items-center gap-2 text-white font-medium"
        style={{ minHeight: 48, backgroundColor: "#B91C1C", padding: "12px 24px" }}
      >
        <X size={18} aria-hidden="true" />
        <span>{exitLabel ?? tr("exit")}</span>
      </a>
    </div>
  );
}
