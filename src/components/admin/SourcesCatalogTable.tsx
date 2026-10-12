"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { IconCheck, IconCopy, IconEye, IconFile, IconMore, IconPencil, IconSearch } from "@/components/forms/icons";
import { DataTable, type DataTableColumn } from "@/components/ui/Table";
import type { FormProvenance } from "@/lib/config/types";

export interface SourceCatalogRow {
  /** Admin source config id */
  id: string;
  /** Smartsheet sheet/report id (string) — used by Forms APIs */
  sheetId: string;
  name: string;
  sourceType: "sheet" | "report";
  /** Whether this sheet is available as a form workspace entry */
  formsEnabled: boolean;
  provenance: FormProvenance | null;
  slug: string | null;
  createdAt: string | null;
  public: boolean;
  viewCount: number;
}

const PROVENANCE_LABEL: Record<FormProvenance, string> = {
  template: "Cloned",
  scratch: "From scratch",
  imported: "Added",
  sample: "Sample",
  excel: "From Excel",
};

const iconBtnClass =
  "inline-flex items-center justify-center rounded-lg border border-line-strong p-1.5 text-ink hover:bg-white disabled:opacity-50";

const menuItemClass =
  "block w-full px-3 py-2 text-left text-xs font-medium text-ink hover:bg-[#f5f2f0] disabled:opacity-50";

function truncateId(id: string): string {
  if (id.length <= 12) return id;
  return `${id.slice(0, 6)}…${id.slice(-4)}`;
}

interface SourcesCatalogTableProps {
  rows: SourceCatalogRow[];
  activeSheetId: string;
  activePath: string;
  query: string;
  onQueryChange: (value: string) => void;
  onUse: (sheetId: string) => void;
  onEditBuilder: (sheetId: string) => void;
  /** Open sheet grid nested under this source. */
  onViewSheet: (sourceId: string) => void;
  onPublish: (sheetId: string) => void;
  onUnpublish: (sheetId: string) => void;
  onDuplicate: (sheetId: string) => void;
  busyId?: string | null;
  loading?: boolean;
}

function RowActions({
  row,
  busy,
  onEditBuilder,
  onViewSheet,
  onPublish,
  onUnpublish,
  onDuplicate,
}: {
  row: SourceCatalogRow;
  busy: boolean;
  onEditBuilder: (sheetId: string) => void;
  onViewSheet: (sourceId: string) => void;
  onPublish: (sheetId: string) => void;
  onUnpublish: (sheetId: string) => void;
  onDuplicate: (sheetId: string) => void;
}) {
  const canForm = row.sourceType === "sheet" && row.formsEnabled;
  const isPublished = Boolean(row.public);
  const publicUrl = row.slug ? `/f/${row.slug}` : null;
  const [menuOpen, setMenuOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setMenuOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [menuOpen]);

  async function handleCopyUrl() {
    if (!publicUrl) return;
    await navigator.clipboard.writeText(`${window.location.origin}${publicUrl}`);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div ref={rootRef} className="relative flex items-center justify-end gap-1.5">
      {canForm ? (
        <>
          <button
            type="button"
            className={iconBtnClass}
            disabled={busy}
            onClick={() => onViewSheet(row.id)}
            aria-label={`View ${row.name} sheet`}
            title="View sheet"
          >
            <IconEye className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            className={iconBtnClass}
            disabled={busy}
            onClick={() => onEditBuilder(row.sheetId)}
            aria-label={`Edit ${row.name} in builder`}
            title="Edit in builder"
          >
            <IconPencil className="h-3.5 w-3.5" />
          </button>
          {isPublished && publicUrl ? (
            <button
              type="button"
              className={iconBtnClass}
              disabled={busy}
              onClick={() => void handleCopyUrl()}
              aria-label={copied ? "URL copied" : `Copy public URL for ${row.name}`}
              title={copied ? "Copied!" : "Copy URL"}
            >
              <IconCopy className="h-3.5 w-3.5" />
            </button>
          ) : null}
          <div className="relative">
            <button
              type="button"
              className={iconBtnClass}
              disabled={busy}
              onClick={() => setMenuOpen((open) => !open)}
              aria-label={`More actions for ${row.name}`}
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              title="More actions"
            >
              <IconMore className="h-3.5 w-3.5" />
            </button>
            {menuOpen ? (
              <div
                role="menu"
                className="absolute right-0 z-20 mt-1 min-w-[9.5rem] rounded-lg border border-line-strong bg-white py-1 shadow-md"
              >
                <Link href={`/admin/sources/${encodeURIComponent(row.id)}`} role="menuitem" className={menuItemClass}>
                  Edit source
                </Link>
                <button
                  type="button"
                  role="menuitem"
                  className={menuItemClass}
                  disabled={busy}
                  onClick={() => {
                    setMenuOpen(false);
                    onDuplicate(row.sheetId);
                  }}
                >
                  Duplicate
                </button>
                {isPublished ? (
                  <button
                    type="button"
                    role="menuitem"
                    className={menuItemClass}
                    disabled={busy}
                    onClick={() => {
                      setMenuOpen(false);
                      onUnpublish(row.sheetId);
                    }}
                  >
                    Unpublish
                  </button>
                ) : (
                  <button
                    type="button"
                    role="menuitem"
                    className={menuItemClass}
                    disabled={busy}
                    onClick={() => {
                      setMenuOpen(false);
                      onPublish(row.sheetId);
                    }}
                  >
                    Publish
                  </button>
                )}
              </div>
            ) : null}
          </div>
        </>
      ) : (
        <Link
          href={`/admin/sources/${encodeURIComponent(row.id)}`}
          className="rounded-lg border border-line-strong px-2.5 py-1 text-xs font-medium text-ink hover:bg-white"
        >
          Edit source
        </Link>
      )}
    </div>
  );
}

