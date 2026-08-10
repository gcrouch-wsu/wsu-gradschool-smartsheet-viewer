import {
  CARD_LAYOUT_CAMPUS_BADGES,
  CARD_LAYOUT_PLACEHOLDER,
  CARD_LAYOUT_TEXT_PREFIX,
  FIELD_TEXT_STYLE_VALUES,
} from "@/lib/config/types";
import { listConfiguredSmartsheetConnectionKeys } from "@/lib/smartsheet-connection-keys";
import { validateOptionalSmartsheetApiBaseUrl } from "@/lib/smartsheet-api-url";
import { normalizePublishedSlug } from "@/lib/slug-normalize";
import { isValidIanaTimeZone } from "@/lib/display-datetime";
import { HEADER_BRAND_TEXT_MAX_LENGTH, validateHeaderLogoPair } from "@/lib/header-logo";
import { isWritableRoleGroup } from "@/lib/role-groups";
import type {
  EditableFieldGroup,
  EditableFieldGroupAttribute,
  FieldSourceSelector,
  FieldTextStyle,
  FilterOperator,
  LayoutType,
  RoleGroupFieldSource,
  RenderType,
  RowDividerStyle,
  SourceConfig,
  SourceRoleGroupConfig,
  SourceRoleGroupSlotConfig,
  TransformConfig,
  ViewConfig,
  ViewEditingConfig,
  ViewFieldConfig,
  ViewFieldSource,
  ViewFieldSourceConfig,
  ViewFilterConfig,
  CampusGroupingMode,
  ViewPresentationConfig,
  ViewSortConfig,
  ViewStyleConfig,
  CampusBadgePresentationStyle,
} from "@/lib/config/types";

