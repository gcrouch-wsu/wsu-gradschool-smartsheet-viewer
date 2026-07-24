export type SourceType = "sheet" | "report";
export type LayoutType = "table" | "cards" | "list" | "tabbed" | "stacked" | "accordion" | "list_detail";
export type RenderType =
  | "text"
  | "multiline_text"
  | "list"
  | "mailto"
  | "mailto_list"
  | "phone"
  | "phone_list"
  | "link"
  | "date"
  | "badge"
  | "people_group"
  | "hidden";
export type FilterOperator =
  | "equals"
  | "not_equals"
  | "contains"
  | "not_contains"
  | "in"
  | "not_in"
  | "is_empty"
  | "not_empty";

export type RoleGroupMode = "numbered_slots" | "delimited_parallel";

export interface SourceRoleGroupSlotConfig {
  slot: string;
  name?: FieldSourceSelector;
  email?: FieldSourceSelector;
  phone?: FieldSourceSelector;
  /** Per-slot campus picklist (e.g. Designee N Campus), paired with this slot only. */
  campus?: FieldSourceSelector;
}

export interface SourceRoleGroupConfig {
  id: string;
  label: string;
  defaultDisplayLabel?: string;
  mode: RoleGroupMode;
  slots?: SourceRoleGroupSlotConfig[];
  delimited?: {
    name?: { source: FieldSourceSelector; delimiters?: string[] };
    email?: { source: FieldSourceSelector; delimiters?: string[] };
    phone?: { source: FieldSourceSelector; delimiters?: string[] };
    pairing?: "by_position";
    /** Explicit admin override when parallel delimited attributes are known to stay aligned. */
    trustPairing?: boolean;
  };
}

export type FormProvenance = "template" | "scratch" | "imported" | "sample";

export interface SourceConfig {
  id: string;
  label: string;
  sourceType: SourceType;
  smartsheetId: number;
  connectionKey?: string;
  apiBaseUrl?: string;
  cacheTtlSeconds?: number;
  /** Reusable grouped contact columns (numbered Smartsheet slots or legacy delimited). */
  roleGroups?: SourceRoleGroupConfig[];
  fetchOptions?: {
    includeObjectValue?: boolean;
    includeColumnOptions?: boolean;
    level?: number;
  };
  /**
   * When false, sheet is views-only. Omit/true = available in Forms for sheet sources.
   * Ignored for reports (forms never use reports).
   */
  formsEnabled?: boolean;
  /** Public path segment for `/f/[slug]` (sheets only). */
  formSlug?: string;
  /** When true, anonymous users may load/submit via the public form URL. */
  formPublic?: boolean;
  formPublishedAt?: string;
  /** How this sheet entered the Forms workspace. */
  formProvenance?: FormProvenance;
  /** ISO timestamp when first registered for Forms (maps to FormEntry.createdAt). */
  formRegisteredAt?: string;
}

export interface FieldSourceSelector {
  columnId?: number;
  columnTitle?: string;
  columnType?: string;
}

export interface ViewFieldSource extends FieldSourceSelector {
  preferredColumnId?: number;
  preferredColumnTitle?: string;
  preferredColumnType?: string;
  fallbackColumnId?: number;
  fallbackColumnTitle?: string;
  fallbackColumnType?: string;
  coalesce?: FieldSourceSelector[];
}

export interface RoleGroupFieldSource {
  kind: "role_group";
  roleGroupId: string;
}

export type ViewFieldSourceConfig = ViewFieldSource | RoleGroupFieldSource;

export interface TransformConfig {
  op: string;
  delimiter?: string;
  delimiters?: string[];
  separator?: string;
  locale?: string;
  dateStyle?: "full" | "long" | "medium" | "short";
  timeStyle?: "full" | "long" | "medium" | "short";
}

export type ListDisplayMode = "inline" | "stacked";
export type PeopleGroupStyle = "plain" | "capsule";

/** Optional per-field typography; theme defines tokens. CSS-only — does not emit heading elements. */
export const FIELD_TEXT_STYLE_VALUES = ["display", "title", "subtitle", "body", "label", "muted"] as const;
export type FieldTextStyle = (typeof FIELD_TEXT_STYLE_VALUES)[number];

