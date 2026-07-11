"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useLanguage, LanguageToggle } from "@/lib/i18n";

type Role = "owner" | "witness" | "leader" | "admin" | "beneficiary" | "legal" | "auditor" | "executor";

type NavItem = { href: string; key: string; label: string };

function buildNav(role: Role, tr: (k: string) => string): NavItem[] {
  const common: NavItem[] = [];
  const byRole: Record<Role, NavItem[]> = {
    owner: [
      { href: "/owner/dashboard", key: "dashboard", label: tr("dashboard") },
      { href: "/owner/estate", key: "estate_dashboard", label: tr("estate_dashboard") },
      { href: "/owner/properties", key: "properties", label: tr("properties") },
      { href: "/owner/family", key: "family_structure", label: tr("family_structure") },
      { href: "/owner/beneficiaries", key: "beneficiaries", label: tr("beneficiaries") },
      { href: "/owner/executors", key: "executors", label: tr("executors") },
      { href: "/owner/succession-plans", key: "succession_plans", label: tr("succession_plans") },
      { href: "/owner/disputes", key: "disputes", label: tr("disputes") },
      { href: "/owner/reports", key: "reports", label: tr("reports") },
    ],
    witness: [
      { href: "/witness/dashboard", key: "verification_requests", label: tr("verification_requests") },
      { href: "/witness/death-verifications", key: "death_verifications", label: tr("death_verifications") },
    ],
    leader: [
      { href: "/leader/dashboard", key: "verification_requests", label: tr("verification_requests") },
      { href: "/leader/death-verifications", key: "death_verifications", label: tr("death_verifications") },
    ],
    legal: [
      { href: "/legal/dashboard", key: "legal_review", label: tr("legal_review") },
      { href: "/legal/death-verifications", key: "death_verifications", label: tr("death_verifications") },
      { href: "/legal/flags", key: "legal_flags", label: tr("legal_flags") },
    ],
    admin: [
      { href: "/admin/dashboard", key: "overview", label: tr("overview") },
      { href: "/admin/users", key: "users", label: tr("users") },
      { href: "/admin/death-verifications", key: "death_verifications", label: tr("death_verifications") },
      { href: "/admin/audit-logs", key: "audit_logs", label: tr("audit_logs") },
      { href: "/admin/reports", key: "reports", label: tr("reports") },
    ],
    auditor: [
      { href: "/auditor/dashboard", key: "audit_logs", label: tr("audit_logs") },
    ],
    beneficiary: [
      { href: "/beneficiary/dashboard", key: "my_inheritance", label: tr("my_inheritance") },
    ],
    executor: [
      { href: "/executor/dashboard", key: "dashboard", label: tr("dashboard") },
      { href: "/executor/estate", key: "estate_dashboard", label: tr("estate_dashboard") },
    ],
  };
  return [...byRole[role], ...common];
}

const ROLE_LABEL: Record<Role, { en: string; sw: string }> = {
  owner: { en: "Property Owner", sw: "Mmiliki wa Mali" },
  witness: { en: "Family Witness", sw: "Shahidi wa Familia" },
  leader: { en: "Local Government Leader", sw: "Kiongozi wa Serikali za Mitaa" },
  legal: { en: "Legal Officer", sw: "Afisa Sheria" },
  admin: { en: "System Administrator", sw: "Msimamizi wa Mfumo" },
  auditor: { en: "System Auditor", sw: "Mkaguzi wa Mfumo" },
  beneficiary: { en: "Beneficiary", sw: "Mnufaika" },
  executor: { en: "Estate Executor", sw: "Msimamizi wa Mirathi" },
};

export default function DashboardShell({
  role,
  children,
}: {
  role: Role;
  children: React.ReactNode;
}) {
  const supabase = createClient();
  const router = useRouter();
  const pathname = usePathname();
  const { lang, t: tr } = useLanguage();
  const [fullName, setFullName] = useState<string>("");
  const [unread, setUnread] = useState<number>(0);

  useEffect(() => {
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      const { data: profile } = await supabase
        .from("dfp_profiles")
        .select("full_name")
        .eq("id", user.id)
        .maybeSingle();
      setFullName(profile?.full_name ?? "");

      const { count } = await supabase
        .from("dfp_notifications")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("is_read", false);
      setUnread(count ?? 0);
    })();
  }, [supabase]);

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  const items = buildNav(role, tr);

  return (
    <div className="min-h-screen flex flex-col">
      <header className="official-header no-print">
        <div className="flex items-center justify-between px-6 py-3 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 border-2 border-primary flex items-center justify-center text-primary font-bold text-sm">
              URT
            </div>
            <div>
              <p className="text-sm font-semibold text-primary leading-tight">
                {tr("system_name_short")}
              </p>
              <p className="text-[11px] text-neutralDark leading-tight">
                {lang === "en" ? ROLE_LABEL[role].en : ROLE_LABEL[role].sw}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <LanguageToggle />
            <div className="text-right hidden sm:block">
              <p className="text-sm font-medium text-neutralDark">{fullName || "…"}</p>
            </div>
            {unread > 0 && (
              <span className="border border-primary text-primary text-xs px-2 py-0.5">
                {unread}
              </span>
            )}
            <button onClick={handleSignOut} className="text-sm text-primary underline">
              {tr("sign_out")}
            </button>
          </div>
        </div>
      </header>

      <div className="flex flex-1 min-h-0">
        <aside className="w-64 bg-white border-r border-gray-300 shrink-0 no-print">
          <nav className="py-4">
            {items.map((item) => {
              const active = pathname === item.href || pathname.startsWith(item.href + "/");
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`block px-5 py-2.5 text-sm border-l-4 ${
                    active
                      ? "border-primary bg-neutralLight text-primary font-semibold"
                      : "border-transparent text-neutralDark hover:bg-neutralLight"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
            <div className="mt-6 border-t border-gray-200 pt-3">
              <Link href="/help" className="block px-5 py-2 text-xs text-neutralDark hover:underline">
                {tr("help_center")}
              </Link>
              <Link href="/terms" className="block px-5 py-2 text-xs text-neutralDark hover:underline">
                {tr("terms")}
              </Link>
              <Link href="/privacy" className="block px-5 py-2 text-xs text-neutralDark hover:underline">
                {tr("privacy")}
              </Link>
            </div>
          </nav>
        </aside>

        <main className="flex-1 p-6 overflow-y-auto bg-neutralLight">{children}</main>
      </div>
    </div>
  );
}
