"use client";

import Link from "next/link";
import { HelpCircle, type LucideIcon } from "lucide-react";

export function EmptyState({
  icon: Icon,
  title,
  description,
  examples,
  action,
  helpHref,
  helpLabel,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  examples?: string[];
  action?: { label: string; href: string } | { label: string; onClick: () => void } | { label: string; disabledReason: string };
  helpHref?: string;
  helpLabel?: string;
}) {
  return (
    <div className="empty-state">
      <Icon size={64} strokeWidth={1.5} aria-hidden="true" className="empty-state-icon" />
      <p className="empty-state-title">{title}</p>
      <p className="empty-state-desc">{description}</p>
      {examples && examples.length > 0 && (
        <p className="empty-state-examples">
          {examples.join(" · ")}
        </p>
      )}
      {action &&
        ("href" in action ? (
          <Link href={action.href} className="btn-primary">
            {action.label}
          </Link>
        ) : "onClick" in action ? (
          <button type="button" onClick={action.onClick} className="btn-primary">
            {action.label}
          </button>
        ) : (
          <p className="text-sm text-inkSoft italic">{action.disabledReason}</p>
        ))}
      {helpHref && (
        <div className="mt-4">
          <Link
            href={helpHref}
            className="inline-flex items-center gap-2 border border-primary text-primary font-medium text-sm px-4"
            style={{ minHeight: 44 }}
          >
            <HelpCircle size={16} aria-hidden="true" />
            {helpLabel}
          </Link>
        </div>
      )}
    </div>
  );
}
