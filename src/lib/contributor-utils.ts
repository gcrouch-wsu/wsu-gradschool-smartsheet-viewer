import type {
  EditableFieldGroup,
  EditableFieldGroupAttribute,
  RenderType,
  ResolvedFieldValue,
  ResolvedPersonRoleEntry,
  ResolvedViewRow,
  SmartsheetCell,
  SmartsheetColumn,
  SmartsheetRow,
  SourceConfig,
  ViewConfig,
  ViewFieldConfig,
} from "@/lib/config/types";
import { applyViewFilters } from "@/lib/filters";
import { isRoleGroupFieldSource, isUnsafeDelimitedRoleGroup } from "@/lib/role-groups";
import { normalizeColumnKey } from "@/lib/smartsheet-column-key";
import { normalizeSourceValue, toContactList } from "@/lib/transforms";

const CONTRIBUTOR_CONTACT_COLUMN_TYPES = new Set(["CONTACT_LIST", "MULTI_CONTACT_LIST"]);
const CONTRIBUTOR_EDITABLE_COLUMN_TYPES = new Set([
  "TEXT_NUMBER",
  "PICKLIST",
  "MULTI_PICKLIST",
  "PHONE",
  "CONTACT_LIST",
  "MULTI_CONTACT_LIST",
]);
const CONTRIBUTOR_EDITABLE_RENDER_TYPES = new Set<RenderType>([
  "text",
  "multiline_text",
  "badge",
  "phone",
  "mailto",
  "mailto_list",
]);

/** True if this display row or any merged source row is contributor-editable. */
export function isContributorRowOrMergedEditable(row: ResolvedViewRow, editableRowIds: Set<number> | undefined): boolean {
  if (!editableRowIds?.size) {
    return false;
  }
  if (editableRowIds.has(row.id)) {
    return true;
  }
  return row.mergedSourceRowIds?.some((id) => editableRowIds.has(id)) ?? false;
}

/** Smartsheet row id to open in the edit drawer (primary row, or first merged id the contributor may edit). */
export function contributorEditTargetRowId(row: ResolvedViewRow, editableRowIds: Set<number> | undefined): number {
  if (editableRowIds?.has(row.id)) {
    return row.id;
  }
  const merged = row.mergedSourceRowIds?.find((id) => editableRowIds?.has(id));
  return merged ?? row.id;
}

export type ContactDisplayMode = "email" | "name";

export interface ContributorEditableFieldDefinition {
  columnId: number;
  columnType: "TEXT_NUMBER" | "PICKLIST" | "MULTI_PICKLIST" | "PHONE" | "CONTACT_LIST" | "MULTI_CONTACT_LIST";
  fieldKey: string;
  label: string;
  /** Smartsheet column title (preferred label in the edit UI). */
  columnTitle: string;
  renderType: "text" | "multiline_text" | "badge" | "phone" | "mailto" | "mailto_list";
  options?: string[];
  /** For CONTACT_LIST/MULTI_CONTACT_LIST: whether display shows emails or names. Used to reverse transform on write. */
  contactDisplayMode?: ContactDisplayMode;
}

/**
 * Minimal resolved field for contributor drawer ordering when {@link ResolvedView} metadata
 * omits the key (e.g. hidden fields or campus stripped from `ResolvedView.fields`).
 */
export function contributorResolvedFieldStub(ed: ContributorEditableFieldDefinition): ResolvedFieldValue {
  return {
    key: ed.fieldKey,
    label: ed.label,
    renderType: ed.renderType,
    textValue: "",
    listValue: [],
    links: [],
    isEmpty: true,
    hideWhenEmpty: false,
    hideLabel: false,
  };
}

export interface ContributorEditingClientConfig {
  contactColumnIds: number[];
  editableColumnIds: number[];
  fieldColumnMap: Record<number, string>;
  editableFields: ContributorEditableFieldDefinition[];
  editableFieldGroups: EditableFieldGroup[];
}

/** Person object for multi-person fields: name, email, phone, optional per-slot campus. */
export interface MultiPersonEntry {
  name: string;
  email: string;
  phone: string;
  campus: string;
}

function trimMultiPersonText(value: string | undefined | null): string {
  return typeof value === "string" ? value.trim() : "";
}

/**
 * Map a resolved role-group row into editor state. Rows marked {@link ResolvedPersonRoleEntry.isEmpty}
 * never contribute name/email/phone (campus may still appear for picker display); this avoids
 * phantom partial contacts on unused numbered slots passing through to validation.
 */
export function multiPersonEntryFromRoleRow(p: ResolvedPersonRoleEntry): MultiPersonEntry {
  if (p.isEmpty) {
    return {
      name: "",
      email: "",
      phone: "",
      campus: trimMultiPersonText(p.campus),
    };
  }
  return {
    name: trimMultiPersonText(p.name),
    email: trimMultiPersonText(p.email),
    phone: trimMultiPersonText(p.phone),
    campus: trimMultiPersonText(p.campus),
  };
}

/** Per-person validation messages for multi-person groups (name/email required when those columns exist). */
export type MultiPersonFieldErrors = { name?: string; email?: string };

/** True when a numbered slot has no contact data — optional campus alone does not count as "in use". */
export function isMultiPersonSlotContactEmpty(p: MultiPersonEntry): boolean {
  return (
    !trimMultiPersonText(p.name) && !trimMultiPersonText(p.email) && !trimMultiPersonText(p.phone)
  );
}

/**
 * Returns groupId → (personIndex → field errors). Empty object means OK to save (including zero people in a group).
 *
 * Name and email are **not** cross-required: Smartsheet may already have only a name or only an email for a role
 * slot, and requiring both blocked saves when editing unrelated fields (e.g. layout visibility).
 */
export function validateMultiPersonGroupsForSave(
  groups: EditableFieldGroup[],
  groupValues: Record<string, MultiPersonEntry[]>,
): Record<string, Record<number, MultiPersonFieldErrors>> {
  void groups;
  void groupValues;
  return {};
}

