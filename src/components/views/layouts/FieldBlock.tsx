import { FieldValue } from "@/components/views/layouts/FieldValue";
import type { ResolvedFieldValue } from "@/lib/config/types";
import { fieldLabelClassName } from "@/lib/field-typography";

export type FieldBlockOuterOptions = {
  /** Parent uses CSS Grid with row gap (not margin-based `space-y-*`). Negative margin tucks hide-label fields up. */
  inCssGrid?: boolean;
};

/**
 * Outer wrapper classes for a labeled field block. When the label is hidden (continuation lines like
 * email under a contact name), pull the block up so parent `space-y-*` or grid `gap-*` does not leave a large gap.
 */
export function fieldBlockOuterClassName(
  field: ResolvedFieldValue,
  compact?: boolean,
  opts?: FieldBlockOuterOptions,
): string {
  const gapClass = compact ? "space-y-0.5" : "space-y-1";
  if (!field.hideLabel) {
    return gapClass;
  }
  if (opts?.inCssGrid) {
    return `${gapClass} -mt-2 sm:-mt-2.5 md:-mt-3`;
  }
  return `${gapClass} !mt-1`;
}

export function FieldBlock({
  field,
  compact,
  inCssGrid,
}: {
  field: ResolvedFieldValue;
  /** Tighter label/value spacing for stacked and card layouts. */
  compact?: boolean;
  inCssGrid?: boolean;
}) {
  const labelExtra = compact ? "leading-tight" : "";
  return (
    <div className={fieldBlockOuterClassName(field, compact, { inCssGrid })}>
      {!field.hideLabel && (
        <p className={fieldLabelClassName(field, labelExtra)}>{field.label}</p>
      )}
      <FieldValue field={field} stacked />
    </div>
  );
}