export interface ViewFieldRender {
  type: RenderType;
  emptyLabel?: string;
  /** Delimiter between list items when inline (e.g. ", ", " | "). Default ", ". */
  listDelimiter?: string;
  /** "inline" = one line with delimiter; "stacked" = each item on its own row. */
  listDisplay?: ListDisplayMode;
  /** Visual treatment for grouped people items. */
  peopleStyle?: PeopleGroupStyle;
  /** Cell value typography (optional; default follows global body/value styles). */
  textStyle?: FieldTextStyle;
  /** Column/field label typography (optional; default follows global field label styles). */
  labelStyle?: FieldTextStyle;
}

export interface ViewFieldConfig {
  key: string;
  label: string;
  source: ViewFieldSourceConfig;
  transforms?: TransformConfig[];
  render: ViewFieldRender;
  emptyBehavior?: "show" | "hide";
  description?: string;
  /** When true, hide the label in card/list layouts—show only the value. Use when the value is self-explanatory (e.g. a name field). */
  hideLabel?: boolean;
}

export interface ViewFilterConfig {
  columnId?: number;
  columnTitle?: string;
  columnType?: string;
  op: FilterOperator;
  value?: string | number | boolean | Array<string | number | boolean>;
}

export interface ViewSortConfig {
  field: string;
  direction: "asc" | "desc";
}

/** Special keys for card layout: __placeholder__ = blank for alignment, __text:Label__ = static text. */
export const CARD_LAYOUT_PLACEHOLDER = "__placeholder__";
export const CARD_LAYOUT_TEXT_PREFIX = "__text:";
/**
 * Special card layout key that renders the campus union badge strip for a row.
 * Sources (in priority order): `row.mergedCampuses` (set during row merge) → `campusFieldKey` text value.
 * If `campusFieldKey` is absent and the row is not merged, the cell renders an empty badge strip (no-op).
 * At most one `__campus_badges__` slot is allowed per card layout (validated on save).
 * Style via `presentation.campusBadgeStyle`.
 */
export const CARD_LAYOUT_CAMPUS_BADGES = "__campus_badges__";

/** Optional styling for campus chips (card layout token + merged-row badges + section strips). */
export interface CampusBadgePresentationStyle {
  fontSize?: string;
  fontWeight?: string;
  fontFamily?: string;
  background?: string;
  color?: string;
  borderColor?: string;
  borderRadius?: string;
}

export interface CardLayoutRow {
  /** Field keys or special values (__placeholder__, __text:Label). Multiple items render side-by-side. */
  fieldKeys: string[];
}

export type RowDividerStyle = "none" | "default" | "subtle";

/** Campus/program grouping on the public view. Expand with merge/hybrid later. */
export type CampusGroupingMode = "grouped";

