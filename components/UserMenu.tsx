"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronDown, User, ShieldCheck, LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useLanguage, LanguageToggle } from "@/lib/i18n";

export function UserMenu({ fullName, roleLabel }: { fullName: string; roleLabel: string }) {
  const supabase = createClient();
  const router = useRouter();
  const { t: tr } = useLanguage();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onEscape(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    document.addEventListener("keydown", onEscape);
    return () => {
      document.removeEventListener("mousedown", onClickOutside);
      document.removeEventListener("keydown", onEscape);
    };
  }, []);

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex items-center gap-2 text-right"
      >
        <span className="hidden sm:block">
          <span className="block text-sm font-medium text-neutralDark leading-tight">{fullName || "…"}</span>
          <span className="block text-[11px] text-inkSoft leading-tight">{roleLabel}</span>
        </span>
        <span className="flex items-center justify-center w-9 h-9 rounded-full bg-blue-50 text-primary shrink-0">
          <User size={18} aria-hidden="true" />
        </span>
        <ChevronDown size={16} className="text-neutralDark shrink-0" aria-hidden="true" />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 mt-2 w-64 bg-white border border-gray-300 shadow-lg z-50"
        >
          <div className="px-4 py-3 border-b border-gray-200 sm:hidden">
            <p className="text-sm font-medium text-neutralDark">{fullName || "…"}</p>
            <p className="text-[11px] text-inkSoft">{roleLabel}</p>
          </div>
          <Link
            href="/profile"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="flex items-center gap-3 px-4 text-sm text-neutralDark hover:bg-neutralLight"
            style={{ minHeight: 48 }}
          >
            <User size={18} aria-hidden="true" />
            {tr("profile")}
          </Link>
          <Link
            href="/profile#security"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="flex items-center gap-3 px-4 text-sm text-neutralDark hover:bg-neutralLight"
            style={{ minHeight: 48 }}
          >
            <ShieldCheck size={18} aria-hidden="true" />
            {tr("security")}
          </Link>
          <div className="px-4 py-3 border-t border-gray-200">
            <p className="text-[11px] font-semibold text-inkSoft uppercase tracking-wide mb-2">{tr("language")}</p>
            <LanguageToggle />
          </div>
          <button
            type="button"
            role="menuitem"
            onClick={handleSignOut}
            className="w-full flex items-center gap-3 px-4 text-sm text-danger hover:bg-red-50 border-t border-gray-200"
            style={{ minHeight: 48 }}
          >
            <LogOut size={18} aria-hidden="true" />
            {tr("sign_out")}
          </button>
        </div>
      )}
    </div>
  );
}
