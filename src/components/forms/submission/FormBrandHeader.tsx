"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { resolveFormsHeaderLogo } from "@/lib/header-logo";

/** Shared content width for institutional logo bars (homepage, guides, auth, student portal). */
export const FORM_BRAND_HEADER_MAX_WIDTH_CLASS = "max-w-[1200px]";

const focusRing =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-crimson";

/** Base styles for header action buttons/links. Combine with outline or solid variants. */
export const FORM_BRAND_HEADER_ACTION_CLASS = [
  "inline-flex min-h-11 items-center justify-center rounded-full px-3.5 py-2 text-sm font-medium transition",
  focusRing,
].join(" ");

export const FORM_BRAND_HEADER_ACTION_OUTLINE_CLASS = [
  FORM_BRAND_HEADER_ACTION_CLASS,
  "border border-[var(--crimson-line)] bg-white text-crimson hover:bg-[var(--crimson-soft)]",
].join(" ");

export const FORM_BRAND_HEADER_ACTION_SOLID_CLASS = [
  FORM_BRAND_HEADER_ACTION_CLASS,
  "border border-crimson bg-crimson text-white shadow-[0_2px_6px_rgba(152,30,50,0.24)] hover:bg-[var(--crimson-deep)]",
].join(" ");

export type FormBrandHeaderProps = {
  /** Optional per-form logo (data URL or http(s) URL). Falls back to the app WSU default. */
  logoDataUrl?: string | null;
  logoAlt?: string | null;
  className?: string;
  /**
   * Constrain the logo bar width. Defaults to the shared institutional width.
   * Use `max-w-none` when the header is embedded inside a card (public forms).
   */
  maxWidthClassName?: string;
  /** Optional controls aligned to the far right of the logo bar (e.g. Admin links). */
  actions?: ReactNode;
  /** Accessible name for the actions group when present. */
  actionsLabel?: string;
};

/**
 * Institutional logo bar: crimson top rule, white bar, WSU logo.
 * Shared across homepage, guides, auth pages, student portal, and public forms.
 */
export function FormBrandHeader({
  logoDataUrl,
  logoAlt,
  className = "",
  maxWidthClassName = FORM_BRAND_HEADER_MAX_WIDTH_CLASS,
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
        className={`mx-auto flex w-full items-center gap-3 px-4 py-3 sm:gap-4 sm:px-7 lg:px-8 ${maxWidthClassName} ${
          actions ? "justify-between" : ""
        }`}
      >
        <Link
          href="/"
          aria-label={`${logo.alt} home`}
          className={`inline-flex shrink-0 rounded-sm ${focusRing}`}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- default WSU CDN or per-form data/remote URL */}
          <img
            src={logo.src}
            alt=""
            className="h-10 w-auto max-w-[min(100%,20rem)] object-contain object-left sm:h-12 sm:max-w-[24rem]"
            decoding="async"
          />
        </Link>
        {actions ? (
          <nav aria-label={actionsLabel} className="flex shrink-0 flex-wrap items-center justify-end gap-2">
            {actions}
          </nav>
        ) : null}
      </div>
    </header>
  );
}