export interface ViewPresentationConfig {
  /** Field used as the main heading in cards, accordions, etc. */
  headingFieldKey?: string;
  /** Field shown as subtitle under the heading. */
  summaryFieldKey?: string;
  /** Field used for A-Z index and search. Defaults to heading if not set. */
  indexFieldKey?: string;
  /** Hide the "Row N" badge in stacked/tabbed layouts. */
  hideRowBadge?: boolean;
  /** Custom layout for card-like views: rows of field keys. When set, overrides heading/summary/remaining. */
  cardLayout?: CardLayoutRow[];
  /** Divider between rows/cards. "none" hides, "default" is standard border, "subtle" is lighter. */
  rowDividerStyle?: RowDividerStyle;
  /** Hide the entire page header card (custom text + status box). Use when neither is needed. */
  hideHeader?: boolean;
  /** Header chrome: hide elements to reduce clutter. */
  hideHeaderBackLink?: boolean;
  hideHeaderSourceLabel?: boolean;
  hideHeaderPageTitle?: boolean;
  hideHeaderLiveDataText?: boolean;
  /** @deprecated Use hideHeaderActiveView, hideHeaderRows, hideHeaderRefreshed for granular control. */
  hideHeaderInfoBox?: boolean;
  hideHeaderActiveView?: boolean;
  hideHeaderRows?: boolean;
  hideHeaderRefreshed?: boolean;
  /** Custom text in main header (left of info box). Use **bold**, *italic*, {{PUBLIC_URL}} for live link. */
  headerCustomText?: string;
  hideViewTitleSection?: boolean;
  /** Hide the view tabs (e.g. "Graduate Program Contact List 124"). */
  hideViewTabs?: boolean;
  /** Hide the row count badge on view tabs. */
  hideViewTabCount?: boolean;
  /** Custom label for this view's tab (overrides view.label). */
  viewTabLabel?: string;
  /**
   * Optional header logo as a PNG or JPEG data URL (managed in admin). Requires headerLogoAlt.
   * Stored in view config / Postgres JSON — keep files small (≤256KB) for performance.
   */
  headerLogoDataUrl?: string;
  /** Short accessible description of the logo (required when headerLogoDataUrl is set). */
  headerLogoAlt?: string;
  /** Hide uploaded logo on the public header without removing it from config. */
  hideHeaderLogo?: boolean;
  /** Smaller line next to logo (e.g. institution name). Plain text. */
  headerBrandSubline?: string;
  /** Larger bold line next to logo (e.g. school or unit). Plain text. */
  headerBrandTitle?: string;
  /**
   * When not `false` (default), mailto and contact emails render as hyperlinks on the public view.
   * Set to `false` to show plain text only.
   */
  linkEmailsInView?: boolean;
  /**
   * When `true`, tel: links are shown for phone fields and people_group phone lines.
   * Default is off so numbers display as plain text unless explicitly enabled.
   */
  linkPhonesInView?: boolean;
  /**
   * Print/PDF: group source rows by this field's displayed value and render one table per group
   * (useful when many rows share the same program name and differ only by campus).
   */
  printGroupByFieldKey?: string;
  /**
   * Smartsheet-backed campus column for grouping/badges (e.g. grad_campus). May point at a hidden field.
   */
  campusFieldKey?: string;
  /**
   * Program identity for grouped headers (e.g. program_name). May point at a hidden field.
   */
  programGroupFieldKey?: string;
  /** When set, the public view may render program sections (see campus-grouping). */
  campusGroupingMode?: CampusGroupingMode;
  /** When true, show client-side campus filter controls (stacked with search). */
  showCampusFilter?: boolean;
  /**
   * When true, merge resolved rows that share the same program field value and the same contact email(s)
   * across `mergePeopleFieldKeys` (or legacy `mergePeopleFieldKey`, or the sole people_group field). Campuses are unioned.
   * Requires programGroupFieldKey + campusFieldKey. Mutually exclusive with `mergeProgramRowsByProgramAndCampus`.
   */
  mergeProgramRowsBySharedEmail?: boolean;
  /**
   * When true, merge resolved rows that share the same program field value and the same campus value
   * (after `normalizeCampusDisplay`; blank campus rows are never merged with each other). First row wins for non-campus fields.
   * Requires programGroupFieldKey + campusFieldKey. Mutually exclusive with `mergeProgramRowsBySharedEmail`.
   */
  mergeProgramRowsByProgramAndCampus?: boolean;
  /**
   * people_group fields used for email matching when merging (union of all emails on the row from these fields).
   * If empty/unset, falls back to `mergePeopleFieldKey`, then to the sole people_group field.
   */
  mergePeopleFieldKeys?: string[];
  /** @deprecated Prefer `mergePeopleFieldKeys`. When set alone, treated as a one-element list. */
  mergePeopleFieldKey?: string;
  /**
   * When true, the campus field stays in the sheet mapping but is omitted from public tables/cards/lists
   * (still used for grouping, merge, filters, and the `CARD_LAYOUT_CAMPUS_BADGES` slot).
   */
  hideCampusFieldInRecordDisplay?: boolean;
  /**
   * When false, grouped layouts omit the program section header (title + strip). Rows stay grouped. Default true when unset.
   */
  showProgramSectionHeaders?: boolean;
  /**
   * When false, program section headers omit the campus chip row. Default true when unset.
   */
  showCampusStripOnProgramSections?: boolean;
  /**
   * When false, merged rows do not show the automatic campus badge row (use custom layout `__campus_badges__` only).
   * Default true when unset.
   */
  showMergedCampusBadgesOnRecords?: boolean;
  /** Typography and colors for campus chips (`__campus_badges__`, merged badges, section strips). */
  campusBadgeStyle?: CampusBadgePresentationStyle;