export function SourcesCatalogTable({
  rows,
  activeSheetId,
  activePath,
  query,
  onQueryChange,
  onUse,
  onEditBuilder,
  onViewSheet,
  onPublish,
  onUnpublish,
  onDuplicate,
  busyId,
  loading = false,
}: SourcesCatalogTableProps) {
  const columns: DataTableColumn<SourceCatalogRow>[] = [
    {
      id: "name",
      header: "Name",
      cellClassName: "max-w-[200px]",
      cell: (row) => (
        <>
          <div className="flex items-center gap-2">
            <IconFile className="h-4 w-4 shrink-0 text-sub" />
            <Link
              href={`/admin/sources/${encodeURIComponent(row.id)}`}
              className="truncate font-medium text-ink hover:text-crimson"
            >
              {row.name}
            </Link>
          </div>
          <p className="mt-0.5 font-mono text-[10px] text-sub" title={row.sheetId}>
            {truncateId(row.sheetId)}
          </p>
        </>
      ),
    },
    {
      id: "source",
      header: "Source",
      cellClassName: "text-sub",
      cell: (row) => {
        if (row.sourceType === "report") return <span>Report</span>;
        if (!row.formsEnabled) return <span>Views only</span>;
        return <span>{row.provenance ? PROVENANCE_LABEL[row.provenance] : "Added"}</span>;
      },
    },
    {
      id: "slug",
      header: "Slug",
      cellClassName: "font-mono text-xs text-sub",
      cell: (row) => (row.formsEnabled && row.slug ? row.slug : "—"),
    },
    {
      id: "created",
      header: "Created",
      cellClassName: "text-sub",
      cell: (row) =>
        row.createdAt && row.createdAt !== new Date(0).toISOString()
          ? new Date(row.createdAt).toLocaleDateString()
          : "—",
    },
    {
      id: "views",
      header: "Views",
      cell: (row) => (
        <Link
          href={`/admin/views?sourceId=${encodeURIComponent(row.id)}`}
          className="text-sm font-medium tabular-nums text-ink hover:text-crimson"
          title={row.viewCount === 1 ? "1 view" : `${row.viewCount} views`}
        >
          {row.viewCount}
        </Link>
      ),
    },
    {
      id: "workspace",
      header: "Workspace",
      cell: (row) => {
        if (!(row.sourceType === "sheet" && row.formsEnabled)) {
          return <span className="text-xs text-mist">—</span>;
        }
        const isActive = String(row.sheetId) === String(activeSheetId);
        return isActive ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-800">
            <IconCheck className="h-3 w-3" />
            Active
          </span>
        ) : (
          <button
            type="button"
            onClick={() => onUse(row.sheetId)}
            className="rounded-lg border border-line-strong px-2.5 py-1 text-xs font-medium text-ink hover:bg-white"
          >
            Use
          </button>
        );
      },
    },
    {
      id: "publication",
      header: "Publication",
      cell: (row) => {
        if (!(row.sourceType === "sheet" && row.formsEnabled)) {
          return <span className="text-xs text-mist">—</span>;
        }
        return row.public ? (
          <span className="inline-flex rounded-full bg-sky-50 px-2.5 py-0.5 text-xs font-medium text-sky-800">
            Published
          </span>
        ) : (
          <span className="inline-flex rounded-full bg-[#f5f2f0] px-2.5 py-0.5 text-xs font-medium text-sub">
            Draft
          </span>
        );
      },
    },
    {
      id: "actions",
      header: <span className="sr-only">Actions</span>,
      cell: (row) => (
        <RowActions
          row={row}
          busy={busyId === row.sheetId}
          onEditBuilder={onEditBuilder}
          onViewSheet={onViewSheet}
          onPublish={onPublish}
          onUnpublish={onUnpublish}
          onDuplicate={onDuplicate}
        />
      ),
    },
  ];

  return (
    <div className="rounded-xl border border-line-strong bg-white" data-tour="as-table">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line-strong px-4 py-3">
        <div>
          <h2 className="text-sm font-medium text-ink">Sources</h2>
          <p className="mt-0.5 text-xs text-sub">
            Shared catalog for views and forms. Active = Forms workspace. Published = public /f URL.
          </p>
          <p className="mt-0.5 text-xs text-sub">Active path: {activePath || "—"}</p>
        </div>
        <div className="relative w-full sm:w-56" data-tour="as-search">
          <IconSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-sub" />
          <input
            type="search"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder="Filter by name, id, or slug"
            aria-label="Filter sources"
            className="w-full rounded-lg border border-line-strong py-2 pl-9 pr-3 text-sm text-ink placeholder:text-sub focus:border-crimson focus:outline-none focus:ring-1 focus:ring-crimson"
          />
        </div>
      </div>

      {loading ? (
        <p className="px-4 py-8 text-center text-sm text-sub">Loading sources…</p>
      ) : rows.length === 0 ? (
        <p className="px-4 py-8 text-center text-sm text-sub">No sources yet.</p>
      ) : (
        <DataTable
          columns={columns}
          data={rows}
          getRowKey={(row) => row.id}
          stickyHeader
          maxHeight="min(32rem, 55vh)"
          minWidth={900}
        />
      )}
    </div>
  );
}
