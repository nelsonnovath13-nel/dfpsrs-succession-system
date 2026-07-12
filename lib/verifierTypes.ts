export type VerifierType =
  | "village_chairperson"
  | "street_chairperson"
  | "veo"
  | "weo"
  | "local_government_leader"
  | "land_officer"
  | "advocate"
  | "lawyer"
  | "notary_public"
  | "legal_representative"
  | "court_officer"
  | "religious_leader"
  | "other";

export const VERIFIER_TYPES: { value: VerifierType; en: string; sw: string }[] = [
  { value: "village_chairperson", en: "Village Chairperson", sw: "Mwenyekiti wa Kijiji" },
  { value: "street_chairperson", en: "Street Chairperson", sw: "Mwenyekiti wa Mtaa" },
  { value: "veo", en: "Village Executive Officer (VEO)", sw: "Afisa Mtendaji wa Kijiji (VEO)" },
  { value: "weo", en: "Ward Executive Officer (WEO)", sw: "Afisa Mtendaji wa Kata (WEO)" },
  { value: "local_government_leader", en: "Local Government Leader", sw: "Kiongozi wa Serikali za Mitaa" },
  { value: "land_officer", en: "Land Officer", sw: "Afisa Ardhi" },
  { value: "advocate", en: "Advocate", sw: "Wakili" },
  { value: "lawyer", en: "Lawyer", sw: "Mwanasheria" },
  { value: "notary_public", en: "Notary Public", sw: "Mthibitishaji wa Hati (Notary)" },
  { value: "legal_representative", en: "Legal Representative", sw: "Mwakilishi wa Kisheria" },
  { value: "court_officer", en: "Court Officer", sw: "Afisa wa Mahakama" },
  { value: "religious_leader", en: "Religious Leader", sw: "Kiongozi wa Dini" },
  { value: "other", en: "Other Authorized Verifier", sw: "Mthibitishaji Mwingine Aliyeidhinishwa" },
];

export function verifierTypeLabel(type: string, lang: string) {
  const found = VERIFIER_TYPES.find((t) => t.value === type);
  if (!found) return type;
  return lang === "sw" ? found.sw : found.en;
}

export type VerifierDocType =
  | "national_id"
  | "employment_letter"
  | "appointment_letter"
  | "government_intro_letter"
  | "practicing_license"
  | "bar_certificate"
  | "lg_authorization_letter"
  | "professional_certificate"
  | "other";

export const VERIFIER_DOC_TYPES: { value: VerifierDocType; en: string; sw: string }[] = [
  { value: "national_id", en: "National ID", sw: "Kitambulisho cha Taifa (NIDA)" },
  { value: "employment_letter", en: "Employment Letter", sw: "Barua ya Ajira" },
  { value: "appointment_letter", en: "Appointment Letter", sw: "Barua ya Uteuzi" },
  { value: "government_intro_letter", en: "Government Introduction Letter", sw: "Barua ya Utambulisho wa Serikali" },
  { value: "practicing_license", en: "Practicing License", sw: "Leseni ya Kufanya Kazi" },
  { value: "bar_certificate", en: "Bar Certificate", sw: "Cheti cha Chama cha Wanasheria" },
  { value: "lg_authorization_letter", en: "Local Government Authorization Letter", sw: "Barua ya Idhini ya Serikali za Mitaa" },
  { value: "professional_certificate", en: "Professional Certificate", sw: "Cheti cha Kitaaluma" },
  { value: "other", en: "Other Document", sw: "Hati Nyingine" },
];

export function verifierDocLabel(type: string, lang: string) {
  const found = VERIFIER_DOC_TYPES.find((t) => t.value === type);
  if (!found) return type;
  return lang === "sw" ? found.sw : found.en;
}

export const VERIFIER_STATUS_LABEL: Record<string, { en: string; sw: string }> = {
  pending_review: { en: "Pending Review", sw: "Inasubiri Ukaguzi" },
  approved: { en: "Approved", sw: "Imeidhinishwa" },
  rejected: { en: "Rejected", sw: "Imekataliwa" },
  suspended: { en: "Suspended", sw: "Imesimamishwa" },
  expired: { en: "Expired", sw: "Imepitwa na Muda" },
};
