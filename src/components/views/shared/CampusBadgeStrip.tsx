import { campusChipInlineStyle } from "@/lib/campus-chip-inline-style";
import type { CampusBadgePresentationStyle } from "@/lib/config/types";

/** Campus labels for program group headers (and filter chip styling alignment). */
export function CampusBadgeStrip({
  campuses,
  className = "",
  badgeStyle,
}: {
  campuses: string[];
  className?: string;
  badgeStyle?: CampusBadgePresentationStyle;
}) {
  if (campuses.length === 0) {
    return null;
  }
  const chipInline = campusChipInlineStyle(badgeStyle);
  const defaultChipClass =
    "rounded-full border border-[color:var(--wsu-border)] bg-[color:var(--wsu-stone)]/40 px-2.5 py-0.5 text-xs font-medium text-[color:var(--wsu-ink)]";
  // Keep pill baseline when any custom style is set; inline borderRadius overrides rounded-full when provided.
  const chipClass = chipInline
    ? "rounded-full border px-2.5 py-0.5 font-medium leading-normal text-[color:var(--wsu-ink)]"
    : defaultChipClass;

  return (
    <div className={`mt-2 flex flex-wrap gap-1.5 ${className}`} aria-label="Campuses for this program">
      {campuses.map((c) => (
        <span key={c} className={chipClass} style={chipInline}>
          {c}
        </span>
      ))}
    </div>
  );
}
