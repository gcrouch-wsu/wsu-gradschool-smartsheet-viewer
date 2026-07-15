import type { ViewPresentationConfig } from "@/lib/config/types";
import { PublicHeaderLogo } from "@/components/views/shell/PublicHeaderLogo";

/**
 * Optional brand row: logo + vertical rule + organization line + title (e.g. WSU + unit name).
 * Shown when logo is visible and/or brand text lines are set.
 */
export function PublicHeaderBrandStrip({
  presentation,
}: {
  presentation?: ViewPresentationConfig;
}) {
  const showLogo = Boolean(
    presentation?.headerLogoDataUrl && !presentation.hideHeaderLogo && presentation.headerLogoAlt?.trim(),
  );
  const subline = presentation?.headerBrandSubline?.trim();
  const title = presentation?.headerBrandTitle?.trim();
  const showText = Boolean(subline || title);

  if (!showLogo && !showText) {
    return null;
  }

  return (
    <div className="view-header-brand-strip-top pt-4">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
        {showLogo && <PublicHeaderLogo presentation={presentation} />}
        {showText && (
          <div
            className={
              showLogo
                ? "min-w-0 border-[color:var(--wsu-border)] sm:border-l sm:pl-5"
                : "min-w-0"
            }
          >
            {subline ? <p className="view-header-brand-subline">{subline}</p> : null}
            {title ? (
              <p className={`view-header-brand-title${subline ? " mt-1" : ""}`}>{title}</p>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
