"use client";

import type { ReactNode } from "react";
import {
  IconColumns,
  IconFile,
  IconGrid,
  IconUsers,
  IconWebhook,
} from "@/components/forms/icons";

export type AdminTab = "forms" | "org" | "webhooks" | "schema" | "platform" | "approvers";

const SECTIONS: { id: AdminTab; label: string; icon: ReactNode }[] = [
  { id: "forms", label: "Forms", icon: <IconFile className="h-3.5 w-3.5" /> },
  { id: "org", label: "Org", icon: <IconGrid className="h-3.5 w-3.5" /> },
  { id: "webhooks", label: "Webhooks", icon: <IconWebhook className="h-3.5 w-3.5" /> },
  { id: "schema", label: "Schema", icon: <IconColumns className="h-3.5 w-3.5" /> },
  { id: "platform", label: "Platform", icon: <IconGrid className="h-3.5 w-3.5" /> },
  { id: "approvers", label: "Approvers", icon: <IconUsers className="h-3.5 w-3.5" /> },
];

interface AdminSectionNavProps {
  active: AdminTab;
  onSelect: (tab: AdminTab) => void;
}

export function AdminSectionNav({ active, onSelect }: AdminSectionNavProps) {
  return (
    <div className="border-b border-[color:var(--wsu-border)] pb-4">
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Admin sections">
        {SECTIONS.map((section) => {
          const isActive = active === section.id;
          return (
            <button
              key={section.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => onSelect(section.id)}
              className={[
                "inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm transition-colors",
                isActive
                  ? "bg-wsu-crimson font-medium text-white"
                  : "font-normal text-[color:var(--wsu-muted)] hover:bg-[color:var(--wsu-stone)] hover:text-[color:var(--wsu-ink)]",
              ].join(" ")}
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
