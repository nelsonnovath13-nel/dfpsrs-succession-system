"use client";

import Link from "next/link";
import { useLanguage, LanguageToggle } from "@/lib/i18n";
import { FooterLinks } from "@/components/FooterLinks";

export default function HomePage() {
  const { t: tr } = useLanguage();
  return (
    <main className="min-h-screen flex flex-col bg-white">
      <header className="official-header">
        <div className="flex items-center justify-between px-6 py-3">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 border-2 border-primary flex items-center justify-center text-primary font-bold text-sm">
              URT
            </div>
            <p className="text-sm font-semibold text-primary">{tr("system_name_short")}</p>
          </div>
          <LanguageToggle />
        </div>
      </header>

      <div className="flex-1 flex items-center justify-center px-6">
        <div className="max-w-2xl w-full text-center py-16">
          <h1 className="text-2xl sm:text-3xl font-bold text-primary mb-4">
            {tr("system_name")}
          </h1>
          <p className="text-neutralDark mb-6 leading-relaxed">{tr("landing_tagline")}</p>
          <div className="border-l-4 border-secondary bg-neutralLight text-left px-4 py-3 text-sm text-neutralDark mb-8">
            {tr("official_notice")}
          </div>
          <div className="flex items-center justify-center gap-4">
            <Link href="/login" className="btn-primary">
              {tr("sign_in")}
            </Link>
            <Link href="/register" className="btn-outline">
              {tr("create_account")}
            </Link>
          </div>
        </div>
      </div>

      <footer role="contentinfo" className="border-t border-gray-300 py-4 px-4">
        <FooterLinks />
      </footer>
    </main>
  );
}
