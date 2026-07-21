/** Detect and match Smartsheet RESEND* helper columns to approval stages. */

export function isResendColumnTitle(title: string): boolean {
  return /^resend\b/i.test(title.trim());
}

/** Strip leading "RESEND" from a column title. */
export function resendTargetLabel(title: string): string {
  return title.trim().replace(/^resend\s+/i, "").trim();
}

const SYNONYMS: Record<string, string> = {
  chair: "chr",
  chairs: "chr",
  advisor: "chr",
};

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/\bapproval\b/g, " ")
    .replace(/\bstatus\b/g, " ")
    .replace(/\bdate\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((t) => SYNONYMS[t] ?? t);
}

function tokenSet(text: string): Set<string> {
  return new Set(tokenize(text));
}

/** Score how well a RESEND column suffix matches an approval stage title (higher is better). */
export function resendMatchScore(resendTitle: string, stageTitle: string): number {
  if (!isResendColumnTitle(resendTitle)) return 0;
  const target = resendTargetLabel(resendTitle);
  if (!target) return 0;

  const a = tokenSet(target);
  const b = tokenSet(stageTitle);
  if (a.size === 0 || b.size === 0) return 0;

  let overlap = 0;
  for (const t of a) {
    if (b.has(t)) overlap++;
  }
  if (overlap === 0) {
    // Exact substring fallback after normalization
    const na = [...a].sort().join(" ");
    const nb = [...b].sort().join(" ");
    if (na === nb) return 10;
    if (na.includes(nb) || nb.includes(na)) return 5;
    return 0;
  }

  // Prefer full containment of the smaller set
  const smaller = a.size <= b.size ? a : b;
  const larger = a.size <= b.size ? b : a;
  let contained = true;
  for (const t of smaller) {
    if (!larger.has(t)) {
      contained = false;
      break;
    }
  }
  return overlap * 3 + (contained ? 4 : 0) + (a.size === b.size && overlap === a.size ? 2 : 0);
}

export interface SheetColumnRef {
  id: number;
  title: string;
  type?: string;
}

/**
 * Find the RESEND* column that best matches an approval stage.
 * Returns null when no meaningful match exists (e.g. RESEND Final PDF vs CHR Approval).
 */
export function findResendColumnForStage(
  columns: SheetColumnRef[],
  stageTitle: string,
): SheetColumnRef | null {
  if (!stageTitle.trim()) return null;
  let best: SheetColumnRef | null = null;
  let bestScore = 0;
  for (const col of columns) {
    if (!isResendColumnTitle(col.title)) continue;
    const score = resendMatchScore(col.title, stageTitle);
    if (score > bestScore) {
      bestScore = score;
      best = col;
    }
  }
  // Require at least one overlapping meaningful token
  return bestScore >= 3 ? best : null;
}

function cellEmailish(value: unknown, displayValue?: unknown): string {
  const display = String(displayValue ?? "").trim();
  if (display.includes("@")) {
    const m = display.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
    if (m) return m[0];
  }
  if (value && typeof value === "object") {
    const obj = value as { email?: unknown; name?: unknown };
    if (typeof obj.email === "string" && obj.email.includes("@")) return obj.email.trim();
  }
  const raw = String(value ?? "").trim();
  if (raw.includes("@")) {
    const m = raw.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
    if (m) return m[0];
  }
  return "";
}

/**
 * Resolve the contact/email column value most likely belonging to the pending stage
 * (e.g. CHR Approval → CHR Email / Chair Email).
 */
export function findPendingContactEmail(
  columns: SheetColumnRef[],
  cells: Array<{ columnId: number; value?: unknown; displayValue?: unknown }> | undefined,
  stageTitle: string,
): string {
  if (!stageTitle.trim()) return "";
  const byId = new Map((cells ?? []).map((c) => [c.columnId, c]));

  const candidates = columns.filter((c) => {
    if (isResendColumnTitle(c.title)) return false;
    if (/\bapproval\b/i.test(c.title)) return false;
    return /e-?mail/i.test(c.title) || /contact/i.test(String(c.type ?? ""));
  });

  let bestEmail = "";
  let bestScore = 0;
  for (const col of candidates) {
    const cell = byId.get(col.id);
    const email = cellEmailish(cell?.value, cell?.displayValue);
    if (!email) continue;
    const score = resendMatchScore(`RESEND ${col.title.replace(/\s*e-?mail\s*/i, " ").trim()}`, stageTitle);
    // Also score tokens of the email column title directly against the stage
    const direct = (() => {
      const a = tokenSet(col.title.replace(/e-?mail/gi, " "));
      const b = tokenSet(stageTitle);
      let n = 0;
      for (const t of a) if (b.has(t)) n++;
      return n * 3;
    })();
    const combined = Math.max(score, direct);
    if (combined > bestScore) {
      bestScore = combined;
      bestEmail = email;
    }
  }

  if (bestEmail) return bestEmail;

  // Fallback: first email-looking column on the row (often the student/submitter).
  for (const col of candidates) {
    const cell = byId.get(col.id);
    const email = cellEmailish(cell?.value, cell?.displayValue);
    if (email) return email;
  }
  return "";
}

/** Whether a checkbox cell is currently checked. */
export function isCheckboxChecked(value: unknown, displayValue?: unknown): boolean {
  if (value === true || value === 1) return true;
  if (value === false || value === 0 || value == null) return false;
  const s = String(displayValue ?? value).trim().toLowerCase();
  return s === "true" || s === "yes" || s === "1" || s === "checked";
}
