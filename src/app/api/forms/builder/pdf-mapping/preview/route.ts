import { requireFormsAdminAccess } from "@/lib/forms/forms-api";
import { expandColumnsWithCheckboxGroups, fieldMetaFromConfig } from "@/lib/forms/form-field-meta";
import { isLayoutFormItem } from "@/lib/forms/form-field-config";
import { resolveFormColumns } from "@/lib/forms/form-fields";
import { ensureBootstrapped } from "@/lib/forms/init";
import { applyPdfCustomization, buildSubmissionPdf } from "@/lib/forms/pdf-mapping";
import {
  normalizePdfMappingConfig,
  type PdfFieldEntry,
  type PdfMappingConfig,
} from "@/lib/forms/pdf-mapping-types";
import * as registry from "@/lib/forms/registry";
import { loadFormFields } from "@/lib/forms/store/field-config";
import { loadPdfMapping } from "@/lib/forms/store/pdf-mapping";
import * as ss from "@/lib/forms/smartsheet-api";
import { richTextPlainText } from "@/lib/rendering";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function sampleValueForTitle(title: string, type?: string): string {
  const t = title.toLowerCase();
  if (/e-?mail/i.test(t) || type === "CONTACT_LIST") return "jane.doe@wsu.edu";
  if (/phone|tel/i.test(t)) return "(509) 555-0100";
  if (/date/i.test(t) || type === "DATE") return "2026-08-05";
  if (type === "CHECKBOX" || /agree|consent|confirm/i.test(t)) return "Yes";
  if (/name/i.test(t)) return "Jane Doe";
  if (/department|program|college/i.test(t)) return "Graduate School";
  return "Sample response";
}

async function resolveSheetId(request: Request, body?: Record<string, unknown> | null): Promise<string | null> {
  const url = new URL(request.url);
  const fromQuery = url.searchParams.get("sheetId")?.trim();
  if (fromQuery) return fromQuery;
  if (body && typeof body.sheetId === "string" && body.sheetId.trim()) return body.sheetId.trim();
  return registry.activeSheetId();
}

async function generatePreviewPdf(sheetId: string, config: PdfMappingConfig) {
  const sheet = await ss.getSheet(sheetId);
  const extracted = ss.extractColumns(sheet);
  const { columns: formColumns } = await resolveFormColumns(sheet, extracted);
  const fieldConfig = await loadFormFields(sheetId);
  const columns = expandColumnsWithCheckboxGroups(formColumns, extracted, fieldConfig);
  const fieldMeta = fieldMetaFromConfig(fieldConfig);
  const byTitle = new Map(columns.map((c) => [c.title.toLowerCase(), c]));

  const fields =
    fieldConfig?.fields?.filter((f) => !f.hiddenOnForm) ??
    columns.map((c) => ({
      columnTitle: c.title,
      order: 0,
      itemKind: "field" as const,
      label: undefined as string | undefined,
      text: undefined as string | undefined,
    }));

  const entries: PdfFieldEntry[] = [];
  for (const item of fields) {
    if (isLayoutFormItem(item)) {
      const kind =
        item.itemKind === "heading"
          ? "heading"
          : item.itemKind === "description"
            ? "description"
            : item.itemKind === "divider"
              ? "divider"
              : "field";
      entries.push({
        label: item.label || item.columnTitle,
        columnTitle: item.columnTitle,
        value: item.text || item.label || "",
        kind,
      });
      continue;
    }

    const col = byTitle.get(item.columnTitle.toLowerCase());
    if (!col) continue;
    const meta = fieldMeta[item.columnTitle.toLowerCase()];
    const label = meta?.label?.trim() || item.label?.trim() || item.columnTitle;
    entries.push({
      label,
      columnTitle: item.columnTitle,
      value: sampleValueForTitle(item.columnTitle, col.type),
      kind: "field",
    });
  }

  const filtered = applyPdfCustomization(entries, config);
  const formTitle = richTextPlainText(fieldConfig?.formTitle ?? "") || String(sheet.name ?? "Form");
  const formDescription = richTextPlainText(fieldConfig?.formDescription ?? "");

  const pdfBytes = await buildSubmissionPdf({
    formTitle,
    formDescription,
    sheetName: String(sheet.name ?? "Form"),
    entries: filtered,
    config,
    logoSrc: config.showLogo === false ? null : fieldConfig?.headerLogoDataUrl,
  });

  const filename = (config.outputFileName || "Final PDF.pdf").replace(/"/g, "");
  const body = Uint8Array.from(pdfBytes);
  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${filename}"`,
      "Cache-Control": "private, no-store",
      "Content-Length": String(body.byteLength),
    },
  });
}

export async function GET(request: Request) {
  const access = await requireFormsAdminAccess();
  if ("response" in access) return access.response;

  await ensureBootstrapped();
  const sheetId = await resolveSheetId(request);
  if (!sheetId) {
    return Response.json({ error: "No form selected yet." }, { status: 409 });
  }

  try {
    const mapping = await loadPdfMapping(sheetId);
    const config = normalizePdfMappingConfig(mapping?.config ?? {});
    return await generatePreviewPdf(sheetId, config);
  } catch (err) {
    console.error("[pdf-mapping preview GET]", err);
    return Response.json({ error: "Failed to generate PDF preview." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const access = await requireFormsAdminAccess();
  if ("response" in access) return access.response;

  await ensureBootstrapped();
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const sheetId = await resolveSheetId(request, body);
  if (!sheetId) {
    return Response.json({ error: "No form selected yet." }, { status: 409 });
  }

  try {
    const mapping = await loadPdfMapping(sheetId);
    const config = normalizePdfMappingConfig({
      ...(mapping?.config ?? {}),
      ...(body.config && typeof body.config === "object" ? body.config : body),
    });
    return await generatePreviewPdf(sheetId, config);
  } catch (err) {
    console.error("[pdf-mapping preview POST]", err);
    return Response.json({ error: "Failed to generate PDF preview." }, { status: 500 });
  }
}
