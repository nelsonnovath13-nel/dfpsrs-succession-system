"use client";

import { useLanguage } from "@/lib/i18n";

export function StatCard({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="card">
      <p className="text-3xl font-bold text-primary leading-tight">{value}</p>
      <p className="text-xs text-neutralDark uppercase tracking-wide mt-1">{label}</p>
    </div>
  );
}

const STATUS_STYLES: Record<string, string> = {
  draft: "bg-gray-100 text-neutralDark border-gray-400",
  submitted: "bg-white text-primary border-primary",
  witness_review: "bg-white text-amber-800 border-amber-700",
  local_leader_review: "bg-white text-amber-800 border-amber-700",
  legal_review: "bg-white text-amber-800 border-amber-700",
  verified: "bg-white text-secondary border-secondary",
  rejected: "bg-white text-red-800 border-red-800",
  archived: "bg-gray-100 text-neutralDark border-gray-400",
  pending: "bg-white text-amber-800 border-amber-700",
  approved: "bg-white text-secondary border-secondary",
  accepted: "bg-white text-secondary border-secondary",
  declined: "bg-white text-red-800 border-red-800",
  reported_deceased: "bg-white text-amber-800 border-amber-700",
  certificate_uploaded: "bg-white text-amber-800 border-amber-700",
  witness_confirmed: "bg-white text-amber-800 border-amber-700",
  leader_confirmed: "bg-white text-amber-800 border-amber-700",
  legal_reviewed: "bg-white text-amber-800 border-amber-700",
  confirmed: "bg-white text-secondary border-secondary",
  released: "bg-white text-secondary border-secondary",
  active: "bg-white text-secondary border-secondary",
  revoked: "bg-gray-100 text-neutralDark border-gray-400",
  open: "bg-white text-amber-800 border-amber-700",
  under_review: "bg-white text-amber-800 border-amber-700",
  mediation: "bg-white text-amber-800 border-amber-700",
  resolved: "bg-white text-secondary border-secondary",
  closed: "bg-gray-100 text-neutralDark border-gray-400",
};

const STATUS_KEY: Record<string, string> = {
  draft: "status_draft",
  submitted: "status_submitted",
  witness_review: "status_witness_review",
  local_leader_review: "status_local_leader_review",
  legal_review: "status_legal_review",
  verified: "status_verified",
  rejected: "status_rejected",
  archived: "status_archived",
  pending: "status_pending",
  approved: "status_approved",
  accepted: "status_accepted",
  declined: "status_declined",
  reported_deceased: "status_reported_deceased",
  certificate_uploaded: "status_certificate_uploaded",
  witness_confirmed: "status_witness_confirmed",
  leader_confirmed: "status_leader_confirmed",
  legal_reviewed: "status_legal_reviewed",
  confirmed: "status_confirmed",
  released: "status_released",
  active: "status_active",
  revoked: "status_revoked",
  open: "status_open",
  under_review: "status_under_review",
  mediation: "status_mediation",
  resolved: "status_resolved",
  closed: "status_closed",
};

export function StatusBadge({ status }: { status: string }) {
  const { t: tr } = useLanguage();
  return (
    <span className={`badge ${STATUS_STYLES[status] ?? "bg-gray-100 text-neutralDark border-gray-400"}`}>
      {tr(STATUS_KEY[status] ?? status)}
    </span>
  );
}

const STEPS = [
  { key: "draft", labelKey: "status_draft" },
  { key: "report_generated", labelKey: "status_report_generated" },
  { key: "submitted", labelKey: "status_submitted" },
  { key: "witness_review", labelKey: "status_witness_review" },
  { key: "local_leader_review", labelKey: "status_local_leader_review" },
  { key: "legal_review", labelKey: "status_legal_review" },
  { key: "verified", labelKey: "status_verified" },
];

// The "report_generated" step is virtual -- it is not a real dfp_succession_records.status
// value (report generation happens while status is still "draft"), so its position must be
// derived separately from the report_generated_at flag rather than matched by status string.
export function VerificationTimeline({ status, reportGenerated }: { status: string; reportGenerated?: boolean }) {
  const { t: tr } = useLanguage();
  if (status === "rejected") {
    return (
      <div className="text-sm text-red-800 bg-white border border-red-800 px-3 py-2">
        {tr("status_rejected")}
      </div>
    );
  }
  // legal_review only applies to records with a legal officer assigned; when absent,
  // the record skips straight from local_leader_review to verified.
  const realIndex = STEPS.findIndex((s) => s.key === status);
  const currentIndex = status === "draft" && reportGenerated ? 1 : realIndex < 0 ? 0 : realIndex;
  return (
    <div className="flex items-center w-full">
      {STEPS.map((step, i) => {
        const done = i < currentIndex || status === "verified";
        const active = i === currentIndex && status !== "verified";
        return (
          <div key={step.key} className="flex items-center flex-1 last:flex-none">
            <div className="flex flex-col items-center">
              <div
                className={`h-6 w-6 flex items-center justify-center text-xs font-semibold border-2 ${
                  done
                    ? "bg-secondary text-white border-secondary"
                    : active
                    ? "bg-primary text-white border-primary"
                    : "bg-white text-neutralDark border-gray-400"
                }`}
              >
                {done ? "✓" : i + 1}
              </div>
              <span className="text-[10px] text-neutralDark mt-1 text-center w-16">{tr(step.labelKey)}</span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={`flex-1 h-0.5 mx-1 ${done ? "bg-secondary" : "bg-gray-300"}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}
