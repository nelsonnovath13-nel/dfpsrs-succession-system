"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Upload } from "lucide-react";
import DashboardShell from "@/components/DashboardShell";
import { PageNav } from "@/components/PageNav";
import { Stepper } from "@/components/Stepper";
import { LocationPicker, EMPTY_LOCATION, type LocationValue } from "@/components/LocationPicker";
import { createClient } from "@/lib/supabase/client";
import { useLanguage } from "@/lib/i18n";
import { withTimeout } from "@/lib/withTimeout";
import { PROPERTY_CATEGORIES, DOC_CATEGORY_META } from "@/lib/propertyCategories";

const STEP_LABELS_SW = ["Aina ya Mali", "Taarifa Msingi", "Mahali", "Umiliki", "Thamani", "Hati", "Pitia na Thibitisha"];
const STEP_LABELS_EN = ["Asset Type", "Basic Information", "Location", "Ownership", "Estimated Value", "Documents", "Review & Submit"];

export default function NewPropertyPage() {
  const supabase = createClient();
  const router = useRouter();
  const { lang } = useLanguage();
  const sw = lang === "sw";

  const [step, setStep] = useState(0);
  const [form, setForm] = useState({
    name: "",
    category: "",
    description: "",
    ownership_type: "sole",
    estimated_value: "",
  });
  const [location, setLocation] = useState<LocationValue>(EMPTY_LOCATION);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [createdPropertyId, setCreatedPropertyId] = useState<string | null>(null);
  const [docCategory, setDocCategory] = useState("land_title");
  const [uploadedDocs, setUploadedDocs] = useState<{ id: string; file_name: string }[]>([]);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  function markTouched(field: string) {
    setTouched((t) => ({ ...t, [field]: true }));
  }

  const fieldErrors: Record<string, string> = {};
  if (!form.category) {
    fieldErrors.category = sw ? "Tafadhali chagua aina ya mali" : "Please select an asset type";
  }
  if (!form.name.trim()) {
    fieldErrors.name = sw ? "Tafadhali ingiza jina la mali" : "Please enter the property name";
  }
  if (!location.regionSlug) {
    fieldErrors.region = sw ? "Tafadhali chagua mkoa" : "Please select a region";
  } else if (!location.districtSlug) {
    fieldErrors.location = sw ? "Tafadhali chagua wilaya" : "Please select a district";
  } else if (!location.wardSlug) {
    fieldErrors.location = sw ? "Tafadhali chagua kata" : "Please select a ward";
  } else if (!location.streetName) {
    fieldErrors.location = sw ? "Tafadhali chagua kijiji/mtaa" : "Please select a village/street";
  }
  if (!form.estimated_value.trim()) {
    fieldErrors.estimated_value = sw ? "Tafadhali ingiza thamani ya mali" : "Please enter the property value";
  } else if (Number.isNaN(Number(form.estimated_value)) || Number(form.estimated_value) <= 0) {
    fieldErrors.estimated_value = sw ? "Tafadhali ingiza namba sahihi" : "Please enter a valid number";
  }

  // Step order: 0 Asset Type, 1 Basic Info, 2 Location, 3 Ownership, 4 Value, 5 Documents, 6 Review
  const stepFields: string[][] = [["category"], ["name"], ["region", "location"], [], ["estimated_value"], [], []];
  const canAdvance = stepFields[step].every((f) => !fieldErrors[f]);

  async function createPropertyRecord() {
    setLoading(true);
    setError(null);
    try {
      const {
        data: { user },
      } = await withTimeout(supabase.auth.getUser(), 15000, { data: { user: null } } as any);
      if (!user) {
        setError(sw ? "Kikao chako kimeisha. Tafadhali ingia tena." : "Your session has expired. Please sign in again.");
        return false;
      }

      const composedLocation = [location.streetName, location.wardName, location.districtName, location.regionName]
        .filter(Boolean)
        .join(", ");

      const { data, error } = await withTimeout(
        supabase
          .from("dfp_properties")
          .insert({
            owner_id: user.id,
            name: form.name,
            category: form.category,
            ownership_type: form.ownership_type,
            estimated_value: form.estimated_value ? Number(form.estimated_value) : null,
            location: composedLocation || null,
            description: form.description || null,
          })
          .select("id")
          .single(),
        15000,
        { data: null, error: { message: sw ? "Muunganisho ulichelewa sana. Jaribu tena." : "The connection took too long. Please try again." } } as any
      );
      if (error || !data) {
        setError(error?.message ?? (sw ? "Imeshindikana kuhifadhi mali." : "Could not save the property."));
        return false;
      }
      setCreatedPropertyId(data.id);
      return true;
    } catch (err: any) {
      setError(err?.message ?? (sw ? "Hitilafu isiyotarajiwa. Jaribu tena." : "An unexpected error occurred. Please try again."));
      return false;
    } finally {
      setLoading(false);
    }
  }

  async function uploadFile(file: File) {
    if (!createdPropertyId) return;
    setUploading(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setUploading(false);
      return;
    }
    const path = `${user.id}/${createdPropertyId}/${Date.now()}-${file.name}`;
    const { error: uploadError } = await supabase.storage.from("dfp-documents").upload(path, file);
    if (uploadError) {
      alert(uploadError.message);
      setUploading(false);
      return;
    }
    const { data } = await supabase
      .from("dfp_property_documents")
      .insert({ property_id: createdPropertyId, file_path: path, file_name: file.name, category: docCategory, uploaded_by: user.id })
      .select("id")
      .single();
    setUploading(false);
    if (data) setUploadedDocs((prev) => [...prev, { id: data.id, file_name: file.name }]);
  }

  async function next() {
    stepFields[step].forEach(markTouched);
    if (!canAdvance) return;

    // Create the property the moment the required fields (asset type through value) are
    // complete, so the Documents step has a real property_id to attach uploads to instead
    // of faking a pre-creation upload.
    if (step === 4 && !createdPropertyId) {
      const ok = await createPropertyRecord();
      if (!ok) return;
    }
    setStep((s) => Math.min(s + 1, STEP_LABELS_EN.length - 1));
  }
  function back() {
    setStep((s) => Math.max(s - 1, 0));
  }

  function finish() {
    // Always continue to the next step of the succession-planning flow, regardless of
    // whether this page was reached via the Welcome Wizard or the Property Registry's
    // own "Register Property" button -- the flow should never depend on entry point.
    router.push("/owner/family?onboarding=1");
  }

  const STEP_LABELS = sw ? STEP_LABELS_SW : STEP_LABELS_EN;
  const selectedCategory = PROPERTY_CATEGORIES.find((c) => c.key === form.category);

  return (
    <DashboardShell role="owner">
      <PageNav exitHref="/owner/properties" />
      <h1 className="text-xl font-semibold text-primary mb-6">{sw ? "Sajili Mali" : "Register Property"}</h1>

      <div className="card max-w-2xl">
        <Stepper steps={STEP_LABELS} currentStep={step} />

        {error && (
          <div role="alert" className="bg-white text-red-800 border border-red-800 text-sm px-3 py-2 mb-4">{error}</div>
        )}

        {step === 0 && (
          <div>
            <p className="text-sm text-inkSoft mb-4">{sw ? "Chagua aina ya mali unayosajili." : "Choose the type of asset you're registering."}</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {PROPERTY_CATEGORIES.map((c) => {
                const CatIcon = c.icon;
                return (
                  <button
                    key={c.key}
                    type="button"
                    onClick={() => setForm({ ...form, category: c.key })}
                    className={`flex flex-col items-center gap-2 p-4 border-2 text-center ${
                      form.category === c.key ? "border-primary" : "border-gray-200"
                    }`}
                    style={{ backgroundColor: form.category === c.key ? c.bg : undefined, minHeight: 104 }}
                  >
                    <span
                      className="w-11 h-11 rounded-full flex items-center justify-center"
                      style={{ backgroundColor: form.category === c.key ? "#fff" : c.bg }}
                    >
                      <CatIcon size={22} aria-hidden="true" style={{ color: c.color }} />
                    </span>
                    <span className="text-sm font-medium text-ink">{c.label[lang]}</span>
                  </button>
                );
              })}
            </div>
            {touched.category && fieldErrors.category && (
              <p role="alert" className="text-sm text-danger mt-3">{fieldErrors.category}</p>
            )}
          </div>
        )}

        {step === 1 && (
          <div className="space-y-4">
            <div>
              <label className="label">{sw ? "Jina la Mali" : "Property Name"}</label>
              <input
                required
                className="input-field"
                placeholder={sw ? "mfano: Nyumba ya Familia, Mbezi" : "e.g. Family home, Mbezi"}
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                onBlur={() => markTouched("name")}
                aria-invalid={touched.name && !!fieldErrors.name}
                aria-describedby={touched.name && fieldErrors.name ? "name-error" : undefined}
              />
              {touched.name && fieldErrors.name && (
                <p id="name-error" role="alert" className="text-sm text-danger mt-1">{fieldErrors.name}</p>
              )}
            </div>
            <div>
              <label className="label">{sw ? "Maelezo (hiari)" : "Description (optional)"}</label>
              <textarea className="input-field" rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
          </div>
        )}

        {step === 2 && (
          <LocationPicker
            value={location}
            onChange={setLocation}
            touched={!!(touched.region || touched.location)}
            onBlur={() => {
              markTouched("region");
              markTouched("location");
            }}
          />
        )}

        {step === 3 && (
          <div>
            <label className="label">{sw ? "Aina ya Umiliki" : "Ownership Type"}</label>
            <select className="input-field" value={form.ownership_type} onChange={(e) => setForm({ ...form, ownership_type: e.target.value })}>
              <option value="sole">{sw ? "Umiliki wa Peke Yako" : "Sole Ownership"}</option>
              <option value="joint">{sw ? "Umiliki wa Pamoja" : "Joint Ownership"}</option>
              <option value="family">{sw ? "Umiliki wa Familia" : "Family Ownership"}</option>
              <option value="customary">{sw ? "Umiliki wa Mila" : "Customary Ownership"}</option>
              <option value="leasehold">{sw ? "Upangaji wa Muda Mrefu" : "Leasehold"}</option>
              <option value="other">{sw ? "Nyingine" : "Other"}</option>
            </select>
          </div>
        )}

        {step === 4 && (
          <div>
            <label className="label">{sw ? "Thamani ya Mali (TZS)" : "Estimated Value (TZS)"}</label>
            <input
              type="number"
              required
              min={1}
              className="input-field"
              value={form.estimated_value}
              onChange={(e) => setForm({ ...form, estimated_value: e.target.value })}
              onBlur={() => markTouched("estimated_value")}
              aria-invalid={touched.estimated_value && !!fieldErrors.estimated_value}
              aria-describedby={touched.estimated_value && fieldErrors.estimated_value ? "value-error" : undefined}
            />
            {touched.estimated_value && fieldErrors.estimated_value && (
              <p id="value-error" role="alert" className="text-sm text-danger mt-1">{fieldErrors.estimated_value}</p>
            )}
          </div>
        )}

        {step === 5 && (
          <div className="space-y-3">
            <p className="text-sm text-inkSoft">
              {sw
                ? "Pakia hati zinazothibitisha umiliki (si lazima sasa hivi — unaweza kufanya hivi baadaye pia)."
                : "Upload documents that support your ownership (not required right now — you can also do this later)."}
            </p>
            {uploadedDocs.length > 0 && (
              <ul className="text-sm border border-gray-300 divide-y divide-gray-200">
                {uploadedDocs.map((d) => (
                  <li key={d.id} className="px-3 py-2 text-ink">✓ {d.file_name}</li>
                ))}
              </ul>
            )}
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
              <p className="text-sm text-inkSoft mb-2">{sw ? "Buruta na uachie faili hapa, au" : "Drag & drop a file here, or"}</p>
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

        {step === 6 && (
          <div className="space-y-4">
            <p className="text-sm text-secondary font-medium">
              {sw ? "✓ Mali yako imehifadhiwa kikamilifu." : "✓ Your property has been saved."}
            </p>
            <dl className="text-sm border border-gray-300 divide-y divide-gray-200">
              <div className="flex justify-between px-3 py-2">
                <dt className="text-inkSoft">{sw ? "Aina" : "Asset Type"}</dt>
                <dd className="font-medium text-ink flex items-center gap-1.5">
                  {selectedCategory && <selectedCategory.icon size={14} aria-hidden="true" style={{ color: selectedCategory.color }} />}
                  {selectedCategory ? selectedCategory.label[lang] : "—"}
                </dd>
              </div>
              <div className="flex justify-between px-3 py-2">
                <dt className="text-inkSoft">{sw ? "Jina" : "Name"}</dt>
                <dd className="font-medium text-ink">{form.name || "—"}</dd>
              </div>
              <div className="flex justify-between px-3 py-2">
                <dt className="text-inkSoft">{sw ? "Mahali" : "Location"}</dt>
                <dd className="font-medium text-ink text-right">
                  {[location.streetName, location.wardName, location.districtName, location.regionName].filter(Boolean).join(", ") || "—"}
                </dd>
              </div>
              <div className="flex justify-between px-3 py-2">
                <dt className="text-inkSoft">{sw ? "Umiliki" : "Ownership"}</dt>
                <dd className="font-medium text-ink capitalize">{form.ownership_type}</dd>
              </div>
              <div className="flex justify-between px-3 py-2">
                <dt className="text-inkSoft">{sw ? "Thamani" : "Value"}</dt>
                <dd className="font-medium text-ink">{form.estimated_value ? `TZS ${Number(form.estimated_value).toLocaleString()}` : "—"}</dd>
              </div>
              <div className="flex justify-between px-3 py-2">
                <dt className="text-inkSoft">{sw ? "Hati" : "Documents"}</dt>
                <dd className="font-medium text-ink">{uploadedDocs.length} {sw ? "zilizopakiwa" : "uploaded"}</dd>
              </div>
            </dl>
          </div>
        )}

        <div className="flex items-center justify-between gap-3 mt-6">
          <button type="button" onClick={back} disabled={step === 0} className="btn-outline">
            {sw ? "Nyuma" : "Previous"}
          </button>
          {step < STEP_LABELS.length - 1 ? (
            <button type="button" onClick={next} disabled={loading} className="btn-primary">
              {loading ? (sw ? "Inahifadhi…" : "Saving…") : sw ? "Endelea" : "Continue"}
            </button>
          ) : (
            <button type="button" onClick={finish} className="btn-primary">
              {sw ? "Maliza" : "Done"}
            </button>
          )}
        </div>
      </div>
    </DashboardShell>
  );
}
