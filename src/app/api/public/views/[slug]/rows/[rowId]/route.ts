import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { ADMIN_SESSION_COOKIE_NAME } from "@/lib/admin-auth";
import { resolveAdminPrincipalFromSession } from "@/lib/admin-users";
import { getContributorConfigurationError } from "@/lib/contributor-auth";
import { resolveContributorPrincipal } from "@/lib/identity";
import {
  buildContributorEditingClientConfig,
  isContributorInRow,
  isContributorStillInSheet,
  mergeContributorContactPayloadWithExistingRow,
  validateContributorPicklistCells,
} from "@/lib/contributor-utils";
import { loadPublicViewCollection } from "@/lib/public-view";
import {
  extractSmartsheetErrorMessage,
  httpStatusForSmartsheetContributorError,
  resolveSheetIdForRowUpdate,
  SmartsheetRequestError,
  updateSmartsheetRow,
} from "@/lib/smartsheet";
import { applyViewFilters } from "@/lib/filters";
import { CONTRIBUTOR_DATASET_OPTIONS, loadContributorDataset } from "@/lib/contributor-view";

export const runtime = "nodejs";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ slug: string; rowId: string }> },
) {
  const configurationError = getContributorConfigurationError();
  if (configurationError) {
    return NextResponse.json({ error: configurationError }, { status: 503 });
  }

  const cookieStore = await cookies();
  const contributor = await resolveContributorPrincipal();
  const adminAuth = await resolveAdminPrincipalFromSession(cookieStore.get(ADMIN_SESSION_COOKIE_NAME)?.value);
  const isAdminEditor = Boolean(adminAuth.ok && adminAuth.principal);
  const contributorEmail = !isAdminEditor ? contributor?.email ?? null : null;
  const isContributor = Boolean(contributorEmail);

  if (!isAdminEditor && !isContributor) {
    return NextResponse.json({ error: "Sign in to edit." }, { status: 401 });
  }

  const { slug, rowId: rowIdParam } = await params;
  const rowId = Number(rowIdParam);
  const body = (await request.json().catch(() => null)) as
    | { viewId?: unknown; cells?: Array<{ columnId?: unknown; value?: unknown; objectValue?: unknown }> }
    | null;

  if (!Number.isFinite(rowId)) {
    return NextResponse.json({ error: "Row not found." }, { status: 404 });
  }

  const viewId = typeof body?.viewId === "string" ? body.viewId : "";
  if (!viewId) {
    return NextResponse.json({ error: "viewId is required." }, { status: 400 });
  }

  const collection = await loadPublicViewCollection(slug);
  if (!collection) {
    return NextResponse.json({ error: "View not found." }, { status: 404 });
  }

  const view = collection.viewConfigs.find((entry) => entry.id === viewId);
  if (!view || !view.editing?.enabled) {
    return NextResponse.json({ error: "View not found." }, { status: 404 });
  }

  const dataset = await loadContributorDataset(collection.sourceConfig, CONTRIBUTOR_DATASET_OPTIONS);

  if (isContributor && !isAdminEditor) {
    const email = contributorEmail!;
    if (!isContributorStillInSheet(dataset.rows, email, view.editing.contactColumnIds)) {
      return NextResponse.json({ error: "Your access has been removed. Contact your coordinator." }, { status: 403 });
    }
  }

  const filteredRows = applyViewFilters(dataset.rows, view.filters);
  const row = filteredRows.find((entry) => entry.id === rowId);
  if (!row) {
    return NextResponse.json({ error: "Row not found." }, { status: 404 });
  }

  if (!isAdminEditor) {
    const email = contributorEmail!;
    if (!isContributorInRow(row, email, view.editing.contactColumnIds)) {
      return NextResponse.json({ error: "You cannot edit this row." }, { status: 403 });
    }
  }

  const editingConfig = buildContributorEditingClientConfig(view, dataset.columns, collection.sourceConfig);
  if (!editingConfig) {
    return NextResponse.json({ error: "View not found." }, { status: 404 });
  }

  const allowedColumnIds = new Set(editingConfig.editableColumnIds);
  const parsedCells = (Array.isArray(body?.cells) ? body.cells : [])
    .map((cell) => ({
      columnId: typeof cell?.columnId === "number" ? cell.columnId : Number(cell?.columnId),
      value: cell?.value,
      objectValue: cell?.objectValue,
    }))
    .filter((cell) => Number.isFinite(cell.columnId) && allowedColumnIds.has(cell.columnId));

  /** Last payload wins per columnId (avoids duplicate cells if client sends overlaps). */
  const byColumn = new Map<number, (typeof parsedCells)[0]>();
  for (const cell of parsedCells) {
    byColumn.set(cell.columnId, cell);
  }
  let filteredCells = [...byColumn.values()];

  if (filteredCells.length === 0) {
    return NextResponse.json({ error: "No editable cells in request." }, { status: 400 });
  }

  const columnsById = new Map(dataset.columns.map((c) => [c.id, c]));
  const columnTypeById = new Map([...columnsById].map(([id, col]) => [id, col.type]));
  filteredCells = mergeContributorContactPayloadWithExistingRow(filteredCells, row, columnTypeById);

  const picklistCheck = validateContributorPicklistCells(filteredCells, columnsById);
  if (!picklistCheck.ok) {
    return NextResponse.json({ error: picklistCheck.error }, { status: 400 });
  }

  const sheetId = resolveSheetIdForRowUpdate(collection.sourceConfig, row);
  if (sheetId == null) {
    return NextResponse.json(
      {
        error:
          "This row is missing sheet information (common with some report data). Saving is not supported for this row — contact your administrator.",
      },
      { status: 400 },
    );
  }

  try {
    await updateSmartsheetRow(collection.sourceConfig, sheetId, row.id, filteredCells, columnTypeById);
  } catch (error) {
    if (error instanceof SmartsheetRequestError && error.status === 429) {
      return NextResponse.json({ error: "Smartsheet rate limit. Try again shortly." }, { status: 429 });
    }
    if (error instanceof SmartsheetRequestError) {
      const message = extractSmartsheetErrorMessage(error.body);
      const status = httpStatusForSmartsheetContributorError(error.status);
      let refNote = "";
      try {
        const parsed = JSON.parse(error.body) as { refId?: string; errorCode?: number };
        if (parsed.refId || parsed.errorCode != null) {
          refNote = ` refId=${parsed.refId ?? "n/a"} errorCode=${parsed.errorCode ?? "n/a"}`;
        }
      } catch {
        /* body not JSON */
      }
      console.error(
        `[contributor PATCH] Smartsheet error${refNote}`,
        "httpStatus=",
        error.status,
        "body=",
        error.body?.slice(0, 1200),
      );
      return NextResponse.json({ error: message }, { status });
    }
    console.error("[contributor PATCH] Unexpected error", error);
    return NextResponse.json({ error: "Update failed. Try again." }, { status: 502 });
  }

  revalidatePath(`/view/${slug}`);
  revalidatePath(`/view/${slug}/print`);
  return NextResponse.json({ ok: true });
}