export function hasMultiPersonValidationErrors(errors: Record<string, Record<number, MultiPersonFieldErrors>>): boolean {
  return Object.values(errors).some((perPerson) => Object.keys(perPerson).length > 0);
}

function isPartialContactObjectValue(ov: unknown): boolean {
  if (ov == null || typeof ov !== "object") {
    return false;
  }
  const o = ov as Record<string, unknown>;
  if (o.objectType !== "CONTACT") {
    return false;
  }
  const email = typeof o.email === "string" ? o.email.trim() : "";
  const name = typeof o.name === "string" ? o.name.trim() : "";
  return Boolean(email || name) && !(Boolean(email) && Boolean(name));
}

function existingContactFromSmartsheetCell(cell: SmartsheetCell | undefined): { email?: string; name?: string } | null {
  if (!cell) {
    return null;
  }
  const ov = cell.objectValue;
  if (ov && typeof ov === "object") {
    const o = ov as Record<string, unknown>;
    if (o.objectType === "CONTACT") {
      const email = typeof o.email === "string" ? o.email.trim() : "";
      const name = typeof o.name === "string" ? o.name.trim() : "";
      if (email || name) {
        return {
          ...(email ? { email } : {}),
          ...(name ? { name } : {}),
        };
      }
      return null;
    }
  }
  const raw =
    (typeof cell.displayValue === "string" && cell.displayValue.trim()) ||
    (typeof cell.value === "string" ? cell.value.trim() : "");
  if (!raw) {
    return null;
  }
  if (raw.includes("@")) {
    return { email: raw };
  }
  return { name: raw };
}

/**
 * CONTACT_LIST writes from contact_names (name-only display) send `{ objectType: "CONTACT", name }` without email.
 * Merge with the sheet row's current cell so the PUT payload retains existing email (same for email-only updates).
 */
export function mergeContributorContactPayloadWithExistingRow<
  T extends { columnId: number; value?: unknown; objectValue?: unknown },
>(cells: T[], row: SmartsheetRow, columnTypeById: Map<number, string>): T[] {
  return cells.map((cell) => {
    const columnType = columnTypeById.get(cell.columnId) ?? "";
    if (columnType !== "CONTACT_LIST" || cell.objectValue === undefined || cell.objectValue === null) {
      return cell;
    }
    if (!isPartialContactObjectValue(cell.objectValue)) {
      return cell;
    }
    const base = existingContactFromSmartsheetCell(row.cellsById[cell.columnId]);
    if (!base) {
      return cell;
    }
    const incoming = cell.objectValue as Record<string, unknown>;
    const inEmail = typeof incoming.email === "string" ? incoming.email.trim() : "";
    const inName = typeof incoming.name === "string" ? incoming.name.trim() : "";
    const merged: { objectType: "CONTACT"; email?: string; name?: string } = { objectType: "CONTACT" };
    if (inEmail) {
      merged.email = inEmail;
    } else if (base.email) {
      merged.email = base.email;
    }
    if (inName) {
      merged.name = inName;
    } else if (base.name) {
      merged.name = base.name;
    }
    return { ...cell, objectValue: merged };
  });
}

const MULTI_PERSON_DELIMITERS = /[,;\r\n]+/;

/** Parse a cell value into an array of strings (one per person/position). Splits on comma, semicolon, and newlines. */
export function parseMultiPersonValue(value: string | null | undefined): string[] {
  if (value == null || typeof value !== "string") return [];
  return value
    .split(MULTI_PERSON_DELIMITERS)
    .map((s) => s.trim())
    .filter(Boolean);
}

function stringsForMultiPersonAttribute(field: ResolvedFieldValue | undefined): string[] {
  if (!field) {
    return [];
  }
  // parseMultiPersonValue(textValue) splits the raw comma-separated string correctly.
  // listValue is built by the rendering pipeline, which can lose entries in two ways:
  //   1. "text" render type → listValue = [whole string as one element] (never split)
  //   2. "phone"/"list" render types → uniqueStrings() deduplicates identical values,
  //      so two people with the same phone number collapse to one entry.
  // Prefer whichever path produces more entries.
  const fromText = parseMultiPersonValue(field.textValue ?? "");
  const fromList = field.listValue
    .map((s) => String(s).trim())
    .filter((s) => s.length > 0);
  if (fromText.length >= fromList.length) {
    return fromText;
  }
  return fromList;
}

/** Parse a row's field values into person entries. Aligns by index across attributes. */
export function parseMultiPersonRow(
  row: ResolvedViewRow,
  group: EditableFieldGroup,
): MultiPersonEntry[] {
  if (group.fromRoleGroupViewFieldKey) {
    const people = row.fieldMap[group.fromRoleGroupViewFieldKey]?.people;
    if (!people?.length) {
      return normalizeFixedSlotPersonsForEdit(group, []);
    }
    const slotOrder = slotOrderFromAttributes(group.attributes);
    if (slotOrder.length === 0) {
      const mapped = people.map((p) => multiPersonEntryFromRoleRow(p));
      return normalizeFixedSlotPersonsForEdit(group, mapped);
    }
    const bySlot = new Map<string, MultiPersonEntry>();
    for (const p of people) {
      bySlot.set(String(p.slot), multiPersonEntryFromRoleRow(p));
    }
    const mapped = slotOrder.map(
      (slot) => bySlot.get(slot) ?? { name: "", email: "", phone: "", campus: "" },
    );
    return normalizeFixedSlotPersonsForEdit(group, mapped);
  }

  const attrArrays = group.attributes.map((attr) => {
    const field = row.fieldMap[attr.fieldKey];
    return stringsForMultiPersonAttribute(field);
  });

  const lengths = attrArrays.map((a) => a.length);
  const maxLen = Math.max(0, ...lengths);
  if (maxLen === 0) {
    return [];
  }

  const persons: MultiPersonEntry[] = [];

  const defaults: MultiPersonEntry = { name: "", email: "", phone: "", campus: "" };

  for (let i = 0; i < maxLen; i++) {
    const entry: MultiPersonEntry = { ...defaults };
    for (let j = 0; j < group.attributes.length; j++) {
      const attr = group.attributes[j];
      const arr = attrArrays[j];
      const val = arr?.[i] ?? "";
      if (attr.attribute === "name") entry.name = val;
      else if (attr.attribute === "email") entry.email = val;
      else if (attr.attribute === "phone") entry.phone = val;
      else if (attr.attribute === "campus") entry.campus = val;
    }
    persons.push(entry);
  }

  return normalizeFixedSlotPersonsForEdit(group, persons);
}

