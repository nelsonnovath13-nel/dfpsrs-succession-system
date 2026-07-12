"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Menu, X } from "lucide-react";
import { useLanguage, LanguageToggle } from "@/lib/i18n";

type Chapter = { title: { en: string; sw: string }; body: { en: string[]; sw: string[] } };

const CHAPTERS: Chapter[] = [
  {
    title: { en: "1. Introduction", sw: "1. Utangulizi" },
    body: {
      en: [
        "This handbook explains, step by step, how to use the Family Property & Succession Records System to protect your family's assets and plan how they will be passed on.",
        "The system is designed for ordinary Tanzanian families — you do not need legal training to use it. Every module maps to a real-world task: listing what you own, recording your family, choosing who inherits, and getting that plan verified by people who know you and your community.",
      ],
      sw: [
        "Kitabu hiki kinaeleza, hatua kwa hatua, jinsi ya kutumia Mfumo wa Kumbukumbu za Mali na Urithi wa Familia kulinda mali za familia yako na kupanga jinsi zitakavyorithishwa.",
        "Mfumo huu umetengenezwa kwa ajili ya familia za kawaida za Tanzania — huhitaji mafunzo ya kisheria kuutumia. Kila sehemu inahusiana na kazi halisi: kuorodhesha unachomiliki, kuandika familia yako, kuchagua nani atarithi, na kupata mpango huo uthibitishwe na watu wanaokujua wewe na jamii yako.",
      ],
    },
  },
  {
    title: { en: "2. Understanding Succession", sw: "2. Kuelewa Urithi" },
    body: {
      en: [
        "Succession is the process by which property passes from one person to their family or chosen beneficiaries, typically after death. In Tanzania, succession can be affected by statutory law, customary law, or Islamic law depending on the family's circumstances.",
        "This system does not replace the courts or official probate procedures. It creates a clear, witnessed, and government-reviewed record of your wishes and your family's property — evidence that can support the formal legal process, not substitute it.",
      ],
      sw: [
        "Urithi ni mchakato ambao mali inahamishwa kutoka kwa mtu mmoja kwenda kwa familia yake au wanufaika waliochaguliwa, kwa kawaida baada ya kifo. Tanzania, urithi unaweza kuathiriwa na sheria za kawaida, sheria za mila, au sheria za Kiislamu kutegemea hali ya familia.",
        "Mfumo huu hauondoi mahakama wala taratibu rasmi za usimamizi wa mirathi. Unatengeneza kumbukumbu iliyo wazi, iliyoshuhudiwa, na iliyopitiwa na serikali ya nia zako na mali za familia yako — ushahidi unaoweza kusaidia mchakato rasmi wa kisheria, sio kuubadilisha.",
      ],
    },
  },
  {
    title: { en: "3. Registering Property", sw: "3. Kusajili Mali" },
    body: {
      en: [
        "Go to Property Registry and select Register Property. Choose the asset type (house, farm, land, vehicle, business, bank account, livestock, investment, or other), then provide its name, location, ownership type, and estimated value.",
        "Register every asset you want to plan for — not just land and houses. A bank account, a shop, or a vehicle are just as important to record.",
      ],
      sw: [
        "Nenda Sajili ya Mali kisha chagua Sajili Mali. Chagua aina ya mali (nyumba, shamba, ardhi, gari, biashara, akaunti ya benki, mifugo, uwekezaji, au nyingine), kisha toa jina lake, mahali ilipo, aina ya umiliki, na thamani inayokadiriwa.",
        "Sajili kila mali unayotaka kuipangia — sio ardhi na nyumba tu. Akaunti ya benki, duka, au gari ni muhimu vilevile kuandikwa.",
      ],
    },
  },
  {
    title: { en: "4. Managing Family Members", sw: "4. Kusimamia Wanafamilia" },
    body: {
      en: [
        "The Family Structure Registry records everyone in your family — parents, spouse, children, dependents — regardless of whether they will inherit anything. This is separate from the Beneficiary Registry.",
        "Recording your full family, including a date of birth for each member, helps witnesses and leaders confirm that no close relative has been left out of your succession plan without explanation.",
      ],
      sw: [
        "Sajili ya Muundo wa Familia inaandika kila mtu kwenye familia yako — wazazi, mwenza, watoto, wategemezi — bila kujali kama watarithi kitu au la. Hii ni tofauti na Sajili ya Wanufaika.",
        "Kuandika familia yako yote, ikiwa ni pamoja na tarehe ya kuzaliwa ya kila mtu, husaidia mashahidi na viongozi kuthibitisha kuwa hakuna ndugu wa karibu aliyeachwa nje ya mpango wako wa urithi bila maelezo.",
      ],
    },
  },
  {
    title: { en: "5. Assigning Beneficiaries", sw: "5. Kuteua Wanufaika" },
    body: {
      en: [
        "Beneficiaries are the people who will actually receive a share of your property. Add them in the Beneficiary Registry with their relationship to you.",
        "If a beneficiary is under 18, mark them as a minor and provide a guardian's name, phone number, and relationship — a National ID is not required for minors.",
      ],
      sw: [
        "Wanufaika ni watu watakaopokea sehemu ya mali yako. Waongeze kwenye Sajili ya Wanufaika pamoja na uhusiano wao na wewe.",
        "Kama mnufaika ana chini ya miaka 18, mweke kama mchanga na toa jina la mlezi, namba ya simu, na uhusiano — NIDA haihitajiki kwa watoto wachanga.",
      ],
    },
  },
  {
    title: { en: "6. Uploading Documents", sw: "6. Kupakia Hati" },
    body: {
      en: [
        "From a property's detail page, upload supporting documents such as a title deed, purchase agreement, tax receipt, valuation report, or ownership certificate.",
        "Documents strengthen your record — witnesses and leaders are far more confident verifying a property that has proof of ownership attached.",
      ],
      sw: [
        "Kutoka ukurasa wa maelezo ya mali, pakia hati zinazothibitisha kama hati ya kumiliki, mkataba wa ununuzi, risiti ya kodi, taarifa ya uthamini, au cheti cha umiliki.",
        "Hati zinaimarisha kumbukumbu yako — mashahidi na viongozi wana uhakika zaidi wanapothibitisha mali yenye uthibitisho wa umiliki uliambatanishwa.",
      ],
    },
  },
  {
    title: { en: "7. Creating Succession Plans", sw: "7. Kutengeneza Mipango ya Urithi" },
    body: {
      en: [
        "A Succession Record connects your properties to your beneficiaries. For each property, decide who receives what share — one property can be split between several people, and each property's shares must total exactly 100%.",
        "You will also choose at least two Family Witnesses and one Local Government Leader, and optionally a Legal Officer, to review your record.",
      ],
      sw: [
        "Kumbukumbu ya Urithi inaunganisha mali zako na wanufaika wako. Kwa kila mali, amua nani anapokea sehemu gani — mali moja inaweza kugawiwa watu kadhaa, na asilimia za kila mali lazima zifikie 100% kamili.",
        "Pia utachagua angalau mashahidi wawili wa familia na kiongozi mmoja wa Serikali za Mitaa, na kwa hiari Afisa Sheria, kupitia kumbukumbu yako.",
      ],
    },
  },
  {
    title: { en: "8. Generating Reports", sw: "8. Kutengeneza Ripoti" },
    body: {
      en: [
        "Before you can submit a succession record for verification, you must generate a Review Report. This creates a complete, frozen summary of your properties, family, allocations, and documents at that exact moment.",
        "Witnesses and leaders review this exact report — if you edit a property afterwards, the report they see does not silently change, protecting the integrity of what was actually reviewed.",
      ],
      sw: [
        "Kabla ya kuwasilisha kumbukumbu ya urithi kwa uthibitisho, lazima utengeneze Ripoti ya Ukaguzi. Hii inatengeneza muhtasari kamili, uliogandishwa, wa mali zako, familia, ugawaji, na hati kwa wakati huo hasa.",
        "Mashahidi na viongozi wanapitia ripoti hiyo hasa — ukibadilisha mali baadaye, ripoti wanayoiona haibadiliki kimya kimya, jambo linalolinda uadilifu wa kile kilichopitiwa kweli.",
      ],
    },
  },
  {
    title: { en: "9. Verification Process", sw: "9. Mchakato wa Uthibitishaji" },
    body: {
      en: [
        "After submission, your record moves through: Family Witnesses (who confirm they know the family and the information is accurate), then a Local Government Leader (who confirms community and property records), and finally a Legal Officer if one was assigned.",
        "Each verifier can approve or reject with a reason. If rejected, you'll be notified so you can correct the record and resubmit.",
      ],
      sw: [
        "Baada ya kuwasilisha, kumbukumbu yako inapitia: Mashahidi wa Familia (wanaothibitisha wanaijua familia na taarifa ni sahihi), kisha Kiongozi wa Serikali za Mitaa (anayethibitisha kumbukumbu za jamii na mali), na mwisho Afisa Sheria kama alipangiwa.",
        "Kila mthibitishaji anaweza kuidhinisha au kukataa akitoa sababu. Ikikataliwa, utaarifiwa ili urekebishe kumbukumbu na uwasilishe tena.",
      ],
    },
  },
  {
    title: { en: "10. Final Approval", sw: "10. Uidhinishaji wa Mwisho" },
    body: {
      en: [
        "Once every required verifier has approved, your record is marked Verified and a QR-verifiable certificate is generated. Anyone can scan it to confirm authenticity without seeing your family's private details.",
        "Beneficiaries linked to a verified record are notified so they can confirm their role.",
      ],
      sw: [
        "Mara kila mthibitishaji anayehitajika akishaidhinisha, kumbukumbu yako inawekwa Imethibitishwa na cheti chenye QR kinatengenezwa. Mtu yeyote anaweza kukichanganua kuthibitisha uhalali bila kuona taarifa binafsi za familia yako.",
        "Wanufaika walioungwa kwenye kumbukumbu iliyothibitishwa wanaarifiwa ili wathibitishe jukumu lao.",
      ],
    },
  },
  {
    title: { en: "11. Common Mistakes", sw: "11. Makosa ya Kawaida" },
    body: {
      en: [
        "Splitting one property's shares so they don't add up to exactly 100% — use the Split Evenly button to avoid rounding errors.",
        "Forgetting to record a family member who won't inherit anything — they still belong in the Family Structure Registry.",
        "Choosing a witness who is also a linked beneficiary account on the same record — the system blocks this because a person cannot verify their own inheritance.",
        "Submitting without generating a Review Report first — the system will not allow this.",
      ],
      sw: [
        "Kugawa asilimia za mali moja bila kufikia 100% kamili — tumia kitufe cha Gawa Sawa kuepuka makosa ya mzunguko wa tarakimu.",
        "Kusahau kuandika mwanafamilia asiyerithi kitu — bado anastahili kuwa kwenye Sajili ya Muundo wa Familia.",
        "Kuchagua shahidi ambaye pia ni akaunti ya mnufaika iliyounganishwa kwenye kumbukumbu hiyohiyo — mfumo unazuia hili kwa sababu mtu hawezi kuthibitisha urithi wake mwenyewe.",
        "Kuwasilisha bila kutengeneza Ripoti ya Ukaguzi kwanza — mfumo hautaruhusu hili.",
      ],
    },
  },
  {
    title: { en: "12. Frequently Asked Questions", sw: "12. Maswali Yanayoulizwa Mara kwa Mara" },
    body: {
      en: [
        "For detailed answers to common questions — including account, password, and WhatsApp support — visit the Help Center from the sidebar.",
      ],
      sw: [
        "Kwa majibu ya kina ya maswali ya kawaida — ikiwemo akaunti, neno la siri, na msaada wa WhatsApp — tembelea Kituo cha Msaada kwenye menyu.",
      ],
    },
  },
];

