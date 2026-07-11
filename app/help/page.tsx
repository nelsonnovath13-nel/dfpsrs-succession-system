"use client";

import Link from "next/link";
import { useLanguage, LanguageToggle } from "@/lib/i18n";

const CONTENT = {
  en: {
    title: "Help Center",
    items: [
      { q: "How do I register a property?", a: "Sign in as a Property Owner, go to Property Registry, and select 'Add Property'. Provide the property category, location, estimated value, and upload any supporting ownership documents." },
      { q: "Who can witness my succession record?", a: "A minimum of two family witnesses is required. Witnesses must first create a 'Family Witness' account before you can select them." },
      { q: "What does 'Legal Review' mean?", a: "If a Legal Officer is assigned to your succession record, it undergoes an additional legal review step after Local Government Leader verification, before final certification." },
      { q: "How do I verify a certificate is authentic?", a: "Every verified succession record has a QR verification code. Scanning it, or visiting the verification link, confirms the record's authenticity without revealing private family details." },
      { q: "Is this system a replacement for court probate procedures?", a: "No. This system supports and documents succession planning; it does not replace the official probate and administration of estates process under Tanzanian law." },
    ],
  },
  sw: {
    title: "Kituo cha Msaada",
    items: [
      { q: "Ninasajilije mali?", a: "Ingia kama Mmiliki wa Mali, nenda kwenye Sajili ya Mali, kisha chagua 'Ongeza Mali'. Toa aina ya mali, eneo, thamani inayokadiriwa, na pakia hati za umiliki zinazothibitisha." },
      { q: "Ni nani anaweza kushuhudia kumbukumbu yangu ya urithi?", a: "Mashahidi wawili wa familia angalau wanahitajika. Mashahidi lazima wafungue akaunti ya 'Shahidi wa Familia' kabla hujaweza kuwachagua." },
      { q: "'Mapitio ya Kisheria' yana maana gani?", a: "Ikiwa Afisa Sheria amepangiwa kwenye kumbukumbu yako ya urithi, itapitia hatua ya ziada ya mapitio ya kisheria baada ya uthibitishaji wa Kiongozi wa Serikali za Mitaa, kabla ya uthibitisho wa mwisho." },
      { q: "Ninathibitishaje uhalali wa cheti?", a: "Kila kumbukumbu ya urithi iliyothibitishwa ina msimbo wa QR wa uthibitishaji. Kuuchanganua, au kutembelea kiungo cha uthibitishaji, kunathibitisha uhalali wa kumbukumbu bila kuonyesha taarifa binafsi za familia." },
      { q: "Je, mfumo huu unachukua nafasi ya taratibu za mahakama za mirathi?", a: "Hapana. Mfumo huu unasaidia na kuhifadhi mipango ya urithi; hauondoi mchakato rasmi wa uthibitisho na usimamizi wa mirathi chini ya sheria za Tanzania." },
    ],
  },
};

export default function HelpPage() {
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
          {c.items.map((item, i) => (
            <div key={i} className="card">
              <p className="font-semibold text-neutralDark mb-1">{item.q}</p>
              <p className="text-sm text-neutralDark leading-relaxed">{item.a}</p>
            </div>
          ))}
        </div>
        <Link href="/" className="inline-block mt-8 text-sm text-primary underline">
          {lang === "en" ? "Back to home" : "Rudi mwanzo"}
        </Link>
      </div>
    </main>
  );
}