const CONTACT_DISPLAY_DELIMITERS = /[,;]+/;

/** Smartsheet-ready objectValue from a contributor’s edited contact display string (not including empty single-contact clear). */
export type SerializedContactDisplayObjectValue =
  | { objectType: "CONTACT"; email: string }
  | { objectType: "CONTACT"; name: string }
  | {
      objectType: "MULTI_CONTACT";
      values: Array<{ objectType: "CONTACT"; email?: string; name?: string }>;
    };

/**
 * Convert edited display string back to Smartsheet objectValue for CONTACT_LIST / MULTI_CONTACT_LIST.
 *
 * **Empty CONTACT_LIST:** returns `null` — callers should send `{ columnId, value: "" }` to clear (valid on PUT).
 * **Empty MULTI_CONTACT_LIST:** returns `{ objectType: "MULTI_CONTACT", values: [] }`.
 */
export function serializeContactDisplayToObjectValue(
  displayValue: string,
  columnType: "CONTACT_LIST" | "MULTI_CONTACT_LIST",
  contactDisplayMode: ContactDisplayMode,
): SerializedContactDisplayObjectValue | null {
  const tokens = displayValue
    .split(CONTACT_DISPLAY_DELIMITERS)
    .map((s) => s.trim())
    .filter(Boolean);

  if (tokens.length === 0) {
    // Both CONTACT_LIST and MULTI_CONTACT_LIST clear via { value: "" }.
    // Smartsheet error 1012 rejects { objectType: "MULTI_CONTACT", values: [] }.
    return null;
  }

  if (columnType === "CONTACT_LIST") {
    const first = tokens[0]!;
    return contactDisplayMode === "email"
      ? { objectType: "CONTACT", email: first }
      : { objectType: "CONTACT", name: first };
  }

  const values = tokens.map((token) =>
    contactDisplayMode === "email"
      ? { objectType: "CONTACT" as const, email: token }
      : { objectType: "CONTACT" as const, name: token },
  );
  return { objectType: "MULTI_CONTACT", values };
}

/** Serialize person entries back to cell values. Uses value for TEXT_NUMBER/PHONE, objectValue for CONTACT_LIST/MULTI_CONTACT_LIST. */
function compareSlotIds(a: string, b: string): number {
  const na = Number(a);
  const nb = Number(b);
  if (Number.isFinite(na) && Number.isFinite(nb)) {
    return na - nb;
  }
  return a.localeCompare(b, undefined, { numeric: true });
}

function slotOrderFromAttributes(attributes: EditableFieldGroup["attributes"]): string[] {
  const order: string[] = [];
  for (const attr of attributes) {
    if (attr.slot && !order.includes(attr.slot)) {
      order.push(attr.slot);
    }
  }
  return order.sort(compareSlotIds);
}

/** Distinct slot ids in contributor/serializer order (numeric sort). */
export function slotOrderForEditableGroup(group: EditableFieldGroup): string[] {
  return slotOrderFromAttributes(group.attributes);
}

/**
 * Ensures numbered-slot contributor groups always expose one editor row per slot,
 * even when the Smartsheet row or resolved people_group field is blank.
 */
export function normalizeFixedSlotPersonsForEdit(
  group: EditableFieldGroup,
  persons: MultiPersonEntry[],
): MultiPersonEntry[] {
  if (!group.usesFixedSlots) {
    return persons;
  }
  const slotOrder = slotOrderFromAttributes(group.attributes);
  const n = slotOrder.length;
  if (n === 0) {
    return persons;
  }
  const empty: MultiPersonEntry = { name: "", email: "", phone: "", campus: "" };
  const next = persons.slice(0, n);
  while (next.length < n) {
    next.push({ ...empty });
  }
  return next;
}

/** Distinct slot count for a fixed-slot editable group (for UI labels). */
export function countFixedSlotsInEditableGroup(group: EditableFieldGroup): number {
  if (!group.usesFixedSlots) {
    return 0;
  }
  return slotOrderFromAttributes(group.attributes).length;
}

function contactSlotMergeKey(slot: string, columnId: number): string {
  return `${slot}\0${columnId}`;
}

/**
 * Fixed-slot serializer: one PATCH cell per (slot, columnId) for contact columns.
 * Numbered role groups may map both name and email to the same Smartsheet CONTACT column; emitting
 * two cells duplicated columnId and the API kept last-write-wins, dropping one attribute.
 */
