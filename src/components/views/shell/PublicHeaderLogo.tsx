import type { ViewPresentationConfig } from "@/lib/config/types";

/** Accessible header logo for public view and admin previews. */
export function PublicHeaderLogo({
  presentation,
  className = "",
}: {
  presentation?: ViewPresentationConfig;
  /** Optional extra classes on the wrapper */
  className?: string;
}) {
  if (!presentation?.headerLogoDataUrl || presentation.hideHeaderLogo || !presentation.headerLogoAlt?.trim()) {
    return null;
  }

  return (
    <div className={`shrink-0 ${className}`.trim()}>
      {/* Data URL from admin config; Next/Image remote patterns do not cover inline data. */}
      {/* eslint-disable-next-line @next/next/no-img-element -- dynamic base64/URL from view config */}
      <img
        src={presentation.headerLogoDataUrl}
        alt={presentation.headerLogoAlt}
        className="h-16 max-h-20 w-auto max-w-[min(100%,14rem)] object-contain object-left sm:h-20"
        decoding="async"
      />
    </div>
  );
}
