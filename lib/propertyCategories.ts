import {
  Home, Wheat, Car, Store, Landmark, PawPrint, TrendingUp, Package,
  FileText, FileSignature, Receipt, ClipboardList, BadgeCheck, Mail, IdCard, MessageSquareText, Camera, Paperclip,
  type LucideIcon,
} from "lucide-react";

export type PropertyCategory = "house" | "land" | "farm" | "vehicle" | "business" | "bank_account" | "livestock" | "investment" | "other";

export type CategoryMeta = {
  key: PropertyCategory;
  icon: LucideIcon;
  color: string;
  bg: string;
  label: { en: string; sw: string };
};

export const PROPERTY_CATEGORIES: CategoryMeta[] = [
  { key: "house", icon: Home, color: "#1D4ED8", bg: "#EFF6FF", label: { en: "House", sw: "Nyumba" } },
  { key: "farm", icon: Wheat, color: "#15803D", bg: "#F0FDF4", label: { en: "Farm", sw: "Shamba" } },
  { key: "land", icon: Landmark, color: "#0369A1", bg: "#F0F9FF", label: { en: "Land", sw: "Ardhi" } },
  { key: "vehicle", icon: Car, color: "#C2410C", bg: "#FFF7ED", label: { en: "Vehicle", sw: "Gari" } },
  { key: "business", icon: Store, color: "#7C3AED", bg: "#F5F3FF", label: { en: "Business", sw: "Biashara" } },
  { key: "bank_account", icon: Landmark, color: "#0F766E", bg: "#F0FDFA", label: { en: "Bank Account", sw: "Akaunti ya Benki" } },
  { key: "livestock", icon: PawPrint, color: "#A16207", bg: "#FEFCE8", label: { en: "Livestock", sw: "Mifugo" } },
  { key: "investment", icon: TrendingUp, color: "#BE185D", bg: "#FDF2F8", label: { en: "Investment", sw: "Uwekezaji" } },
  { key: "other", icon: Package, color: "#475569", bg: "#F8FAFC", label: { en: "Other Asset", sw: "Mali Nyingine" } },
];

const BY_KEY: Record<string, CategoryMeta> = Object.fromEntries(PROPERTY_CATEGORIES.map((c) => [c.key, c]));

export function categoryMeta(key: string): CategoryMeta {
  return BY_KEY[key] ?? PROPERTY_CATEGORIES[PROPERTY_CATEGORIES.length - 1];
}

export type DocCategoryMeta = { key: string; icon: LucideIcon; label: { en: string; sw: string } };

export const DOC_CATEGORY_META: DocCategoryMeta[] = [
  { key: "land_title", icon: FileText, label: { en: "Title Deed", sw: "Hati ya Kumiliki" } },
  { key: "purchase_agreement", icon: FileSignature, label: { en: "Purchase Agreement", sw: "Mkataba wa Ununuzi" } },
  { key: "tax_receipt", icon: Receipt, label: { en: "Tax Receipt", sw: "Risiti ya Kodi" } },
  { key: "valuation_report", icon: ClipboardList, label: { en: "Valuation Report", sw: "Taarifa ya Uthamini" } },
  { key: "ownership_certificate", icon: BadgeCheck, label: { en: "Ownership Certificate", sw: "Cheti cha Umiliki" } },
  { key: "government_letter", icon: Mail, label: { en: "Government Letter", sw: "Barua ya Serikali" } },
  { key: "national_id", icon: IdCard, label: { en: "National ID", sw: "Kitambulisho cha NIDA" } },
  { key: "witness_declaration", icon: MessageSquareText, label: { en: "Witness Declaration", sw: "Tamko la Shahidi" } },
  { key: "photo", icon: Camera, label: { en: "Photo", sw: "Picha" } },
  { key: "other_evidence", icon: Paperclip, label: { en: "Other Evidence", sw: "Ushahidi Mwingine" } },
];

const DOC_BY_KEY: Record<string, DocCategoryMeta> = Object.fromEntries(DOC_CATEGORY_META.map((c) => [c.key, c]));

export function docCategoryMeta(key: string): DocCategoryMeta {
  return DOC_BY_KEY[key] ?? DOC_CATEGORY_META[DOC_CATEGORY_META.length - 1];
}

export function docCategoryLabel(key: string, lang: "en" | "sw"): string {
  const found = DOC_CATEGORY_META.find((d) => d.key === key);
  return found ? found.label[lang] : key;
}