function parseCampusBadgeStyle(input: unknown): CampusBadgePresentationStyle | undefined {
  if (!isRecord(input)) {
    return undefined;
  }
  const out: CampusBadgePresentationStyle = {};
  for (const k of [
    "fontSize",
    "fontWeight",
    "fontFamily",
    "background",
    "color",
    "borderColor",
    "borderRadius",
  ] as const) {
    const raw = input[k];
    const v = typeof raw === "string" ? raw.trim() : "";
    if (v && v.length <= 96) {
      out[k] = v;
    }
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

export interface ValidationResult<T> {
  success: boolean;
  data?: T;
  errors: string[];
}

const MAX_CONFIG_ID_LEN = 120;
const SAFE_CONFIG_ID = /^[a-zA-Z0-9][a-zA-Z0-9_-]*$/;
const MAX_PUBLIC_SLUG_LEN = 200;
const PUBLIC_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const CONNECTION_KEY_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9_-]*$/;
const MAX_CONNECTION_KEY_LEN = 64;

const LAYOUT_TYPES: LayoutType[] = ["table", "cards", "list", "tabbed", "stacked", "accordion", "list_detail"];
const RENDER_TYPES: RenderType[] = [
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
const ROLE_GROUP_MODES: SourceRoleGroupConfig["mode"][] = ["numbered_slots", "delimited_parallel"];
const FILTER_OPERATORS: FilterOperator[] = [
  "equals",
  "not_equals",
  "contains",
  "not_contains",
  "in",
  "not_in",
  "is_empty",
  "not_empty",
];
const DATE_STYLES = ["full", "long", "medium", "short"] as const;
const TRANSFORM_OPS = [
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function validateConfigId(id: string, fieldLabel: string): string | undefined {
  if (!id) {
    return `${fieldLabel} is required.`;
  }
  if (id.length > MAX_CONFIG_ID_LEN) {
    return `${fieldLabel} must be at most ${MAX_CONFIG_ID_LEN} characters.`;
  }
  if (!SAFE_CONFIG_ID.test(id)) {
    return `${fieldLabel} may only use letters, numbers, hyphens, and underscores, and must start with a letter or number.`;
  }
  return undefined;
}

function validatePublicViewSlug(slug: string): string | undefined {
  if (!slug) {
    return "View slug is required.";
  }
  if (slug.length > MAX_PUBLIC_SLUG_LEN) {
    return `View slug must be at most ${MAX_PUBLIC_SLUG_LEN} characters.`;
  }
  if (!PUBLIC_SLUG_PATTERN.test(slug)) {
    return 'View slug must be lowercase letters, numbers, and single hyphens between segments (e.g. "graduate-programs").';
  }
  return undefined;
}

function asTrimmedString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function asOptionalString(value: unknown) {
  const normalized = asTrimmedString(value);
  return normalized || undefined;
}

function asOptionalNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

function asBoolean(value: unknown, fallback = false) {
  return typeof value === "boolean" ? value : fallback;
}

function parseTransformConfig(input: unknown, path: string): ValidationResult<TransformConfig> {
  const errors: string[] = [];
  if (!isRecord(input)) {
    return { success: false, errors: [`${path} must be an object.`] };
  }

  const op = asTrimmedString(input.op);
  if (!TRANSFORM_OPS.includes(op as (typeof TRANSFORM_OPS)[number])) {
    errors.push(`${path}.op must be one of: ${TRANSFORM_OPS.join(", ")}.`);
  }

  const dateStyle = asOptionalString(input.dateStyle);
  const timeStyle = asOptionalString(input.timeStyle);
  if (dateStyle && !DATE_STYLES.includes(dateStyle as (typeof DATE_STYLES)[number])) {
    errors.push(`${path}.dateStyle must be one of: ${DATE_STYLES.join(", ")}.`);
  }
  if (timeStyle && !DATE_STYLES.includes(timeStyle as (typeof DATE_STYLES)[number])) {
    errors.push(`${path}.timeStyle must be one of: ${DATE_STYLES.join(", ")}.`);
  }

  const delimiters = Array.isArray(input.delimiters)
    ? input.delimiters.map((entry) => asTrimmedString(entry)).filter(Boolean)
    : undefined;

  return {
    success: errors.length === 0,
    errors,
    data: errors.length
      ? undefined
      : {
          op,
          delimiter: asOptionalString(input.delimiter),
          delimiters,
          separator: asOptionalString(input.separator),
          locale: asOptionalString(input.locale),
          dateStyle: dateStyle as TransformConfig["dateStyle"],
          timeStyle: timeStyle as TransformConfig["timeStyle"],
        },
  };
}

function parseFieldSourceSelector(input: unknown, path: string): ValidationResult<FieldSourceSelector> {
  if (!isRecord(input)) {
    return { success: false, errors: [`${path} must be an object.`] };
  }
  const columnId = asOptionalNumber(input.columnId);
  const columnTitle = asOptionalString(input.columnTitle);
  const columnType = asOptionalString(input.columnType);
  if (columnId === undefined && !columnTitle) {
    return { success: false, errors: [`${path} must define columnId or columnTitle.`] };
  }
  return {
    success: true,
    errors: [],
    data: { columnId, columnTitle, columnType },
  };
}

function parseDelimitedParallelConfig(
  input: unknown,
  path: string,
): ValidationResult<NonNullable<SourceRoleGroupConfig["delimited"]>> {
  if (!isRecord(input)) {
    return { success: false, errors: [`${path} must be an object.`] };
  }
  const errors: string[] = [];
  const out: NonNullable<SourceRoleGroupConfig["delimited"]> = { pairing: "by_position" };
  if (input.trustPairing === true) {
    out.trustPairing = true;
  }

  for (const key of ["name", "email", "phone"] as const) {
    const raw = input[key];
    if (raw === undefined || raw === null) {
      continue;
    }
    if (!isRecord(raw)) {
      errors.push(`${path}.${key} must be an object.`);
      continue;
    }
    const src = parseFieldSourceSelector(raw.source, `${path}.${key}.source`);
    errors.push(...src.errors);
    if (!src.data) {
      continue;
    }
    const delimiters = Array.isArray(raw.delimiters)
      ? raw.delimiters.map((d) => asTrimmedString(d)).filter(Boolean)
      : undefined;
    out[key] = { source: src.data, ...(delimiters?.length ? { delimiters } : {}) };
  }

  return { success: errors.length === 0, errors, data: errors.length ? undefined : out };
}

function parseRoleGroupSlot(input: unknown, path: string): ValidationResult<SourceRoleGroupSlotConfig> {
  if (!isRecord(input)) {
    return { success: false, errors: [`${path} must be an object.`] };
  }
  const slot = asTrimmedString(input.slot);
  if (!slot) {
    return { success: false, errors: [`${path}.slot is required.`] };
  }
  const errors: string[] = [];
  const row: SourceRoleGroupSlotConfig = { slot };

  for (const attr of ["name", "email", "phone", "campus"] as const) {
    if (input[attr] === undefined || input[attr] === null) {
      continue;
    }
    const sel = parseFieldSourceSelector(input[attr], `${path}.${attr}`);
    errors.push(...sel.errors);
    if (sel.data) {
      row[attr] = sel.data;
    }
  }

  const hasAny = row.name || row.email || row.phone;
  if (!hasAny) {
    errors.push(`${path} must define at least one of name, email, or phone selectors.`);
  }

  return { success: errors.length === 0, errors, data: errors.length ? undefined : row };
}

function parseSourceRoleGroup(input: unknown, index: number): ValidationResult<SourceRoleGroupConfig> {
  const path = `roleGroups[${index}]`;
  const errors: string[] = [];
  if (!isRecord(input)) {
    return { success: false, errors: [`${path} must be an object.`] };
  }

  const id = asTrimmedString(input.id);
  const label = asTrimmedString(input.label);
  const mode = asTrimmedString(input.mode);
  if (!id) {
    errors.push(`${path}.id is required.`);
  }
  if (!label) {
    errors.push(`${path}.label is required.`);
  }
  if (!ROLE_GROUP_MODES.includes(mode as SourceRoleGroupConfig["mode"])) {
    errors.push(`${path}.mode must be "numbered_slots" or "delimited_parallel".`);
  }

  let slots: SourceRoleGroupSlotConfig[] | undefined;
  if (Array.isArray(input.slots)) {
    slots = [];
    for (const [i, slot] of input.slots.entries()) {
      const res = parseRoleGroupSlot(slot, `${path}.slots[${i}]`);
      errors.push(...res.errors);
      if (res.data) {
        slots.push(res.data);
      }
    }
  }

  let delimited: SourceRoleGroupConfig["delimited"];
  if (input.delimited !== undefined && input.delimited !== null) {
    const dRes = parseDelimitedParallelConfig(input.delimited, `${path}.delimited`);
    errors.push(...dRes.errors);
    if (dRes.data) {
      delimited = dRes.data;
    }
  }

  if (mode === "numbered_slots" && slots && slots.length > 0) {
    const seenSlots = new Set<string>();
    for (const row of slots) {
      if (seenSlots.has(row.slot)) {
        errors.push(`${path}.slots: duplicate slot id "${row.slot}" — each numbered slot must be unique.`);
        break;
      }
      seenSlots.add(row.slot);
    }
  }

  if (mode === "numbered_slots" && (!slots || slots.length === 0)) {
    errors.push(`${path}.slots must be a non-empty array when mode is "numbered_slots".`);
  }
  if (mode === "delimited_parallel" && !delimited) {
    errors.push(`${path}.delimited is required when mode is "delimited_parallel".`);
  }

  return {
    success: errors.length === 0,
    errors,
    data: errors.length
      ? undefined
      : {
          id,
          label,
          defaultDisplayLabel: asOptionalString(input.defaultDisplayLabel),
          mode: mode as SourceRoleGroupConfig["mode"],
          ...(slots?.length ? { slots } : {}),
          ...(delimited ? { delimited } : {}),
        },
  };
}

function parseFieldConfig(input: unknown, index: number, options?: { knownRoleGroupIds?: Set<string> }): ValidationResult<ViewFieldConfig> {
  const path = `fields[${index}]`;
  const errors: string[] = [];

  if (!isRecord(input)) {
    return { success: false, errors: [`${path} must be an object.`] };
  }

  const key = asTrimmedString(input.key);
  const label = asTrimmedString(input.label) ?? "";
  if (!key) {
    errors.push(`${path}.key is required.`);
  }

  const sourceInput = isRecord(input.source) ? input.source : {};
  const isRoleGroup = asTrimmedString(sourceInput.kind) === "role_group";

  const renderInput = isRecord(input.render) ? input.render : {};
  const renderType = asTrimmedString(renderInput.type);
  if (!RENDER_TYPES.includes(renderType as RenderType)) {
    errors.push(`${path}.render.type must be one of: ${RENDER_TYPES.join(", ")}.`);
  }

  const transforms: TransformConfig[] = [];
  for (const [transformIndex, transform] of (Array.isArray(input.transforms) ? input.transforms : []).entries()) {
    const result = parseTransformConfig(transform, `${path}.transforms[${transformIndex}]`);
    errors.push(...result.errors);
    if (result.data) {
      transforms.push(result.data);
    }
  }

  let source: ViewFieldSourceConfig;

  if (isRoleGroup) {
    const roleGroupId = asTrimmedString(sourceInput.roleGroupId);
    if (!roleGroupId) {
      errors.push(`${path}.source.roleGroupId is required when source.kind is "role_group".`);
    }
    if (options?.knownRoleGroupIds && roleGroupId && !options.knownRoleGroupIds.has(roleGroupId)) {
      errors.push(`${path}.source.roleGroupId "${roleGroupId}" is not defined on the view's source.`);
    }
    if (renderType && renderType !== "people_group") {
      errors.push(`${path}.render.type must be "people_group" when source.kind is "role_group".`);
    }
    if (transforms.length > 0) {
      errors.push(`${path}.transforms must be empty for role_group source fields.`);
    }
    source = { kind: "role_group", roleGroupId };
  } else {
    if (renderType === "people_group") {
      errors.push(`${path}.render.type "people_group" requires source.kind "role_group".`);
    }

    const coalesceTitles = Array.isArray(sourceInput.coalesce)
      ? sourceInput.coalesce
          .filter((entry) => isRecord(entry))
          .map((entry) => ({
            columnId: asOptionalNumber(entry.columnId),
            columnTitle: asOptionalString(entry.columnTitle),
            columnType: asOptionalString(entry.columnType),
          }))
          .filter((entry) => typeof entry.columnId === "number" || Boolean(entry.columnTitle))
      : [];

    const colSource: ViewFieldSource = {
      columnId: asOptionalNumber(sourceInput.columnId),
      columnTitle: asOptionalString(sourceInput.columnTitle),
      columnType: asOptionalString(sourceInput.columnType),
      preferredColumnId: asOptionalNumber(sourceInput.preferredColumnId),
      preferredColumnTitle: asOptionalString(sourceInput.preferredColumnTitle),
      preferredColumnType: asOptionalString(sourceInput.preferredColumnType),
      fallbackColumnId: asOptionalNumber(sourceInput.fallbackColumnId),
      fallbackColumnTitle: asOptionalString(sourceInput.fallbackColumnTitle),
      fallbackColumnType: asOptionalString(sourceInput.fallbackColumnType),
      coalesce: coalesceTitles.length > 0 ? coalesceTitles : undefined,
    };

    const hasSelector = [
      colSource.columnId,
      colSource.columnTitle,
      colSource.preferredColumnId,
      colSource.preferredColumnTitle,
      colSource.fallbackColumnId,
      colSource.fallbackColumnTitle,
      ...(colSource.coalesce ?? []).flatMap((entry) => [entry.columnId, entry.columnTitle]),
    ].some((value) => value !== undefined && value !== "");

    if (!hasSelector) {
      errors.push(`${path}.source must define at least one column selector.`);
    }

    source = colSource;
  }

  const emptyBehavior = asOptionalString(input.emptyBehavior);
  if (emptyBehavior && emptyBehavior !== "show" && emptyBehavior !== "hide") {
    errors.push(`${path}.emptyBehavior must be "show" or "hide".`);
  }

  const hideLabel = input.hideLabel === true || input.hideLabel === "true";

  const rawTextStyle = asTrimmedString(renderInput.textStyle);
  let textStyle: FieldTextStyle | undefined;
  if (rawTextStyle) {
    if ((FIELD_TEXT_STYLE_VALUES as readonly string[]).includes(rawTextStyle)) {
      textStyle = rawTextStyle as FieldTextStyle;
    } else {
      errors.push(`${path}.render.textStyle must be one of: ${FIELD_TEXT_STYLE_VALUES.join(", ")}.`);
    }
  }
  const rawLabelStyle = asTrimmedString(renderInput.labelStyle);
  let labelStyle: FieldTextStyle | undefined;
  if (rawLabelStyle) {
    if ((FIELD_TEXT_STYLE_VALUES as readonly string[]).includes(rawLabelStyle)) {
      labelStyle = rawLabelStyle as FieldTextStyle;
    } else {
      errors.push(`${path}.render.labelStyle must be one of: ${FIELD_TEXT_STYLE_VALUES.join(", ")}.`);
    }
  }

  return {
    success: errors.length === 0,
    errors,
    data: errors.length
      ? undefined
      : {
          key,
          label,
          description: asOptionalString(input.description),
          source,
          transforms: isRoleGroup ? [] : transforms,
          render: {
            type: renderType as RenderType,
            emptyLabel: asOptionalString(renderInput.emptyLabel),
            listDelimiter: asOptionalString(renderInput.listDelimiter),
            listDisplay: asOptionalString(renderInput.listDisplay) === "stacked" ? "stacked" : asOptionalString(renderInput.listDisplay) === "inline" ? "inline" : undefined,
            peopleStyle:
              asOptionalString(renderInput.peopleStyle) === "capsule"
                ? "capsule"
                : asOptionalString(renderInput.peopleStyle) === "plain"
                  ? "plain"
                  : undefined,
            ...(textStyle ? { textStyle } : {}),
            ...(labelStyle ? { labelStyle } : {}),
          },
          emptyBehavior: emptyBehavior as ViewFieldConfig["emptyBehavior"],
          hideLabel: hideLabel || undefined,
        },
  };
}

function isRoleGroupField(field: ViewFieldConfig): field is ViewFieldConfig & { source: RoleGroupFieldSource } {
  return typeof field.source === "object" && field.source !== null && "kind" in field.source && field.source.kind === "role_group";
}

function hasWritableDerivedRoleGroupField(fields: ViewFieldConfig[], sourceConfig?: SourceConfig) {
  const roleGroupFields = fields.filter(isRoleGroupField);
  if (roleGroupFields.length === 0) {
    return false;
  }

  if (!sourceConfig?.roleGroups?.length) {
    return true;
  }

  return roleGroupFields.some((field) => {
    const group = sourceConfig.roleGroups?.find((entry) => entry.id === field.source.roleGroupId);
    return Boolean(group && isWritableRoleGroup(group));
  });
}

function parseFilterConfig(input: unknown, index: number): ValidationResult<ViewFilterConfig> {
  const path = `filters[${index}]`;
  const errors: string[] = [];

  if (!isRecord(input)) {
    return { success: false, errors: [`${path} must be an object.`] };
  }

  const op = asTrimmedString(input.op);
  if (!FILTER_OPERATORS.includes(op as FilterOperator)) {
    errors.push(`${path}.op must be one of: ${FILTER_OPERATORS.join(", ")}.`);
  }

  const columnId = asOptionalNumber(input.columnId);
  const columnTitle = asOptionalString(input.columnTitle);
  const columnType = asOptionalString(input.columnType);
  if (columnId === undefined && !columnTitle) {
    errors.push(`${path} must define columnId or columnTitle.`);
  }

  const rawValue = input.value;
  let value: ViewFilterConfig["value"] = undefined;
  if (Array.isArray(rawValue)) {
    value = rawValue.map((entry) => (typeof entry === "string" ? entry.trim() : entry));
  } else if (rawValue !== undefined && rawValue !== null) {
    value = typeof rawValue === "string" ? rawValue.trim() : (rawValue as ViewFilterConfig["value"]);
  }

  return {
    success: errors.length === 0,
    errors,
    data: errors.length ? undefined : { columnId, columnTitle, columnType, op: op as FilterOperator, value },
  };
}

function parseSortConfig(input: unknown, index: number): ValidationResult<ViewSortConfig> {
  const path = `defaultSort[${index}]`;
  const errors: string[] = [];

  if (!isRecord(input)) {
    return { success: false, errors: [`${path} must be an object.`] };
  }

  const field = asTrimmedString(input.field);
  const direction = asTrimmedString(input.direction);

  if (!field) {
    errors.push(`${path}.field is required.`);
  }
  if (direction !== "asc" && direction !== "desc") {
    errors.push(`${path}.direction must be "asc" or "desc".`);
  }

  return {
    success: errors.length === 0,
    errors,
    data: errors.length ? undefined : { field, direction: direction as ViewSortConfig["direction"] },
  };
}

function parsePresentationConfig(
  input: unknown,
  fieldKeys: Set<string>,
  /** Keys of fields that are not `render.type === "hidden"` (print layout never resolves hidden fields). */
  nonHiddenFieldKeys: Set<string>,
  peopleGroupFieldKeys: Set<string>,
): ValidationResult<ViewPresentationConfig | undefined> {
  if (input === undefined || input === null || input === "") {
    return { success: true, errors: [], data: undefined };
  }

  if (!isRecord(input)) {
    return { success: false, errors: ["presentation must be an object."] };
  }

  const errors: string[] = [];
  let headingFieldKey = asOptionalString(input.headingFieldKey);
  let summaryFieldKey = asOptionalString(input.summaryFieldKey);
  let indexFieldKey = asOptionalString(input.indexFieldKey);
  const hideRowBadge = asBoolean(input.hideRowBadge, false);
  const rowDividerStyle = asOptionalString(input.rowDividerStyle);
  const validDividerStyles = ["none", "default", "subtle"];
  const dividerStyle = rowDividerStyle && validDividerStyles.includes(rowDividerStyle) ? rowDividerStyle : undefined;
  const hideHeader = asBoolean(input.hideHeader, false);
  const hideHeaderBackLink = asBoolean(input.hideHeaderBackLink, false);
  const hideHeaderSourceLabel = asBoolean(input.hideHeaderSourceLabel, false);
  const hideHeaderPageTitle = asBoolean(input.hideHeaderPageTitle, false);
  const hideHeaderLiveDataText = asBoolean(input.hideHeaderLiveDataText, false);
  const hideHeaderInfoBox = asBoolean(input.hideHeaderInfoBox, false);
  const hideHeaderActiveView = asBoolean(input.hideHeaderActiveView, false);
  const hideHeaderRows = asBoolean(input.hideHeaderRows, false);
  const hideHeaderRefreshed = asBoolean(input.hideHeaderRefreshed, false);
  const headerCustomText = asOptionalString(input.headerCustomText);
  const hideViewTitleSection = asBoolean(input.hideViewTitleSection, false);
  const hideViewTabs = asBoolean(input.hideViewTabs, false);
  const hideViewTabCount = asBoolean(input.hideViewTabCount, false);
  const viewTabLabel = asOptionalString(input.viewTabLabel);
  const hideHeaderLogo = asBoolean(input.hideHeaderLogo, false);
  const linkEmailsInView =
    input.linkEmailsInView === undefined ? undefined : asBoolean(input.linkEmailsInView, true);
  const linkPhonesInView =
    input.linkPhonesInView === undefined ? undefined : asBoolean(input.linkPhonesInView, false);
  let printGroupByFieldKey = asOptionalString(input.printGroupByFieldKey);
  let campusFieldKey = asOptionalString(input.campusFieldKey);
  let programGroupFieldKey = asOptionalString(input.programGroupFieldKey);
  const campusGroupingModeRaw = asOptionalString(input.campusGroupingMode);
  let campusGroupingMode: CampusGroupingMode | undefined;
  if (campusGroupingModeRaw) {
    if (campusGroupingModeRaw !== "grouped") {
      errors.push(`presentation.campusGroupingMode must be \"grouped\" when set.`);
    } else {
      campusGroupingMode = "grouped";
    }
  }
  const showCampusFilter =
    input.showCampusFilter === undefined ? undefined : asBoolean(input.showCampusFilter, false);
  const mergeProgramRowsBySharedEmail = input.mergeProgramRowsBySharedEmail === true;
  const mergeProgramRowsByProgramAndCampus = input.mergeProgramRowsByProgramAndCampus === true;
  if (mergeProgramRowsBySharedEmail && mergeProgramRowsByProgramAndCampus) {
    errors.push(
      "presentation: turn on only one row merge mode — either merge by shared contact email or by same program and campus, not both.",
    );
  }
  let mergePeopleFieldKey = asOptionalString(input.mergePeopleFieldKey);
  let mergePeopleFieldKeys: string[] | undefined;
  if (Array.isArray(input.mergePeopleFieldKeys)) {
    mergePeopleFieldKeys = input.mergePeopleFieldKeys
      .filter((k: unknown): k is string => typeof k === "string")
      .map((k) => k.trim())
      .filter(Boolean)
      .filter((k) => fieldKeys.has(k) && peopleGroupFieldKeys.has(k));
    if (mergePeopleFieldKeys.length === 0) {
      mergePeopleFieldKeys = undefined;
    }
  }
  // Dropped columns / renamed field keys leave stale presentation pointers — clear them instead of failing validation.
  if (headingFieldKey && !fieldKeys.has(headingFieldKey)) {
    headingFieldKey = undefined;
  }
  if (summaryFieldKey && !fieldKeys.has(summaryFieldKey)) {
    summaryFieldKey = undefined;
  }
  if (indexFieldKey && !fieldKeys.has(indexFieldKey)) {
    indexFieldKey = undefined;
  }
  if (
    printGroupByFieldKey &&
    (!fieldKeys.has(printGroupByFieldKey) || !nonHiddenFieldKeys.has(printGroupByFieldKey))
  ) {
    printGroupByFieldKey = undefined;
  }
  if (campusFieldKey && !fieldKeys.has(campusFieldKey)) {
    campusFieldKey = undefined;
  }
  if (programGroupFieldKey && !fieldKeys.has(programGroupFieldKey)) {
    programGroupFieldKey = undefined;
  }
  if (mergePeopleFieldKey && !peopleGroupFieldKeys.has(mergePeopleFieldKey)) {
    mergePeopleFieldKey = undefined;
  }
  const hideCampusFieldInRecordDisplay = input.hideCampusFieldInRecordDisplay === true;
  const showCampusStripOnProgramSections =
    input.showCampusStripOnProgramSections === undefined ? undefined : asBoolean(input.showCampusStripOnProgramSections, true);
  const showProgramSectionHeaders =
    input.showProgramSectionHeaders === undefined ? undefined : asBoolean(input.showProgramSectionHeaders, true);
  const showMergedCampusBadgesOnRecords =
    input.showMergedCampusBadgesOnRecords === undefined ? undefined : asBoolean(input.showMergedCampusBadgesOnRecords, true);
  const campusBadgeStyle = parseCampusBadgeStyle(input.campusBadgeStyle);

  let recordSuppressedFileStatusFieldKey = asOptionalString(input.recordSuppressedFileStatusFieldKey);
  if (recordSuppressedFileStatusFieldKey && !fieldKeys.has(recordSuppressedFileStatusFieldKey)) {
    recordSuppressedFileStatusFieldKey = undefined;
  }
  let recordSuppressedFileStatusValues: string[] | undefined;
  if (Array.isArray(input.recordSuppressedFileStatusValues)) {
    recordSuppressedFileStatusValues = input.recordSuppressedFileStatusValues
      .filter((v: unknown): v is string => typeof v === "string")
      .map((v) => v.trim())
      .filter(Boolean);
    if (recordSuppressedFileStatusValues.length === 0) {
      recordSuppressedFileStatusValues = undefined;
    }
  }
  let recordSuppressedFileRedactFieldKeys: string[] | undefined;
  if (Array.isArray(input.recordSuppressedFileRedactFieldKeys)) {
    recordSuppressedFileRedactFieldKeys = input.recordSuppressedFileRedactFieldKeys
      .filter((v: unknown): v is string => typeof v === "string")
      .map((v) => v.trim())
      .filter(Boolean)
      .filter((k) => fieldKeys.has(k));
    if (recordSuppressedFileRedactFieldKeys.length === 0) {
      recordSuppressedFileRedactFieldKeys = undefined;
    }
  }
  const recordSuppressedFileHideStatusFieldInPublicBody =
    input.recordSuppressedFileHideStatusFieldInPublicBody === undefined
      ? undefined
      : asBoolean(input.recordSuppressedFileHideStatusFieldInPublicBody, true);

  const rawLogoUrl =
    typeof input.headerLogoDataUrl === "string" && input.headerLogoDataUrl.trim()
      ? input.headerLogoDataUrl.trim()
      : undefined;
  const rawLogoAlt =
    typeof input.headerLogoAlt === "string" && input.headerLogoAlt.trim()
      ? input.headerLogoAlt.trim()
      : undefined;
  const logoValidated = validateHeaderLogoPair(rawLogoUrl, rawLogoAlt);
  if (!logoValidated.ok) {
    errors.push(...logoValidated.errors);
  }
  const headerLogoDataUrl = logoValidated.ok ? logoValidated.dataUrl : undefined;
  const headerLogoAlt = logoValidated.ok ? logoValidated.alt : undefined;

  let headerBrandSubline = asOptionalString(input.headerBrandSubline);
  let headerBrandTitle = asOptionalString(input.headerBrandTitle);
  if (headerBrandSubline && headerBrandSubline.length > HEADER_BRAND_TEXT_MAX_LENGTH) {
    errors.push(`presentation.headerBrandSubline must be at most ${HEADER_BRAND_TEXT_MAX_LENGTH} characters.`);
    headerBrandSubline = undefined;
  }
  if (headerBrandTitle && headerBrandTitle.length > HEADER_BRAND_TEXT_MAX_LENGTH) {
    errors.push(`presentation.headerBrandTitle must be at most ${HEADER_BRAND_TEXT_MAX_LENGTH} characters.`);
    headerBrandTitle = undefined;
  }

  if (hideCampusFieldInRecordDisplay && !campusFieldKey) {
    errors.push(`presentation.hideCampusFieldInRecordDisplay requires presentation.campusFieldKey.`);
  }
  if (mergeProgramRowsByProgramAndCampus && (!programGroupFieldKey || !campusFieldKey)) {
    errors.push(
      "presentation.mergeProgramRowsByProgramAndCampus requires presentation.programGroupFieldKey and presentation.campusFieldKey.",
    );
  }

  if (mergeProgramRowsBySharedEmail && peopleGroupFieldKeys.size > 1) {
    const selected =
      mergePeopleFieldKeys?.length && mergePeopleFieldKeys.length > 0
        ? mergePeopleFieldKeys
        : mergePeopleFieldKey && peopleGroupFieldKeys.has(mergePeopleFieldKey)
          ? [mergePeopleFieldKey]
          : [];
    if (selected.length === 0) {
      errors.push(
        `presentation.mergePeopleFieldKeys: when row merge is on and multiple people_group fields exist, select at least one for email matching.`,
      );
    }
  }

  let cardLayout: ViewPresentationConfig["cardLayout"];
  const cardLayoutKeyRows = new Map<string, number[]>();
  let cardLayoutCampusBadgeSlots = 0;
  if (Array.isArray(input.cardLayout)) {
    cardLayout = [];
    for (let i = 0; i < input.cardLayout.length; i++) {
      const row = input.cardLayout[i];
      if (!Array.isArray(row?.fieldKeys)) {
        errors.push(`presentation.cardLayout[${i}].fieldKeys must be an array.`);
      } else {
        const keys = row.fieldKeys.filter((k: unknown) => typeof k === "string").map((k: string) => k.trim()).filter(Boolean);
        for (const key of keys) {
          if (key === CARD_LAYOUT_PLACEHOLDER || key.startsWith(CARD_LAYOUT_TEXT_PREFIX)) continue;
          if (key === CARD_LAYOUT_CAMPUS_BADGES) {
            // Special token — not a field key, no field-key validation needed.
            // Behavior when campusFieldKey is absent and row is not merged: renders empty badge strip (no-op).
            cardLayoutCampusBadgeSlots += 1;
            continue;
          }
          if (!fieldKeys.has(key)) {
            const rowNum = i + 1;
            errors.push(
              `Custom card layout (row ${rowNum}): "${key}" does not match any field on the Fields tab. ` +
                `Under Setup → Custom card layout, replace that slot with a field that still exists, or remove the row. ` +
                `This usually happens after removing or renaming a field, or after replacing separate contact columns with one grouped people field.`,
            );
          } else {
            const rows = cardLayoutKeyRows.get(key) ?? [];
            rows.push(i);
            cardLayoutKeyRows.set(key, rows);
          }
        }
        cardLayout.push({ fieldKeys: keys });
      }
    }
    if (cardLayoutCampusBadgeSlots > 1) {
      errors.push(`presentation.cardLayout: \"${CARD_LAYOUT_CAMPUS_BADGES}\" may appear at most once across all rows.`);
    }
    for (const [key, rowIndices] of cardLayoutKeyRows) {
      if (rowIndices.length > 1) {
        const rows = rowIndices.map((j) => j + 1).join(", ");
        errors.push(
          `Custom card layout: field "${key}" is used in more than one row (rows ${rows}). ` +
            `Each field can appear only once in the layout — merge into a single row or remove the extra slots.`,
        );
      }
    }
  }

  const hasPresentation = Boolean(
    headingFieldKey ||
      summaryFieldKey ||
      indexFieldKey ||
      hideRowBadge ||
      dividerStyle ||
      (cardLayout && cardLayout.length > 0) ||
      hideHeader ||
      hideHeaderBackLink ||
      hideHeaderSourceLabel ||
      hideHeaderPageTitle ||
      hideHeaderLiveDataText ||
      hideHeaderInfoBox ||
      hideHeaderActiveView ||
      hideHeaderRows ||
      hideHeaderRefreshed ||
      headerCustomText ||
      hideViewTitleSection ||
      hideViewTabs ||
      hideViewTabCount ||
      viewTabLabel ||
      Boolean(headerLogoDataUrl && headerLogoAlt) ||
      hideHeaderLogo ||
      headerBrandSubline ||
      headerBrandTitle ||
      linkEmailsInView !== undefined ||
      linkPhonesInView !== undefined ||
      Boolean(printGroupByFieldKey) ||
      Boolean(campusFieldKey) ||
      Boolean(programGroupFieldKey) ||
      Boolean(campusGroupingMode) ||
      showCampusFilter !== undefined ||
      mergeProgramRowsBySharedEmail ||
      mergeProgramRowsByProgramAndCampus ||
      Boolean(mergePeopleFieldKeys?.length) ||
      hideCampusFieldInRecordDisplay ||
      showCampusStripOnProgramSections !== undefined ||
      showProgramSectionHeaders !== undefined ||
      showMergedCampusBadgesOnRecords !== undefined ||
      Boolean(campusBadgeStyle) ||
      Boolean(recordSuppressedFileStatusFieldKey) ||
      Boolean(recordSuppressedFileStatusValues?.length) ||
      Boolean(recordSuppressedFileRedactFieldKeys?.length) ||
      recordSuppressedFileHideStatusFieldInPublicBody !== undefined
  );

  return {
    success: errors.length === 0,
    errors,
    data:
      errors.length || !hasPresentation
        ? undefined
        : {
            headingFieldKey,
            summaryFieldKey,
            indexFieldKey,
            hideRowBadge,
            cardLayout,
            rowDividerStyle: dividerStyle as RowDividerStyle,
            hideHeader,
            hideHeaderBackLink,
            hideHeaderSourceLabel,
            hideHeaderPageTitle,
            hideHeaderLiveDataText,
            hideHeaderInfoBox,
            hideHeaderActiveView,
            hideHeaderRows,
            hideHeaderRefreshed,
            headerCustomText,
            hideViewTitleSection,
            hideViewTabs,
            hideViewTabCount,
            viewTabLabel,
            headerLogoDataUrl,
            headerLogoAlt,
            hideHeaderLogo,
            headerBrandSubline,
            headerBrandTitle,
            ...(linkEmailsInView !== undefined ? { linkEmailsInView } : {}),
            ...(linkPhonesInView !== undefined ? { linkPhonesInView } : {}),
            ...(printGroupByFieldKey ? { printGroupByFieldKey } : {}),
            ...(campusFieldKey ? { campusFieldKey } : {}),
            ...(programGroupFieldKey ? { programGroupFieldKey } : {}),
            ...(campusGroupingMode ? { campusGroupingMode } : {}),
            ...(showCampusFilter !== undefined ? { showCampusFilter } : {}),
            ...(mergeProgramRowsBySharedEmail ? { mergeProgramRowsBySharedEmail: true } : {}),
            ...(mergeProgramRowsByProgramAndCampus ? { mergeProgramRowsByProgramAndCampus: true } : {}),
            ...(mergeProgramRowsBySharedEmail && mergePeopleFieldKeys?.length
              ? { mergePeopleFieldKeys }
              : mergeProgramRowsBySharedEmail && mergePeopleFieldKey
                ? { mergePeopleFieldKey }
                : {}),
            ...(hideCampusFieldInRecordDisplay ? { hideCampusFieldInRecordDisplay: true } : {}),
            ...(showCampusStripOnProgramSections !== undefined ? { showCampusStripOnProgramSections } : {}),
            ...(showProgramSectionHeaders !== undefined ? { showProgramSectionHeaders } : {}),
            ...(showMergedCampusBadgesOnRecords !== undefined ? { showMergedCampusBadgesOnRecords } : {}),
            ...(campusBadgeStyle ? { campusBadgeStyle } : {}),
            ...(recordSuppressedFileStatusFieldKey ? { recordSuppressedFileStatusFieldKey } : {}),
            ...(recordSuppressedFileStatusValues?.length ? { recordSuppressedFileStatusValues } : {}),
            ...(recordSuppressedFileRedactFieldKeys?.length ? { recordSuppressedFileRedactFieldKeys } : {}),
            ...(recordSuppressedFileHideStatusFieldInPublicBody !== undefined
              ? { recordSuppressedFileHideStatusFieldInPublicBody }
              : {}),
          },
  };
}

const STYLE_KEYS: (keyof ViewStyleConfig)[] = [
  "backgroundColor",
  "cardBackground",
  "surfaceMutedBackground",
  "accentColor",
  "textColor",
  "headingTextColor",
  "mutedColor",
  "borderColor",
  "controlBackground",
  "controlText",
  "controlBorder",
  "controlHoverBackground",
  "controlActiveBackground",
  "controlActiveText",
  "fontFamily",
  "headingFontFamily",
  "fontSize",
  "headingFontSize",
  "fieldLabelFontSize",
  "rowHeadingFontSize",
  "fontWeight",
  "headingFontWeight",
  "fieldLabelFontWeight",
  "rowHeadingFontWeight",
  "peopleNameFontWeight",
  "peopleDetailFontWeight",
  "peopleCampusChipBg",
  "peopleCampusChipText",
  "peopleCampusChipBorder",
  "fontStyle",
  "headingFontStyle",
  "fieldLabelLetterSpacing",
  "fieldLabelTextTransform",
  "displayTextFontSize",
  "displayTextFontWeight",
  "displayTextColor",
  "titleTextFontSize",
  "titleTextFontWeight",
  "titleTextColor",
  "subtitleTextFontSize",
  "subtitleTextFontWeight",
  "subtitleTextColor",
  "borderRadius",
  "cardShadow",
  "badgeBg",
  "badgeText",
  "pageTitleFontSize",
  "actionFontSize",
  "valueLinkColor",
  "valueLinkDecoration",
  "headerTopBorderColor",
  "headerTopBorderWidth",
  "headerPanelBackgroundColor",
  "headerPanelBorderColor",
  "headerPanelBorderRadius",
  "headerPanelShadow",
  "headerBrandSublineFontFamily",
  "headerBrandSublineFontSize",
  "headerBrandSublineFontWeight",
  "headerBrandSublineColor",
  "headerBrandTitleFontFamily",
  "headerBrandTitleFontSize",
  "headerBrandTitleFontWeight",
  "headerBrandTitleFontStyle",
  "headerBrandTitleLetterSpacing",
  "headerBrandTitleColor",
  "headerSourceLabelFontFamily",
  "headerSourceLabelFontSize",
  "headerSourceLabelFontWeight",
  "headerSourceLabelLetterSpacing",
  "headerSourceLabelTextTransform",
  "headerSourceLabelColor",
  "headerPageTitleFontFamily",
  "headerPageTitleFontSize",
  "headerPageTitleFontWeight",
  "headerPageTitleFontStyle",
  "headerPageTitleLetterSpacing",
  "headerPageTitleColor",
  "headerLiveBlurbFontSize",
  "headerLiveBlurbColor",
  "headerLiveBlurbStrongColor",
  "primaryColor",
];

function parseStyleConfig(input: unknown): ValidationResult<ViewStyleConfig | undefined> {
  if (input === undefined || input === null || input === "") {
    return { success: true, errors: [], data: undefined };
  }

  if (!isRecord(input)) {
    return { success: false, errors: ["style must be an object."] };
  }

  const style: ViewStyleConfig = {};
  for (const key of STYLE_KEYS) {
    const value = asOptionalString((input as Record<string, unknown>)[key]);
    if (value) {
      (style as Record<string, string>)[key] = value;
    }
  }

  return {
    success: true,
    errors: [],
    data: Object.keys(style).length > 0 ? style : undefined,
  };
}

function parseNumberArray(input: unknown, path: string) {
  const errors: string[] = [];
  if (input === undefined || input === null || input === "") {
    return { errors, values: [] as number[] };
  }
  if (!Array.isArray(input)) {
    return { errors: [`${path} must be an array.`], values: [] as number[] };
  }

  const values: number[] = [];
  for (const [index, entry] of input.entries()) {
    const parsed = asOptionalNumber(entry);
    if (parsed === undefined) {
      errors.push(`${path}[${index}] must be a number.`);
      continue;
    }
    values.push(parsed);
  }

  return {
    errors,
    values: [...new Set(values)],
  };
}

function parseEditingConfig(input: unknown): ValidationResult<ViewEditingConfig | undefined> {
  if (input === undefined || input === null || input === "") {
    return { success: true, errors: [], data: undefined };
  }

  if (!isRecord(input)) {
    return { success: false, errors: ["editing must be an object."] };
  }

  const enabled = asBoolean(input.enabled, false);
  const contactColumnIds = parseNumberArray(input.contactColumnIds, "editing.contactColumnIds");
  const editableColumnIds = parseNumberArray(input.editableColumnIds, "editing.editableColumnIds");
  const errors = [...contactColumnIds.errors, ...editableColumnIds.errors];

  if (enabled && contactColumnIds.values.length === 0) {
    errors.push("editing.contactColumnIds must include at least one column when editing is enabled.");
  }

  const editableFieldGroups = parseEditableFieldGroups(input.editableFieldGroups);
  errors.push(...editableFieldGroups.errors);

  return {
    success: errors.length === 0,
    errors,
    data: errors.length
      ? undefined
      : {
          enabled,
          contactColumnIds: contactColumnIds.values,
          editableColumnIds: editableColumnIds.values,
          editableFieldGroups: editableFieldGroups.data,
          showLoginLink: asBoolean(input.showLoginLink, true),
          showContributorInstructions: asBoolean(input.showContributorInstructions, true),
        },
  };
}

function parseEditableFieldGroups(input: unknown): {
  errors: string[];
  data: EditableFieldGroup[];
} {
  const errors: string[] = [];
  const data: EditableFieldGroup[] = [];

  if (input === undefined || input === null || input === "") {
    return { errors: [], data: [] };
  }

  if (!Array.isArray(input)) {
    return { errors: ["editing.editableFieldGroups must be an array."], data: [] };
  }

  const attrTypes = new Set(["name", "email", "phone", "campus"]);

  for (let i = 0; i < input.length; i++) {
    const item = input[i];
    if (!isRecord(item)) {
      errors.push(`editing.editableFieldGroups[${i}] must be an object.`);
      continue;
    }

    const id = String(item.id ?? `group-${i}`).trim() || `group-${i}`;
    const label = String(item.label ?? "").trim() || `Group ${i + 1}`;
    const attrsInput = Array.isArray(item.attributes) ? item.attributes : [];

    if (attrsInput.length === 0) {
      errors.push(`editing.editableFieldGroups[${i}].attributes must have at least one attribute.`);
      continue;
    }

    const attributes: import("@/lib/config/types").EditableFieldGroupAttribute[] = [];
    for (let j = 0; j < attrsInput.length; j++) {
      const a = attrsInput[j];
      if (!isRecord(a)) {
        errors.push(`editing.editableFieldGroups[${i}].attributes[${j}] must be an object.`);
        continue;
      }
      const attribute = String(a.attribute ?? "").trim().toLowerCase();
      if (!attrTypes.has(attribute)) {
        errors.push(
          `editing.editableFieldGroups[${i}].attributes[${j}].attribute must be "name", "email", "phone", or "campus".`,
        );
        continue;
      }
      const fieldKey = String(a.fieldKey ?? "").trim();
      if (!fieldKey) {
        errors.push(`editing.editableFieldGroups[${i}].attributes[${j}].fieldKey is required.`);
        continue;
      }
      const columnId = asOptionalNumber(a.columnId);
      if (columnId === undefined) {
        errors.push(`editing.editableFieldGroups[${i}].attributes[${j}].columnId must be a number.`);
        continue;
      }
      const columnType = asOptionalString(a.columnType);
      const slot = asOptionalString(a.slot);
      attributes.push({
        attribute: attribute as EditableFieldGroupAttribute["attribute"],
        fieldKey,
        columnId,
        ...(columnType && { columnType }),
        ...(slot && { slot }),
      });
    }

    if (attributes.length > 0) {
      data.push({ id, label, attributes });
    }
  }

  return { errors, data };
}

export function validateSourceConfig(input: unknown): ValidationResult<SourceConfig> {
  const errors: string[] = [];

  if (!isRecord(input)) {
    return { success: false, errors: ["Source config must be an object."] };
  }

  const id = asTrimmedString(input.id);
  const label = asTrimmedString(input.label);
  const sourceType = asTrimmedString(input.sourceType);
  const smartsheetId = asOptionalNumber(input.smartsheetId);
  const fetchOptionsInput = isRecord(input.fetchOptions) ? input.fetchOptions : {};

  if (!id) {
    errors.push("Source id is required.");
  } else {
    const idErr = validateConfigId(id, "Source id");
    if (idErr) {
      errors.push(idErr);
    }
  }
  if (!label) {
    errors.push("Source label is required.");
  }
  if (sourceType !== "sheet" && sourceType !== "report") {
    errors.push('sourceType must be "sheet" or "report".');
  }
  if (smartsheetId === undefined) {
    errors.push("smartsheetId must be a number.");
  }

  const connectionKey = asOptionalString(input.connectionKey);
  if (connectionKey) {
    if (connectionKey.length > MAX_CONNECTION_KEY_LEN) {
      errors.push(`connectionKey must be at most ${MAX_CONNECTION_KEY_LEN} characters.`);
    } else if (!CONNECTION_KEY_PATTERN.test(connectionKey)) {
      errors.push("connectionKey may only use letters, numbers, hyphens, and underscores.");
    } else {
      const configuredKeys = listConfiguredSmartsheetConnectionKeys();
      if (!configuredKeys.includes(connectionKey)) {
        errors.push(
          `connectionKey "${connectionKey}" is not defined. Configured keys: ${configuredKeys.join(", ")}.`,
        );
      }
    }
  }

  const apiBaseUrlErr = validateOptionalSmartsheetApiBaseUrl(input.apiBaseUrl);
  if (apiBaseUrlErr) {
    errors.push(apiBaseUrlErr);
  }

  const level = asOptionalNumber(fetchOptionsInput.level);
  if (fetchOptionsInput.level !== undefined && level === undefined) {
    errors.push("fetchOptions.level must be a number.");
  }

  const roleGroups: SourceRoleGroupConfig[] = [];
  if (Array.isArray(input.roleGroups)) {
    for (const [i, rg] of input.roleGroups.entries()) {
      const res = parseSourceRoleGroup(rg, i);
      errors.push(...res.errors);
      if (res.data) {
        roleGroups.push(res.data);
      }
    }
  }

  if (roleGroups.length > 0) {
    const rgIds = roleGroups.map((g) => g.id);
    if (new Set(rgIds).size !== rgIds.length) {
      errors.push("roleGroups: each role group id must be unique.");
    }
  }

  const formsEnabled =
    input.formsEnabled === undefined ? undefined : asBoolean(input.formsEnabled, true);
  const formSlug = asOptionalString(input.formSlug);
  const formPublic =
    input.formPublic === undefined ? undefined : asBoolean(input.formPublic, false);
  const formPublishedAt = asOptionalString(input.formPublishedAt);
  const formRegisteredAt = asOptionalString(input.formRegisteredAt);
  const formProvenanceRaw = asOptionalString(input.formProvenance);
  const formProvenanceAllowed = new Set(["template", "scratch", "imported", "sample"]);
  let formProvenance: SourceConfig["formProvenance"] | undefined;
  if (formProvenanceRaw) {
    if (!formProvenanceAllowed.has(formProvenanceRaw)) {
      errors.push('formProvenance must be "template", "scratch", "imported", or "sample".');
    } else {
      formProvenance = formProvenanceRaw as SourceConfig["formProvenance"];
    }
  }

  const studentVisible =
    input.studentVisible === undefined ? undefined : asBoolean(input.studentVisible, false);
  const studentEmailColumns = parseNumberArray(input.studentEmailColumnIds, "studentEmailColumnIds");
  errors.push(...studentEmailColumns.errors);

  if (sourceType === "report") {
    if (formPublic) {
      errors.push("Reports cannot be published as forms.");
    }
    if (formsEnabled === true) {
      errors.push("Reports cannot be enabled for Forms (sheets only).");
    }
    if (studentVisible === true) {
      errors.push("Reports cannot be enabled for student discovery (sheets only).");
    }
  }

  return {
    success: errors.length === 0,
    errors,
    data: errors.length
      ? undefined
      : {
          id,
          label,
          sourceType: sourceType as SourceConfig["sourceType"],
          smartsheetId: smartsheetId as number,
          connectionKey,
          apiBaseUrl: asOptionalString(input.apiBaseUrl),
          cacheTtlSeconds: asOptionalNumber(input.cacheTtlSeconds),
          ...(roleGroups.length > 0 ? { roleGroups } : {}),
          fetchOptions: {
            includeObjectValue: asBoolean(fetchOptionsInput.includeObjectValue, true),
            includeColumnOptions: asBoolean(fetchOptionsInput.includeColumnOptions, true),
            level,
          },
          ...(formsEnabled !== undefined ? { formsEnabled } : {}),
          ...(formSlug ? { formSlug } : {}),
          ...(formPublic !== undefined ? { formPublic } : {}),
          ...(formPublishedAt ? { formPublishedAt } : {}),
          ...(formProvenance ? { formProvenance } : {}),
          ...(formRegisteredAt ? { formRegisteredAt } : {}),
          ...(studentVisible !== undefined ? { studentVisible } : {}),
          ...(studentEmailColumns.values.length > 0
            ? { studentEmailColumnIds: studentEmailColumns.values }
            : {}),
        },
  };
}

export function validateViewConfig(
  input: unknown,
  options?: { knownSourceIds?: string[]; sources?: SourceConfig[] },
): ValidationResult<ViewConfig> {
  const errors: string[] = [];

  if (!isRecord(input)) {
    return { success: false, errors: ["View config must be an object."] };
  }

  const id = asTrimmedString(input.id);
  const slug = asTrimmedString(input.slug);
  const sourceId = asTrimmedString(input.sourceId);
  const label = asTrimmedString(input.label);
  const layout = asTrimmedString(input.layout);

  if (!id) {
    errors.push("View id is required.");
  } else {
    const idErr = validateConfigId(id, "View id");
    if (idErr) {
      errors.push(idErr);
    }
  }
  if (!slug) {
    errors.push("View slug is required.");
  } else {
    const slugErr = validatePublicViewSlug(slug);
    if (slugErr) {
      errors.push(slugErr);
    }
  }
  if (!sourceId) {
    errors.push("View sourceId is required.");
  }
  if (options?.knownSourceIds?.length && sourceId && !options.knownSourceIds.includes(sourceId)) {
    errors.push(`sourceId \"${sourceId}\" does not match any known source.`);
  } else if (sourceId) {
    const sidErr = validateConfigId(sourceId, "View sourceId");
    if (sidErr) {
      errors.push(sidErr);
    }
  }
  if (!label) {
    errors.push("View label is required.");
  }
  if (!LAYOUT_TYPES.includes(layout as LayoutType)) {
    errors.push(`layout must be one of: ${LAYOUT_TYPES.join(", ")}.`);
  }

  const sourceForRoleGroups = options?.sources?.find((s) => s.id === sourceId);
  const knownRoleGroupIds =
    sourceForRoleGroups?.roleGroups && sourceForRoleGroups.roleGroups.length > 0
      ? new Set(sourceForRoleGroups.roleGroups.map((g) => g.id))
      : undefined;

  const defaultSort: ViewSortConfig[] = [];
  for (const [index, sort] of (Array.isArray(input.defaultSort) ? input.defaultSort : []).entries()) {
    const result = parseSortConfig(sort, index);
    errors.push(...result.errors);
    if (result.data) {
      defaultSort.push(result.data);
    }
  }

  const filters: ViewFilterConfig[] = [];
  for (const [index, filter] of (Array.isArray(input.filters) ? input.filters : []).entries()) {
    const result = parseFilterConfig(filter, index);
    errors.push(...result.errors);
    if (result.data) {
      filters.push(result.data);
    }
  }

  const fields: ViewFieldConfig[] = [];
  for (const [index, field] of (Array.isArray(input.fields) ? input.fields : []).entries()) {
    const result = parseFieldConfig(field, index, { knownRoleGroupIds });
    errors.push(...result.errors);
    if (result.data) {
      fields.push(result.data);
    }
  }

  if (fields.length === 0) {
    errors.push("View must define at least one field.");
  }

  if (fields.length > 0) {
    const keys = fields.map((field) => field.key);
    if (new Set(keys).size !== keys.length) {
      errors.push("fields: each field key must be unique.");
    }
  }

  const fieldKeys = new Set(fields.map((field) => field.key));
  const nonHiddenFieldKeys = new Set(
    fields.filter((field) => field.render.type !== "hidden").map((field) => field.key),
  );
  const peopleGroupFieldKeys = new Set(
    fields.filter((field) => field.render.type === "people_group").map((field) => field.key),
  );
  const presentationResult = parsePresentationConfig(
    input.presentation,
    fieldKeys,
    nonHiddenFieldKeys,
    peopleGroupFieldKeys,
  );
  const styleResult = parseStyleConfig(input.style);
  const editingResult = parseEditingConfig(input.editing);
  errors.push(...presentationResult.errors, ...styleResult.errors, ...editingResult.errors);

  const hasConfiguredEditableContent =
    (editingResult.data?.editableColumnIds.length ?? 0) > 0 || (editingResult.data?.editableFieldGroups?.length ?? 0) > 0;
  const hasDerivedRoleGroupEditableContent = hasWritableDerivedRoleGroupField(fields, sourceForRoleGroups);
  if (editingResult.data?.enabled && !hasConfiguredEditableContent && !hasDerivedRoleGroupEditableContent) {
    errors.push(
      "Select at least one Editable Field (what contributors can edit), add a Multi-person field group, or include a writable role-group field. Contact columns only define who can edit, not what."
    );
  }

  const displayTimeZoneRaw = asOptionalString(input.displayTimeZone);
  let displayTimeZone: string | undefined;
  if (displayTimeZoneRaw) {
    if (!isValidIanaTimeZone(displayTimeZoneRaw)) {
      errors.push('displayTimeZone must be a valid IANA time zone (e.g. "America/Los_Angeles").');
    } else {
      displayTimeZone = displayTimeZoneRaw;
    }
  }

  return {
    success: errors.length === 0,
    errors,
    data: errors.length
      ? undefined
      : {
          id,
          slug: normalizePublishedSlug(slug),
          sourceId,
          label,
          description: asOptionalString(input.description),
          layout: layout as LayoutType,
          public: asBoolean(input.public),
          tabOrder: asOptionalNumber(input.tabOrder),
          filters,
          defaultSort,
          presentation: presentationResult.data,
          style: styleResult.data,
          fixedLayout: asBoolean(input.fixedLayout),
          themePresetId: asOptionalString(input.themePresetId),
          ...(displayTimeZone ? { displayTimeZone } : {}),
          editing: editingResult.data,
          fields,
        },
  };
}
