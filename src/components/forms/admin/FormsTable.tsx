"use client";

import { useEffect, useRef, useState } from "react";
import { IconCheck, IconCopy, IconEye, IconFile, IconMore, IconPencil, IconSearch } from "@/components/forms/icons";
import { DataTable, type DataTableColumn } from "@/components/ui/Table";

export interface FormEntryRow {
  id: string;
  name: string;
  createdAt: string;
  source: "template" | "scratch" | "imported" | "sample";
  slug?: string;
  public?: boolean;
  publishedAt?: string;
  sourceConfigId?: string;
}

const SOURCE_LABEL: Record<FormEntryRow["source"], string> = {
  template: "Cloned",
  scratch: "From scratch",
  imported: "Added",
  sample: "Sample",
};

const iconBtnClass =
  "inline-flex items-center justify-center rounded-lg border border-[color:var(--wsu-border)] p-1.5 text-[color:var(--wsu-ink)] hover:bg-white disabled:opacity-50";

const menuItemClass =
  "block w-full px-3 py-2 text-left text-xs font-medium text-[color:var(--wsu-ink)] hover:bg-[color:var(--wsu-stone)] disabled:opacity-50";

function truncateSheetId(id: string): string {
  if (id.length <= 12) return id;
  return `${id.slice(0, 6)}…${id.slice(-4)}`;
}

interface FormsTableProps {
  forms: FormEntryRow[];
  activeId: string;
  activePath: string;
  query: string;
  onQueryChange: (value: string) => void;
  onUseForm: (id: string) => void;
  onEdit: (id: string) => void;
  onViewSheet: (id: string) => void;
  onPublish: (id: string) => void;
  onUnpublish: (id: string) => void;
  onDuplicate: (id: string) => void;
  busyId?: string | null;
  loading?: boolean;
}

