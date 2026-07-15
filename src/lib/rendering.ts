import sanitizeHtml from "sanitize-html";

const ALLOWED_TAGS = ["p", "br", "strong", "em", "s", "a", "span", "h1", "h2", "h3", "ul", "ol", "li", "u"];
const ALLOWED_ATTR: Record<string, string[]> = {
  a: ["href", "target", "rel", "class"],
  p: ["class", "style"],
  span: ["class", "style"],
  h1: ["class", "style"],
  h2: ["class", "style"],
  h3: ["class", "style"],
  ul: ["class", "style"],
  ol: ["class", "style"],
  li: ["class", "style"],
  strong: ["class"],
  em: ["class"],
  s: ["class"],
  u: ["class"],
};

/**
 * Safely render the custom header text with {{PUBLIC_URL}} replacement.
 * Uses sanitize-html (no jsdom) to avoid ESM/CommonJS issues on Vercel.
 */
export function renderHeaderCustomText(html: string, publicUrl: string): string {
  const isSafeProtocol =
    publicUrl.startsWith("http://") || publicUrl.startsWith("https://") || publicUrl.startsWith("/");

  if (!isSafeProtocol) {
    return sanitizeHtml(html, { allowedTags: ALLOWED_TAGS, allowedAttributes: ALLOWED_ATTR });
  }

  const randomSuffix = Math.random().toString(36).slice(2, 10);
  const tempPlaceholder = `___PUBLIC_URL_LINK_${Date.now()}_${randomSuffix}___`;
  const withTemp = html.replace(/\{\{PUBLIC_URL\}\}/g, tempPlaceholder);

  const sanitized = sanitizeHtml(withTemp, {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: ALLOWED_ATTR,
    transformTags: {
      a: (tagName, attribs) => {
        const href = attribs.href || "";
        const lower = href.toLowerCase();
        if (
          lower.startsWith("javascript:") ||
          lower.startsWith("data:") ||
          lower.startsWith("vbscript:")
        ) {
          delete attribs.href;
        }
        return {
          tagName: "a",
          attribs: {
            ...attribs,
            target: "_blank",
            rel: "noopener noreferrer",
          },
        };
      },
    },
  });

  const safeHref = publicUrl
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  const safeText = publicUrl.replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const finalLink = `<a href="${safeHref}" target="_blank" rel="noopener noreferrer" class="custom-header-link cursor-pointer relative z-[1] text-[color:var(--wsu-crimson)] underline hover:text-[color:var(--wsu-crimson-dark)]">${safeText}</a>`;

  return sanitized.replace(new RegExp(tempPlaceholder.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g"), finalLink);
}

/**
 * Legacy text parsing for bold, italic, and URLs.
 */
export function parseFormattedHeaderText(
  text: string,
  publicUrl: string
): Array<string | { t: "b" | "i" | "a"; c: string }> {
  const parts: Array<string | { t: "a"; c: string }> = [];
  const segments = text.split(/\{\{PUBLIC_URL\}\}/g);
  for (let i = 0; i < segments.length; i++) {
    parts.push(segments[i]!);
    if (i < segments.length - 1) {
      parts.push({ t: "a" as const, c: publicUrl });
    }
  }
  const result: Array<string | { t: "b" | "i" | "a"; c: string }> = [];
  const re = /\*\*(.+?)\*\*|\*(.+?)\*|(https?:\/\/[^\s<>"']+)/g;
  for (const part of parts) {
    if (typeof part === "object") {
      result.push(part);
      continue;
    }
    let lastEnd = 0;
    let m;
    re.lastIndex = 0;
    while ((m = re.exec(part)) !== null) {
      if (m.index > lastEnd) result.push(part.slice(lastEnd, m.index));
      if (m[1] !== undefined) result.push({ t: "b" as const, c: m[1] });
      else if (m[2] !== undefined) result.push({ t: "i" as const, c: m[2] });
      else if (m[3] !== undefined) result.push({ t: "a" as const, c: m[3] });
      lastEnd = re.lastIndex;
    }
    if (lastEnd < part.length) result.push(part.slice(lastEnd));
  }
  return result;
}

/**
 * Heuristic to detect if text is TipTap HTML content.
 */
export function isHtmlContent(text: string): boolean {
  const trimmed = text.trimStart();
  return (
    trimmed.startsWith("<p") ||
    trimmed.startsWith("<div") ||
    trimmed.startsWith("<span") ||
    trimmed.startsWith("<a") ||
    trimmed.startsWith("<strong") ||
    trimmed.startsWith("<em") ||
    trimmed.startsWith("<h1") ||
    trimmed.startsWith("<h2") ||
    trimmed.startsWith("<h3") ||
    trimmed.startsWith("<ul") ||
    trimmed.startsWith("<ol") ||
    trimmed.startsWith("<li") ||
    trimmed.startsWith("<u")
  );
}

function sanitizeRichTextTransform(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: ALLOWED_ATTR,
    transformTags: {
      a: (_tagName, attribs) => {
        const href = attribs.href || "";
        const lower = href.toLowerCase();
        if (
          lower.startsWith("javascript:") ||
          lower.startsWith("data:") ||
          lower.startsWith("vbscript:")
        ) {
          delete attribs.href;
        }
        return {
          tagName: "a",
          attribs: {
            ...attribs,
            target: "_blank",
            rel: "noopener noreferrer",
          },
        };
      },
    },
  });
}

/** Sanitize TipTap / pasted HTML for safe public rendering (forms, etc.). */
export function sanitizeRichTextHtml(html: string): string {
  return sanitizeRichTextTransform(html);
}

/** Strip tags for list labels, document titles, and emptiness checks. */
export function richTextPlainText(htmlOrText: string): string {
  const trimmed = htmlOrText.trim();
  if (!trimmed) return "";
  if (!isHtmlContent(trimmed)) return trimmed;
  return sanitizeHtml(trimmed, { allowedTags: [], allowedAttributes: {} })
    .replace(/\s+/g, " ")
    .trim();
}

export function isRichTextEmpty(htmlOrText: string | undefined | null): boolean {
  if (!htmlOrText?.trim()) return true;
  return !richTextPlainText(htmlOrText);
}
