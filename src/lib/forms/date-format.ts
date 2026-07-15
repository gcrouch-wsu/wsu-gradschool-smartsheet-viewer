/**
 * Form date helpers.
 * Calendar inputs and typed values are normalized to ISO YYYY-MM-DD for Smartsheet DATE cells.
 */

function isValidYmd(year: number, month: number, day: number): boolean {
  if (year < 1000 || year > 9999 || month < 1 || month > 12 || day < 1 || day > 31) {
    return false;
  }
  const dt = new Date(Date.UTC(year, month - 1, day));
  return dt.getUTCFullYear() === year && dt.getUTCMonth() === month - 1 && dt.getUTCDate() === day;
}

function toIso(year: number, month: number, day: number): string {
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/**
 * Parse a calendar or typed date into Smartsheet DATE format (YYYY-MM-DD).
 * Accepts YYYY-MM-DD (from `<input type="date">`) and US M/D/YYYY.
 */
export function parseFormDateToIso(raw: string): string | null {
  const t = raw.trim();
  if (!t) return null;

  const iso = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (iso) {
    const year = Number(iso[1]);
    const month = Number(iso[2]);
    const day = Number(iso[3]);
    return isValidYmd(year, month, day) ? toIso(year, month, day) : null;
  }

  const us = t.match(/^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{4})$/);
  if (us) {
    const month = Number(us[1]);
    const day = Number(us[2]);
    const year = Number(us[3]);
    return isValidYmd(year, month, day) ? toIso(year, month, day) : null;
  }

  return null;
}

export function isSmartsheetDateColumnType(type: string | undefined): boolean {
  return type === "DATE" || type === "ABSTRACT_DATETIME";
}
