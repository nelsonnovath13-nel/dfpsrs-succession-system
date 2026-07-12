"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useLanguage, LanguageToggle } from "@/lib/i18n";

const CONTENT = {
  en: {
    title: "Privacy Policy",
    sections: [
      { h: "1. Information We Collect", p: "The system collects identity information (name, phone number, national ID where provided), property details, beneficiary details, family structure information, uploaded documents, and records of verification decisions." },
      { h: "2. How Information Is Used", p: "Information is used solely to build, verify, and preserve succession records, and to notify relevant parties (witnesses, leaders, legal officers, beneficiaries) of actions requiring their attention." },
      { h: "3. Who Can Access Your Records", p: "Access is restricted by role: only the record owner, the specific witnesses, leader, and legal officer assigned to a record, named beneficiaries (after verification), and authorized administrators/auditors can view relevant information. Access control is enforced at the database level." },
      { h: "4. Document Storage", p: "Uploaded documents are stored in a private, access-controlled repository and are never made publicly accessible. Documents can only be retrieved through authenticated, authorized requests." },
      { h: "5. Public Verification", p: "A verified succession record's QR verification page shows only confirmation of authenticity and the verification date — it never displays private property, beneficiary, or family details." },
      { h: "6. Data Security", p: "The system applies encryption in transit, role-based access control, and full audit logging of actions taken on records." },
    ],
  },
  sw: {
    title: "Sera ya Faragha",
    sections: [
      { h: "1. Taarifa Tunazokusanya", p: "Mfumo unakusanya taarifa za utambulisho (jina, namba ya simu, NIDA pale zinapotolewa), maelezo ya mali, maelezo ya wanufaika, taarifa za muundo wa familia, hati zilizopakiwa, na kumbukumbu za maamuzi ya uthibitishaji." },
      { h: "2. Jinsi Taarifa Zinavyotumika", p: "Taarifa zinatumika pekee kuunda, kuthibitisha, na kuhifadhi kumbukumbu za urithi, na kuwajulisha wahusika (mashahidi, viongozi, maafisa sheria, wanufaika) kuhusu matendo yanayohitaji uangalizi wao." },
      { h: "3. Nani Anaweza Kufikia Kumbukumbu Zako", p: "Ufikiaji umewekewa mipaka kwa jukumu: ni mmiliki wa kumbukumbu, mashahidi, kiongozi, na afisa sheria waliopangiwa kumbukumbu husika, wanufaika waliotajwa (baada ya uthibitishaji), na wasimamizi/wakaguzi walioidhinishwa pekee wanaoweza kuona taarifa husika. Udhibiti wa ufikiaji unasimamiwa katika ngazi ya hifadhidata." },
      { h: "4. Uhifadhi wa Hati", p: "Hati zilizopakiwa zinahifadhiwa mahali salama, penye udhibiti wa ufikiaji, na hazipatikani hadharani. Hati zinaweza kupatikana tu kupitia maombi ya uthibitishaji yaliyoidhinishwa." },
      { h: "5. Uthibitishaji wa Umma", p: "Ukurasa wa uthibitishaji wa QR wa kumbukumbu iliyothibitishwa unaonyesha tu uthibitisho wa uhalali na tarehe ya uthibitishaji — hauonyeshi kamwe maelezo binafsi ya mali, wanufaika, au familia." },
      { h: "6. Usalama wa Taarifa", p: "Mfumo unatumia usimbaji wakati wa usafirishaji wa taarifa, udhibiti wa ufikiaji unaotegemea jukumu, na kumbukumbu kamili za ukaguzi za matendo yanayofanyika kwenye rekodi." },
    ],
  },
};

export default function PrivacyPage() {
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