  /**
   * When set, rows whose status field matches `recordSuppressedFileStatusValues` (default: hide, delete)
   * have link/file fields redacted on the public view and in contributor forms; cards use a collapsed shell with a status chip.
   */
  recordSuppressedFileStatusFieldKey?: string;
  /** Normalized match tokens; default is hide + delete if unset. */
  recordSuppressedFileStatusValues?: string[];
  /**
   * Field keys to clear when suppressed. If omitted, every view field with render type `link` is redacted.
   */
  recordSuppressedFileRedactFieldKeys?: string[];
  /**
   * When true (default), the status field is omitted from public record body (custom layout uses a placeholder);
   * the status still appears on the collapsed summary chip.
   */
  recordSuppressedFileHideStatusFieldInPublicBody?: boolean;
}

export interface ViewStyleConfig {
  backgroundColor?: string;
  cardBackground?: string;
  surfaceMutedBackground?: string;
  accentColor?: string;
  textColor?: string;
  /** Color for structural headings (card row titles, section h2, font-view-heading). Defaults to primary text when unset. */
  headingTextColor?: string;
  mutedColor?: string;
  borderColor?: string;
  controlBackground?: string;
  controlText?: string;
  controlBorder?: string;
  controlHoverBackground?: string;
  controlActiveBackground?: string;
  controlActiveText?: string;
  fontFamily?: string;
  headingFontFamily?: string;
  /** Body text size (e.g. 1rem, 12pt). */
  fontSize?: string;
  /** Heading text size (e.g. 1.25rem). */
  headingFontSize?: string;
  /** Field label size (e.g. 0.75rem). */
  fieldLabelFontSize?: string;
  /** Card/list row heading size (e.g. 1.125rem). */
  rowHeadingFontSize?: string;
  /** Body font weight (e.g. normal, bold). */
  fontWeight?: string;
  /** Heading font weight (e.g. normal, bold). */
  headingFontWeight?: string;
  /** Field label font weight (e.g. 500, 600). */
  fieldLabelFontWeight?: string;
  /** Card/list row heading font weight (e.g. 600). */
  rowHeadingFontWeight?: string;
  /** Name weight inside grouped people fields. */
  peopleNameFontWeight?: string;
  /** Email/phone weight inside grouped people fields. */
  peopleDetailFontWeight?: string;
  /** Background for campus chip beside names in people_group (Setup → Chips can override per field). */
  peopleCampusChipBg?: string;
  /** Text color for that chip. */
  peopleCampusChipText?: string;
  /** Border color for that chip. */
  peopleCampusChipBorder?: string;
  /** Body font style (e.g. normal, italic). */
  fontStyle?: string;
  /** Heading font style (e.g. normal, italic). */
  headingFontStyle?: string;
  /** Field label tracking/letter spacing (e.g. 0.12em). */
  fieldLabelLetterSpacing?: string;
  /** Field label text transform (e.g. uppercase, none). */
  fieldLabelTextTransform?: string;
  /** Per-field scale: display (e.g. large stat). Maps to .view-text-display / .view-label-display. */
  displayTextFontSize?: string;
  displayTextFontWeight?: string;
  displayTextColor?: string;
  titleTextFontSize?: string;
  titleTextFontWeight?: string;
  titleTextColor?: string;
  subtitleTextFontSize?: string;
  subtitleTextFontWeight?: string;
  subtitleTextColor?: string;
  borderRadius?: string;
  cardShadow?: string;
  badgeBg?: string;
  badgeText?: string;
  /** Page-level h1 font size (e.g. 2.25rem). */
  pageTitleFontSize?: string;
  /** Font size for action link buttons (Contributor sign in, Print/PDF, etc.). */
  actionFontSize?: string;
  /**
   * Optional color for value links (mailto, tel, URLs in table/cards). When unset, uses accentColor.
   */
  valueLinkColor?: string;
  /** Underline for value links: "underline" (default) or "none". */
  valueLinkDecoration?: "underline" | "none";

  // ── Public header / masthead (optional overrides; fallbacks keep prior look) ──
  /** Top accent rule above the brand strip (e.g. #a60f2d). Empty uses theme accent. */
  headerTopBorderColor?: string;
  /** Top border thickness (e.g. 3px, 0). */
  headerTopBorderWidth?: string;
  /** Masthead card background. Empty uses card background. */
  headerPanelBackgroundColor?: string;
  /** Masthead card border color. Empty uses border color token. */
  headerPanelBorderColor?: string;
  /** Masthead corner radius (e.g. 2rem). */
  headerPanelBorderRadius?: string;
  /** Masthead box-shadow (CSS value). */
  headerPanelShadow?: string;