function serializeSlotBasedMultiPersonToCells(
  persons: MultiPersonEntry[],
  group: EditableFieldGroup & { attributes: Array<EditableFieldGroupAttribute & { columnType?: string }> },
): Array<{ columnId: number; value?: string; objectValue?: unknown }> {
  const slotOrder = slotOrderFromAttributes(group.attributes);
  const result: Array<{ columnId: number; value?: string; objectValue?: unknown }> = [];
  const isContact = (t?: string) => t === "CONTACT_LIST" || t === "MULTI_CONTACT_LIST";

  const mergedContactByKey = new Map<
    string,
    { columnId: number; columnType: string; contact: { objectType: "CONTACT"; email?: string; name?: string } }
  >();

  for (const attr of group.attributes) {
    if (!attr.slot || !isContact(attr.columnType)) {
      continue;
    }
    const personIdx = slotOrder.indexOf(attr.slot);
    const p = persons[personIdx] ?? { name: "", email: "", phone: "", campus: "" };
    const mk = contactSlotMergeKey(attr.slot, attr.columnId);
    let entry = mergedContactByKey.get(mk);
    if (!entry) {
      entry = {
        columnId: attr.columnId,
        columnType: attr.columnType as string,
        contact: { objectType: "CONTACT" },
      };
      mergedContactByKey.set(mk, entry);
    }
    if (attr.attribute === "email" && p.email.trim()) {
      entry.contact.email = p.email.trim();
    }
    if (attr.attribute === "name" && p.name.trim()) {
      entry.contact.name = p.name.trim();
    }
  }

  const emittedContact = new Set<string>();

  for (const attr of group.attributes) {
    if (!attr.slot) {
      continue;
    }
    const personIdx = slotOrder.indexOf(attr.slot);
    const p = persons[personIdx] ?? { name: "", email: "", phone: "", campus: "" };
    const slotContactEmpty = isMultiPersonSlotContactEmpty(p);

    if (isContact(attr.columnType)) {
      const mk = contactSlotMergeKey(attr.slot, attr.columnId);
      if (emittedContact.has(mk)) {
        continue;
      }
      emittedContact.add(mk);
      const merged = mergedContactByKey.get(mk)!;
      const c = merged.contact;
      if (!c.email && !c.name) {
        result.push({ columnId: merged.columnId, value: "" });
      } else if (merged.columnType === "MULTI_CONTACT_LIST") {
        result.push({
          columnId: merged.columnId,
          objectValue: { objectType: "MULTI_CONTACT" as const, values: [c] },
        });
      } else {
        result.push({ columnId: merged.columnId, objectValue: c });
      }
      continue;
    }

    const val = slotContactEmpty
      ? ""
      : attr.attribute === "name"
        ? p.name.trim()
        : attr.attribute === "email"
          ? p.email.trim()
          : attr.attribute === "campus"
            ? p.campus.trim()
            : p.phone.trim();
    result.push({ columnId: attr.columnId, value: val });
  }

  return result;
}

export function serializeMultiPersonToCells(
  persons: MultiPersonEntry[],
  group: EditableFieldGroup & { attributes: Array<EditableFieldGroupAttribute & { columnType?: string }> },
): Array<{ columnId: number; value?: string; objectValue?: unknown }> {
  const isContact = (t?: string) =>
    t === "CONTACT_LIST" || t === "MULTI_CONTACT_LIST";

  const usesSlots = group.attributes.length > 0 && group.attributes.every((a) => a.slot != null && a.slot !== "");
  if (usesSlots) {
    return serializeSlotBasedMultiPersonToCells(persons, group);
  }

  const contactAttrsByColumn = new Map<number, Array<typeof group.attributes[0]>>();
  const nonContactAttrs: Array<typeof group.attributes[0]> = [];

  for (const attr of group.attributes) {
    if (isContact(attr.columnType)) {
      const arr = contactAttrsByColumn.get(attr.columnId) ?? [];
      arr.push(attr);
      contactAttrsByColumn.set(attr.columnId, arr);
    } else {
      nonContactAttrs.push(attr);
    }
  }

  const result: Array<{ columnId: number; value?: string; objectValue?: unknown }> = [];

  for (const [columnId, attrs] of contactAttrsByColumn) {
    const hasEmail = attrs.some((a) => a.attribute === "email");
    const hasName = attrs.some((a) => a.attribute === "name");
    const value = persons
      .map((p) => {
        const c: { objectType: "CONTACT"; email?: string; name?: string } = {
          objectType: "CONTACT",
        };
        if (hasEmail && p.email.trim()) c.email = p.email.trim();
        if (hasName && p.name.trim()) c.name = p.name.trim();
        return c;
      })
      .filter((c) => {
        const hasAny = Boolean(
          (typeof c.email === "string" && c.email.trim()) || (typeof c.name === "string" && c.name.trim()),
        );
        return hasAny;
      });
    const colType = attrs[0]!.columnType as string;
    if (colType === "CONTACT_LIST") {
      if (value.length === 0) {
        result.push({ columnId, value: "" });
      } else {
        result.push({ columnId, objectValue: value[0]! });
      }
    } else {
      if (value.length === 0) {
        result.push({ columnId, value: "" });
      } else {
        result.push({ columnId, objectValue: { objectType: "MULTI_CONTACT" as const, values: value } });
      }
    }
  }

  for (const attr of nonContactAttrs) {
    const values = persons.map((p) => {
      if (attr.attribute === "name") return p.name.trim();
      if (attr.attribute === "email") return p.email.trim();
      if (attr.attribute === "phone") return p.phone.trim();
      if (attr.attribute === "campus") return p.campus.trim();
      return "";
    });
    const joined = values.filter(Boolean).join(", ");
    result.push({ columnId: attr.columnId, value: joined });
  }

  return result;
}

/**
 * Server-side guard for contributor PATCH: strict picklists must match column options; empty string clears.
 * Rejects `objectValue` on PICKLIST / MULTI_PICKLIST (wrong shape for our contributor API).
 */
