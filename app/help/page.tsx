"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, MessageCircle, BookOpen } from "lucide-react";
import { useLanguage, LanguageToggle } from "@/lib/i18n";

const WHATSAPP_NUMBER = "255628714671";

const FAQ = {
  en: [
    { q: "How do I register a property?", a: "Sign in as a Property Owner, go to Property Registry, and select 'Register Property'. Choose the asset type, provide its location, ownership type, estimated value, and upload any supporting documents." },
    { q: "Who can witness my succession record?", a: "A minimum of two family witnesses is required. Witnesses must first create a 'Family Witness' account before you can select them." },
    { q: "What does 'Legal Review' mean?", a: "If a Legal Officer is assigned to your succession record, it undergoes an additional legal review step after Local Government Leader verification, before final certification." },
    { q: "How do I verify a certificate is authentic?", a: "Every verified succession record has a QR verification code. Scanning it, or visiting the verification link, confirms the record's authenticity without revealing private family details." },
    { q: "Is this system a replacement for court probate procedures?", a: "No. This system supports and documents succession planning; it does not replace the official probate and administration of estates process under Tanzanian law." },
    { q: "What happens if I disagree with a decision on my record?", a: "Go to Disputes from your dashboard and file a dispute against the specific succession record, explaining the issue. It will be reviewed by the assigned officials." },
    { q: "Who can act as an Estate Executor?", a: "An executor is a person you assign to manage your estate matters if you become unable to. They must create an Executor account and be linked to your estate before they can act." },
    { q: "I forgot my password. What do I do?", a: "On the sign-in page, use 'Forgot password' to receive a reset link by email. If you no longer have access to that email, contact support on WhatsApp." },
    { q: "Why can't I submit my succession record?", a: "You must first click 'Generate Review Report' on the Review & Confirm step. Submit For Verification only unlocks once that report has been generated successfully." },
  ],
  sw: [
    { q: "Ninasajilije mali?", a: "Ingia kama Mmiliki wa Mali, nenda kwenye Sajili ya Mali, kisha chagua 'Sajili Mali'. Chagua aina ya mali, toa mahali ilipo, aina ya umiliki, thamani inayokadiriwa, na pakia hati zinazothibitisha." },
    { q: "Ni nani anaweza kushuhudia kumbukumbu yangu ya urithi?", a: "Mashahidi wawili wa familia angalau wanahitajika. Mashahidi lazima wafungue akaunti ya 'Shahidi wa Familia' kabla hujaweza kuwachagua." },
    { q: "'Mapitio ya Kisheria' yana maana gani?", a: "Ikiwa Afisa Sheria amepangiwa kwenye kumbukumbu yako ya urithi, itapitia hatua ya ziada ya mapitio ya kisheria baada ya uthibitishaji wa Kiongozi wa Serikali za Mitaa, kabla ya uthibitisho wa mwisho." },
    { q: "Ninathibitishaje uhalali wa cheti?", a: "Kila kumbukumbu ya urithi iliyothibitishwa ina msimbo wa QR wa uthibitishaji. Kuuchanganua, au kutembelea kiungo cha uthibitishaji, kunathibitisha uhalali wa kumbukumbu bila kuonyesha taarifa binafsi za familia." },
    { q: "Je, mfumo huu unachukua nafasi ya taratibu za mahakama za mirathi?", a: "Hapana. Mfumo huu unasaidia na kuhifadhi mipango ya urithi; hauondoi mchakato rasmi wa uthibitisho na usimamizi wa mirathi chini ya sheria za Tanzania." },
    { q: "Nini kinatokea nikiwa sikubaliani na uamuzi kuhusu kumbukumbu yangu?", a: "Nenda kwenye Migogoro kutoka dashibodi yako kisha wasilisha malalamiko dhidi ya kumbukumbu husika, ukielezea tatizo. Itapitiwa na maafisa waliopangiwa." },
    { q: "Ni nani anaweza kuwa Msimamizi wa Mirathi (Executor)?", a: "Msimamizi wa mirathi ni mtu unayemteua kusimamia mambo ya mali yako endapo hutaweza mwenyewe. Ni lazima afungue akaunti ya Msimamizi wa Mirathi na kuunganishwa na mali yako kabla ya kutenda." },
    { q: "Nimesahau neno la siri. Nifanye nini?", a: "Kwenye ukurasa wa kuingia, tumia 'Umesahau neno la siri' kupokea kiungo cha kubadilisha kupitia barua pepe. Kama huna tena ufikiaji wa barua pepe hiyo, wasiliana na msaada kupitia WhatsApp." },
    { q: "Kwa nini siwezi kuwasilisha kumbukumbu yangu ya urithi?", a: "Lazima kwanza ubofye 'Tengeneza Ripoti ya Ukaguzi' kwenye hatua ya Pitia na Thibitisha. Kitufe cha Wasilisha kwa Uthibitisho kinafunguka tu baada ya ripoti hiyo kutengenezwa kikamilifu." },
  ],
};

