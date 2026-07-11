"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import DashboardShell from "@/components/DashboardShell";
import { createClient } from "@/lib/supabase/client";

type Property = {
  id: string;
  property_number: string | null;
  name: string;
  category: string;
  ownership_type: string | null;
  estimated_value: number | null;
  location: string | null;
  status: string;
};

type Doc = {
  id: string;
  property_id: string;
  file_path: string;
  file_name: string | null;
  category: string;
};

const CATEGORY_LABEL: Record<string, string> = {
  land: "LAND",
  house: "HOUSE",
  farm: "FARM",
  vehicle: "VEHICLE",
  business: "BUSINESS",
  livestock: "LIVESTOCK",
  bank_account: "BANK ACCT.",
  investment: "INVESTMENT",
  other: "OTHER",
};

const DOC_CATEGORIES = [
  "land_title", "ownership_certificate", "national_id", "witness_declaration", "government_letter", "other_evidence", "photo",
];

export default function PropertiesPage() {
  const supabase = createClient();
  const [properties, setProperties] = useState<Property[]>([]);
  const [docs, setDocs] = useState<Record<string, Doc[]>>({});
  const [loading, setLoading] = useState(true);
  const [uploadingFor, setUploadingFor] = useState<string | null>(null);
  const [docCategory, setDocCategory] = useState("other_evidence");

  async function load() {
    setLoading(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase
      .from("dfp_properties")
      .select("id, property_number, name, category, ownership_type, estimated_value, location, status")
      .eq("owner_id", user.id)
      .order("created_at", { ascending: false });
    setProperties(data ?? []);

    if (data && data.length > 0) {
      const { data: docRows } = await supabase
        .from("dfp_property_documents")
        .select("id, property_id, file_path, file_name, category")
        .in("property_id", data.map((p) => p.id));
      const grouped: Record<string, Doc[]> = {};
      (docRows ?? []).forEach((d) => {
        grouped[d.property_id] = [...(grouped[d.property_id] ?? []), d];
      });
      setDocs(grouped);
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleDelete(id: string) {
    if (!confirm("Delete this property? This cannot be undone.")) return;
    await supabase.from("dfp_properties").delete().eq("id", id);
    load();
  }

  async function handleUpload(propertyId: string, file: File) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    const path = `${user.id}/${propertyId}/${Date.now()}-${file.name}`;
    const { error: uploadError } = await supabase.storage.from("dfp-documents").upload(path, file);
    if (uploadError) {
      alert(uploadError.message);
      return;
    }
    await supabase.from("dfp_property_documents").insert({
      property_id: propertyId,
      file_path: path,
      file_name: file.name,
      category: docCategory,
      uploaded_by: user.id,
    });
    load();
  }

  async function viewDoc(path: string) {
    const { data, error } = await supabase.storage.from("dfp-documents").createSignedUrl(path, 60);
    if (error || !data) {
      alert("Could not open document.");
      return;
    }
    window.open(data.signedUrl, "_blank");
  }

  async function deleteDoc(doc: Doc) {
    if (!confirm("Remove this document?")) return;
    await supabase.storage.from("dfp-documents").remove([doc.file_path]);
    await supabase.from("dfp_property_documents").delete().eq("id", doc.id);
    load();
  }

  return (
    <DashboardShell role="owner">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-primary">Property Registry</h1>
        <Link href="/owner/properties/new" className="btn-primary text-sm">
          Register Property
        </Link>
      </div>

      {loading ? (
        <p className="text-sm text-neutralDark">Loading…</p>
      ) : properties.length === 0 ? (
        <div className="card text-center py-10">
          <p className="text-neutralDark mb-3">You haven&apos;t registered any properties yet.</p>
          <Link href="/owner/properties/new" className="btn-primary inline-block">
            Register your first property
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {properties.map((p) => (
            <div key={p.id} className="card">
              <div className="flex items-start justify-between mb-2">
                <span className="badge bg-neutralLight text-primary border-primary">
                  {CATEGORY_LABEL[p.category] ?? "OTHER"}
                </span>
                <button
                  onClick={() => handleDelete(p.id)}
                  className="text-xs text-red-800 hover:underline"
                >
                  Delete
                </button>
              </div>
              {p.property_number && (
                <p className="text-[11px] text-neutralDark font-mono mb-1">{p.property_number}</p>
              )}
              <p className="font-medium text-neutralDark">{p.name}</p>
              {p.ownership_type && (
                <p className="text-xs text-neutralDark mb-2 capitalize">Ownership: {p.ownership_type}</p>
              )}
              {p.location && <p className="text-xs text-neutralDark">Location: {p.location}</p>}
              {p.estimated_value != null && (
                <p className="text-sm font-semibold text-neutralDark mt-2 mb-3">
                  TZS {Number(p.estimated_value).toLocaleString()}
                </p>
              )}

              <div className="border-t border-gray-200 pt-3 mt-2">
                <p className="text-xs font-semibold text-neutralDark uppercase mb-2">Documents</p>
                {(docs[p.id] ?? []).length === 0 && (
                  <p className="text-xs text-neutralDark mb-2">None uploaded yet.</p>
                )}
                <ul className="space-y-1 mb-2">
                  {(docs[p.id] ?? []).map((d) => (
                    <li key={d.id} className="flex items-center justify-between text-xs">
                      <button onClick={() => viewDoc(d.file_path)} className="text-primary underline truncate max-w-[140px] text-left">
                        {d.file_name ?? d.category}
                      </button>
                      <button onClick={() => deleteDoc(d)} className="text-red-800">Remove</button>
                    </li>
                  ))}
                </ul>

                {uploadingFor === p.id ? (
                  <div className="space-y-2">
                    <select
                      className="input-field text-xs py-1"
                      value={docCategory}
                      onChange={(e) => setDocCategory(e.target.value)}
                    >
                      {DOC_CATEGORIES.map((c) => (
                        <option key={c} value={c}>{c.replace("_", " ")}</option>
                      ))}
                    </select>
                    <input
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png,.docx"
                      className="text-xs"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleUpload(p.id, file);
                        setUploadingFor(null);
                      }}
                    />
                  </div>
                ) : (
                  <button
                    onClick={() => setUploadingFor(p.id)}
                    className="text-xs text-primary font-medium underline"
                  >
                    Upload document
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </DashboardShell>
  );
}