export function validateContributorPicklistCells(
  cells: Array<{ columnId: number; value?: unknown; objectValue?: unknown }>,
  columnsById: Map<number, SmartsheetColumn>,
): { ok: true } | { ok: false; error: string } {
  for (const cell of cells) {
    const column = columnsById.get(cell.columnId);
    if (!column || (column.type !== "PICKLIST" && column.type !== "MULTI_PICKLIST")) {
      continue;
    }
    const hasObject = cell.objectValue !== undefined && cell.objectValue !== null;
    if (hasObject) {
      return { ok: false, error: "Picklist fields must send a plain value, not objectValue." };
    }
    const opts = (column.options ?? []).filter((o): o is string => typeof o === "string" && o.length > 0);
    if (opts.length === 0) {
      continue;
    }
    const str = cell.value === undefined || cell.value === null ? "" : String(cell.value).trim();
    if (str === "") {
      continue;
    }
    if (column.type === "MULTI_PICKLIST") {
      const parts = str
        .split(/[,;\n]+/)
        .map((p) => p.trim())
        .filter(Boolean);
      for (const part of parts) {
        if (!opts.includes(part)) {
          const label = column.title?.trim() || "this field";
          return {
            ok: false,
            error: `"${part}" is not a valid choice for ${label}. Use only listed options.`,
          };
        }
      }
      continue;
    }
    if (!opts.includes(str)) {
      const label = column.title?.trim() || "this field";
      return {
        ok: false,
        error: `"${str}" is not a valid choice for ${label}. Pick one of the listed options.`,
      };
    }
  }
  return { ok: true };
}

export function normalizeContributorEmail(value: string) {
  return value.trim().toLowerCase();
}

export function isWsuEmail(value: string) {
  return normalizeContributorEmail(value).endsWith("@wsu.edu");
}

export function extractContributorEmailsFromCell(cell: SmartsheetCell | null | undefined) {
  if (!cell) {
    return [];
  }

  const contacts = toContactList(normalizeSourceValue(cell));
  return [...new Set(contacts.map((contact) => normalizeContributorEmail(contact.email ?? "")).filter(Boolean))];
}

export function collectContributorEmailsForRow(row: SmartsheetRow, contactColumnIds: number[]) {
  const emails = new Set<string>();

  for (const columnId of contactColumnIds) {
    for (const email of extractContributorEmailsFromCell(row.cellsById[columnId])) {
      emails.add(email);
    }
  }

  return [...emails];
}

export function isContributorInRow(row: SmartsheetRow, email: string, contactColumnIds: number[]) {
  const normalizedEmail = normalizeContributorEmail(email);
  return collectContributorEmailsForRow(row, contactColumnIds).includes(normalizedEmail);
}

export function isContributorStillInSheet(rows: SmartsheetRow[], email: string, contactColumnIds: number[]) {
  const normalizedEmail = normalizeContributorEmail(email);
  return rows.some((row) => isContributorInRow(row, normalizedEmail, contactColumnIds));
}

export function getEditableRowIdsForView(rows: SmartsheetRow[], view: ViewConfig, email: string) {
  const editing = view.editing;
  if (!editing?.enabled) {
    return [];
  }

  return applyViewFilters(rows, view.filters)
    .filter((row) => isContributorInRow(row, email, editing.contactColumnIds))
    .map((row) => row.id);
}

/**
 * Display row ids plus merged source ids — every Smartsheet row id that may be selected as an edit target
 * for this rendered view. Used when administrators edit with no per-row contact restriction.
 */
export function collectResolvableRowIdsForUnrestrictedEditing(rows: ResolvedViewRow[]): number[] {
  const set = new Set<number>();
  for (const row of rows) {
    set.add(row.id);
    for (const id of row.mergedSourceRowIds ?? []) {
      if (typeof id === "number" && Number.isFinite(id)) {
        set.add(id);
      }
    }
  }
  return [...set];
}

export function isContributorEditableRenderType(renderType: RenderType): renderType is "text" | "multiline_text" | "badge" | "phone" | "mailto" | "mailto_list" {
  return CONTRIBUTOR_EDITABLE_RENDER_TYPES.has(renderType);
}

/** Non-contact columns: which render types can write back as a plain cell value. */
function isContributorEditableNonContactRender(renderType: RenderType, columnType: string): boolean {
  if (isContributorEditableRenderType(renderType)) {
    return true;
  }
  // Config may still use "list" after changing the sheet column type; default MULTI_PICKLIST uses list render.
  if (renderType === "list" && (columnType === "PICKLIST" || columnType === "MULTI_PICKLIST")) {
    return true;
  }
  return false;
}

function hasEditableSafeTransforms(field: ViewFieldConfig, columnType: string): { ok: boolean; contactDisplayMode?: ContactDisplayMode } {
  const transforms = field.transforms ?? [];
  if (transforms.length === 0) {
    return { ok: true };
  }
  if (!CONTRIBUTOR_CONTACT_COLUMN_TYPES.has(columnType)) {
    return { ok: false };
  }
  if (transforms.length !== 1) {
    return { ok: false };
  }
  const op = transforms[0]?.op;
  if (op === "contact_emails") {
    return { ok: true, contactDisplayMode: "email" };
  }
  if (op === "contact_names") {
    return { ok: true, contactDisplayMode: "name" };
  }
  return { ok: false };
}

/**
 * True when field maps to a single Smartsheet column in a way we can write back.
 * Contact columns require mailto + contact_emails/contact_names. Other columns allow display
 * transforms (trim, etc.)—we still treat the field as one column for editing.
 */
export function isEditableFieldDirectMapped(field: ViewFieldConfig, column?: SmartsheetColumn | null) {
  if (isRoleGroupFieldSource(field.source)) {
    return false;
  }
  if (
    typeof field.source.columnId !== "number" ||
    field.source.preferredColumnId ||
    field.source.preferredColumnTitle ||
    field.source.preferredColumnType ||
    field.source.fallbackColumnId ||
    field.source.fallbackColumnTitle ||
    field.source.fallbackColumnType ||
    (field.source.coalesce?.length ?? 0) > 0
  ) {
    return false;
  }

  const columnType = column?.type ?? "";
  const transformCheck = hasEditableSafeTransforms(field, columnType);

  if (field.render.type === "hidden") {
    if (!column || !CONTRIBUTOR_EDITABLE_COLUMN_TYPES.has(column.type)) {
      return false;
    }
    if (CONTRIBUTOR_CONTACT_COLUMN_TYPES.has(column.type)) {
      return false;
    }
    return true;
  }

  if (CONTRIBUTOR_CONTACT_COLUMN_TYPES.has(columnType)) {
    return (
      transformCheck.ok &&
      (field.render.type === "mailto" || field.render.type === "mailto_list")
    );
  }

  // Non-contact: still direct-mapped to one column. Display transforms (trim, case, etc.) only
  // affect how we show data; contributors edit the rendered text and we write that string back.
  // Requiring zero transforms incorrectly dropped admin-selected columns (e.g. "Coordinator"
  // with a trim transform) from the edit UI.
  return isContributorEditableNonContactRender(field.render.type, columnType);
}

