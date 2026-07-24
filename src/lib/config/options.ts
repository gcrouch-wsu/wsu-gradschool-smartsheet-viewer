import type { FilterOperator, LayoutType, RenderType } from "@/lib/config/types";

/** Web-safe font stacks for body and heading text. */
export const FONT_OPTIONS: { value: string; label: string }[] = [
  { value: "system-ui, sans-serif", label: "System UI (default)" },
  { value: "Georgia, serif", label: "Georgia" },
  { value: "'Times New Roman', Times, serif", label: "Times New Roman" },
  { value: "Arial, Helvetica, sans-serif", label: "Arial" },
  { value: "Verdana, Geneva, sans-serif", label: "Verdana" },
  { value: "'Segoe UI', system-ui, sans-serif", label: "Segoe UI" },
  { value: "'Open Sans', system-ui, sans-serif", label: "Open Sans" },
  { value: "inherit", label: "Inherit from page" },
];

/** Body and heading font sizes (rem, pt). Good for readability. */
export const FONT_SIZE_OPTIONS: { value: string; label: string }[] = [
  { value: "0.75rem", label: "XS (12px)" },
  { value: "12pt", label: "12 point" },
  { value: "0.875rem", label: "Small (14px)" },
  { value: "1rem", label: "Medium (16px)" },
  { value: "1.0625rem", label: "Large (17px)" },
  { value: "1.125rem", label: "Extra large (18px)" },
  { value: "1.25rem", label: "2XL (20px)" },
  { value: "1.5rem", label: "3XL (24px)" },
  { value: "1.75rem", label: "4XL (28px)" },
  { value: "2rem", label: "5XL (32px)" },
  { value: "2.25rem", label: "6XL (36px)" },
  { value: "2.5rem", label: "7XL (40px)" },
];

export const LETTER_SPACING_OPTIONS: { value: string; label: string }[] = [
  { value: "0", label: "Normal" },
  { value: "-0.025em", label: "Tight (display)" },
  { value: "0.04em", label: "Slight wide" },
  { value: "0.1em", label: "Wide" },
  { value: "0.16em", label: "Wider" },
  { value: "0.22em", label: "Extra wide" },
];

export const TEXT_TRANSFORM_OPTIONS: { value: string; label: string }[] = [
  { value: "none", label: "None" },
  { value: "uppercase", label: "Uppercase" },
  { value: "capitalize", label: "Capitalize" },
];

export const PEOPLE_STYLE_OPTIONS: { value: "plain" | "capsule"; label: string }[] = [
  { value: "plain", label: "Plain" },
  { value: "capsule", label: "Capsule" },
];

/** Font weight options for body and heading. */
export const FONT_WEIGHT_OPTIONS: { value: string; label: string }[] = [
  { value: "100", label: "Thin (100)" },
  { value: "200", label: "Extra light (200)" },
  { value: "300", label: "Light (300)" },
  { value: "400", label: "Normal (400)" },
  { value: "500", label: "Medium (500)" },
  { value: "600", label: "Semibold (600)" },
  { value: "700", label: "Bold (700)" },
  { value: "800", label: "Extra bold (800)" },
  { value: "900", label: "Black (900)" },
];

/** Font style options for body and heading. */
export const FONT_STYLE_OPTIONS: { value: string; label: string }[] = [
  { value: "normal", label: "Normal" },
  { value: "italic", label: "Italic" },
  { value: "oblique", label: "Oblique" },
];

/** Border radius presets for cards and buttons. */
export const BORDER_RADIUS_OPTIONS: { value: string; label: string }[] = [
  { value: "0", label: "None" },
  { value: "0.25rem", label: "Small (4px)" },
  { value: "0.5rem", label: "Medium (8px)" },
  { value: "1rem", label: "Large (16px)" },
  { value: "1.75rem", label: "Extra large (28px)" },
  { value: "2rem", label: "Rounded (32px)" },
];

/** Card shadow presets. */
export const SHADOW_OPTIONS: { value: string; label: string }[] = [
  { value: "none", label: "None" },
  { value: "0 1px 3px rgba(0,0,0,0.08)", label: "Subtle" },
  { value: "0 4px 6px rgba(0,0,0,0.1)", label: "Light" },
  { value: "0 16px 40px rgba(35,31,32,0.06)", label: "Medium (default)" },
  { value: "0 24px 64px rgba(35,31,32,0.07)", label: "Masthead depth" },
  { value: "0 24px 64px rgba(35,31,32,0.08)", label: "Strong" },
  { value: "0 24px 64px rgba(0,0,0,0.35)", label: "Strong (dark)" },
];

/** Top rule above logo / brand text. */
export const HEADER_TOP_BORDER_WIDTH_OPTIONS: { value: string; label: string }[] = [
  { value: "0", label: "Hidden" },
  { value: "2px", label: "Thin (2px)" },
  { value: "3px", label: "Default (3px)" },
  { value: "4px", label: "Thick (4px)" },
  { value: "6px", label: "Heavy (6px)" },
];

export const LAYOUT_OPTIONS: LayoutType[] = ["table", "cards", "list", "tabbed", "stacked", "accordion", "list_detail"];

/** Human-readable label for a layout id (e.g. list_detail → List Detail). Safe for server and client. */
export function formatLayoutLabel(layout: LayoutType) {
  return layout
    .split("_")
    .map((token) => token.charAt(0).toUpperCase() + token.slice(1))
    .join(" ");
}

export const RENDER_TYPE_OPTIONS: RenderType[] = [
  "text",
  "multiline_text",
  "list",
  "mailto",
  "mailto_list",
  "phone",
  "phone_list",
  "link",
  "date",
  "badge",
  "people_group",
  "hidden",
];
export const FILTER_OPERATOR_OPTIONS: FilterOperator[] = [
  "equals",
  "not_equals",
  "contains",
  "not_contains",
  "in",
  "not_in",
  "is_empty",
  "not_empty",
];
export const TRANSFORM_OPTIONS = [
  "trim",
  "split",
  "coalesce",
  "reset_to_source",
  "extract_emails",
  "extract_phones",
  "dedupe",
  "filter_empty",
  "to_contact_list",
  "contact_names",
  "contact_emails",
  "join",
  "lowercase",
  "uppercase",
  "format_date",
  "url_from_value",
] as const;
