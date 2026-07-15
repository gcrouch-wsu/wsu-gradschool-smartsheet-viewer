"use client";

import {
  isHtmlContent,
  isRichTextEmpty,
  richTextPlainText,
  sanitizeRichTextHtml,
} from "@/lib/rendering";

/**
 * Render form presentation / layout text. Supports TipTap HTML (sanitized) and legacy plain text.
 */
export function RichTextHtml({
  value,
  className,
  as = "div",
  fallback,
}: {
  value: string | undefined | null;
  className?: string;
  as?: "div" | "h1" | "h2" | "p";
  /** Shown when value is empty (plain fallback only). */
  fallback?: string;
}) {
  const raw = value?.trim() || "";
  const empty = isRichTextEmpty(raw);
  const display = empty ? (fallback ?? "") : raw;
  if (!display) return null;

  const Tag = as;
  const classes = ["form-rich-text", className].filter(Boolean).join(" ");

  if (isHtmlContent(display)) {
    // TipTap stores paragraphs; avoid nesting <p> inside <h1>/<h2>.
    return (
      <div
        className={classes}
        role={as === "h1" || as === "h2" ? "heading" : undefined}
        aria-level={as === "h1" ? 1 : as === "h2" ? 2 : undefined}
        dangerouslySetInnerHTML={{ __html: sanitizeRichTextHtml(display) }}
      />
    );
  }

  return <Tag className={className}>{richTextPlainText(display) || display}</Tag>;
}
