"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  SourcesCatalogTable,
  type SourceCatalogRow,
} from "@/components/admin/SourcesCatalogTable";
import { Button } from "@/components/admin/WorkspacePrimitives";
import { CreateFormModal, excelOverridesFromColumns, type CreateFormMode } from "@/components/forms/admin/CreateFormModal";
import { DuplicateFormModal } from "@/components/forms/admin/DuplicateFormModal";
import { IconPlus } from "@/components/forms/icons";
import type { ExcelImportColumn } from "@/lib/forms/excel-import-types";

interface SheetOption {
  id: number;
  name: string;
}

async function parseJson(r: Response): Promise<Record<string, unknown>> {
  const text = await r.text();
  if (!text) return {};
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    throw new Error(
      r.ok
        ? "Invalid response from server."
        : `Request failed (${r.status}). Sign in again if you were redirected.`,
    );
  }
}

interface SourcesCatalogClientProps {
  initialRows: SourceCatalogRow[];
}

export function SourcesCatalogClient({ initialRows }: SourcesCatalogClientProps) {
  const router = useRouter();
  const [rows, setRows] = useState(initialRows);
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [mode, setMode] = useState<CreateFormMode>("template");
  const [sheets, setSheets] = useState<SheetOption[]>([]);
  const [sheetsError, setSheetsError] = useState("");
  const [templateId, setTemplateId] = useState("");
  const [newName, setNewName] = useState("");
  const [destinationFolderId, setDestinationFolderId] = useState("");
  const [creating, setCreating] = useState(false);
  const [createMsg, setCreateMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [excelFile, setExcelFile] = useState<File | null>(null);
  const [excelColumns, setExcelColumns] = useState<ExcelImportColumn[] | null>(null);
  const [excelRowCount, setExcelRowCount] = useState(0);
  const [excelPreviewing, setExcelPreviewing] = useState(false);
  const [excelPreviewError, setExcelPreviewError] = useState("");

  const [duplicateModalOpen, setDuplicateModalOpen] = useState(false);
  const [duplicateSourceId, setDuplicateSourceId] = useState<string | null>(null);
  const [duplicateName, setDuplicateName] = useState("");
  const [duplicateError, setDuplicateError] = useState("");
  const [duplicating, setDuplicating] = useState(false);

  useEffect(() => {
    setRows(initialRows);
  }, [initialRows]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (row) =>
        row.name.toLowerCase().includes(q) ||
        row.id.toLowerCase().includes(q) ||
        row.sheetId.includes(q) ||
        (row.slug ?? "").toLowerCase().includes(q),
    );
  }, [rows, query]);

  const duplicateSource = useMemo(
    () => rows.find((r) => String(r.sheetId) === String(duplicateSourceId ?? "")) ?? null,
    [rows, duplicateSourceId],
  );

  async function refreshCatalog() {
    setLoading(true);
    setError("");
    try {
      const [sourcesRes, viewsRes] = await Promise.all([
        fetch("/api/admin/sources", { credentials: "include" }),
        fetch("/api/admin/views", { credentials: "include" }),
      ]);
      const sourcesData = await parseJson(sourcesRes);
      const viewsData = await parseJson(viewsRes);
      if (!sourcesRes.ok) throw new Error(String(sourcesData.error || "Could not load sources."));

      const sources = (sourcesData.sources as Array<Record<string, unknown>>) ?? [];
      const views = (viewsData.views as Array<{ sourceId?: string }>) ?? [];
      const viewsBySource = views.reduce<Map<string, number>>((map, view) => {
        if (!view.sourceId) return map;
        map.set(view.sourceId, (map.get(view.sourceId) ?? 0) + 1);
        return map;
      }, new Map());

      const nextRows: SourceCatalogRow[] = sources.map((source) => {
        const sourceType = source.sourceType === "report" ? "report" : "sheet";
        const formsEnabled = sourceType === "sheet" && source.formsEnabled !== false;
        return {
          id: String(source.id),
          sheetId: String(source.smartsheetId),
          name: String(source.label ?? source.id),
          sourceType,
          formsEnabled,
          provenance: (source.formProvenance as SourceCatalogRow["provenance"]) ?? null,
          slug: formsEnabled ? String(source.formSlug ?? "") || null : null,
          createdAt: source.formRegisteredAt ? String(source.formRegisteredAt) : null,
          public: Boolean(source.formPublic),
          viewCount: viewsBySource.get(String(source.id)) ?? 0,
        };
      });

      setRows(nextRows);
      router.refresh();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Could not refresh sources.");
    } finally {
      setLoading(false);
    }
  }

  function editBuilder(sourceId: string) {
    router.push(`/admin/sources/${encodeURIComponent(sourceId)}/builder`);
  }

  function viewSheet(sourceId: string) {
    router.push(`/admin/sources/${encodeURIComponent(sourceId)}/sheet`);
  }

  async function publishForm(sheetId: string) {
    setBusyId(sheetId);
    setError("");
    try {
      const r = await fetch(`/api/forms/registry/${encodeURIComponent(sheetId)}/publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const d = await parseJson(r);
      if (!r.ok) throw new Error(String(d.error || d.message || "Publish failed."));
      await refreshCatalog();
      if (d.publicUrl) {
        void navigator.clipboard.writeText(`${window.location.origin}${String(d.publicUrl)}`).catch(() => undefined);
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Publish failed.");
    } finally {
      setBusyId(null);
    }
  }

  async function unpublishForm(sheetId: string) {
    setBusyId(sheetId);
    setError("");
    try {
      const r = await fetch(`/api/forms/registry/${encodeURIComponent(sheetId)}/unpublish`, {
        method: "POST",
      });
      const d = await parseJson(r);
      if (!r.ok) throw new Error(String(d.error || d.message || "Unpublish failed."));
      await refreshCatalog();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Unpublish failed.");
    } finally {
      setBusyId(null);
    }
  }

  function defaultDuplicateName(sourceName: string): string {
    const base = sourceName.trim() || "Form";
    if (/\(copy\)\s*$/i.test(base)) return `${base} ${Date.now().toString().slice(-4)}`;
    return `${base} (copy)`;
  }

  function openDuplicateModal(sheetId: string) {
    const source = rows.find((r) => String(r.sheetId) === String(sheetId));
    setDuplicateSourceId(sheetId);
    setDuplicateName(defaultDuplicateName(source?.name ?? "Form"));
    setDuplicateError("");
    setDuplicateModalOpen(true);
  }

  function closeDuplicateModal() {
    if (duplicating) return;
    setDuplicateModalOpen(false);
    setDuplicateSourceId(null);
    setDuplicateName("");
    setDuplicateError("");
  }

  async function confirmDuplicateForm() {
    const id = duplicateSourceId;
    if (!id) return;
    const name = duplicateName.trim();
    if (!name) {
      setDuplicateError("Enter a name for the duplicated sheet.");
      return;
    }
    setDuplicating(true);
    setBusyId(id);
    setDuplicateError("");
    setError("");
    try {
      const r = await fetch(`/api/forms/registry/${encodeURIComponent(id)}/duplicate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newName: name }),
      });
      const d = await parseJson(r);
      if (!r.ok) throw new Error(String(d.error || d.message || "Duplicate failed."));
      setDuplicateModalOpen(false);
      setDuplicateSourceId(null);
      setDuplicateName("");
      await refreshCatalog();
      const form = d.form as { sourceConfigId?: string } | undefined;
      if (form?.sourceConfigId) {
        router.push(`/admin/sources/${encodeURIComponent(form.sourceConfigId)}/builder`);
      } else {
        router.push("/admin/sources");
      }
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Duplicate failed.";
      setDuplicateError(message);
      setError(message);
    } finally {
      setDuplicating(false);
      setBusyId(null);
    }
  }

  async function loadSheets() {
    try {
      const r = await fetch("/api/forms/platform/sheets", { credentials: "include" });
      const d = await parseJson(r);
      if (!r.ok) throw new Error(String(d.error || d.message || "Could not load sheets."));
      setSheets((d.sheets as SheetOption[]) ?? []);
      setSheetsError("");
    } catch (e: unknown) {
      setSheets([]);
      setSheetsError(e instanceof Error ? e.message : "Could not load sheets.");
    }
  }

  function openCreateModal() {
    setCreateMsg(null);
    setCreateModalOpen(true);
    void loadSheets();
  }

  function closeCreateModal() {
    if (creating) return;
    setCreateModalOpen(false);
    setCreateMsg(null);
    setExcelFile(null);
    setExcelColumns(null);
    setExcelRowCount(0);
    setExcelPreviewError("");
  }

  function handleModeChange(next: CreateFormMode) {
    setMode(next);
    setCreateMsg(null);
    if (next !== "excel") setExcelPreviewError("");
  }

  async function previewExcelFile(file?: File | null) {
    const f = file === undefined ? excelFile : file;
    setExcelPreviewError("");
    setExcelColumns(null);
    setExcelRowCount(0);
    if (!f) return;
    setExcelPreviewing(true);
    try {
      const body = new FormData();
      body.append("file", f);
      const r = await fetch("/api/forms/registry/excel/preview", { method: "POST", body });
      const d = await parseJson(r);
      if (!r.ok) throw new Error(String(d.error || d.message || "Could not read that file."));
      const preview = d.preview as { columns?: ExcelImportColumn[]; rowCount?: number } | undefined;
      setExcelColumns(preview?.columns ?? []);
      setExcelRowCount(Number(preview?.rowCount ?? 0));
      if (!newName.trim() && f.name) {
        const base = f.name.replace(/\.(xlsx|csv)$/i, "").trim();
        if (base) setNewName(base);
      }
    } catch (e: unknown) {
      setExcelPreviewError(e instanceof Error ? e.message : "Could not read that file.");
    } finally {
      setExcelPreviewing(false);
    }
  }

  async function createForm() {
    setCreateMsg(null);
    if (mode === "template" && !templateId) {
      return setCreateMsg({ ok: false, text: "Choose a template sheet first." });
    }
    if (mode === "excel") {
      if (!excelFile) return setCreateMsg({ ok: false, text: "Choose an Excel or CSV file first." });
      if (!excelColumns?.some((c) => c.included)) {
        return setCreateMsg({ ok: false, text: "Include at least one column." });
      }
    }
    setCreating(true);
    try {
      let r: Response;
      if (mode === "excel") {
        const body = new FormData();
        body.append("mode", "excel");
        body.append("file", excelFile!);
        body.append("newName", newName);
        if (destinationFolderId.trim()) body.append("destinationFolderId", destinationFolderId.trim());
        body.append("columnOverrides", JSON.stringify(excelOverridesFromColumns(excelColumns!)));
        r = await fetch("/api/forms/registry/create", { method: "POST", body });
      } else {
        r = await fetch("/api/forms/registry/create", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mode,
            templateId,
            newName,
            destinationFolderId: destinationFolderId || undefined,
          }),
        });
      }
      const d = await parseJson(r);
      if (!r.ok) throw new Error(String(d.error || d.message || "Create failed."));
      setNewName("");
      setExcelFile(null);
      setExcelColumns(null);
      setExcelRowCount(0);
      const sheet = d.sheet as { name?: string } | undefined;
      setCreateMsg({
        ok: true,
        text: `Created "${sheet?.name ?? "form"}" and set it active.${d.note ? ` ${d.note}` : ""}`,
      });
      await refreshCatalog();
      setCreateModalOpen(false);
    } catch (e: unknown) {
      setCreateMsg({ ok: false, text: e instanceof Error ? e.message : "Create failed." });
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <button
          type="button"
          onClick={openCreateModal}
          className="inline-flex items-center gap-1.5 rounded-full bg-crimson px-4 py-2 text-sm font-medium text-white hover:bg-[#8a1538]"
          data-tour="as-create-form"
        >
          <IconPlus className="h-4 w-4" />
          Create form
        </button>
        <Link href="/admin/sources/new" data-tour="as-new">
          <Button variant="primary">New source</Button>
        </Link>
      </div>

      {error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>
      ) : null}

      <SourcesCatalogTable
        rows={filtered}
        query={query}
        onQueryChange={setQuery}
        onEditBuilder={editBuilder}
        onViewSheet={viewSheet}
        onPublish={publishForm}
        onUnpublish={unpublishForm}
        onDuplicate={openDuplicateModal}
        busyId={busyId}
        loading={loading}
      />

      <CreateFormModal
        open={createModalOpen}
        onClose={closeCreateModal}
        mode={mode}
        onModeChange={handleModeChange}
        templateId={templateId}
        onTemplateIdChange={setTemplateId}
        sheets={sheets}
        sheetsError={sheetsError}
        newName={newName}
        onNewNameChange={setNewName}
        destinationFolderId={destinationFolderId}
        onDestinationFolderIdChange={setDestinationFolderId}
        creating={creating}
        onCreate={createForm}
        createMsg={createMsg}
        excelFile={excelFile}
        onExcelFileChange={(file) => {
          setExcelFile(file);
          setExcelColumns(null);
          setExcelRowCount(0);
          setExcelPreviewError("");
        }}
        excelColumns={excelColumns}
        onExcelColumnsChange={setExcelColumns}
        excelRowCount={excelRowCount}
        excelPreviewing={excelPreviewing}
        excelPreviewError={excelPreviewError}
        onExcelPreview={(file) => void previewExcelFile(file)}
      />

      <DuplicateFormModal
        open={duplicateModalOpen}
        onClose={closeDuplicateModal}
        sourceName={duplicateSource?.name ?? ""}
        newName={duplicateName}
        onNewNameChange={setDuplicateName}
        duplicating={duplicating}
        onConfirm={() => void confirmDuplicateForm()}
        error={duplicateError}
      />
    </div>
  );
}
