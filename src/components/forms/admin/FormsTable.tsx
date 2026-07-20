"use client";

import { useState } from "react";
import { IconCheck, IconFile, IconPencil, IconSearch } from "@/components/forms/icons";
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
  onPublish: (id: string) => void;
  onUnpublish: (id: string) => void;
  onShareActiveSheet: (email: string) => Promise<{ ok: boolean; text: string }>;
  busyId?: string | null;
  loading?: boolean;
}

export function FormsTable({
  forms,
  activeId,
  activePath,
  query,
  onQueryChange,
  onUseForm,
  onEdit,
  onPublish,
  onUnpublish,
  onShareActiveSheet,
  busyId,
  loading = false,
}: FormsTableProps) {
  const [shareOpen, setShareOpen] = useState(false);
  const [shareEmail, setShareEmail] = useState("");
  const [shareBusy, setShareBusy] = useState(false);
  const [shareMsg, setShareMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function handleShare() {
    const email = shareEmail.trim();
    if (!email || shareBusy) return;
    setShareBusy(true);
    setShareMsg(null);
    try {
      const result = await onShareActiveSheet(email);
      setShareMsg(result);
      if (result.ok) {
        setShareEmail("");
        setShareOpen(false);
      }
    } finally {
      setShareBusy(false);
    }
  }

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
      cell: (form) => {
        const isActive = String(form.id) === activeId;
        const isPublished = Boolean(form.public);
        const publicUrl = form.slug ? `/f/${form.slug}` : null;
        const busy = busyId === form.id;
        return (
          <div className="flex flex-col items-end gap-1.5">
            <div className="flex flex-wrap justify-end gap-1.5">
              <button
                type="button"
                className="inline-flex items-center justify-center rounded-lg border border-[color:var(--wsu-border)] p-1.5 text-[color:var(--wsu-ink)] hover:bg-white disabled:opacity-50"
                disabled={busy}
                onClick={() => onEdit(form.id)}
                aria-label={`Edit ${form.name}`}
                title="Edit in builder"
              >
                <IconPencil className="h-3.5 w-3.5" />
              </button>
              {isActive ? (
                <button
                  type="button"
                  className="rounded-lg border border-[color:var(--wsu-border)] px-2.5 py-1 text-xs font-medium text-[color:var(--wsu-ink)] hover:bg-white"
                  onClick={() => {
                    setShareOpen((open) => !open);
                    setShareMsg(null);
                  }}
                  aria-expanded={shareOpen}
                >
                  Share
                </button>
              ) : null}
              {isPublished && publicUrl ? (
                <button
                  type="button"
                  className="rounded-lg border border-[color:var(--wsu-border)] px-2.5 py-1 text-xs font-medium text-[color:var(--wsu-ink)] hover:bg-white disabled:opacity-50"
                  disabled={busy}
                  onClick={() => {
                    const absolute = `${window.location.origin}${publicUrl}`;
                    void navigator.clipboard.writeText(absolute);
                  }}
                >
                  Copy URL
                </button>
              ) : null}
              {isPublished ? (
                <button
                  type="button"
                  className="rounded-lg border border-[color:var(--wsu-border)] px-2.5 py-1 text-xs font-medium text-[color:var(--wsu-ink)] hover:bg-white disabled:opacity-50"
                  disabled={busy}
                  onClick={() => onUnpublish(form.id)}
                >
                  Unpublish
                </button>
              ) : (
                <button
                  type="button"
                  className="rounded-lg bg-wsu-crimson px-2.5 py-1 text-xs font-medium text-white hover:bg-wsu-crimson/90 disabled:opacity-50"
                  disabled={busy}
                  onClick={() => onPublish(form.id)}
                >
                  Publish
                </button>
              )}
            </div>
            {isActive && shareOpen ? (
              <div className="flex w-full min-w-[14rem] max-w-xs flex-col gap-1.5 sm:items-end">
                <div className="flex w-full flex-wrap gap-1.5 sm:justify-end">
                  <input
                    type="email"
                    value={shareEmail}
                    onChange={(e) => setShareEmail(e.target.value)}
                    placeholder="user@wsu.edu"
                    aria-label="Email to share active sheet with"
                    className="min-w-0 flex-1 rounded-lg border border-[color:var(--wsu-border)] px-2.5 py-1 text-xs text-[color:var(--wsu-ink)] placeholder:text-[color:var(--wsu-muted)] focus:border-wsu-crimson focus:outline-none focus:ring-1 focus:ring-wsu-crimson"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        void handleShare();
                      }
                    }}
                  />
                  <button
                    type="button"
                    disabled={shareBusy || !shareEmail.trim()}
                    onClick={() => void handleShare()}
                    className="rounded-lg bg-wsu-crimson px-2.5 py-1 text-xs font-medium text-white hover:bg-wsu-crimson/90 disabled:opacity-50"
                  >
                    {shareBusy ? "Sharing…" : "Send"}
                  </button>
                </div>
                {shareMsg ? (
                  <p
                    className={`text-[10px] ${shareMsg.ok ? "text-emerald-700" : "text-red-700"}`}
                    role="status"
                  >
                    {shareMsg.text}
                  </p>
                ) : (
                  <p className="text-[10px] text-[color:var(--wsu-muted)]">Grants EDITOR access on this sheet</p>
                )}
              </div>
            ) : null}
            {isActive && !shareOpen && shareMsg?.ok ? (
              <p className="text-[10px] text-emerald-700" role="status">
                {shareMsg.text}
              </p>
            ) : null}
          </div>
        );
      },
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
