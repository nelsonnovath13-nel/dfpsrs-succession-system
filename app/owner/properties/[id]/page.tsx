"use client";

import { Suspense, useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { FileText, Upload, Eye, Trash2, History, HeartHandshake, ClipboardCheck, AlertTriangle } from "lucide-react";
import DashboardShell from "@/components/DashboardShell";
import { PageNav } from "@/components/PageNav";
import { StatusBadge } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import { useLanguage } from "@/lib/i18n";
import { categoryMeta, DOC_CATEGORY_META, docCategoryLabel, docCategoryMeta } from "@/lib/propertyCategories";

type Property = {
  id: string;
  property_number: string | null;
  name: string;
  category: string;
  ownership_type: string | null;
  estimated_value: number | null;
  location: string | null;
  description: string | null;
  status: string;
};

type Doc = { id: string; property_id: string; file_path: string; file_name: string | null; category: string; uploaded_at: string };
type Allocation = { id: string; share_percentage: number; succession_record_id: string; dfp_beneficiaries: { full_name: string; relationship: string } | null };
type AuditRow = { id: string; action: string; created_at: string };
type Verification = { id: string; verifier_role: string; decision: string; decided_at: string | null };
type Dispute = { id: string; category: string; status: string; created_at: string };

function PropertyDetailInner() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();
  const { lang } = useLanguage();
  const sw = lang === "sw";

  const [property, setProperty] = useState<Property | null>(null);
  const [docs, setDocs] = useState<Doc[]>([]);
  const [allocations, setAllocations] = useState<Allocation[]>([]);
  const [audit, setAudit] = useState<AuditRow[]>([]);
  const [verifications, setVerifications] = useState<Verification[]>([]);
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [loading, setLoading] = useState(true);

  const [editing, setEditing] = useState(searchParams.get("edit") === "1");
  const [editForm, setEditForm] = useState({ name: "", estimated_value: "", description: "" });
  const [saving, setSaving] = useState(false);

  const [showUpload, setShowUpload] = useState(searchParams.get("upload") === "1");
  const [docCategory, setDocCategory] = useState("land_title");
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  async function load() {
    setLoading(true);
    const { data: prop } = await supabase.from("dfp_properties").select("*").eq("id", params.id).single();
    setProperty(prop);
    if (!prop) {
      setLoading(false);
      return;
    }
    setEditForm({ name: prop.name, estimated_value: prop.estimated_value ? String(prop.estimated_value) : "", description: prop.description ?? "" });

    const [docsRes, allocRes, auditRes] = await Promise.all([
      supabase.from("dfp_property_documents").select("id, property_id, file_path, file_name, category, uploaded_at").eq("property_id", prop.id).order("uploaded_at", { ascending: false }),
      supabase
        .from("dfp_property_allocations")
        .select("id, share_percentage, succession_record_id, dfp_beneficiaries(full_name, relationship)")
        .eq("property_id", prop.id),
      supabase.from("dfp_audit_logs").select("id, action, created_at").eq("reference_table", "dfp_properties").eq("reference_id", prop.id).order("created_at", { ascending: false }).limit(20),
    ]);
    setDocs(docsRes.data ?? []);
    setAllocations((allocRes.data as any) ?? []);
    setAudit(auditRes.data ?? []);

    const recordIds = Array.from(new Set(((allocRes.data as any) ?? []).map((a: Allocation) => a.succession_record_id)));
    if (recordIds.length > 0) {
      const [verRes, disputeRes] = await Promise.all([
        supabase.from("dfp_verifications").select("id, verifier_role, decision, decided_at").in("succession_record_id", recordIds),
        supabase.from("dfp_disputes").select("id, category, status, created_at").in("succession_record_id", recordIds),
      ]);
      setVerifications(verRes.data ?? []);
      setDisputes(disputeRes.data ?? []);
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  async function handleSaveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!property) return;
    setSaving(true);
    await supabase
      .from("dfp_properties")
      .update({
        name: editForm.name,
        estimated_value: editForm.estimated_value ? Number(editForm.estimated_value) : null,
        description: editForm.description || null,
      })
      .eq("id", property.id);
    setSaving(false);
    setEditing(false);
    router.replace(`/owner/properties/${property.id}`);
    load();
  }

  async function uploadFile(file: File) {
    if (!property) return;
    setUploading(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setUploading(false);
      return;
    }
    const path = `${user.id}/${property.id}/${Date.now()}-${file.name}`;
    const { error: uploadError } = await supabase.storage.from("dfp-documents").upload(path, file);
    if (uploadError) {
      alert(uploadError.message);
      setUploading(false);
      return;
    }
    await supabase.from("dfp_property_documents").insert({
      property_id: property.id,
      file_path: path,
      file_name: file.name,
      category: docCategory,
      uploaded_by: user.id,
    });
    setUploading(false);
    load();
  }

  async function viewDoc(path: string) {
    const newTab = window.open("", "_blank");
    const { data, error } = await supabase.storage.from("dfp-documents").createSignedUrl(path, 60);
    if (error || !data) {
      newTab?.close();
      alert(sw ? "Imeshindikana kufungua hati." : "Could not open document.");
      return;
    }
    if (newTab) newTab.location.href = data.signedUrl;
  }

  async function deleteDoc(doc: Doc) {
    if (!confirm(sw ? "Ondoa hati hii?" : "Remove this document?")) return;
    await supabase.storage.from("dfp-documents").remove([doc.file_path]);
    await supabase.from("dfp_property_documents").delete().eq("id", doc.id);
    load();
  }

  if (loading) {
    return (
      <DashboardShell role="owner">
        <p className="text-sm text-neutralDark">{sw ? "Inapakia…" : "Loading…"}</p>
      </DashboardShell>
    );
  }

  if (!property) {
    return (
      <DashboardShell role="owner">
        <PageNav exitHref="/owner/properties" />
        <p className="text-sm text-neutralDark">{sw ? "Mali haikupatikana." : "Property not found."}</p>
      </DashboardShell>
    );
  }

  const meta = categoryMeta(property.category);
  const Icon = meta.icon;

  return (
    <DashboardShell role="owner">
      <PageNav exitHref="/owner/properties" />

      <div className="max-w-3xl">
        {/* Header */}
        <div className="card mb-6 border-t-4" style={{ borderTopColor: meta.color }}>
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="w-12 h-12 rounded-lg flex items-center justify-center" style={{ backgroundColor: meta.bg }}>
                <Icon size={24} aria-hidden="true" style={{ color: meta.color }} />
              </span>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: meta.color }}>{meta.label[lang]}</p>
                <h1 className="text-xl font-semibold text-ink">{property.name}</h1>
                {property.property_number && <p className="text-[11px] text-inkSoft font-mono">{property.property_number}</p>}
              </div>
            </div>
            <StatusBadge status={property.status} />
          </div>
        </div>

        {/* Property Information / Ownership (editable) */}
        <div className="card mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-primary text-sm uppercase tracking-wide">{sw ? "Taarifa za Mali" : "Property Information"}</h2>
            {!editing && (
              <button onClick={() => setEditing(true)} className="text-xs text-primary font-medium border border-primary px-2" style={{ minHeight: 30 }}>
                {sw ? "Hariri" : "Edit"}
              </button>
            )}
          </div>
          {editing ? (
            <form onSubmit={handleSaveEdit} className="space-y-3">
              <div>
                <label className="label">{sw ? "Jina" : "Name"}</label>
                <input required className="input-field" value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} />
              </div>
              <div>
                <label className="label">{sw ? "Thamani (TZS)" : "Estimated Value (TZS)"}</label>
                <input type="number" className="input-field" value={editForm.estimated_value} onChange={(e) => setEditForm({ ...editForm, estimated_value: e.target.value })} />
              </div>
              <div>
                <label className="label">{sw ? "Maelezo" : "Description"}</label>
                <textarea className="input-field" rows={3} value={editForm.description} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} />
              </div>
              <div className="flex gap-2">
                <button type="submit" disabled={saving} className="btn-primary text-sm">{saving ? (sw ? "Inahifadhi…" : "Saving…") : sw ? "Hifadhi" : "Save"}</button>
                <button type="button" onClick={() => setEditing(false)} className="btn-outline text-sm">{sw ? "Ghairi" : "Cancel"}</button>
              </div>
            </form>
          ) : (
            <dl className="text-sm space-y-1.5">
              {property.description && (
                <div className="flex justify-between gap-4"><dt className="text-inkSoft">{sw ? "Maelezo" : "Description"}</dt><dd className="text-ink text-right">{property.description}</dd></div>
              )}
              <div className="flex justify-between"><dt className="text-inkSoft">{sw ? "Umiliki" : "Ownership"}</dt><dd className="text-ink capitalize">{property.ownership_type ?? "—"}</dd></div>
              <div className="flex justify-between"><dt className="text-inkSoft">{sw ? "Mahali" : "Location"}</dt><dd className="text-ink">{property.location ?? "—"}</dd></div>
              <div className="flex justify-between"><dt className="text-inkSoft">{sw ? "Thamani" : "Estimated Value"}</dt><dd className="text-ink font-semibold">{property.estimated_value ? `TZS ${Number(property.estimated_value).toLocaleString()}` : "—"}</dd></div>
            </dl>
          )}
        </div>

        {/* Documents */}
        <div className="card mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-primary text-sm uppercase tracking-wide flex items-center gap-2">
              <FileText size={16} aria-hidden="true" /> {sw ? "Hati za Mali" : "Property Documents"}
            </h2>
            <span className="text-xs text-inkSoft">{docs.length} {sw ? "zilizopakiwa" : "uploaded"}</span>
          </div>

          {docs.length > 0 && (
            <ul className="divide-y divide-gray-200 border border-gray-200 mb-4">
              {docs.map((d) => (
                <li key={d.id} className="flex items-center justify-between px-3 py-2 text-sm">
                  <span className="flex items-center gap-2 text-ink truncate">
                    {(() => {
                      const DocIcon = docCategoryMeta(d.category).icon;
                      return <DocIcon size={16} className="text-inkSoft shrink-0" aria-hidden="true" />;
                    })()}
                    <span className="truncate">{d.file_name ?? docCategoryLabel(d.category, lang)}</span>
                    <span className="text-xs text-inkSoft shrink-0">({docCategoryLabel(d.category, lang)})</span>
                  </span>
                  <span className="flex items-center gap-2 shrink-0">
                    <button onClick={() => viewDoc(d.file_path)} className="text-primary" aria-label={sw ? "Tazama" : "View"}>
                      <Eye size={16} aria-hidden="true" />
                    </button>
                    <button onClick={() => deleteDoc(d)} className="text-danger" aria-label={sw ? "Futa" : "Remove"}>
                      <Trash2 size={16} aria-hidden="true" />
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          )}

          {!showUpload ? (
            <button onClick={() => setShowUpload(true)} className="btn-outline text-sm inline-flex items-center gap-2">
              <Upload size={16} aria-hidden="true" /> {sw ? "Pakia Hati" : "Upload Document"}
            </button>
          ) : (
            <div className="space-y-3">
              <div>
                <label className="label">{sw ? "Aina ya Hati" : "Document Type"}</label>
                <select className="input-field" value={docCategory} onChange={(e) => setDocCategory(e.target.value)}>
                  {DOC_CATEGORY_META.map((c) => (
                    <option key={c.key} value={c.key}>{c.label[lang]}</option>
                  ))}
                </select>
              </div>
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOver(false);
                  const file = e.dataTransfer.files?.[0];
                  if (file) uploadFile(file);
                }}
                className={`border-2 border-dashed p-6 text-center ${dragOver ? "border-primary bg-blue-50" : "border-gray-300"}`}
              >
                <Upload size={24} className="mx-auto mb-2 text-inkSoft" aria-hidden="true" />
                <p className="text-sm text-inkSoft mb-2">
                  {sw ? "Buruta na uachie faili hapa, au" : "Drag & drop a file here, or"}
                </p>
                <label className="btn-outline text-sm cursor-pointer inline-block">
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
                {uploading && <p className="text-xs text-primary mt-2">{sw ? "Inapakia…" : "Uploading…"}</p>}
              </div>
            </div>
          )}
        </div>

        {/* Beneficiaries Linked */}
        <div className="card mb-6">
          <h2 className="font-semibold text-primary mb-3 text-sm uppercase tracking-wide flex items-center gap-2">
            <HeartHandshake size={16} aria-hidden="true" /> {sw ? "Wanufaika Waliounganishwa" : "Beneficiaries Linked"}
          </h2>
          {allocations.length === 0 ? (
            <p className="text-sm text-inkSoft">{sw ? "Mali hii bado haijawekwa kwenye kumbukumbu yoyote ya urithi." : "This property hasn't been allocated in any succession record yet."}</p>
          ) : (
            <ul className="text-sm space-y-1">
              {allocations.map((a) => (
                <li key={a.id} className="flex justify-between">
                  <span className="text-ink">{a.dfp_beneficiaries?.full_name} ({a.dfp_beneficiaries?.relationship})</span>
                  <span className="font-medium text-ink">{a.share_percentage}%</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Verification History */}
        <div className="card mb-6">
          <h2 className="font-semibold text-primary mb-3 text-sm uppercase tracking-wide flex items-center gap-2">
            <ClipboardCheck size={16} aria-hidden="true" /> {sw ? "Historia ya Uthibitishaji" : "Verification History"}
          </h2>
          {verifications.length === 0 ? (
            <p className="text-sm text-inkSoft">{sw ? "Hakuna uthibitishaji bado." : "No verification activity yet."}</p>
          ) : (
            <ul className="text-sm space-y-1.5">
              {verifications.map((v) => (
                <li key={v.id} className="flex justify-between">
                  <span className="text-ink capitalize">{v.verifier_role}</span>
                  <span className="flex items-center gap-2">
                    <StatusBadge status={v.decision} />
                    {v.decided_at && <span className="text-xs text-inkSoft">{new Date(v.decided_at).toLocaleDateString()}</span>}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Disputes */}
        {disputes.length > 0 && (
          <div className="card mb-6">
            <h2 className="font-semibold text-primary mb-3 text-sm uppercase tracking-wide flex items-center gap-2">
              <AlertTriangle size={16} aria-hidden="true" /> {sw ? "Migogoro" : "Disputes"}
            </h2>
            <ul className="text-sm space-y-1.5">
              {disputes.map((d) => (
                <li key={d.id} className="flex justify-between">
                  <span className="text-ink capitalize">{d.category}</span>
                  <StatusBadge status={d.status} />
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Activity Log */}
        <div className="card">
          <h2 className="font-semibold text-primary mb-3 text-sm uppercase tracking-wide flex items-center gap-2">
            <History size={16} aria-hidden="true" /> {sw ? "Kumbukumbu za Shughuli" : "Activity Log"}
          </h2>
          {audit.length === 0 ? (
            <p className="text-sm text-inkSoft">{sw ? "Hakuna shughuli zilizorekodiwa." : "No activity recorded."}</p>
          ) : (
            <ul className="text-sm space-y-1.5">
              {audit.map((a) => (
                <li key={a.id} className="flex justify-between">
                  <span className="text-ink">{a.action}</span>
                  <span className="text-xs text-inkSoft">{new Date(a.created_at).toLocaleString()}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </DashboardShell>
  );
}

export default function PropertyDetailPage() {
  return (
    <Suspense fallback={null}>
      <PropertyDetailInner />
    </Suspense>
  );
}