function buildDirectMappedFieldCounts(view: ViewConfig, columns: SmartsheetColumn[]) {
  const columnsById = new Map(columns.map((c) => [c.id, c]));
  const counts = new Map<number, number>();

  for (const field of view.fields) {
    if (isRoleGroupFieldSource(field.source)) {
      continue;
    }
    const columnId = field.source.columnId as number;
    const column = columnsById.get(columnId);
    if (!isEditableFieldDirectMapped(field, column)) {
      continue;
    }
    counts.set(columnId, (counts.get(columnId) ?? 0) + 1);
  }

  return counts;
}

/** Prefer contact_emails over contact_names when multiple fields map to same contact column. */
function pickContactFieldForEditing(
  fields: Array<{ field: ViewFieldConfig; column: SmartsheetColumn }>,
): { field: ViewFieldConfig; column: SmartsheetColumn } | null {
  if (fields.length === 0) return null;
  const withEmails = fields.find((f) => f.field.transforms?.some((t) => t.op === "contact_emails"));
  const withNames = fields.find((f) => f.field.transforms?.some((t) => t.op === "contact_names"));
  return withEmails ?? withNames ?? fields[0] ?? null;
}

export function getEligibleEditableFieldDefinitions(
  view: ViewConfig,
  columns: SmartsheetColumn[],
  editableColumnIds?: number[],
) {
  const columnsById = new Map(columns.map((column) => [column.id, column]));
  const directFieldCounts = buildDirectMappedFieldCounts(view, columns);
  const requestedEditableIds = editableColumnIds ? new Set(editableColumnIds) : null;

  const eligibleFields: ContributorEditableFieldDefinition[] = [];
  const contactFieldsByColumn = new Map<number, Array<{ field: ViewFieldConfig; column: SmartsheetColumn }>>();

  for (const field of view.fields) {
    if (isRoleGroupFieldSource(field.source)) {
      continue;
    }
    const columnId = field.source.columnId as number;
    const column = columnsById.get(columnId);
    if (!isEditableFieldDirectMapped(field, column)) {
      continue;
    }
    if (requestedEditableIds && !requestedEditableIds.has(columnId)) {
      continue;
    }
    if (!column || !CONTRIBUTOR_EDITABLE_COLUMN_TYPES.has(column.type)) {
      continue;
    }

    const isContactColumn = CONTRIBUTOR_CONTACT_COLUMN_TYPES.has(column.type);
    const count = directFieldCounts.get(columnId) ?? 0;

    if (isContactColumn) {
      if (count >= 1) {
        const arr = contactFieldsByColumn.get(columnId) ?? [];
        arr.push({ field, column });
        contactFieldsByColumn.set(columnId, arr);
      }
    } else {
      if (count !== 1) continue;
      const transformCheck = hasEditableSafeTransforms(field, column.type);
      const def: ContributorEditableFieldDefinition = {
        columnId,
        columnType: column.type as ContributorEditableFieldDefinition["columnType"],
        fieldKey: field.key,
        label: field.label || field.key,
        columnTitle: column.title?.trim() || field.label || field.key,
        renderType: field.render.type as ContributorEditableFieldDefinition["renderType"],
        options: column.options,
      };
      if (transformCheck.contactDisplayMode) {
        def.contactDisplayMode = transformCheck.contactDisplayMode;
      }
      eligibleFields.push(def);
    }
  }

  for (const [columnId, fields] of contactFieldsByColumn) {
    const picked = pickContactFieldForEditing(fields);
    if (!picked) continue;
    const { field, column } = picked;
    const transformCheck = hasEditableSafeTransforms(field, column.type);
    const def: ContributorEditableFieldDefinition = {
      columnId,
      columnType: column.type as ContributorEditableFieldDefinition["columnType"],
      fieldKey: field.key,
      label: field.label || field.key,
      columnTitle: column.title?.trim() || field.label || field.key,
      renderType: field.render.type as ContributorEditableFieldDefinition["renderType"],
      options: column.options,
    };
    if (transformCheck.contactDisplayMode) {
      def.contactDisplayMode = transformCheck.contactDisplayMode;
    }
    eligibleFields.push(def);
  }

  return eligibleFields;
}

/** Column types for multi-person groups. Contact columns need objectValue write-back. */
const MULTI_PERSON_GROUP_COLUMN_TYPES = new Set([
  "TEXT_NUMBER",
  "PICKLIST",
  "MULTI_PICKLIST",
  "PHONE",
  "CONTACT_LIST",
  "MULTI_CONTACT_LIST",
]);

/**
 * Field list for multi-person groups. Includes TEXT_NUMBER, PICKLIST, PHONE, and CONTACT_LIST/MULTI_CONTACT_LIST.
 * For contact columns, only includes fields with contact_emails or contact_names transform; allows multiple
 * fields per column (e.g. one for names, one for emails).
 */