const GLOSSARY = {
  en: [
    { term: "Succession Record", def: "The official record connecting your properties to your beneficiaries and specifying how each property is shared." },
    { term: "Beneficiary", def: "A person who will receive a share of your property under a succession record." },
    { term: "Family Witness", def: "A person, registered on the system, who personally knows your family and confirms your succession record's information." },
    { term: "Local Government Leader", def: "An official who verifies community and property records for succession requests in their jurisdiction." },
    { term: "Legal Officer", def: "A specialist who conducts an additional legal-soundness review, only for records where one is assigned." },
    { term: "Review Report", def: "A frozen, complete summary of a succession record generated before submission — this is what verifiers actually review." },
    { term: "Allocation", def: "The share (percentage) of one specific property given to one specific beneficiary." },
    { term: "Executor", def: "A person appointed to manage estate matters on the owner's behalf if the owner becomes unable to." },
    { term: "Verification", def: "The multi-step review process (witness, leader, and optionally legal) a succession record goes through before being marked Verified." },
  ],
  sw: [
    { term: "Kumbukumbu ya Urithi", def: "Kumbukumbu rasmi inayounganisha mali zako na wanufaika wako na kueleza jinsi kila mali inavyogawanywa." },
    { term: "Mnufaika", def: "Mtu atakayepokea sehemu ya mali yako chini ya kumbukumbu ya urithi." },
    { term: "Shahidi wa Familia", def: "Mtu, aliyesajiliwa kwenye mfumo, anayeifahamu familia yako binafsi na kuthibitisha taarifa za kumbukumbu yako ya urithi." },
    { term: "Kiongozi wa Serikali za Mitaa", def: "Afisa anayethibitisha kumbukumbu za jamii na mali kwa maombi ya urithi katika eneo lake." },
    { term: "Afisa Sheria", def: "Mtaalamu anayefanya mapitio ya ziada ya usahihi wa kisheria, kwa kumbukumbu zilizopangiwa tu." },
    { term: "Ripoti ya Ukaguzi", def: "Muhtasari kamili, uliogandishwa, wa kumbukumbu ya urithi uliotengenezwa kabla ya kuwasilishwa — hii ndiyo wathibitishaji wanayoipitia." },
    { term: "Mgao (Allocation)", def: "Sehemu (asilimia) ya mali fulani inayotolewa kwa mnufaika fulani." },
    { term: "Msimamizi wa Mirathi", def: "Mtu aliyeteuliwa kusimamia mambo ya mali kwa niaba ya mmiliki endapo mmiliki hataweza." },
    { term: "Uthibitishaji", def: "Mchakato wa mapitio ya hatua nyingi (shahidi, kiongozi, na kwa hiari kisheria) ambao kumbukumbu ya urithi inapitia kabla ya kuwekwa Imethibitishwa." },
  ],
};

