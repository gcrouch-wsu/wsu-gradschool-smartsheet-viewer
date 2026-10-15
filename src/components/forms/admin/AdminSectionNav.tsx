"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { IconFile } from "@/components/forms/icons";

function pillClass(isActive: boolean) {
  return [
    "inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm transition-colors",
    isActive
      ? "bg-wsu-crimson font-medium text-white"
      : "font-normal text-[color:var(--wsu-muted)] hover:bg-[color:var(--wsu-stone)] hover:text-[color:var(--wsu-ink)]",
  ].join(" ");
}

/** Minimal nav for leftover Forms workspace pages — catalog lives under Admin Sources. */
export function AdminSectionNav() {
  const pathname = usePathname();
  const isSources = pathname.startsWith("/admin/sources");

  return (
    <div className="border-b border-[color:var(--wsu-border)] pb-4">
      <div className="flex flex-wrap gap-2" role="navigation" aria-label="Admin sections">
        <Link
          href="/admin/sources"
          className={pillClass(isSources)}
          aria-current={isSources ? "page" : undefined}
        >
          <IconFile className="h-3.5 w-3.5" />
          Sources
        </Link>
      </div>
    </div>
  );
}
