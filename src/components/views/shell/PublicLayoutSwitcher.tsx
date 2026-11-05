"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import type { LayoutType } from "@/lib/config/types";

export function PublicLayoutSwitcher({
  layout,
  options,
}: {
  layout: LayoutType;
  options: { id: LayoutType; label: string; href: string }[];
}) {
  const navRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const nav = navRef.current;
    const active = nav?.querySelector<HTMLElement>('[aria-current="page"]');
    if (!nav || !active) return;

    const navRect = nav.getBoundingClientRect();
    const activeRect = active.getBoundingClientRect();
    if (activeRect.left < navRect.left) {
      nav.scrollLeft -= navRect.left - activeRect.left + 8;
    } else if (activeRect.right > navRect.right) {
      nav.scrollLeft += activeRect.right - navRect.right + 8;
    }
  }, [layout]);

  return (
    <nav
      ref={navRef}
      aria-label="Layout"
      className="view-control-group view-control-group--layouts"
      data-tour="pv-layouts"
    >
      {options.map((option) => {
        const active = option.id === layout;
        return (
          <Link
            key={option.id}
            href={option.href}
            aria-current={active ? "page" : undefined}
            className={active ? "view-control-active" : "view-control"}
          >
            {option.label}
          </Link>
        );
      })}
    </nav>
  );
}
