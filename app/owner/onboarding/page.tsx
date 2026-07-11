"use client";

import DashboardShell from "@/components/DashboardShell";
import { WelcomeWizard } from "@/components/WelcomeWizard";
import { useLanguage } from "@/lib/i18n";

export default function OnboardingPage() {
  const { lang } = useLanguage();
  return (
    <DashboardShell role="owner">
      <h1 className="text-xl font-semibold text-primary mb-6">
        {lang === "sw" ? "Anza Hapa" : "Get Started"}
      </h1>
      <WelcomeWizard />
    </DashboardShell>
  );
}
