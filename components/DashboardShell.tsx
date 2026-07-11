"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Home,
  LayoutDashboard,
  Landmark,
  Users,
  HeartHandshake,
  ShieldCheck,
  FileText,
  AlertTriangle,
  FileBarChart,
  ClipboardCheck,
  HeartPulse,
  Scale,
  Flag,
  History,
  Gift,
  HelpCircle,
  Menu,
  X,
  Compass,
  type LucideIcon,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useLanguage, LanguageToggle } from "@/lib/i18n";
import { FooterLinks } from "@/components/FooterLinks";
import { HelpButton } from "@/components/HelpButton";

type Role = "owner" | "witness" | "leader" | "admin" | "beneficiary" | "legal" | "auditor" | "executor";

type NavItem = { href: string; key: string; label: string; icon: LucideIcon };

const ICON: Record<string, LucideIcon> = {
  dashboard: Home,
  estate_dashboard: LayoutDashboard,
  properties: Landmark,
  family_structure: Users,
  beneficiaries: HeartHandshake,
  executors: ShieldCheck,
  succession_plans: FileText,
  disputes: AlertTriangle,
  reports: FileBarChart,
  verification_requests: ClipboardCheck,
  death_verifications: HeartPulse,
  legal_review: Scale,
  legal_flags: Flag,
  overview: LayoutDashboard,
  users: Users,
  audit_logs: History,
  my_inheritance: Gift,
  onboarding: Compass,
};

function buildNav(role: Role, tr: (k: string) => string): NavItem[] {
  const common: NavItem[] = [];
  const byRole: Record<Role, Omit<NavItem, "icon">[]> = {
    owner: [
      { href: "/owner/dashboard", key: "dashboard", label: tr("dashboard") },
      { href: "/owner/onboarding", key: "onboarding", label: tr("onboarding") },
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
  return [...byRole[role], ...common].map((item) => ({ ...item, icon: ICON[item.key] ?? FileText }));
}

// Owner is the platform's highest-traffic, least technical role — ships a mobile bottom bar first.
const OWNER_BOTTOM_NAV_KEYS = ["properties", "family_structure", "beneficiaries", "succession_plans"];

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

function NavLink({ item, active, onClick }: { item: NavItem; active: boolean; onClick?: () => void }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={`flex items-center gap-3 px-5 text-[15px] border-l-4 ${
        active
          ? "border-primary bg-neutralLight text-primary font-semibold"
          : "border-transparent text-neutralDark hover:bg-neutralLight"
      }`}
      style={{ minHeight: 48 }}
    >
      <Icon size={20} aria-hidden="true" className="shrink-0" />
      <span>{item.label}</span>
    </Link>
  );
}

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
  const [drawerOpen, setDrawerOpen] = useState(false);

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

  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  const items = buildNav(role, tr);
  const bottomNavItems =
    role === "owner"
      ? [
          ...items.filter((i) => OWNER_BOTTOM_NAV_KEYS.includes(i.key)),
          { href: "/help", key: "help_center", label: tr("help_center"), icon: HelpCircle },
        ]
      : [];

  return (
    <div className="min-h-screen flex flex-col">
      <a href="#main-content" className="skip-link">
        {tr("skip_to_content")}
      </a>

      <header className="official-header no-print">
        <div className="flex items-center justify-between px-4 sm:px-6 py-3 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <button
              type="button"
              className="lg:hidden p-2 -ml-2 text-primary"
              aria-label={tr("open_menu")}
              aria-expanded={drawerOpen}
              onClick={() => setDrawerOpen(true)}
            >
              <Menu size={26} aria-hidden="true" />
            </button>
            <div className="h-10 w-10 border-2 border-primary flex items-center justify-center text-primary font-bold text-sm shrink-0">
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
          <div className="flex items-center gap-3 sm:gap-4">
            <LanguageToggle />
            <div className="text-right hidden sm:block">
              <p className="text-sm font-medium text-neutralDark">{fullName || "…"}</p>
            </div>
            {unread > 0 && (
              <span className="border border-primary text-primary text-xs px-2 py-0.5" aria-label={`${unread} ${tr("unread_notifications")}`}>
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
        {/* Desktop sidebar */}
        <aside className="hidden lg:block w-64 bg-white border-r border-gray-300 shrink-0 no-print">
          <nav className="py-4" aria-label={tr("main_navigation")}>
            {items.map((item) => (
              <NavLink
                key={item.href}
                item={item}
                active={pathname === item.href || pathname.startsWith(item.href + "/")}
              />
            ))}
            <div className="mt-6 border-t border-gray-200 pt-3 px-5">
              <FooterLinks compact />
            </div>
          </nav>
        </aside>

        {/* Mobile drawer */}
        {drawerOpen && (
          <div className="lg:hidden fixed inset-0 z-50 no-print">
            <div
              className="absolute inset-0 bg-black/50"
              onClick={() => setDrawerOpen(false)}
              aria-hidden="true"
            />
            <div
              role="dialog"
              aria-modal="true"
              aria-label={tr("main_navigation")}
              className="absolute inset-y-0 left-0 bg-white shadow-xl overflow-y-auto"
              style={{ width: "85%", maxWidth: 340 }}
            >
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
                <span className="text-sm font-semibold text-primary">{tr("system_name_short")}</span>
                <button
                  type="button"
                  aria-label={tr("close_menu")}
                  className="p-2 text-neutralDark"
                  onClick={() => setDrawerOpen(false)}
                >
                  <X size={24} aria-hidden="true" />
                </button>
              </div>
              <nav className="py-2" aria-label={tr("main_navigation")}>
                {items.map((item) => (
                  <div key={item.href} style={{ minHeight: 56 }} className="flex items-stretch">
                    <NavLink
                      item={item}
                      active={pathname === item.href || pathname.startsWith(item.href + "/")}
                      onClick={() => setDrawerOpen(false)}
                    />
                  </div>
                ))}
                <div className="mt-4 border-t border-gray-200 pt-3 px-5">
                  <FooterLinks compact />
                </div>
              </nav>
            </div>
          </div>
        )}

        <main id="main-content" role="main" tabIndex={-1} className="flex-1 p-4 sm:p-6 overflow-y-auto bg-neutralLight pb-20 lg:pb-6">
          {children}
        </main>
      </div>

      <HelpButton />

      {bottomNavItems.length > 0 && (
        <nav
          className="lg:hidden no-print fixed bottom-0 inset-x-0 bg-white border-t border-gray-300 flex z-40"
          aria-label={tr("main_navigation")}
        >
          {bottomNavItems.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-2 ${
                  active ? "text-primary" : "text-neutralDark"
                }`}
                style={{ minHeight: 56 }}
              >
                <Icon size={22} aria-hidden="true" />
                <span className="text-[11px] leading-tight">{item.label}</span>
              </Link>
            );
          })}
        </nav>
      )}
    </div>
  );
}