export function getFieldsForMultiPersonGroup(
  view: ViewConfig,
  columns: SmartsheetColumn[],
): Array<{ columnId: number; fieldKey: string; label: string; columnType: string }> {
  const columnsById = new Map(columns.map((c) => [c.id, c]));
  const result: Array<{ columnId: number; fieldKey: string; label: string; columnType: string }> = [];
  const seenNonContact = new Set<number>();
  const seenContact = new Set<string>();

  for (const field of view.fields) {
    if (field.render.type === "hidden") continue;
    if (isRoleGroupFieldSource(field.source)) continue;
    const columnId =
      (typeof field.source.columnId === "number" ? field.source.columnId : null) ??
      (typeof field.source.preferredColumnId === "number" ? field.source.preferredColumnId : null);
    if (columnId == null) continue;

    const column = columnsById.get(columnId);
    if (!column || !MULTI_PERSON_GROUP_COLUMN_TYPES.has(column.type)) continue;

    const isContact = CONTRIBUTOR_CONTACT_COLUMN_TYPES.has(column.type);
    if (isContact) {
      const hasContactTransform = field.transforms?.some(
        (t) => t.op === "contact_emails" || t.op === "contact_names",
      );
      if (!hasContactTransform) continue;
      const key = `${columnId}:${field.key}`;
      if (seenContact.has(key)) continue;
      seenContact.add(key);
    } else {
      if (seenNonContact.has(columnId)) continue;
      seenNonContact.add(columnId);
    }

    result.push({
      columnId,
      fieldKey: field.key,
      label: field.label || field.key,
      columnType: column.type,
    });
  }
  return result;
}

function resolveSelectorColumn(
  selector: { columnId?: number; columnTitle?: string; columnType?: string } | undefined,
  columnsById: Map<number, SmartsheetColumn>,
  columnsByTitle: Map<string, SmartsheetColumn>,
) {
  if (!selector) {
    return null;
  }
  if (typeof selector.columnId === "number") {
    return columnsById.get(selector.columnId) ?? null;
  }
  if (selector.columnTitle) {
    return columnsByTitle.get(normalizeColumnKey(selector.columnTitle)) ?? null;
  }
  return null;
}

export function buildDerivedRoleGroupEditableFieldGroups(
  view: ViewConfig,
  sourceConfig: SourceConfig | null | undefined,
  columns: SmartsheetColumn[],
): EditableFieldGroup[] {
  if (!sourceConfig?.roleGroups?.length) {
    return [];
  }
  const columnsById = new Map(columns.map((c) => [c.id, c]));
  const columnsByTitle = new Map(columns.map((c) => [normalizeColumnKey(c.title), c]));
  const out: EditableFieldGroup[] = [];

  for (const field of view.fields) {
    const fieldSrc = field.source;
    if (!isRoleGroupFieldSource(fieldSrc) || field.render.type !== "people_group") {
      continue;
    }
    const rg = sourceConfig.roleGroups.find((g) => g.id === fieldSrc.roleGroupId);
    if (!rg) {
      continue;
    }

    if (rg.mode === "delimited_parallel") {
      const attrs: EditableFieldGroupAttribute[] = [];
      const d = rg.delimited;
      if (d) {
        for (const attr of ["name", "email", "phone"] as const) {
          const cfg = d[attr];
          if (!cfg?.source) {
            continue;
          }
          const col = resolveSelectorColumn(cfg.source, columnsById, columnsByTitle);
          const columnId = col?.id ?? cfg.source.columnId;
          if (typeof columnId !== "number") {
            continue;
          }
          attrs.push({
            attribute: attr,
            fieldKey: field.key,
            columnId,
            columnType: col?.type ?? cfg.source.columnType,
            columnTitle: col?.title?.trim() ?? cfg.source.columnTitle ?? attr,
          });
        }
      }
      if (attrs.length > 0) {
        const unsafe = isUnsafeDelimitedRoleGroup(rg);
        out.push({
          id: unsafe ? `rg-readonly:${field.key}:${rg.id}` : `rg:${field.key}:${rg.id}`,
          label: rg.defaultDisplayLabel ?? rg.label,
          attributes: attrs,
          fromRoleGroupViewFieldKey: field.key,
          readOnly: unsafe || undefined,
          usesFixedSlots: false,
        });
      }
      continue;
    }

    if (rg.mode !== "numbered_slots" || !rg.slots?.length) {
      continue;
    }

    const attrs: EditableFieldGroupAttribute[] = [];
    for (const slot of rg.slots) {
      for (const attr of ["name", "email", "phone", "campus"] as const) {
        const sel = slot[attr];
        if (!sel) {
          continue;
        }
        const col = resolveSelectorColumn(sel, columnsById, columnsByTitle);
        const columnId = col?.id ?? sel.columnId;
        if (typeof columnId !== "number") {
          continue;
        }
        const opts = (col?.options ?? []).filter((o): o is string => typeof o === "string" && o.length > 0);
        attrs.push({
          attribute: attr,
          fieldKey: field.key,
          columnId,
          columnType: col?.type ?? sel.columnType,
          columnTitle: col?.title?.trim() ?? sel.columnTitle ?? attr,
          slot: slot.slot,
          ...(opts.length > 0 ? { options: opts } : {}),
        });
      }
    }
    if (attrs.length === 0) {
      continue;
    }
    out.push({
      id: `rg:${field.key}:${rg.id}`,
      label: rg.defaultDisplayLabel ?? rg.label,
      attributes: attrs,
      fromRoleGroupViewFieldKey: field.key,
      usesFixedSlots: true,
    });
  }

  return out;
}

