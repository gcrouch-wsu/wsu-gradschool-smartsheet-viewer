import { auditFromPrincipal } from "@/lib/audit";
import { config } from "@/lib/forms/config";
import {
  applyColumnOverrides,
  cellValueForSmartsheet,
  columnsForCreateSheet,
  EXCEL_IMPORT_MAX_BYTES,
  parseExcelImport,
  type ExcelImportOverride,
} from "@/lib/forms/excel-import";
import * as ss from "@/lib/forms/smartsheet-api";
import * as registry from "@/lib/forms/registry";
import { ensureBootstrapped } from "@/lib/forms/init";
import { formsAuthErrorResponse, requireFormsAdminAccess } from "@/lib/forms/forms-api";
import { resolveAdminPrincipal } from "@/lib/identity";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function shareCreatedSheet(sheetId: string | number, shareEmails: string[]) {
  const emailsToShare: string[] = [...shareEmails];
  if (config.autoShareGroupIds.length) {
    try {
      const groups = (await ss.listGroups()) as { id?: string | number; name?: string }[];
      for (const gid of config.autoShareGroupIds) {
        const g = groups.find((x) => String(x.id) === gid);
        if (g?.name) emailsToShare.push(`${g.name}@groups.smartsheet.com`);
      }
    } catch {
      /* non-fatal */
    }
  }

  for (const email of emailsToShare) {
    if (!email) continue;
    try {
      await ss.shareSheet(sheetId, email, "EDITOR");
    } catch {
      /* non-fatal per recipient */
    }
  }
}

