"use client";

import { createContext, useContext, useEffect, useState } from "react";

export type Lang = "en" | "sw";

const DICT: Record<string, { en: string; sw: string }> = {
  system_name: { en: "Digital Family Property & Succession Records System", sw: "Mfumo wa Kidijitali wa Kumbukumbu za Mali na Urithi wa Familia" },
  system_name_short: { en: "Family Property & Succession Records", sw: "Kumbukumbu za Mali na Urithi wa Familia" },
  sign_in: { en: "Sign In", sw: "Ingia" },
  create_account: { en: "Create Account", sw: "Fungua Akaunti" },
  sign_out: { en: "Sign Out", sw: "Toka" },
  dashboard: { en: "Dashboard", sw: "Dashibodi" },
  properties: { en: "Property Registry", sw: "Sajili ya Mali" },
  beneficiaries: { en: "Beneficiary Registry", sw: "Sajili ya Wanufaika" },
  family_structure: { en: "Family Structure Registry", sw: "Sajili ya Muundo wa Familia" },
  succession_plans: { en: "Succession Records", sw: "Kumbukumbu za Urithi" },
  verification_requests: { en: "Verification Center", sw: "Kituo cha Uthibitishaji" },
  legal_review: { en: "Legal Review Center", sw: "Kituo cha Mapitio ya Kisheria" },
  overview: { en: "Overview", sw: "Muhtasari" },
  users: { en: "User Management", sw: "Usimamizi wa Watumiaji" },
  audit_logs: { en: "Audit & Compliance", sw: "Ukaguzi na Uzingatiaji" },
  reports: { en: "Reports & Certificates", sw: "Taarifa na Vyeti" },
  my_inheritance: { en: "My Inheritance", sw: "Urithi Wangu" },
  help_center: { en: "Help Center", sw: "Kituo cha Msaada" },
  terms: { en: "Terms & Conditions", sw: "Masharti na Vigezo" },
  privacy: { en: "Privacy Policy", sw: "Sera ya Faragha" },
  save: { en: "Save", sw: "Hifadhi" },
  submit: { en: "Submit", sw: "Wasilisha" },
  approve: { en: "Approve", sw: "Idhinisha" },
  reject: { en: "Reject", sw: "Kataa" },
  cancel: { en: "Cancel", sw: "Ghairi" },
  add: { en: "Add", sw: "Ongeza" },
  print: { en: "Print", sw: "Chapisha" },
  status_draft: { en: "Draft", sw: "Rasimu" },
  status_submitted: { en: "Submitted", sw: "Imewasilishwa" },
  status_witness_review: { en: "Witness Verification", sw: "Uthibitishaji wa Mashahidi" },
  status_local_leader_review: { en: "Leader Verification", sw: "Uthibitishaji wa Kiongozi" },
  status_legal_review: { en: "Legal Review", sw: "Mapitio ya Kisheria" },
  status_verified: { en: "Verified", sw: "Imethibitishwa" },
  status_rejected: { en: "Rejected", sw: "Imekataliwa" },
  status_archived: { en: "Archived", sw: "Imehifadhiwa" },
  status_pending: { en: "Pending", sw: "Inasubiri" },
  status_approved: { en: "Approved", sw: "Imeidhinishwa" },
  status_accepted: { en: "Accepted", sw: "Imekubaliwa" },
  status_declined: { en: "Declined", sw: "Imekataliwa" },
  status_reported_deceased: { en: "Death Reported", sw: "Kifo Kimeripotiwa" },
  status_certificate_uploaded: { en: "Certificate Uploaded", sw: "Cheti Kimepakiwa" },
  status_witness_confirmed: { en: "Witness Confirmed", sw: "Mashahidi Wamethibitisha" },
  status_leader_confirmed: { en: "Leader Confirmed", sw: "Kiongozi Amethibitisha" },
  status_legal_reviewed: { en: "Legal Reviewed", sw: "Imepitiwa Kisheria" },
  status_confirmed: { en: "Death Confirmed", sw: "Kifo Kimethibitishwa" },
  status_released: { en: "Released", sw: "Imeachiliwa" },
  status_active: { en: "Active", sw: "Hai" },
  status_revoked: { en: "Revoked", sw: "Imeondolewa" },
  status_open: { en: "Open", sw: "Wazi" },
  status_under_review: { en: "Under Review", sw: "Inapitiwa" },
  status_mediation: { en: "Mediation", sw: "Upatanishi" },
  status_resolved: { en: "Resolved", sw: "Imetatuliwa" },
  status_closed: { en: "Closed", sw: "Imefungwa" },
  estate_dashboard: { en: "Estate Dashboard", sw: "Dashibodi ya Mirathi" },
  executors: { en: "Executors & Representatives", sw: "Wasimamizi wa Mirathi" },
  disputes: { en: "Dispute Management", sw: "Usimamizi wa Migogoro" },
  death_verifications: { en: "Death Verification", sw: "Uthibitishaji wa Kifo" },
  legal_flags: { en: "Compliance Flags", sw: "Alama za Uzingatiaji" },
  landing_tagline: {
    en: "An official platform for recording family property and succession plans, verified by family witnesses and local government authorities.",
    sw: "Jukwaa rasmi la kuhifadhi taarifa za mali za familia na mipango ya urithi, inayothibitishwa na mashahidi wa familia na mamlaka za Serikali za Mitaa.",
  },
  official_notice: {
    en: "This system supports, and does not replace, the official succession and probate procedures established under the laws of the United Republic of Tanzania.",
    sw: "Mfumo huu unasaidia, na hauondoi, taratibu rasmi za mirathi na uthibitisho zilizowekwa chini ya sheria za Jamhuri ya Muungano wa Tanzania.",
  },
};

export function t(key: string, lang: Lang): string {
  return DICT[key]?.[lang] ?? key;
}

type LanguageContextType = { lang: Lang; setLang: (l: Lang) => void; t: (key: string) => string };

const LanguageContext = createContext<LanguageContextType>({
  lang: "en",
  setLang: () => {},
  t: (key: string) => key,
});

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>("en");

  useEffect(() => {
    const stored = window.localStorage.getItem("dfp_lang") as Lang | null;
    if (stored === "en" || stored === "sw") setLangState(stored);
  }, []);

  function setLang(l: Lang) {
    setLangState(l);
    window.localStorage.setItem("dfp_lang", l);
  }

  return (
    <LanguageContext.Provider value={{ lang, setLang, t: (key: string) => t(key, lang) }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}

export function LanguageToggle() {
  const { lang, setLang } = useLanguage();
  return (
    <div className="flex border border-gray-400 text-xs">
      <button
        onClick={() => setLang("en")}
        className={`px-2 py-1 ${lang === "en" ? "bg-primary text-white" : "bg-white text-neutralDark"}`}
      >
        EN
      </button>
      <button
        onClick={() => setLang("sw")}
        className={`px-2 py-1 border-l border-gray-400 ${lang === "sw" ? "bg-primary text-white" : "bg-white text-neutralDark"}`}
      >
        SW
      </button>
    </div>
  );
}