export function buildContributorEditingClientConfig(
  view: ViewConfig,
  columns: SmartsheetColumn[],
  sourceConfig?: SourceConfig | null,
) {
  const editing = view.editing;
  if (!editing?.enabled) {
    return null;
  }

  const columnsById = new Map(columns.map((c) => [c.id, c]));
  const derivedGroups = buildDerivedRoleGroupEditableFieldGroups(view, sourceConfig ?? null, columns);
  const derivedColumnIds = new Set(derivedGroups.flatMap((g) => g.attributes.map((a) => a.columnId)));

  const legacyGroupsFiltered = (editing.editableFieldGroups ?? []).filter(
    (group) => !group.attributes.some((a) => derivedColumnIds.has(a.columnId)),
  );

  const groups = [...derivedGroups, ...legacyGroupsFiltered].map((group) => ({
    ...group,
    attributes: group.attributes.map((attr) => {
      const column = columnsById.get(attr.columnId);
      const fromCol = (column?.options ?? []).filter((o): o is string => typeof o === "string" && o.length > 0);
      const options = attr.options?.length ? attr.options : fromCol.length > 0 ? fromCol : undefined;
      return {
        ...attr,
        columnType: attr.columnType ?? column?.type,
        columnTitle: column?.title?.trim() || attr.fieldKey,
        ...(options?.length ? { options } : {}),
      };
    }),
  }));
  const groupColumnIds = new Set(
    groups.flatMap((g) => g.attributes.map((a) => a.columnId)),
  );

  const allEditableFields = getEligibleEditableFieldDefinitions(view, columns, editing.editableColumnIds);
  const editableFields = allEditableFields.filter((f) => !groupColumnIds.has(f.columnId));
  const simpleColumnIds = editableFields.map((field) => field.columnId);
  const editableColumnIds = [...simpleColumnIds, ...groupColumnIds];
  const fieldColumnMap = editableFields.reduce<Record<number, string>>((map, field) => {
    map[field.columnId] = field.fieldKey;
    return map;
  }, {});

  return {
    contactColumnIds: [...editing.contactColumnIds],
    editableColumnIds,
    fieldColumnMap,
    editableFields,
    editableFieldGroups: groups,
  } satisfies ContributorEditingClientConfig;
}

/**
 * Remove contributor editing column ids that no longer exist in Smartsheet (e.g. after deleting/recreating a column).
 * Prevents save from failing with "does not exist in the current source schema" until the admin re-checks fields.
 */
export function pruneStaleContributorColumnIds(
  view: ViewConfig,
  columns: SmartsheetColumn[],
): { view: ViewConfig; pruned: boolean } {
  const editing = view.editing;
  if (!editing) {
    return { view, pruned: false };
  }
  const ids = new Set(columns.map((c) => c.id));
  const contactColumnIds = editing.contactColumnIds.filter((id) => ids.has(id));
  const editableColumnIds = editing.editableColumnIds.filter((id) => ids.has(id));
  const pruned =
    contactColumnIds.length !== editing.contactColumnIds.length ||
    editableColumnIds.length !== editing.editableColumnIds.length;
  if (!pruned) {
    return { view, pruned: false };
  }
  return {
    view: {
      ...view,
      editing: {
        ...editing,
        contactColumnIds,
        editableColumnIds,
      },
    },
    pruned: true,
  };
}

export function getContributorEditingValidationErrors(
  view: ViewConfig,
  columns: SmartsheetColumn[],
  sourceConfig?: SourceConfig | null,
) {
  const editing = view.editing;
  if (!editing?.enabled) {
    return [];
  }

  const columnsById = new Map(columns.map((column) => [column.id, column]));
  const errors: string[] = [];

  for (const columnId of editing.contactColumnIds) {
    const column = columnsById.get(columnId);
    if (!column) {
      errors.push(`Editing contact column ${columnId} does not exist in the current source schema.`);
      continue;
    }
    if (!CONTRIBUTOR_CONTACT_COLUMN_TYPES.has(column.type)) {
      errors.push(`Editing contact column "${column.title}" must be CONTACT_LIST or MULTI_CONTACT_LIST.`);
    }
  }

  const eligibleFields = getEligibleEditableFieldDefinitions(view, columns);
  const eligibleByColumnId = new Map(eligibleFields.map((field) => [field.columnId, field]));

  const derivedGroups = buildDerivedRoleGroupEditableFieldGroups(view, sourceConfig ?? null, columns);
  const allGroups = [...derivedGroups, ...(editing.editableFieldGroups ?? [])];
  const groupColumnIds = new Set(allGroups.flatMap((g) => g.attributes.map((a) => a.columnId)));

  for (const columnId of editing.editableColumnIds) {
    if (groupColumnIds.has(columnId)) continue;
    const column = columnsById.get(columnId);
    if (!column) {
      errors.push(`Editable column ${columnId} does not exist in the current source schema.`);
      continue;
    }
    if (!eligibleByColumnId.has(columnId)) {
      errors.push(
        `Editable column "${column.title}" must be a visible direct-mapped TEXT_NUMBER, PICKLIST, PHONE, or CONTACT_LIST/MULTI_CONTACT_LIST field (contact columns require contact_emails or contact_names transform).`
      );
    }
  }

  const fieldKeys = new Set(view.fields.map((f) => f.key));
  for (const group of editing.editableFieldGroups ?? []) {
    for (const attr of group.attributes) {
      if (!fieldKeys.has(attr.fieldKey)) {
        errors.push(`Editable field group "${group.label}": field key "${attr.fieldKey}" does not exist in the view.`);
      }
      if (!columnsById.has(attr.columnId)) {
        errors.push(`Editable field group "${group.label}": column ${attr.columnId} does not exist in the source schema.`);
      }
    }
  }

  const runtimeEditingConfig = buildContributorEditingClientConfig(view, columns, sourceConfig ?? null);
  const hasWritableContent =
    (runtimeEditingConfig?.editableFields.length ?? 0) > 0 ||
    Boolean(runtimeEditingConfig?.editableFieldGroups.some((group) => !group.readOnly));
  if (!hasWritableContent) {
    errors.push(
      "Select at least one Editable Field (what contributors can edit), add a Multi-person field group, or include a writable role-group field. Contact columns only define who can edit, not what."
    );
  }

  return errors;
}

export function getEditableFieldValue(row: ResolvedViewRow, fieldColumnMap: Record<number, string>, columnId: number) {
  const fieldKey = fieldColumnMap[columnId];
  return fieldKey ? row.fieldMap[fieldKey]?.textValue ?? "" : "";
}