async function createFromExcelForm(form: FormData): Promise<Response> {
  const file = form.get("file");
  if (!(file instanceof File)) {
    return Response.json({ error: "Choose an Excel (.xlsx) or CSV file." }, { status: 400 });
  }
  if (file.size <= 0) {
    return Response.json({ error: "The uploaded file is empty." }, { status: 400 });
  }
  if (file.size > EXCEL_IMPORT_MAX_BYTES) {
    return Response.json(
      { error: `File is too large (max ${EXCEL_IMPORT_MAX_BYTES / (1024 * 1024)} MB).` },
      { status: 400 },
    );
  }

  const newName = String(form.get("newName") ?? "").trim();
  const destinationFolderId = String(form.get("destinationFolderId") ?? "").trim() || undefined;
  const name = newName || `WSU Form ${new Date().toISOString().slice(0, 10)}`;

  let overrides: ExcelImportOverride[] | undefined;
  const overridesRaw = form.get("columnOverrides");
  if (typeof overridesRaw === "string" && overridesRaw.trim()) {
    try {
      const parsedJson = JSON.parse(overridesRaw) as unknown;
      if (!Array.isArray(parsedJson)) throw new Error("columnOverrides must be an array.");
      overrides = parsedJson as ExcelImportOverride[];
    } catch {
      return Response.json({ error: "Invalid columnOverrides JSON." }, { status: 400 });
    }
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const parsed = await parseExcelImport(buffer, file.name || "upload.xlsx");
  const columns = applyColumnOverrides(parsed, overrides);
  const included = columns.filter((c) => c.included);
  if (!included.length) {
    return Response.json({ error: "Include at least one column." }, { status: 400 });
  }

  const createCols = columnsForCreateSheet(columns);
  if (!createCols.some((c) => c.primary)) {
    createCols[0]!.primary = true;
  }

  const sheet = (
    (await ss.createSheet(name, createCols)) as { result: { id: number | string; name: string } }
  ).result;

  if (destinationFolderId || config.defaultFolderId) {
    try {
      await ss.moveSheet(sheet.id, destinationFolderId || config.defaultFolderId);
    } catch {
      /* non-fatal */
    }
  }

  const listed = (await ss.listColumns(sheet.id)) as { id?: number; title?: string }[];
  const idByTitle = new Map(
    listed
      .filter((c) => c.id != null && c.title)
      .map((c) => [String(c.title).toLowerCase(), Number(c.id)]),
  );

  for (const col of included) {
    if (!col.smartsheetFormula) continue;
    const columnId = idByTitle.get(col.title.toLowerCase());
    if (!columnId) continue;
    try {
      await ss.updateColumn(sheet.id, columnId, { formula: col.smartsheetFormula });
    } catch {
      /* continue */
    }
  }

  const rowCount = parsed.preview.rowCount;
  const rowsPayload: { cells: ss.AddRowCell[] }[] = [];
  for (let r = 0; r < rowCount; r++) {
    const cells: ss.AddRowCell[] = [];
    for (let ci = 0; ci < columns.length; ci++) {
      const col = columns[ci]!;
      if (!col.included) continue;
      if (col.smartsheetFormula) continue;
      const columnId = idByTitle.get(col.title.toLowerCase());
      if (!columnId) continue;
      const raw = parsed.columnValues[ci]?.[r];
      const value = cellValueForSmartsheet(col.type, raw);
      if (value === null) continue;
      cells.push({ columnId, value });
    }
    if (cells.length) rowsPayload.push({ cells });
  }

  let importedRows = 0;
  let rowNote = "";
  if (rowsPayload.length) {
    try {
      await ss.addRows(sheet.id, rowsPayload);
      importedRows = rowsPayload.length;
    } catch (e) {
      rowNote = e instanceof Error ? e.message : "Row import failed.";
    }
  }

  await shareCreatedSheet(sheet.id, []);

  await registry.registerForm(
    { id: String(sheet.id), name: sheet.name, createdAt: new Date().toISOString(), source: "excel" },
    true,
  );

  await auditFromPrincipal(await resolveAdminPrincipal(), "forms.registry.create", "form", String(sheet.id), {
    name: sheet.name,
    source: "excel",
    mode: "excel",
    columns: included.length,
    importedRows,
    rowImportError: rowNote || undefined,
  });

  const formulaCount = included.filter((c) => c.smartsheetFormula).length;
  const noteParts = [
    `Imported ${included.length} column${included.length === 1 ? "" : "s"}`,
    importedRows ? `${importedRows} row${importedRows === 1 ? "" : "s"}` : "no data rows",
  ];
  if (formulaCount) noteParts.push(`${formulaCount} formula column${formulaCount === 1 ? "" : "s"}`);
  noteParts.push("no automations (same as from-scratch)");
  if (rowNote) noteParts.push(`row import issue: ${rowNote}`);

  return Response.json({
    ok: true,
    sheet: { id: sheet.id, name: sheet.name },
    note: noteParts.join("; ") + ".",
    demo: config.demo,
    importedRows,
  });
}

export async function POST(request: Request) {
  const access = await requireFormsAdminAccess();
  if ("response" in access) return access.response;

  await ensureBootstrapped();

  const contentType = request.headers.get("content-type") || "";
  if (contentType.includes("multipart/form-data")) {
    try {
      const form = await request.formData();
      const mode = String(form.get("mode") ?? "").trim();
      if (mode !== "excel") {
        return Response.json({ error: "multipart create requires mode=excel." }, { status: 400 });
      }
      return await createFromExcelForm(form);
    } catch (e) {
      const message = e instanceof Error ? e.message : "";
      if (/headers|empty|too many|too large|Upload an|\.xlsx|\.csv|worksheets|Include at least/i.test(message)) {
        return Response.json({ error: message || "Excel import failed." }, { status: 400 });
      }
      return formsAuthErrorResponse(e);
    }
  }

  const body = await request.json().catch(() => ({}));
  const { mode, templateId, newName, destinationFolderId, shareEmails = [] } = body ?? {};
  const name = (newName && String(newName).trim()) || `WSU Form ${new Date().toISOString().slice(0, 10)}`;

  if (mode === "excel") {
    return Response.json(
      { error: "Excel create must use multipart/form-data with the file." },
      { status: 400 },
    );
  }

  try {
    let sheet: { id: number | string; name: string };
    let note = "";

    if (mode === "template") {
      const tid = templateId ? String(templateId).trim() : "";
      if (!tid) return Response.json({ error: "Choose a template sheet first." }, { status: 400 });
      const include = ["forms", "rules", "ruleRecipients", "filters"];
      try {
        sheet = (
          (await ss.copySheetToFolder(tid, name, include, destinationFolderId)) as {
            result: { id: number | string; name: string };
          }
        ).result;
      } catch {
        sheet = (
          (await ss.copySheetToFolder(tid, name, ["rules", "ruleRecipients", "filters"], destinationFolderId)) as {
            result: { id: number | string; name: string };
          }
        ).result;
        note =
          "Cloned without the native form (forms include failed on this account); columns, rules, and recipients were carried over.";
      }
    } else {
      sheet = ((await ss.createSheet(name, ss.DEFAULT_COLUMNS)) as { result: { id: number | string; name: string } })
        .result;
      if (destinationFolderId || config.defaultFolderId) {
        try {
          await ss.moveSheet(sheet.id, destinationFolderId || config.defaultFolderId);
        } catch {
          /* non-fatal */
        }
      }
      note =
        "From-scratch sheet has no automations (the API cannot create them). Use a template if you need post-submission workflows.";
    }

    await shareCreatedSheet(sheet.id, Array.isArray(shareEmails) ? shareEmails.map(String) : []);

    const source = mode === "template" ? "template" : "scratch";
    await registry.registerForm(
      { id: String(sheet.id), name: sheet.name, createdAt: new Date().toISOString(), source },
      true,
    );

    await auditFromPrincipal(await resolveAdminPrincipal(), "forms.registry.create", "form", String(sheet.id), {
      name: sheet.name,
      source,
      mode: mode === "template" ? "template" : "scratch",
    });

    return Response.json({ ok: true, sheet: { id: sheet.id, name: sheet.name }, note, demo: config.demo });
  } catch (e) {
    return formsAuthErrorResponse(e);
  }
}
