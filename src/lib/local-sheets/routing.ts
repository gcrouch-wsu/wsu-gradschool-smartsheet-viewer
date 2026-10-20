import { isSmartsheetApiEnabled } from "@/lib/smartsheet-api-gate";
import { SheetNotImportedError } from "@/lib/local-sheets/types";

/**
 * Prefer the imported Postgres copy when present.
 * Never call Smartsheet when the API kill switch is off.
 */
export async function withImportedOrLive<T>(options: {
  kind: "sheet" | "report";
  id: string | number;
  hasImported: () => Promise<boolean>;
  fromImported: () => Promise<T>;
  fromLive: () => Promise<T>;
}): Promise<T> {
  if (await options.hasImported()) {
    return options.fromImported();
  }

  if (!(await isSmartsheetApiEnabled())) {
    throw new SheetNotImportedError(options.kind, options.id);
  }

  return options.fromLive();
}

export async function assertCanCallSmartsheetOrImported(
  hasImported: boolean,
  kind: "sheet" | "report",
  id: string | number,
): Promise<void> {
  if (hasImported) return;
  if (!(await isSmartsheetApiEnabled())) {
    throw new SheetNotImportedError(kind, id);
  }
}
