"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import DashboardShell from "@/components/DashboardShell";
import { PageNav } from "@/components/PageNav";
import { Stepper } from "@/components/Stepper";
import { LocationPicker, EMPTY_LOCATION, type LocationValue } from "@/components/LocationPicker";
import { createClient } from "@/lib/supabase/client";
import { useLanguage } from "@/lib/i18n";

const CATEGORIES = [
  "land", "house", "farm", "vehicle", "business", "livestock", "bank_account", "investment", "other",
];

const STEP_LABELS_SW = ["Taarifa za Mali", "Mahali Ilipo", "Thamani", "Pitia na Thibitisha"];
const STEP_LABELS_EN = ["Property Info", "Location", "Value", "Review & Confirm"];

export default function NewPropertyPage() {
  const supabase = createClient();
  const router = useRouter();
  const { lang } = useLanguage();
  const sw = lang === "sw";

  const [step, setStep] = useState(0);
  const [form, setForm] = useState({
    name: "",
    category: "land",
    description: "",
    ownership_type: "sole",
    estimated_value: "",
  });
  const [location, setLocation] = useState<LocationValue>(EMPTY_LOCATION);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function markTouched(field: string) {
    setTouched((t) => ({ ...t, [field]: true }));
  }

  const fieldErrors: Record<string, string> = {};
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
  if (form.estimated_value && Number.isNaN(Number(form.estimated_value))) {
    fieldErrors.estimated_value = sw ? "Tafadhali ingiza namba sahihi" : "Please enter a valid number";
  }

  const stepFields: string[][] = [["name"], ["region", "location"], ["estimated_value"], []];
  const canAdvance = stepFields[step].every((f) => !fieldErrors[f]);

  function next() {
    stepFields[step].forEach(markTouched);
    if (!canAdvance) return;
    setStep((s) => Math.min(s + 1, STEP_LABELS_EN.length - 1));
  }
  function back() {
    setStep((s) => Math.max(s - 1, 0));
  }

  async function handleSubmit() {
    setLoading(true);
    setError(null);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const composedLocation = [location.streetName, location.wardName, location.districtName, location.regionName]
      .filter(Boolean)
      .join(", ");

    const { error } = await supabase.from("dfp_properties").insert({
      owner_id: user.id,
      name: form.name,
      category: form.category,
      ownership_type: form.ownership_type,
      estimated_value: form.estimated_value ? Number(form.estimated_value) : null,
      location: composedLocation || null,
      description: form.description || null,
    });
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    router.push("/owner/properties");
  }

  const STEP_LABELS = sw ? STEP_LABELS_SW : STEP_LABELS_EN;

  return (
    <DashboardShell role="owner">
      <PageNav exitHref="/owner/properties" />
      <h1 className="text-xl font-semibold text-primary mb-6">{sw ? "Sajili Mali" : "Register Property"}</h1>

      <div className="card max-w-xl">
        <Stepper steps={STEP_LABELS} currentStep={step} />

        {error && (
          <div role="alert" className="bg-white text-red-800 border border-red-800 text-sm px-3 py-2 mb-4">{error}</div>
        )}

        {step === 0 && (
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
              <label className="label">{sw ? "Aina ya Mali" : "Property Category"}</label>
              <select className="input-field" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c.replace("_", " ")}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">{sw ? "Maelezo (hiari)" : "Description (optional)"}</label>
              <textarea className="input-field" rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-4">
            <LocationPicker
              value={location}
              onChange={setLocation}
              touched={!!(touched.region || touched.location)}
              onBlur={() => {
                markTouched("region");
                markTouched("location");
              }}
            />
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
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <div>
              <label className="label">{sw ? "Thamani ya Mali (TZS)" : "Estimated Value (TZS)"}</label>
              <input
                type="number"
                min={0}
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
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <p className="text-sm text-inkSoft">
              {sw
                ? "Baada ya kuhifadhi, unaweza kupakia nyaraka za umiliki (hati, cheti, picha) kwenye Sajili ya Mali."
                : "After saving, you can upload supporting documents (title deed, certificate, photos) from the Property Registry."}
            </p>
            <dl className="text-sm border border-gray-300 divide-y divide-gray-200">
              <div className="flex justify-between px-3 py-2">
                <dt className="text-inkSoft">{sw ? "Jina" : "Name"}</dt>
                <dd className="font-medium text-ink">{form.name || "—"}</dd>
              </div>
              <div className="flex justify-between px-3 py-2">
                <dt className="text-inkSoft">{sw ? "Aina" : "Category"}</dt>
                <dd className="font-medium text-ink capitalize">{form.category.replace("_", " ")}</dd>
              </div>
              <div className="flex justify-between px-3 py-2">
                <dt className="text-inkSoft">{sw ? "Mahali" : "Location"}</dt>
                <dd className="font-medium text-ink text-right">
                  {[location.streetName, location.wardName, location.districtName, location.regionName].filter(Boolean).join(", ") || "—"}
                </dd>
              </div>
              <div className="flex justify-between px-3 py-2">
                <dt className="text-inkSoft">{sw ? "Thamani" : "Value"}</dt>
                <dd className="font-medium text-ink">{form.estimated_value ? Number(form.estimated_value).toLocaleString() : "—"}</dd>
              </div>
            </dl>
          </div>
        )}

        <div className="flex items-center justify-between gap-3 mt-6">
          <button type="button" onClick={back} disabled={step === 0} className="btn-outline">
            {sw ? "Nyuma" : "Previous"}
          </button>
          {step < STEP_LABELS.length - 1 ? (
            <button type="button" onClick={next} className="btn-primary">
              {sw ? "Endelea" : "Continue"}
            </button>
          ) : (
            <button type="button" onClick={handleSubmit} disabled={loading} className="btn-primary">
              {loading ? (sw ? "Inahifadhi…" : "Saving…") : sw ? "Hifadhi na Sajili" : "Save Property"}
            </button>
          )}
        </div>
      </div>
    </DashboardShell>
  );
}