function FormRowActions({
  form,
  busy,
  onEdit,
  onViewSheet,
  onPublish,
  onUnpublish,
  onDuplicate,
}: {
  form: FormEntryRow;
  busy: boolean;
  onEdit: (id: string) => void;
  onViewSheet: (id: string) => void;
  onPublish: (id: string) => void;
  onUnpublish: (id: string) => void;
  onDuplicate: (id: string) => void;
}) {
  const isPublished = Boolean(form.public);
  const publicUrl = form.slug ? `/f/${form.slug}` : null;
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
      if (event.key === "Escape") {
        setMenuOpen(false);
      }
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
    const absolute = `${window.location.origin}${publicUrl}`;
    await navigator.clipboard.writeText(absolute);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div ref={rootRef} className="relative flex items-center justify-end gap-1.5">
      <button
        type="button"
        className={iconBtnClass}
        disabled={busy}
        onClick={() => onViewSheet(form.id)}
        aria-label={`View ${form.name} on Sheet tab`}
        title="View on Sheet"
      >
        <IconEye className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        className={iconBtnClass}
        disabled={busy}
        onClick={() => onEdit(form.id)}
        aria-label={`Edit ${form.name}`}
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
          aria-label={copied ? "URL copied" : `Copy public URL for ${form.name}`}
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
          aria-label={`More actions for ${form.name}`}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          title="More actions"
        >
          <IconMore className="h-3.5 w-3.5" />
        </button>
        {menuOpen ? (
          <div
            role="menu"
            className="absolute right-0 z-20 mt-1 min-w-[9.5rem] rounded-lg border border-[color:var(--wsu-border)] bg-white py-1 shadow-md"
          >
            <button
              type="button"
              role="menuitem"
              className={menuItemClass}
              disabled={busy}
              onClick={() => {
                setMenuOpen(false);
                onDuplicate(form.id);
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
                  onUnpublish(form.id);
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
                  onPublish(form.id);
                }}
              >
                Publish
              </button>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function FormsTable({
  forms,
  activeId,
  activePath,
  query,
  onQueryChange,
  onUseForm,
  onEdit,
  onViewSheet,
  onPublish,
  onUnpublish,
  onDuplicate,
  busyId,
  loading = false,
}: FormsTableProps) {
  const columns: DataTableColumn<FormEntryRow>[] = [
    {
      id: "name",
      header: "Name",
      cellClassName: "max-w-[200px]",
      cell: (form) => (
        <>
          <div className="flex items-center gap-2">
            <IconFile className="h-4 w-4 shrink-0 text-[color:var(--wsu-muted)]" />
            <span className="truncate font-medium text-[color:var(--wsu-ink)]">{form.name}</span>
          </div>
          <p className="mt-0.5 font-mono text-[10px] text-[color:var(--wsu-muted)]" title={form.id}>
            {truncateSheetId(form.id)}
          </p>
          {form.sourceConfigId ? (
            <a
              href={`/admin/sources/${encodeURIComponent(form.sourceConfigId)}`}
              className="mt-1 inline-block text-[10px] font-medium text-wsu-crimson hover:underline"
            >
              Admin source →
            </a>
          ) : null}
        </>
      ),
    },
    {
      id: "source",
      header: "Source",
      cellClassName: "text-[color:var(--wsu-muted)]",
      cell: (form) => (
        <>
          <span>{SOURCE_LABEL[form.source]}</span>
          {form.sourceConfigId ? (
            <a
              href={`/admin/sources/${encodeURIComponent(form.sourceConfigId)}`}
              className="mt-1 block text-[10px] font-medium text-wsu-crimson hover:underline"
            >
              Edit source / views →
            </a>
          ) : null}
        </>
      ),
    },
    {
      id: "slug",
      header: "Slug",
      cellClassName: "font-mono text-xs text-[color:var(--wsu-muted)]",
      cell: (form) => form.slug || "—",
    },
    {
      id: "created",
      header: "Created",
      cellClassName: "text-[color:var(--wsu-muted)]",
      cell: (form) => (form.createdAt ? new Date(form.createdAt).toLocaleDateString() : ""),
    },
    {
      id: "workspace",
      header: "Workspace",
      cell: (form) => {
        const isActive = String(form.id) === activeId;
        return isActive ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-800">
            <IconCheck className="h-3 w-3" />
            Active
          </span>
        ) : (
          <button
            type="button"
            onClick={() => onUseForm(form.id)}
            className="rounded-lg border border-[color:var(--wsu-border)] px-2.5 py-1 text-xs font-medium text-[color:var(--wsu-ink)] hover:bg-white"
          >
            Use
          </button>
        );
      },
    },
    {
      id: "publication",
      header: "Publication",
      cell: (form) =>
        form.public ? (
          <span className="inline-flex rounded-full bg-sky-50 px-2.5 py-0.5 text-xs font-medium text-sky-800">
            Published
          </span>
        ) : (
          <span className="inline-flex rounded-full bg-[color:var(--wsu-stone)] px-2.5 py-0.5 text-xs font-medium text-[color:var(--wsu-muted)]">
            Draft
          </span>
        ),
    },
    {
      id: "actions",
      header: <span className="sr-only">Actions</span>,
      cell: (form) => (
        <FormRowActions
          form={form}
          busy={busyId === form.id}
          onEdit={onEdit}
          onViewSheet={onViewSheet}
          onPublish={onPublish}
          onUnpublish={onUnpublish}
          onDuplicate={onDuplicate}
        />
      ),
    },
  ];

  return (
    <div className="rounded-xl border border-[color:var(--wsu-border)] bg-white">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[color:var(--wsu-border)] px-4 py-3">
        <div>
          <h2 className="text-sm font-medium text-[color:var(--wsu-ink)]">Your forms</h2>
          <p className="mt-0.5 text-xs text-[color:var(--wsu-muted)]">
            Sheet sources from Admin Sources. Active = Forms workspace. Published = public /f URL.
          </p>
          <p className="mt-0.5 text-xs text-[color:var(--wsu-muted)]">Active path: {activePath || "—"}</p>
        </div>
        <div className="relative w-full sm:w-56">
          <IconSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[color:var(--wsu-muted)]" />
          <input
            type="search"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder="Filter by name or sheet ID"
            aria-label="Filter forms"
            className="w-full rounded-lg border border-[color:var(--wsu-border)] py-2 pl-9 pr-3 text-sm text-[color:var(--wsu-ink)] placeholder:text-[color:var(--wsu-muted)] focus:border-wsu-crimson focus:outline-none focus:ring-1 focus:ring-wsu-crimson"
          />
        </div>
      </div>

      {loading ? (
        <p className="px-4 py-8 text-center text-sm text-[color:var(--wsu-muted)]">Loading forms…</p>
      ) : forms.length === 0 ? (
        <p className="px-4 py-8 text-center text-sm text-[color:var(--wsu-muted)]">No forms yet.</p>
      ) : (
        <DataTable
          columns={columns}
          data={forms}
          getRowKey={(form) => form.id}
          stickyHeader
          maxHeight="min(32rem, 55vh)"
          minWidth={720}
        />
      )}
    </div>
  );
}