  headerBrandSublineFontFamily?: string;
  headerBrandSublineFontSize?: string;
  headerBrandSublineFontWeight?: string;
  headerBrandSublineColor?: string;

  headerBrandTitleFontFamily?: string;
  headerBrandTitleFontSize?: string;
  headerBrandTitleFontWeight?: string;
  headerBrandTitleFontStyle?: string;
  headerBrandTitleLetterSpacing?: string;
  headerBrandTitleColor?: string;

  headerSourceLabelFontFamily?: string;
  headerSourceLabelFontSize?: string;
  headerSourceLabelFontWeight?: string;
  headerSourceLabelLetterSpacing?: string;
  headerSourceLabelTextTransform?: string;
  headerSourceLabelColor?: string;

  /** Overrides page h1 size inside the public header only. */
  headerPageTitleFontFamily?: string;
  headerPageTitleFontSize?: string;
  headerPageTitleFontWeight?: string;
  headerPageTitleFontStyle?: string;
  headerPageTitleLetterSpacing?: string;
  headerPageTitleColor?: string;

  headerLiveBlurbFontSize?: string;
  headerLiveBlurbColor?: string;
  headerLiveBlurbStrongColor?: string;

  /** @deprecated Use accentColor. Kept for backward compatibility. */
  primaryColor?: string;
}

export interface ThemeConfig {
  id: string;
  label: string;
  tokens: Partial<ViewStyleConfig>;
}

export type EditableFieldGroupAttributeType = "name" | "email" | "phone" | "campus";

export interface EditableFieldGroupAttribute {
  attribute: EditableFieldGroupAttributeType;
  fieldKey: string;
  columnId: number;
  /** Column type (e.g. TEXT_NUMBER, CONTACT_LIST). Used for objectValue write-back on contact columns. */
  columnType?: string;
  /** Smartsheet column title; set when building contributor client config (not stored in view JSON). */
  columnTitle?: string;
  /** Slot id within a numbered role group (e.g. "1"); enables per-column write-back for that slot. */
  slot?: string;
  /** Populated for PICKLIST when building contributor client config from schema (not stored in view JSON). */
  options?: string[];
}

export interface EditableFieldGroup {
  id: string;
  label: string;
  attributes: EditableFieldGroupAttribute[];
  /** Load/save uses `ResolvedFieldValue.people` on this view field (numbered slot role groups). */
  fromRoleGroupViewFieldKey?: string;
  /** Contributor UI is display-only (e.g. unsafe delimited multi-attribute role group). */
  readOnly?: boolean;
  /** Hide add/remove person controls; slot list is fixed by the source role group. */
  usesFixedSlots?: boolean;
}

export interface ViewEditingConfig {
  enabled: boolean;
  contactColumnIds: number[];
  editableColumnIds: number[];
  editableFieldGroups?: EditableFieldGroup[];
  showLoginLink?: boolean;
  /**
   * When true (default), show a single “Contributor instructions” link on the public page that opens the help guide in a new window.
   * No inline instructions; the guide itself never requires login to read.
   */
  showContributorInstructions?: boolean;
}

export interface ViewConfig {
  id: string;
  slug: string;
  sourceId: string;
  label: string;
  description?: string;
  layout: LayoutType;
  public: boolean;
  tabOrder?: number;
  filters?: ViewFilterConfig[];
  defaultSort?: ViewSortConfig[];
  presentation?: ViewPresentationConfig;
  style?: ViewStyleConfig;
  /** When true, hide the layout switcher; only use the view's default layout. */
  fixedLayout?: boolean;
  /** Theme preset id (e.g. wsu_crimson). When unset, WSU Crimson is used. */
  themePresetId?: string;
  /**
   * IANA time zone for interpreting date/datetime fields on the public page (e.g. America/Los_Angeles).
   * Set in the admin view builder; visitors see a read-only label, not a control.
   */
  displayTimeZone?: string;
  editing?: ViewEditingConfig;
  fields: ViewFieldConfig[];
}

export interface PublicPageSummary {
  slug: string;
  title: string;
  sourceId: string;
  sourceLabel: string;
  views: Array<{
    id: string;
    label: string;
    description?: string;
  }>;
}

