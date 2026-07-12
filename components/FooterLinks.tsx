"use client";

import Link from "next/link";
import { BookOpen, FileCheck, Lock, LibraryBig } from "lucide-react";
import { useLanguage } from "@/lib/i18n";

export function FooterLinks({ compact = false }: { compact?: boolean }) {
  const { t: tr } = useLanguage();
  const items = [
    { href: "/help", label: tr("help_center"), icon: BookOpen },
    { href: "/handbook", label: tr("handbook"), icon: LibraryBig },
    { href: "/terms", label: tr("terms"), icon: FileCheck },
    { href: "/privacy", label: tr("privacy"), icon: Lock },
  ];
  return (
    <div className={`flex flex-wrap gap-2 ${compact ? "" : "justify-center"}`}>
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            className="inline-flex items-center gap-2 border border-gray-400 text-neutralDark px-4 hover:bg-neutralLight hover:border-primary hover:text-primary transition"
            style={{ minHeight: 44 }}
          >
            <Icon size={16} aria-hidden="true" />
            <span className="text-sm font-medium">{item.label}</span>
          </Link>
        );
      })}
    </div>
  );
}
