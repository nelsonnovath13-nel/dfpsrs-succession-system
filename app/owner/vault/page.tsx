"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Vault, Upload, Eye, Trash2, Search, FileText, ShieldCheck } from "lucide-react";
import DashboardShell from "@/components/DashboardShell";
import { PageGuide } from "@/components/PageGuide";
import { EmptyState } from "@/components/EmptyState";
import { createClient } from "@/lib/supabase/client";
import { useLanguage } from "@/lib/i18n";

const VAULT_GUIDE = {
  purpose: { en: "One secure place for every important family document — not just property paperwork.", sw: "Mahali salama pamoja kwa kila hati muhimu ya familia — si hati za mali pekee." },
  why: {
    en: "Documents like National IDs, birth certificates, wills, and court papers don't belong to one property, but they matter for your family's legacy.",
    sw: "Hati kama NIDA, vyeti vya kuzaliwa, wosia, na hati za mahakama hazihusiani na mali moja, lakini ni muhimu kwa urithi wa familia yako.",
  },
  example: { en: "Your National ID, your children's birth certificates, a will, a family agreement.", sw: "NIDA yako, vyeti vya kuzaliwa vya watoto wako, wosia, mkataba wa familia." },
  mistakes: { en: "Confusing this with Property Documents — property-specific papers (title deeds, tax receipts) still belong on each property's own page.", sw: "Kuchanganya hii na Hati za Mali — hati za mali maalum (hati za kumiliki, risiti za kodi) bado zinawekwa kwenye ukurasa wa mali husika." },
  nextStep: { en: "Keep this vault updated as your family's documents change over time.", sw: "Hifadhi kumbukumbu hii ikiwa ya kisasa kadri hati za familia yako zinavyobadilika." },
};

type VaultDoc = { id: string; category: string; file_name: string; file_path: string; notes: string | null; uploaded_at: string };

const CATEGORIES: { key: string; en: string; sw: string }[] = [
  { key: "national_id", en: "National ID", sw: "Kitambulisho cha NIDA" },
  { key: "birth_certificate", en: "Birth Certificate", sw: "Cheti cha Kuzaliwa" },
  { key: "death_certificate", en: "Death Certificate", sw: "Cheti cha Kifo" },
  { key: "land_title", en: "Land Title", sw: "Hati ya Ardhi" },
  { key: "vehicle_registration", en: "Vehicle Registration", sw: "Usajili wa Gari" },
  { key: "business_license", en: "Business License", sw: "Leseni ya Biashara" },
  { key: "insurance_document", en: "Insurance Document", sw: "Hati ya Bima" },
  { key: "family_agreement", en: "Family Agreement", sw: "Mkataba wa Familia" },
  { key: "will", en: "Will", sw: "Wosia" },
  { key: "court_document", en: "Court Document", sw: "Hati ya Mahakama" },
  { key: "tax_record", en: "Tax Record", sw: "Kumbukumbu ya Kodi" },
  { key: "other", en: "Other", sw: "Nyingine" },
];

function catLabel(key: string, lang: "en" | "sw") {
  const c = CATEGORIES.find((x) => x.key === key);
  return c ? (lang === "en" ? c.en : c.sw) : key;
}

