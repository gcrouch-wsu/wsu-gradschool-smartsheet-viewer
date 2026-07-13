"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRef } from "react";
import type { ProductNavIcon, ProductNavItem } from "@/lib/product-navigation";

interface ProductNavProps {
  items: ProductNavItem[];
  variant?: "global" | "context";
  label: string;
}

function NavIcon({ name, className = "h-[15px] w-[15px]" }: { name: ProductNavIcon; className?: string }) {
  const paths: Record<ProductNavIcon, React.ReactNode> = {
    dashboard: (
      <>
        <rect x="3" y="3" width="7" height="7" rx="1.3" />
        <rect x="14" y="3" width="7" height="7" rx="1.3" />
        <rect x="3" y="14" width="7" height="7" rx="1.3" />
        <rect x="14" y="14" width="7" height="7" rx="1.3" />
      </>
    ),
    sources: (
      <>
        <ellipse cx="12" cy="5" rx="7" ry="3" />
        <path d="M5 5v10c0 1.7 3.1 3 7 3s7-1.3 7-3V5" />
        <path d="M5 10c0 1.7 3.1 3 7 3s7-1.3 7-3" />
      </>
    ),
    views: (
      <>
        <rect x="4" y="5" width="16" height="14" rx="1.5" />
        <path d="M4 10h16M10 5v14" />
      </>
    ),
    contributors: (
      <>
        <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
      </>
    ),
    forms: (
      <>
        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
        <path d="M14 2v6h6M8 13h8M8 17h8M8 9h2" />
      </>
    ),
    admins: (
      <>
        <path d="M12 3l7 3v5c0 4.3-2.9 7.4-7 9-4.1-1.6-7-4.7-7-9V6l7-3z" />
        <path d="M9.5 12l1.6 1.6 3.5-3.6" />
      </>
    ),
    form: (
      <>
        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
        <path d="M14 2v6h6M8 13h8M8 17h8M8 9h2" />
      </>
    ),
    tracker: (
      <>
        <path d="M9 11l3 3L22 4" />
        <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
      </>
    ),
    grid: (
      <>
        <rect x="3" y="3" width="18" height="18" rx="1.6" />
        <path d="M3 9h18M3 15h18M9 3v18M15 3v18" />
      </>
    ),
    manage: (
      <>
        <path d="M12.22 2h-.44a2 2 0 00-2 2v.18a2 2 0 01-1 1.73l-.43.25a2 2 0 01-2 0l-.15-.08a2 2 0 00-2.73.73l-.22.38a2 2 0 00.73 2.73l.15.1a2 2 0 011 1.72v.5a2 2 0 01-1 1.74l-.15.09a2 2 0 00-.73 2.73l.22.38a2 2 0 002.73.73l.15-.08a2 2 0 012 0l.43.25a2 2 0 011 1.73V20a2 2 0 002 2h.44a2 2 0 002-2v-.18a2 2 0 011-1.73l.43-.25a2 2 0 012 0l.15.08a2 2 0 002.73-.73l.22-.39a2 2 0 00-.73-2.73l-.15-.08a2 2 0 01-1-1.74v-.5a2 2 0 011-1.74l.15-.09a2 2 0 00.73-2.73l-.22-.38a2 2 0 00-2.73-.73l-.15.08a2 2 0 01-2 0l-.43-.25a2 2 0 01-1-1.73V4a2 2 0 00-2-2z" />
        <circle cx="12" cy="12" r="3" />
      </>
    ),
  };
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {paths[name]}
    </svg>
  );
}

function isActive(item: ProductNavItem, pathname: string) {
  if (item.exact) return pathname === item.href || pathname === `${item.href}/`;
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

export function ProductNav({ items, variant = "global", label }: ProductNavProps) {
  const pathname = usePathname();
  const linksRef = useRef<Array<HTMLAnchorElement | null>>([]);
  if (items.length === 0) return null;

  function handleKeyDown(event: React.KeyboardEvent<HTMLAnchorElement>, index: number) {
    let nextIndex: number | null = null;
    if (event.key === "ArrowRight") nextIndex = (index + 1) % items.length;
    if (event.key === "ArrowLeft") nextIndex = (index - 1 + items.length) % items.length;
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = items.length - 1;
    if (nextIndex === null) return;
    event.preventDefault();
    linksRef.current[nextIndex]?.focus();
  }

  const wrapperClass =
    variant === "context"
      ? "flex gap-1 overflow-x-auto border-b border-line px-5 py-2.5 sm:px-8"
      : "flex flex-wrap items-center gap-1";

  return (
    <nav className={wrapperClass} aria-label={label} role="tablist">
      {items.map((item, index) => {
        const active = isActive(item, pathname);
        return (
          <Link
            key={item.href}
            href={item.href}
            ref={(node) => {
              linksRef.current[index] = node;
            }}
            onKeyDown={(event) => handleKeyDown(event, index)}
            role="tab"
            aria-selected={active}
            aria-current={active ? "page" : undefined}
            className={[
              "flex shrink-0 items-center gap-2 rounded-full px-3.5 py-2 text-[13.5px] font-medium transition",
              active
                ? "bg-crimson !text-white shadow-[0_2px_6px_rgba(152,30,50,0.24)]"
                : "text-sub hover:bg-[#f4f0f1] hover:text-ink",
            ].join(" ")}
          >
            {item.icon ? <NavIcon name={item.icon} /> : null}
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
