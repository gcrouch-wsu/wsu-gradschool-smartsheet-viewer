/** Contact / name+email fields tied to an approval stage for reroute requests. */

import {
  isResendColumnTitle,
  resendMatchScore,
  type SheetColumnRef,
} from "@/lib/forms/resend";

export type ContactFieldKind = "name" | "email" | "contact";

export interface StageContactField {
  columnId: number;
  columnTitle: string;
  columnType: string;
  kind: ContactFieldKind;
  currentDisplay: string;
  currentEmail: string;
  currentName: string;
}

export interface StageContactBundle {
  stageTitle: string;
  fields: StageContactField[];
  /** Best email currently on the row for this stage (hint). */
  currentEmail: string;
  currentName: string;
}

type CellRef = { columnId: number; value?: unknown; displayValue?: unknown };

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/\bapproval\b/g, " ")
    .replace(/\bstatus\b/g, " ")
    .replace(/\bdate\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

function tokenOverlapScore(columnTitle: string, stageTitle: string): number {
  const a = new Set(tokenize(columnTitle.replace(/e-?mail/gi, " ").replace(/\bname\b/gi, " ")));
  const b = new Set(tokenize(stageTitle));
  let n = 0;
  for (const t of a) if (b.has(t)) n++;
  return n * 3;
}

function cellEmail(value: unknown, displayValue?: unknown): string {
  const display = String(displayValue ?? "").trim();
  if (display.includes("@")) {
    const m = display.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
    if (m) return m[0];
  }
  if (value && typeof value === "object") {
    const obj = value as { email?: unknown };
    if (typeof obj.email === "string" && obj.email.includes("@")) return obj.email.trim();
  }
  const raw = String(value ?? "").trim();
  if (raw.includes("@")) {
    const m = raw.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
    if (m) return m[0];
  }
  return "";
}

function cellName(value: unknown, displayValue?: unknown): string {
  if (value && typeof value === "object") {
    const obj = value as { name?: unknown; email?: unknown };
    if (typeof obj.name === "string" && obj.name.trim()) return obj.name.trim();
  }
  const display = String(displayValue ?? "").trim();
  if (display && !display.includes("@")) return display;
  const raw = String(value ?? "").trim();
  if (raw && !raw.includes("@") && typeof value !== "object") return raw;
  // "Name <email>" style display
  if (display.includes("@")) {
    const before = display.split("<")[0]?.replace(/"/g, "").trim();
    if (before && !before.includes("@")) return before;
  }
  return "";
}

function cellDisplay(value: unknown, displayValue?: unknown): string {
  const display = String(displayValue ?? "").trim();
  if (display) return display;
  if (value && typeof value === "object") {
    const obj = value as { name?: unknown; email?: unknown };
    const name = typeof obj.name === "string" ? obj.name.trim() : "";
    const email = typeof obj.email === "string" ? obj.email.trim() : "";
    if (name && email) return `${name} <${email}>`;
    return name || email;
  }
  return String(value ?? "").trim();
}

function scoreColumnForStage(col: SheetColumnRef, stageTitle: string): number {
  const title = col.title;
  const viaResend = resendMatchScore(`RESEND ${title.replace(/\s*e-?mail\s*/i, " ").replace(/\s*name\s*/i, " ").trim()}`, stageTitle);
  const direct = tokenOverlapScore(title, stageTitle);
  return Math.max(viaResend, direct);
}

/**
 * Resolve name / email / CONTACT_LIST columns belonging to an approval stage
 * (e.g. CHR Approval → CHR Name + CHR Email, or Chair CONTACT).
 */
export function findStageContactFields(
  columns: SheetColumnRef[],
  cells: CellRef[] | undefined,
  stageTitle: string,
): StageContactBundle {
  const byId = new Map((cells ?? []).map((c) => [c.columnId, c]));
  const empty: StageContactBundle = {
    stageTitle,
    fields: [],
    currentEmail: "",
    currentName: "",
  };
  if (!stageTitle.trim()) return empty;

  type Scored = { col: SheetColumnRef; kind: ContactFieldKind; score: number };
  const scored: Scored[] = [];

  for (const col of columns) {
    if (isResendColumnTitle(col.title)) continue;
    if (/\bapproval\b/i.test(col.title)) continue;
    const type = String(col.type ?? "").toUpperCase();
    const title = col.title;
    let kind: ContactFieldKind | null = null;
    if (type === "CONTACT_LIST" || type === "MULTI_CONTACT_LIST") {
      kind = "contact";
    } else if (/e-?mail/i.test(title)) {
      kind = "email";
    } else if (/\bname\b/i.test(title) && !/file|form|program|sheet/i.test(title)) {
      kind = "name";
    }
    if (!kind) continue;
    const score = scoreColumnForStage(col, stageTitle);
    if (score < 3) continue;
    scored.push({ col, kind, score });
  }

  scored.sort((a, b) => b.score - a.score);

  // Prefer one contact column, or a name+email pair.
  const contact = scored.find((s) => s.kind === "contact");
  const email = scored.find((s) => s.kind === "email");
  const name = scored.find((s) => s.kind === "name");

  const picked: Scored[] = [];
  if (contact) {
    picked.push(contact);
    // Optional paired name column if separate
    if (name && name.col.id !== contact.col.id) picked.push(name);
  } else {
    if (email) picked.push(email);
    if (name) picked.push(name);
  }

  const fields: StageContactField[] = picked.map(({ col, kind }) => {
    const cell = byId.get(col.id);
    return {
      columnId: col.id,
      columnTitle: col.title,
      columnType: String(col.type ?? "TEXT_NUMBER"),
      kind,
      currentDisplay: cellDisplay(cell?.value, cell?.displayValue),
      currentEmail: cellEmail(cell?.value, cell?.displayValue),
      currentName: cellName(cell?.value, cell?.displayValue),
    };
  });

  const currentEmail =
    fields.find((f) => f.currentEmail)?.currentEmail ??
    fields.find((f) => f.kind === "email" || f.kind === "contact")?.currentDisplay ??
    "";
  const currentName =
    fields.find((f) => f.currentName)?.currentName ??
    fields.find((f) => f.kind === "name")?.currentDisplay ??
    "";

  return { stageTitle, fields, currentEmail, currentName };
}

export function isValidContactName(name: string): string | null {
  const trimmed = name.trim();
  if (!trimmed) return "Name is required.";
  if (trimmed.length < 2) return "Enter a full name.";
  return null;
}

/**
 * Validate email for contact reroutes using the same domain rules as the form sheet
 * (exact domain match against the form's allowed domains list).
 */
export function isValidContactEmail(email: string, allowedDomains?: string[]): string | null {
  const trimmed = email.trim();
  if (!trimmed) return "Email is required.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) return "Enter a valid email address.";
  if (allowedDomains?.length) {
    const domain = trimmed.split("@")[1]?.toLowerCase() ?? "";
    const allowed = allowedDomains.map((d) => d.trim().toLowerCase()).filter(Boolean);
    if (allowed.length && !allowed.includes(domain)) {
      return `Email must be from: ${allowed.join(", ")}.`;
    }
  }
  return null;
}

/** Build Smartsheet cell writes for an approved contact change. */
export function buildContactChangeCells(input: {
  fields: Array<{ columnId: number; columnType: string; kind: ContactFieldKind }>;
  proposedName: string;
  proposedEmail: string;
}): Array<{ columnId: number; value: string } | { columnId: number; objectValue: unknown }> {
  const name = input.proposedName.trim();
  const email = input.proposedEmail.trim();
  const cells: Array<{ columnId: number; value: string } | { columnId: number; objectValue: unknown }> = [];

  for (const field of input.fields) {
    const type = field.columnType.toUpperCase();
    if (field.kind === "contact" || type === "CONTACT_LIST") {
      const objectValue: { objectType: "CONTACT"; email: string; name?: string } = {
        objectType: "CONTACT",
        email,
      };
      if (name) objectValue.name = name;
      cells.push({ columnId: field.columnId, objectValue });
    } else if (field.kind === "email") {
      cells.push({ columnId: field.columnId, value: email });
    } else if (field.kind === "name") {
      cells.push({ columnId: field.columnId, value: name });
    }
  }
  return cells;
}
