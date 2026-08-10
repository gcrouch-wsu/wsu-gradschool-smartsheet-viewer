import { NextResponse } from "next/server";
import { fieldMetaFromConfig } from "@/lib/forms/form-field-meta";
import { isLayoutFormItem } from "@/lib/forms/form-field-config";
import {
  applyPdfCustomization,
  buildSubmissionPdf,
  formatPdfCellValue,
} from "@/lib/forms/pdf-mapping";
import type { PdfFieldEntry } from "@/lib/forms/pdf-mapping-types";
import { ensureBootstrapped } from "@/lib/forms/init";
import { loadFormFields } from "@/lib/forms/store/field-config";
import { loadPdfMapping } from "@/lib/forms/store/pdf-mapping";
import { requireStudentSession } from "@/lib/forms/student-auth";
import { assertOwnedRow, loadOwnedSheetContext } from "@/lib/forms/student-rows";
import { richTextPlainText } from "@/lib/rendering";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function contentDisposition(disposition: "inline" | "attachment", name: string) {
  const safe = name.replace(/[\r\n"]/g, "_").trim() || "Final PDF.pdf";
  return `${disposition}; filename="${safe}"; filename*=UTF-8''${encodeURIComponent(safe)}`;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ sheetId: string; rowId: string }> },
) {
  const session = await requireStudentSession();
  if (!session.ok) return session.response;

  await ensureBootstrapped();
  const { sheetId, rowId } = await params;
  const rowIdNum = Number(rowId);
  if (!Number.isFinite(rowIdNum)) {
    return NextResponse.json({ error: "Invalid row id." }, { status: 400 });
  }

  try {
    const loaded = await loadOwnedSheetContext(sheetId, session.email);
    if (!loaded.ok) return NextResponse.json({ error: loaded.error }, { status: loaded.status });
    const row = assertOwnedRow(loaded.context, rowIdNum, session.email);
    if (!row) return NextResponse.json({ error: "Submission not found." }, { status: 404 });

    const mapping = await loadPdfMapping(loaded.context.entry.sheetId);
    if (!mapping?.config.enabled) {
      return NextResponse.json({ error: "A generated PDF is not configured for this submission." }, { status: 404 });
    }

    const fieldConfig = await loadFormFields(loaded.context.entry.sheetId);
    const fieldMeta = fieldMetaFromConfig(fieldConfig);
    const columns = loaded.context.columns.map((column) => ({ id: column.id, title: String(column.title ?? "") }));
    const values = new Map((row.cells ?? []).map((cell) => [cell.columnId, cell.displayValue ?? cell.value ?? ""]));
    const byTitle = new Map(columns.map((column) => [column.title.toLowerCase(), column]));
    const items =
      fieldConfig?.fields?.filter((field) => !field.hiddenOnForm) ??
      columns.map((column) => ({ columnTitle: column.title, order: 0, itemKind: "field" as const }));
    const entries: PdfFieldEntry[] = [];

    for (const item of items) {
      if (isLayoutFormItem(item)) {
        entries.push({
          label: item.label || item.columnTitle,
          columnTitle: item.columnTitle,
          value: item.text || item.label || "",
          kind: item.itemKind === "heading" ? "heading" : item.itemKind === "description" ? "description" : "divider",
        });
        continue;
      }
      const column = byTitle.get(item.columnTitle.toLowerCase());
      if (!column) continue;
      const meta = fieldMeta[item.columnTitle.toLowerCase()];
      entries.push({
        label: meta?.label?.trim() || item.label?.trim() || item.columnTitle,
        columnTitle: item.columnTitle,
        value: formatPdfCellValue(values.get(column.id) ?? ""),
        kind: "field",
      });
    }

    const filtered = applyPdfCustomization(entries, mapping.config);
    const name = mapping.config.outputFileName || "Final PDF.pdf";
    const url = new URL(request.url);
    const wantMeta = url.searchParams.get("meta") === "1";
    if (wantMeta) {
      return NextResponse.json({ name, mimeType: "application/pdf", previewable: true });
    }

    const pdfBytes = await buildSubmissionPdf({
      formTitle: richTextPlainText(fieldConfig?.formTitle ?? "") || String(loaded.context.sheet.name ?? loaded.context.entry.name),
      formDescription: richTextPlainText(fieldConfig?.formDescription ?? ""),
      sheetName: String(loaded.context.sheet.name ?? loaded.context.entry.name),
      entries: filtered,
      config: mapping.config,
      logoSrc: mapping.config.showLogo === false ? null : fieldConfig?.headerLogoDataUrl,
    });
    const disposition = url.searchParams.get("disposition") === "attachment" ? "attachment" : "inline";
    return new NextResponse(Uint8Array.from(pdfBytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": contentDisposition(disposition, name),
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to build the PDF preview." },
      { status: 500 },
    );
  }
}
