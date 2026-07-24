"use client";

import type { ReactNode } from "react";
import { resolveFormsHeaderLogo } from "@/lib/header-logo";

export type FormBrandHeaderProps = {
  /** Optional per-form logo (data URL or http(s) URL). Falls back to the app WSU default. */
  logoDataUrl?: string | null;
  logoAlt?: string | null;
  className?: string;
  /** Constrain width to match the form card. */
  maxWidthClassName?: string;
  /** Optional controls aligned to the far right of the logo bar (e.g. Admin links). */
  actions?: ReactNode;
  /** Accessible name for the actions group when present. */
  actionsLabel?: string;
};

/**
 * Institutional form header: crimson top rule, white bar, WSU logo.
 * Uses the official WSU horizontal lockup by default for every form.
 */
export function FormBrandHeader({
  logoDataUrl,
  logoAlt,
  className = "",
  maxWidthClassName = "max-w-7xl",
  actions,
  actionsLabel = "Admin",
}: FormBrandHeaderProps) {
  const logo = resolveFormsHeaderLogo(logoDataUrl, logoAlt);

  return (
    <header
      className={[
        "border-b border-[color:var(--wsu-border)] bg-white",
        "border-t-[3px] border-t-wsu-crimson",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div
        className={`mx-auto flex w-full items-center gap-3 px-4 py-3 sm:gap-4 sm:px-6 ${maxWidthClassName} ${
          actions ? "justify-between" : ""
        }`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- default WSU CDN or per-form data/remote URL */}
        <img
          src={logo.src}
          alt={logo.alt}
          className="h-10 w-auto max-w-[min(100%,20rem)] object-contain object-left sm:h-12 sm:max-w-[24rem]"
          decoding="async"
        />
        {actions ? (
          <nav aria-label={actionsLabel} className="flex shrink-0 flex-wrap items-center justify-end gap-2">
            {actions}
          </nav>
        ) : null}
      </div>
    </header>
  );
}