export interface SmartsheetColumn {
  id: number;
  index: number;
  title: string;
  type: string;
  options?: string[];
  locked?: boolean;
}

/** Optional cell hyperlink from the Smartsheet API (`cells[].hyperlink`). */
export interface SmartsheetCellHyperlink {
  url?: string;
}

export interface SmartsheetCell {
  columnId: number;
  columnTitle: string;
  columnType: string;
  value: unknown;
  displayValue?: string;
  objectValue?: unknown;
  hyperlink?: SmartsheetCellHyperlink | null;
}

export interface SmartsheetRow {
  id: number;
  sheetId?: number;
  cellsById: Record<number, SmartsheetCell>;
  cellsByTitle: Record<string, SmartsheetCell>;
}

export interface SmartsheetDataset {
  sourceType: SourceType;
  id: number;
  name: string;
  columns: SmartsheetColumn[];
  rows: SmartsheetRow[];
  fetchedAt: string;
}

export interface PublicLink {
  label: string;
  href: string;
}

export interface ContactValue {
  name?: string;
  email?: string;
}

export interface ResolvedPersonRoleEntry {
  slot: string;
  name?: string;
  email?: string;
  phone?: string;
  /** Trimmed Smartsheet picklist value for this slot's campus column (if configured). */
  campus?: string;
  isEmpty: boolean;
}

export interface ResolvedFieldValue {
  key: string;
  label: string;
  renderType: RenderType;
  textValue: string;
  sortValue?: string;
  listValue: string[];
  links: PublicLink[];
  isEmpty: boolean;
  hideWhenEmpty: boolean;
  hideLabel?: boolean;
  textStyle?: FieldTextStyle;
  labelStyle?: FieldTextStyle;
  /** Set for `people_group` when data is structured from numbered slots (or safe single-attribute delimited). */
  people?: ResolvedPersonRoleEntry[];
  /** When true, contributor editing must not expose this group as editable. */
  roleGroupReadOnly?: boolean;
  /** Delimiter between list items when inline (e.g. ", ", " | "). */
  listDelimiter?: string;
  /** "inline" = one line with delimiter; "stacked" = each item on its own row. */
  listDisplay?: ListDisplayMode;
  /** Visual treatment for grouped people items. */
  peopleStyle?: PeopleGroupStyle;
  /** Pre-transform date/datetime string from Smartsheet; public UI may reformat using the visitor's time zone. */
  dateSourceRaw?: string;
}

/** Set when `presentation.recordSuppressedFileStatusFieldKey` matches suppressed values (e.g. Hide / Delete). */
export interface ResolvedRecordSuppression {
  statusDisplay: string;
  redactedFieldKeys: string[];
  statusFieldKey: string;
}

export interface ResolvedViewRow {
  id: number;
  fields: ResolvedFieldValue[];
  fieldMap: Record<string, ResolvedFieldValue>;
  /** Smartsheet row ids merged into this display row (same program + matching emails). */
  mergedSourceRowIds?: number[];
  /** Canonical campus labels for merged row badge strip (and campus cell text). */
  mergedCampuses?: string[];
  /** Row-level file/link suppression for public + contributor UX. */
  recordSuppression?: ResolvedRecordSuppression;
}

export interface ResolvedViewField {
  key: string;
  label: string;
  renderType: RenderType;
  description?: string;
  textStyle?: FieldTextStyle;
  labelStyle?: FieldTextStyle;
}

export interface ResolvedView {
  id: string;
  label: string;
  description?: string;
  layout: LayoutType;
  presentation?: ViewPresentationConfig;
  style?: ViewStyleConfig;
  themePresetId?: string;
  fixedLayout?: boolean;
  /** IANA zone from view config used to format date/datetime fields on the public page. */
  displayTimeZone: string;
  /** Effective flags from presentation (defaults: email linked, phone not). */
  linkEmailsInView: boolean;
  linkPhonesInView: boolean;
  rowCount: number;
  fields: ResolvedViewField[];
  rows: ResolvedViewRow[];
}

export interface ResolvedPublicPage {
  slug: string;
  title: string;
  source: {
    id: string;
    label: string;
    name: string;
    sourceType: SourceType;
  };
  views: ResolvedView[];
  defaultViewId: string;
  fetchedAt: string;
}
