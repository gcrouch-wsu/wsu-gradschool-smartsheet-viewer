"use client";

import { resolveFormsHeaderLogo } from "@/lib/header-logo";

export type FormBrandHeaderProps = {
  /** Optional per-form logo (data URL or http(s) URL). Falls back to the app WSU default. */
  logoDataUrl?: string | null;
  logoAlt?: string | null;
  className?: string;
  /** Constrain width to match the form card. */
  maxWidthClassName?: string;
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
      <div className={`mx-auto flex w-full items-center px-4 py-3 sm:px-6 ${maxWidthClassName}`}>
        {/* eslint-disable-next-line @next/next/no-img-element -- default WSU CDN or per-form data/remote URL */}
        <img
          src={logo.src}
          alt={logo.alt}
          className="h-10 w-auto max-w-[min(100%,20rem)] object-contain object-left sm:h-12 sm:max-w-[24rem]"
          decoding="async"
        />
      </div>
    </header>
  );
}