const DOCUMENTS = {
  en: [
    { name: "National ID", note: "Required for adult owners, beneficiaries, witnesses, and leaders." },
    { name: "Title Deed / Land Documents", note: "For houses, farms, and land — proves ownership of the property." },
    { name: "Purchase Agreement", note: "Supports ownership for recently acquired property." },
    { name: "Tax Receipt", note: "Recent property tax payment evidence, where applicable." },
    { name: "Valuation Report", note: "An independent estimate of a property's value, if available." },
    { name: "Vehicle Registration", note: "For vehicles listed as an asset." },
    { name: "Business Documents", note: "Registration certificate or similar, for a business listed as an asset." },
    { name: "Death Certificate", note: "Required only during the Death Verification process, not at registration time." },
  ],
  sw: [
    { name: "Kitambulisho cha NIDA", note: "Kinahitajika kwa wamiliki wazima, wanufaika, mashahidi, na viongozi." },
    { name: "Hati ya Kumiliki / Hati za Ardhi", note: "Kwa nyumba, mashamba, na ardhi — inathibitisha umiliki wa mali." },
    { name: "Mkataba wa Ununuzi", note: "Inasaidia umiliki wa mali iliyonunuliwa hivi karibuni." },
    { name: "Risiti ya Kodi", note: "Uthibitisho wa malipo ya kodi ya mali ya hivi karibuni, inapohitajika." },
    { name: "Taarifa ya Uthamini", note: "Makadirio huru ya thamani ya mali, ikiwa yapo." },
    { name: "Usajili wa Gari", note: "Kwa magari yaliyoorodheshwa kama mali." },
    { name: "Hati za Biashara", note: "Cheti cha usajili au sawa, kwa biashara iliyoorodheshwa kama mali." },
    { name: "Cheti cha Kifo", note: "Kinahitajika tu wakati wa mchakato wa Uthibitisho wa Kifo, si wakati wa usajili." },
  ],
};

const VERIFICATION_STEPS = {
  en: [
    { step: "1. Generate Review Report", note: "The owner creates a frozen summary of the record — required before submission." },
    { step: "2. Submit For Verification", note: "The record is sent to the assigned family witnesses and local leader." },
    { step: "3. Witness Verification", note: "At least two family witnesses confirm the family, beneficiaries, and property details." },
    { step: "4. Local Government Verification", note: "A local leader confirms community and property records, and can flag risks or disputes." },
    { step: "5. Legal Review (if assigned)", note: "A legal officer checks the record for legal soundness and compliance." },
    { step: "6. Final Approval", note: "Once every required verifier approves, the record is marked Verified and a certificate is generated." },
  ],
  sw: [
    { step: "1. Tengeneza Ripoti ya Ukaguzi", note: "Mmiliki anatengeneza muhtasari uliogandishwa wa kumbukumbu — unahitajika kabla ya kuwasilisha." },
    { step: "2. Wasilisha kwa Uthibitisho", note: "Kumbukumbu inatumwa kwa mashahidi wa familia na kiongozi wa mtaa waliopangiwa." },
    { step: "3. Uthibitisho wa Shahidi", note: "Angalau mashahidi wawili wa familia wanathibitisha familia, wanufaika, na maelezo ya mali." },
    { step: "4. Uthibitisho wa Serikali za Mitaa", note: "Kiongozi wa mtaa anathibitisha kumbukumbu za jamii na mali, na anaweza kuashiria hatari au migogoro." },
    { step: "5. Mapitio ya Kisheria (ikiwa yamepangiwa)", note: "Afisa sheria anakagua kumbukumbu kwa usahihi na uzingatiaji wa kisheria." },
    { step: "6. Uidhinishaji wa Mwisho", note: "Mara kila mthibitishaji anayehitajika akiidhinisha, kumbukumbu inawekwa Imethibitishwa na cheti kinatengenezwa." },
  ],
};