export default function HandbookPage() {
  const { lang } = useLanguage();
  const [active, setActive] = useState(0);
  const [drawerOpen, setDrawerOpen] = useState(false);

  function selectChapter(i: number) {
    setActive(i);
    setDrawerOpen(false);
  }

  return (
    <main className="min-h-screen bg-white">
      <header className="official-header">
        <div className="flex items-center justify-between px-4 sm:px-6 py-3">
          <Link href="/" className="text-sm font-semibold text-primary">Family Property &amp; Succession Records</Link>
          <div className="flex items-center gap-3">
            <LanguageToggle />
            <button
              type="button"
              className="lg:hidden p-2 text-primary"
              onClick={() => setDrawerOpen(true)}
              aria-label={lang === "en" ? "Open chapters" : "Fungua sura"}
            >
              <Menu size={22} aria-hidden="true" />
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10 flex gap-8">
        <aside className="hidden lg:block w-64 shrink-0">
          <p className="text-xs font-semibold text-inkSoft uppercase tracking-wide mb-3">
            {lang === "en" ? "Chapters" : "Sura"}
          </p>
          <nav className="space-y-1">
            {CHAPTERS.map((c, i) => (
              <button
                key={i}
                onClick={() => selectChapter(i)}
                className={`block w-full text-left px-3 py-2 text-sm ${
                  active === i ? "bg-neutralLight text-primary font-semibold border-l-4 border-primary" : "text-neutralDark"
                }`}
              >
                {c.title[lang]}
              </button>
            ))}
          </nav>
        </aside>

        {drawerOpen && (
          <div className="lg:hidden fixed inset-0 z-50">
            <div className="absolute inset-0 bg-black/50" onClick={() => setDrawerOpen(false)} aria-hidden="true" />
            <div className="absolute inset-y-0 left-0 bg-white w-4/5 max-w-xs overflow-y-auto shadow-xl">
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
                <span className="text-sm font-semibold text-primary">{lang === "en" ? "Chapters" : "Sura"}</span>
                <button onClick={() => setDrawerOpen(false)} aria-label={lang === "en" ? "Close" : "Funga"} className="p-2 text-neutralDark">
                  <X size={22} aria-hidden="true" />
                </button>
              </div>
              <nav className="py-2">
                {CHAPTERS.map((c, i) => (
                  <button
                    key={i}
                    onClick={() => selectChapter(i)}
                    className={`block w-full text-left px-4 text-sm ${active === i ? "text-primary font-semibold bg-neutralLight" : "text-neutralDark"}`}
                    style={{ minHeight: 48 }}
                  >
                    {c.title[lang]}
                  </button>
                ))}
              </nav>
            </div>
          </div>
        )}

        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold text-primary mb-1">
            {lang === "en" ? "Family Property & Succession User Handbook" : "Kitabu cha Mtumiaji cha Mali na Urithi wa Familia"}
          </h1>
          <p className="text-sm text-inkSoft mb-8">
            {lang === "en" ? `Chapter ${active + 1} of ${CHAPTERS.length}` : `Sura ya ${active + 1} kati ya ${CHAPTERS.length}`}
          </p>

          <article>
            <h2 className="text-xl font-semibold text-ink mb-4">{CHAPTERS[active].title[lang]}</h2>
            <div className="space-y-4">
              {CHAPTERS[active].body[lang].map((p, i) => (
                <p key={i} className="text-sm text-neutralDark leading-relaxed">{p}</p>
              ))}
            </div>
          </article>

          <div className="flex items-center justify-between mt-10 pt-6 border-t border-gray-200">
            <button
              onClick={() => setActive((a) => Math.max(0, a - 1))}
              disabled={active === 0}
              className="btn-outline text-sm disabled:opacity-40"
            >
              {lang === "en" ? "Previous Chapter" : "Sura Iliyopita"}
            </button>
            {active < CHAPTERS.length - 1 ? (
              <button onClick={() => setActive((a) => a + 1)} className="btn-primary text-sm">
                {lang === "en" ? "Next Chapter" : "Sura Inayofuata"}
              </button>
            ) : (
              <Link
                href="/"
                className="inline-flex items-center gap-2 border border-primary text-primary font-medium text-sm px-4"
                style={{ minHeight: 44 }}
              >
                <ArrowLeft size={16} aria-hidden="true" />
                {lang === "en" ? "Back to home" : "Rudi mwanzo"}
              </Link>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
