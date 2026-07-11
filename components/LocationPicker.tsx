"use client";

import { useEffect, useState } from "react";
import { useLanguage } from "@/lib/i18n";

type Item = { name: string; slug: string };
type StreetItem = { name: string; postcode: string; slug?: string };

export type LocationValue = {
  regionSlug: string;
  regionName: string;
  districtSlug: string;
  districtName: string;
  wardSlug: string;
  wardName: string;
  streetName: string;
};

const EMPTY: LocationValue = {
  regionSlug: "",
  regionName: "",
  districtSlug: "",
  districtName: "",
  wardSlug: "",
  wardName: "",
  streetName: "",
};

export function LocationPicker({
  value,
  onChange,
  touched,
  onBlur,
}: {
  value: LocationValue;
  onChange: (v: LocationValue) => void;
  touched?: boolean;
  onBlur?: () => void;
}) {
  const { lang } = useLanguage();
  const sw = lang === "sw";

  const [regions, setRegions] = useState<Item[]>([]);
  const [districts, setDistricts] = useState<Item[]>([]);
  const [wards, setWards] = useState<Item[]>([]);
  const [streets, setStreets] = useState<StreetItem[]>([]);
  const [loading, setLoading] = useState({ regions: true, districts: false, wards: false, streets: false });

  useEffect(() => {
    fetch("/api/locations/regions")
      .then((r) => r.json())
      .then((d) => setRegions(d.regions ?? []))
      .finally(() => setLoading((l) => ({ ...l, regions: false })));
  }, []);

  useEffect(() => {
    if (!value.regionSlug) {
      setDistricts([]);
      return;
    }
    setLoading((l) => ({ ...l, districts: true }));
    fetch(`/api/locations/districts?region=${value.regionSlug}`)
      .then((r) => r.json())
      .then((d) => setDistricts(d.districts ?? []))
      .finally(() => setLoading((l) => ({ ...l, districts: false })));
  }, [value.regionSlug]);

  useEffect(() => {
    if (!value.regionSlug || !value.districtSlug) {
      setWards([]);
      return;
    }
    setLoading((l) => ({ ...l, wards: true }));
    fetch(`/api/locations/wards?region=${value.regionSlug}&district=${value.districtSlug}`)
      .then((r) => r.json())
      .then((d) => setWards(d.wards ?? []))
      .finally(() => setLoading((l) => ({ ...l, wards: false })));
  }, [value.regionSlug, value.districtSlug]);

  useEffect(() => {
    if (!value.regionSlug || !value.districtSlug || !value.wardSlug) {
      setStreets([]);
      return;
    }
    setLoading((l) => ({ ...l, streets: true }));
    fetch(`/api/locations/streets?region=${value.regionSlug}&district=${value.districtSlug}&ward=${value.wardSlug}`)
      .then((r) => r.json())
      .then((d) => setStreets(d.streets ?? []))
      .finally(() => setLoading((l) => ({ ...l, streets: false })));
  }, [value.regionSlug, value.districtSlug, value.wardSlug]);

  function selectRegion(slug: string) {
    const region = regions.find((r) => r.slug === slug);
    onChange({ ...EMPTY, regionSlug: slug, regionName: region?.name ?? "" });
  }
  function selectDistrict(slug: string) {
    const district = districts.find((d) => d.slug === slug);
    onChange({ ...value, districtSlug: slug, districtName: district?.name ?? "", wardSlug: "", wardName: "", streetName: "" });
  }
  function selectWard(slug: string) {
    const ward = wards.find((w) => w.slug === slug);
    onChange({ ...value, wardSlug: slug, wardName: ward?.name ?? "", streetName: "" });
  }
  function selectStreet(name: string) {
    onChange({ ...value, streetName: name });
  }

  const errors = {
    region: !value.regionSlug ? (sw ? "Tafadhali chagua mkoa" : "Please select a region") : null,
    district: !value.districtSlug ? (sw ? "Tafadhali chagua wilaya" : "Please select a district") : null,
    ward: !value.wardSlug ? (sw ? "Tafadhali chagua kata" : "Please select a ward") : null,
    street: !value.streetName ? (sw ? "Tafadhali chagua kijiji/mtaa" : "Please select a village/street") : null,
  };

  return (
    <div className="space-y-4" onBlur={onBlur}>
      <div>
        <label className="label" htmlFor="region-select">{sw ? "Mkoa" : "Region"}</label>
        <select
          id="region-select"
          className="input-field"
          value={value.regionSlug}
          onChange={(e) => selectRegion(e.target.value)}
          aria-required="true"
          aria-invalid={!!(touched && errors.region)}
          aria-describedby={touched && errors.region ? "region-error" : undefined}
        >
          <option value="">{loading.regions ? (sw ? "Inapakia…" : "Loading…") : sw ? "Chagua Mkoa" : "Select Region"}</option>
          {regions.map((r) => (
            <option key={r.slug} value={r.slug}>{r.name}</option>
          ))}
        </select>
        {touched && errors.region && <p id="region-error" role="alert" className="text-sm text-danger mt-1">{errors.region}</p>}
      </div>

      <div>
        <label className="label" htmlFor="district-select">{sw ? "Wilaya" : "District"}</label>
        <select
          id="district-select"
          className="input-field disabled:bg-gray-100 disabled:cursor-not-allowed"
          value={value.districtSlug}
          onChange={(e) => selectDistrict(e.target.value)}
          disabled={!value.regionSlug}
          aria-required="true"
          aria-invalid={!!(touched && errors.district)}
          aria-describedby={touched && errors.district ? "district-error" : undefined}
        >
          <option value="">
            {!value.regionSlug ? (sw ? "Chagua mkoa kwanza" : "Select a region first") : loading.districts ? (sw ? "Inapakia…" : "Loading…") : sw ? "Chagua Wilaya" : "Select District"}
          </option>
          {districts.map((d) => (
            <option key={d.slug} value={d.slug}>{d.name}</option>
          ))}
        </select>
        {touched && errors.district && <p id="district-error" role="alert" className="text-sm text-danger mt-1">{errors.district}</p>}
      </div>

      <div>
        <label className="label" htmlFor="ward-select">{sw ? "Kata" : "Ward"}</label>
        <select
          id="ward-select"
          className="input-field disabled:bg-gray-100 disabled:cursor-not-allowed"
          value={value.wardSlug}
          onChange={(e) => selectWard(e.target.value)}
          disabled={!value.districtSlug}
          aria-required="true"
          aria-invalid={!!(touched && errors.ward)}
          aria-describedby={touched && errors.ward ? "ward-error" : undefined}
        >
          <option value="">
            {!value.districtSlug ? (sw ? "Chagua wilaya kwanza" : "Select a district first") : loading.wards ? (sw ? "Inapakia…" : "Loading…") : sw ? "Chagua Kata" : "Select Ward"}
          </option>
          {wards.map((w) => (
            <option key={w.slug} value={w.slug}>{w.name}</option>
          ))}
        </select>
        {touched && errors.ward && <p id="ward-error" role="alert" className="text-sm text-danger mt-1">{errors.ward}</p>}
      </div>

      <div>
        <label className="label" htmlFor="street-select">{sw ? "Kijiji/Mtaa" : "Village/Street"}</label>
        <select
          id="street-select"
          className="input-field disabled:bg-gray-100 disabled:cursor-not-allowed"
          value={value.streetName}
          onChange={(e) => selectStreet(e.target.value)}
          disabled={!value.wardSlug}
          aria-required="true"
          aria-invalid={!!(touched && errors.street)}
          aria-describedby={touched && errors.street ? "street-error" : undefined}
        >
          <option value="">
            {!value.wardSlug ? (sw ? "Chagua kata kwanza" : "Select a ward first") : loading.streets ? (sw ? "Inapakia…" : "Loading…") : sw ? "Chagua Kijiji/Mtaa" : "Select Village/Street"}
          </option>
          {streets.map((s) => (
            <option key={`${s.name}-${s.postcode}`} value={s.name}>{s.name}{s.postcode ? ` (${s.postcode})` : ""}</option>
          ))}
        </select>
        {touched && errors.street && <p id="street-error" role="alert" className="text-sm text-danger mt-1">{errors.street}</p>}
      </div>
    </div>
  );
}

export { EMPTY as EMPTY_LOCATION };