const TABS = [
  { key: "faq", en: "FAQ", sw: "Maswali" },
  { key: "guide", en: "User Guide", sw: "Mwongozo" },
  { key: "glossary", en: "Glossary", sw: "Kamusi" },
  { key: "documents", en: "Document Requirements", sw: "Mahitaji ya Hati" },
  { key: "verification", en: "Verification Process", sw: "Mchakato wa Uthibitisho" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

export default function HelpPage() {
  const { lang } = useLanguage();
  const [tab, setTab] = useState<TabKey>("faq");

  return (
    <main className="min-h-screen bg-white">
      <header className="official-header">
        <div className="flex items-center justify-between px-6 py-3">
          <Link href="/" className="text-sm font-semibold text-primary">Family Property &amp; Succession Records</Link>
          <LanguageToggle />
        </div>
      </header>
      <div className="max-w-3xl mx-auto px-6 py-10">
        <h1 className="text-2xl font-bold text-primary mb-6">{lang === "en" ? "Help Center" : "Kituo cha Msaada"}</h1>

        <div className="card mb-6 flex flex-col sm:flex-row sm:items-center gap-4 justify-between">
          <div>
            <p className="font-semibold text-neutralDark">
              {lang === "en" ? "Need to talk to someone?" : "Unahitaji kuongea na mtu?"}
            </p>
            <p className="text-sm text-inkSoft">
              {lang === "en"
                ? "Our support team responds on WhatsApp during business hours."
                : "Timu yetu ya msaada inajibu kupitia WhatsApp wakati wa saa za kazi."}
            </p>
          </div>
          <a
            href={`https://wa.me/${WHATSAPP_NUMBER}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-2 text-white font-medium text-sm px-4 shrink-0"
            style={{ minHeight: 44, backgroundColor: "#1E7E34" }}
          >
            <MessageCircle size={18} aria-hidden="true" />
            {lang === "en" ? "Chat on WhatsApp" : "Ongea kwa WhatsApp"}
          </a>
        </div>

        <div className="flex flex-wrap gap-2 mb-6 border-b border-gray-200 pb-3">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`text-sm font-medium px-3 border ${
                tab === t.key ? "border-primary text-primary bg-blue-50" : "border-gray-300 text-inkSoft"
              }`}
              style={{ minHeight: 40 }}
            >
              {lang === "en" ? t.en : t.sw}
            </button>
          ))}
        </div>

        {tab === "faq" && (
          <div className="space-y-6">
            {FAQ[lang].map((item, i) => (
              <div key={i} className="card">
                <p className="font-semibold text-neutralDark mb-1">{item.q}</p>
                <p className="text-sm text-neutralDark leading-relaxed">{item.a}</p>
              </div>
            ))}
          </div>
        )}

        {tab === "guide" && (
          <div className="card text-center py-10">
            <BookOpen size={32} className="mx-auto mb-3 text-primary" aria-hidden="true" />
            <p className="font-semibold text-neutralDark mb-2">
              {lang === "en" ? "Read the full step-by-step User Handbook" : "Soma Kitabu Kamili cha Mtumiaji cha Hatua kwa Hatua"}
            </p>
            <p className="text-sm text-inkSoft mb-4">
              {lang === "en"
                ? "12 chapters covering everything from registering property to final approval."
                : "Sura 12 zinazofunika kila kitu kuanzia kusajili mali hadi uidhinishaji wa mwisho."}
            </p>
            <Link href="/handbook" className="btn-primary text-sm inline-block">
              {lang === "en" ? "Open Handbook" : "Fungua Kitabu"}
            </Link>
          </div>
        )}

        {tab === "glossary" && (
          <div className="space-y-4">
            {GLOSSARY[lang].map((g, i) => (
              <div key={i} className="card">
                <p className="font-semibold text-primary mb-1">{g.term}</p>
                <p className="text-sm text-neutralDark leading-relaxed">{g.def}</p>
              </div>
            ))}
          </div>
        )}

        {tab === "documents" && (
          <div className="border border-gray-300 divide-y divide-gray-200">
            {DOCUMENTS[lang].map((d, i) => (
              <div key={i} className="px-4 py-3">
                <p className="font-medium text-ink text-sm">{d.name}</p>
                <p className="text-xs text-inkSoft mt-0.5">{d.note}</p>
              </div>
            ))}
          </div>
        )}

        {tab === "verification" && (
          <div className="space-y-3">
            {VERIFICATION_STEPS[lang].map((v, i) => (
              <div key={i} className="card">
                <p className="font-semibold text-primary text-sm mb-1">{v.step}</p>
                <p className="text-sm text-inkSoft">{v.note}</p>
              </div>
            ))}
          </div>
        )}

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