export default function VaultPage() {
  const supabase = createClient();
  const { lang } = useLanguage();
  const sw = lang === "sw";

  const [docs, setDocs] = useState<VaultDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [showUpload, setShowUpload] = useState(false);
  const [category, setCategory] = useState("national_id");
  const [notes, setNotes] = useState("");
  const [uploading, setUploading] = useState(false);
  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState("all");

  async function load() {
    setLoading(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase
      .from("dfp_vault_documents")
      .select("id, category, file_name, file_path, notes, uploaded_at")
      .eq("owner_id", user.id)
      .order("uploaded_at", { ascending: false });
    setDocs(data ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function uploadFile(file: File) {
    setUploading(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setUploading(false);
      return;
    }
    const path = `${user.id}/vault/${Date.now()}-${file.name}`;
    const { error: uploadError } = await supabase.storage.from("dfp-documents").upload(path, file);
    if (uploadError) {
      alert(uploadError.message);
      setUploading(false);
      return;
    }
    await supabase.from("dfp_vault_documents").insert({
      owner_id: user.id,
      category,
      file_name: file.name,
      file_path: path,
      notes: notes || null,
      uploaded_by: user.id,
    });
    setUploading(false);
    setNotes("");
    setShowUpload(false);
    load();
  }

  async function viewDoc(path: string) {
    // Open the tab synchronously in the click handler, then redirect it once the signed URL
    // resolves -- opening only after the await is what popup blockers silently block.
    const newTab = window.open("", "_blank");
    const { data, error } = await supabase.storage.from("dfp-documents").createSignedUrl(path, 60);
    if (error || !data) {
      newTab?.close();
      alert(sw ? "Imeshindikana kufungua hati." : "Could not open document.");
      return;
    }
    if (newTab) newTab.location.href = data.signedUrl;
  }

  async function deleteDoc(doc: VaultDoc) {
    if (!confirm(sw ? "Ondoa hati hii kutoka kwenye hazina?" : "Remove this document from the vault?")) return;
    await supabase.storage.from("dfp-documents").remove([doc.file_path]);
    await supabase.from("dfp_vault_documents").delete().eq("id", doc.id);
    load();
  }

  const categoryCounts = docs.reduce<Record<string, number>>((acc, d) => {
    acc[d.category] = (acc[d.category] ?? 0) + 1;
    return acc;
  }, {});

  const filtered = useMemo(() => {
    return docs.filter((d) => {
      if (filterCategory !== "all" && d.category !== filterCategory) return false;
      if (search && !d.file_name.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [docs, filterCategory, search]);

  return (
    <DashboardShell role="owner">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-primary flex items-center gap-2">
          <Vault size={22} aria-hidden="true" /> {sw ? "Hazina ya Urithi wa Familia" : "Family Legacy Vault"}
        </h1>
        <div className="flex items-center gap-2">
          <PageGuide content={VAULT_GUIDE} />
          <Link href="/owner/vault/trustees" className="btn-outline text-sm inline-flex items-center gap-2">
            <ShieldCheck size={16} aria-hidden="true" /> {sw ? "Watu wa Kuaminika" : "Trusted Access"}
          </Link>
          <button className="btn-primary text-sm" onClick={() => setShowUpload((s) => !s)}>
            {showUpload ? (sw ? "Ghairi" : "Cancel") : sw ? "Pakia Hati" : "Upload Document"}
          </button>
        </div>
      </div>

      {showUpload && (
        <div className="card mb-6 max-w-xl space-y-3">
          <div>
            <label className="label">{sw ? "Aina ya Hati" : "Document Category"}</label>
            <select className="input-field" value={category} onChange={(e) => setCategory(e.target.value)}>
              {CATEGORIES.map((c) => (
                <option key={c.key} value={c.key}>{lang === "en" ? c.en : c.sw}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">{sw ? "Maelezo (hiari)" : "Notes (optional)"}</label>
            <input className="input-field" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          <label className="btn-outline text-sm cursor-pointer inline-flex items-center gap-2">
            <Upload size={16} aria-hidden="true" />
            {sw ? "Chagua Faili" : "Choose File"}
            <input
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,.docx"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) uploadFile(file);
              }}
            />
          </label>
          {uploading && <p className="text-xs text-primary">{sw ? "Inapakia…" : "Uploading…"}</p>}
        </div>
      )}

      {loading ? (
        <p className="text-sm text-neutralDark">{sw ? "Inapakia…" : "Loading…"}</p>
      ) : docs.length === 0 ? (
        <EmptyState
          icon={Vault}
          title={sw ? "Hazina Yako ya Familia Ipo Tupu" : "Your Family Vault is Empty"}
          description={
            sw
              ? "Hifadhi hati muhimu za familia mahali salama pamoja — NIDA, vyeti vya kuzaliwa, wosia, na hati za mahakama."
              : "Store your family's important documents in one secure place — National IDs, birth certificates, wills, and court documents."
          }
          examples={sw ? ["NIDA", "Cheti cha Kuzaliwa", "Wosia", "Mkataba wa Familia"] : ["National ID", "Birth Certificate", "Will", "Family Agreement"]}
          action={{ label: sw ? "Pakia Hati ya Kwanza" : "Upload your first document", onClick: () => setShowUpload(true) }}
          helpHref="/help"
          helpLabel={sw ? "Nahitaji msaada zaidi" : "I need more help"}
        />
      ) : (
        <>
          <div className="card mb-6">
            <div className="flex flex-wrap gap-3">
              {CATEGORIES.filter((c) => categoryCounts[c.key]).map((c) => (
                <button
                  key={c.key}
                  onClick={() => setFilterCategory(filterCategory === c.key ? "all" : c.key)}
                  className={`text-xs px-3 py-1.5 border ${filterCategory === c.key ? "border-primary text-primary bg-blue-50" : "border-gray-300 text-inkSoft"}`}
                >
                  {lang === "en" ? c.en : c.sw} ({categoryCounts[c.key]})
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2 mb-4 max-w-sm">
            <Search size={16} className="text-inkSoft shrink-0" aria-hidden="true" />
            <input
              className="input-field"
              placeholder={sw ? "Tafuta hati…" : "Search documents…"}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="border border-gray-300 divide-y divide-gray-200">
            {filtered.map((d) => (
              <div key={d.id} className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-3 min-w-0">
                  <FileText size={18} className="text-inkSoft shrink-0" aria-hidden="true" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-ink truncate">{d.file_name}</p>
                    <p className="text-xs text-inkSoft">
                      {catLabel(d.category, lang)} · {new Date(d.uploaded_at).toLocaleDateString()}
                      {d.notes ? ` · ${d.notes}` : ""}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <button onClick={() => viewDoc(d.file_path)} className="text-primary" aria-label={sw ? "Tazama" : "View"}>
                    <Eye size={18} aria-hidden="true" />
                  </button>
                  <button onClick={() => deleteDoc(d)} className="text-danger" aria-label={sw ? "Futa" : "Remove"}>
                    <Trash2 size={18} aria-hidden="true" />
                  </button>
                </div>
              </div>
            ))}
            {filtered.length === 0 && <p className="text-sm text-inkSoft px-4 py-6 text-center">{sw ? "Hakuna hati zinazolingana." : "No matching documents."}</p>}
          </div>
        </>
      )}
    </DashboardShell>
  );
}
