import { slugify } from "@/lib/utils";
import { isRoleGroupFieldSource } from "@/lib/role-groups";
import type {
  FieldSourceSelector,
  SmartsheetColumn,
  SourceConfig,
  SourceRoleGroupConfig,
  TransformConfig,
  ViewConfig,
  ViewEditingConfig,
  ViewFieldConfig,
  ViewFieldSource,
  ViewFilterConfig,
  ViewSortConfig,
} from "@/lib/config/types";

export type ViewBuilderTab = "setup" | "fields" | "filters" | "editing" | "preview";

export function createEmptyFilter(): ViewFilterConfig {
  return {
    columnTitle: "",
    op: "equals",
    value: "",
  };
}

export function createEmptySort(): ViewSortConfig {
  return {
    field: "",
    direction: "asc",
  };
}

const COLUMN_TYPE_SUGGESTIONS: Record<string, { render: ViewFieldConfig["render"]["type"]; transforms?: TransformConfig[] }> = {
  TEXT_NUMBER: { render: "text" },
  DATE: { render: "date", transforms: [{ op: "format_date" }] },
  DATETIME: { render: "date", transforms: [{ op: "format_date" }] },
  PICKLIST: { render: "badge" },
  MULTI_PICKLIST: { render: "list", transforms: [{ op: "split" }] },
  CONTACT_LIST: { render: "mailto", transforms: [{ op: "contact_emails" }] },
  MULTI_CONTACT_LIST: { render: "mailto_list", transforms: [{ op: "contact_emails" }] },
  CHECKBOX: { render: "badge" },
  DURATION: { render: "text" },
  ABSTRACT_DATETIME: { render: "date", transforms: [{ op: "format_date" }] },
};

function columnTitleToBaseKey(col: SmartsheetColumn): string {
  return col.title
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "") || `col_${col.id}`;
}

function columnToKey(col: SmartsheetColumn, usedKeys: Set<string>): string {
  const base = columnTitleToBaseKey(col);
  if (!usedKeys.has(base)) {
    usedKeys.add(base);
    return base;
  }
  let n = 2;
  while (usedKeys.has(`${base}_${n}`)) {
    n += 1;
  }
  const key = `${base}_${n}`;
  usedKeys.add(key);
  return key;
}

export function columnToField(col: SmartsheetColumn, displayName: string | undefined, usedKeys: Set<string>): ViewFieldConfig {
  const suggestion = COLUMN_TYPE_SUGGESTIONS[col.type ?? "TEXT_NUMBER"] ?? { render: "text" as const };
  return {
    key: columnToKey(col, usedKeys),
    label: displayName ?? col.title,
    source: { columnTitle: col.title, columnId: col.id, columnType: col.type },
    transforms: suggestion.transforms ?? [],
    render: { type: suggestion.render },
  };
}

export function buildInitialView(view: ViewConfig | null, sources: SourceConfig[]): ViewConfig {
  if (view) return view;
  const firstSource = sources[0];
  const label = firstSource?.label ?? "";
  const slug = slugify(label);
  return {
    id: slug,
    slug,
    sourceId: firstSource?.id ?? "",
    label,
    description: "",
    layout: "table",
    public: false,
    tabOrder: 1,
    presentation: {
      headingFieldKey: "",
      summaryFieldKey: "",
    },
    filters: [],
    defaultSort: [],
    fields: [],
  };
}

export function parseOptionalNumber(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function createEditingConfigState(current?: ViewEditingConfig): ViewEditingConfig {
  return {
    enabled: current?.enabled ?? false,
    contactColumnIds: current?.contactColumnIds ?? [],
    editableColumnIds: current?.editableColumnIds ?? [],
    editableFieldGroups: current?.editableFieldGroups ?? [],
    showLoginLink: current?.showLoginLink !== false,
    showContributorInstructions: current?.showContributorInstructions !== false,
  };
}

export function toggleNumberSelection(values: number[], id: number, checked: boolean) {
  if (checked) {
    return values.includes(id) ? values : [...values, id];
  }
  return values.filter((value) => value !== id);
}

export const FETCH_CREDENTIALS: RequestCredentials = "include";

export type ExistingViewMeta = Pick<ViewConfig, "id" | "label" | "slug" | "sourceId" | "public">;
export type RoleGroupOverlapWarning = {
  roleFieldKey: string;
  roleFieldLabel: string;
  roleGroupId: string;
  overlappingFields: Array<{
    key: string;
    label: string;
    sourceLabel: string;
  }>;
};

export function normalizedCompareKey(value: string | null | undefined) {
  return (value ?? "").trim().toLowerCase();
}

function selectorsMatch(left?: FieldSourceSelector, right?: FieldSourceSelector) {
  if (!left || !right) {
    return false;
  }
  if (typeof left.columnId === "number" && typeof right.columnId === "number" && left.columnId === right.columnId) {
    return true;
  }
  const leftTitle = normalizedCompareKey(left.columnTitle);
  const rightTitle = normalizedCompareKey(right.columnTitle);
  return Boolean(leftTitle && rightTitle && leftTitle === rightTitle);
}

function collectRawFieldSelectors(source: ViewFieldSource): FieldSourceSelector[] {
  return [
    { columnId: source.columnId, columnTitle: source.columnTitle, columnType: source.columnType },
    { columnId: source.preferredColumnId, columnTitle: source.preferredColumnTitle, columnType: source.preferredColumnType },
    { columnId: source.fallbackColumnId, columnTitle: source.fallbackColumnTitle, columnType: source.fallbackColumnType },
    ...(source.coalesce ?? []),
  ].filter((selector) => typeof selector.columnId === "number" || Boolean(selector.columnTitle?.trim()));
}

function collectRoleGroupSelectors(group: SourceRoleGroupConfig): FieldSourceSelector[] {
  if (group.mode === "numbered_slots") {
    return (group.slots ?? [])
      .flatMap((slot) => [slot.name, slot.email, slot.phone, slot.campus])
      .filter((selector): selector is FieldSourceSelector => Boolean(selector));
  }

  return [group.delimited?.name?.source, group.delimited?.email?.source, group.delimited?.phone?.source].filter(
    (selector): selector is FieldSourceSelector => Boolean(selector)
  );
}

export function rawFieldOverlapsRoleGroup(field: ViewFieldConfig, group: SourceRoleGroupConfig) {
  if (isRoleGroupFieldSource(field.source)) {
    return false;
  }

  const rawSelectors = collectRawFieldSelectors(field.source as ViewFieldSource);
  const roleSelectors = collectRoleGroupSelectors(group);
  return rawSelectors.some((rawSelector) => roleSelectors.some((roleSelector) => selectorsMatch(rawSelector, roleSelector)));
}
