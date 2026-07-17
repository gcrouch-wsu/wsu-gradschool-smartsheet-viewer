"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  IconFile,
  IconGrid,
  IconLayers,
  IconPencil,
  IconTracker,
  IconUsers,
  IconWebhook,
} from "@/components/forms/icons";

export type AdminTab = "forms" | "org" | "webhooks" | "approvers";

type NavItem =
  | { kind: "tab"; id: AdminTab; label: string; icon: ReactNode }
  | { kind: "link"; href: string; label: string; icon: ReactNode };

const SECTIONS: NavItem[] = [
  { kind: "tab", id: "forms", label: "Forms", icon: <IconFile className="h-3.5 w-3.5" /> },
  { kind: "tab", id: "org", label: "Org", icon: <IconLayers className="h-3.5 w-3.5" /> },
  { kind: "tab", id: "webhooks", label: "Webhooks", icon: <IconWebhook className="h-3.5 w-3.5" /> },
  { kind: "link", href: "/forms/tracker", label: "Tracker", icon: <IconTracker className="h-3.5 w-3.5" /> },
  { kind: "link", href: "/forms/sheet", label: "Grid", icon: <IconGrid className="h-3.5 w-3.5" /> },
  { kind: "link", href: "/forms/builder", label: "Builder", icon: <IconPencil className="h-3.5 w-3.5" /> },
  { kind: "tab", id: "approvers", label: "Approvers", icon: <IconUsers className="h-3.5 w-3.5" /> },
];

function pillClass(isActive: boolean) {
  return [
    "inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm transition-colors",
    isActive
      ? "bg-wsu-crimson font-medium text-white"
      : "font-normal text-[color:var(--wsu-muted)] hover:bg-[color:var(--wsu-stone)] hover:text-[color:var(--wsu-ink)]",
  ].join(" ");
}

interface AdminSectionNavProps {
  active: AdminTab;
  onSelect: (tab: AdminTab) => void;
}

export function AdminSectionNav({ active, onSelect }: AdminSectionNavProps) {
  const pathname = usePathname();

  return (
    <div className="border-b border-[color:var(--wsu-border)] pb-4">
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Admin sections">
        {SECTIONS.map((section) => {
          if (section.kind === "link") {
            const isActive = pathname === section.href || pathname.startsWith(`${section.href}/`);
            return (
              <Link
                key={section.href}
                href={section.href}
                className={pillClass(isActive)}
                aria-current={isActive ? "page" : undefined}
              >
                {section.icon}
                {section.label}
              </Link>
            );
          }

          const isActive = active === section.id;
          return (
            <button
              key={section.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => onSelect(section.id)}
              className={pillClass(isActive)}
            >
              {section.icon}
              {section.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
