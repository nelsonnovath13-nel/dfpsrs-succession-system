"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useLanguage, LanguageToggle } from "@/lib/i18n";

const CONTENT = {
  en: {
    title: "Terms & Conditions",
    sections: [
      { h: "1. Purpose of the System", p: "This platform enables individuals to record family property ownership and succession intentions during their lifetime, verified through a multi-party process involving family witnesses, Local Government Leaders, and, where assigned, a Legal Officer." },
      { h: "2. Not a Substitute for Legal Process", p: "Records created on this system are intended to support, and do not replace, formal probate, administration of estates, or other legal procedures required under the laws of the United Republic of Tanzania." },
      { h: "3. Accuracy of Information", p: "Users are responsible for the accuracy of the information they submit. Knowingly submitting false property, beneficiary, or identity information may result in account suspension and may carry legal consequences." },
      { h: "4. Verification Responsibilities", p: "Family Witnesses, Local Government Leaders, and Legal Officers acting on this platform confirm that they are reviewing submissions in good faith and to the best of their knowledge." },
      { h: "5. Data Retention", p: "Verified succession records and associated documents are retained for long-term reference in accordance with the system's records retention practices." },
      { h: "6. Account Responsibility", p: "Users are responsible for maintaining the confidentiality of their account credentials and for all activity that occurs under their account." },
    ],
  },
  sw: {
    title: "Masharti na Vigezo",
    sections: [
      { h: "1. Madhumuni ya Mfumo", p: "Jukwaa hili linawezesha watu binafsi kuandika taarifa za umiliki wa mali za familia na nia za urithi wakati wa uhai wao, zikithibitishwa kupitia mchakato wa pande nyingi unaohusisha mashahidi wa familia, Viongozi wa Serikali za Mitaa, na, pale ilipopangiwa, Afisa Sheria." },
      { h: "2. Sio Mbadala wa Mchakato wa Kisheria", p: "Kumbukumbu zinazoundwa kwenye mfumo huu zinalenga kusaidia, na hazibadilishi, taratibu rasmi za uthibitisho wa mirathi, usimamizi wa mirathi, au taratibu nyingine za kisheria zinazohitajika chini ya sheria za Jamhuri ya Muungano wa Tanzania." },
      { h: "3. Usahihi wa Taarifa", p: "Watumiaji wanawajibika kwa usahihi wa taarifa wanazowasilisha. Kuwasilisha kwa makusudi taarifa za uongo za mali, wanufaika, au utambulisho kunaweza kupelekea kusimamishwa kwa akaunti na kunaweza kuwa na madhara ya kisheria." },
      { h: "4. Wajibu wa Uthibitishaji", p: "Mashahidi wa Familia, Viongozi wa Serikali za Mitaa, na Maafisa Sheria wanaofanya kazi kwenye jukwaa hili wanathibitisha kuwa wanapitia maombi kwa nia njema na kwa uelewa wao bora." },
      { h: "5. Uhifadhi wa Taarifa", p: "Kumbukumbu za urithi zilizothibitishwa na hati zinazohusiana zinahifadhiwa kwa marejeo ya muda mrefu kulingana na taratibu za uhifadhi wa mfumo huu." },
      { h: "6. Wajibu wa Akaunti", p: "Watumiaji wanawajibika kuhifadhi usiri wa taarifa za akaunti yao na shughuli zote zinazofanyika chini ya akaunti yao." },
    ],
  },
};

export default function TermsPage() {
  const { lang } = useLanguage();
  const c = CONTENT[lang];
  return (
    <main className="min-h-screen bg-white">
      <header className="official-header">
        <div className="flex items-center justify-between px-6 py-3">
          <Link href="/" className="text-sm font-semibold text-primary">Family Property &amp; Succession Records</Link>
          <LanguageToggle />
        </div>
      </header>
      <div className="max-w-3xl mx-auto px-6 py-10">
        <h1 className="text-2xl font-bold text-primary mb-6">{c.title}</h1>
        <div className="space-y-6">
          {c.sections.map((s, i) => (
            <div key={i}>
              <p className="font-semibold text-neutralDark mb-1">{s.h}</p>
              <p className="text-sm text-neutralDark leading-relaxed">{s.p}</p>
            </div>
          ))}
        </div>
        <Link
          href="/"
          className="inline-flex items-center gap-2 mt-8 border border-primary text-primary font-medium text-sm px-4"
          style={{ minHeight: 44 }}
        >
          <ArrowLeft size={16} aria-hidden="true" />
          {lang === "en" ? "Back to home" : "Rudi mwanzo"}
        </Link>
      </div>
    </main>
  );
}
