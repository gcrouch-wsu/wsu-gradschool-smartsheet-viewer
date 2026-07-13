"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ProductNavItem } from "@/lib/product-navigation";

interface ProductNavProps {
  items: ProductNavItem[];
  variant?: "global" | "context";
  label: string;
}

function isActive(item: ProductNavItem, pathname: string) {
  if (item.exact) return pathname === item.href || pathname === `${item.href}/`;
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

export function ProductNav({ items, variant = "global", label }: ProductNavProps) {
  const pathname = usePathname();
  if (items.length === 0) return null;

  if (variant === "context") {
    return (
      <nav className="flex gap-6 overflow-x-auto border-b border-[color:var(--wsu-border)] px-5 sm:px-6" aria-label={label}>
        {items.map((item) => {
          const active = isActive(item, pathname);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={[
                "shrink-0 border-b-2 py-3 text-sm transition-colors",
                active
                  ? "border-wsu-crimson font-medium text-[color:var(--wsu-ink)]"
                  : "border-transparent text-[color:var(--wsu-muted)] hover:text-[color:var(--wsu-ink)]",
              ].join(" ")}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    );
  }

  return (
    <nav className="flex flex-wrap gap-2" aria-label={label}>
      {items.map((item) => {
        const active = isActive(item, pathname);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={[
              "rounded-full border px-4 py-2 text-sm font-medium transition-colors",
              active
                ? "border-wsu-crimson bg-wsu-crimson text-white"
                : "border-[color:var(--wsu-border)] bg-white text-[color:var(--wsu-muted)] hover:border-wsu-crimson hover:text-wsu-crimson",
            ].join(" ")}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
