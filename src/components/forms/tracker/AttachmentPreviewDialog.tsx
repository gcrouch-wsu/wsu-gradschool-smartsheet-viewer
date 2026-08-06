"use client";

import { useEffect, useMemo, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import type { TrackerAttachment } from "@/components/forms/tracker/types";

function attachmentPath(rowId: number, attachmentId: number, sheetId?: string | null) {
  const path = `/api/forms/submissions/${rowId}/attachments/${attachmentId}`;
  if (!sheetId) return path;
  return `${path}?sheetId=${encodeURIComponent(sheetId)}`;
}

function withQuery(path: string, params: Record<string, string>) {
  const url = new URL(path, "http://local.invalid");
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return `${url.pathname}${url.search}`;
}

function previewKind(mimeType: string | undefined, name: string): "image" | "pdf" | "text" | "other" {
  const mime = (mimeType || "").toLowerCase();
  const lower = name.toLowerCase();
  if (mime.startsWith("image/") || /\.(png|jpe?g|gif|webp)$/i.test(lower)) return "image";
  if (mime === "application/pdf" || lower.endsWith(".pdf")) return "pdf";
  if (mime.startsWith("text/") || lower.endsWith(".txt")) return "text";
  return "other";
}

interface AttachmentPreviewDialogProps {
  open: boolean;
  onClose: () => void;
  attachment: TrackerAttachment | null;
  rowId: number;
  sheetId?: string | null;
}

export function AttachmentPreviewDialog({
  open,
  onClose,
  attachment,
  rowId,
  sheetId,
}: AttachmentPreviewDialogProps) {
  const [metaMime, setMetaMime] = useState<string | undefined>();
  const [metaError, setMetaError] = useState<string | null>(null);
  const [loadingMeta, setLoadingMeta] = useState(false);

  const basePath = useMemo(() => {
    if (!attachment) return "";
    return attachmentPath(rowId, attachment.id, sheetId);
  }, [attachment, rowId, sheetId]);

  const viewUrl = basePath ? withQuery(basePath, { disposition: "inline" }) : "";
  const downloadUrl = basePath ? withQuery(basePath, { disposition: "attachment" }) : "";

  useEffect(() => {
    if (!open || !attachment || !basePath) return;
    let cancelled = false;
    setLoadingMeta(true);
    setMetaError(null);
    setMetaMime(attachment.mimeType);

    fetch(withQuery(basePath, { meta: "1" }))
      .then(async (r) => {
        const data = (await r.json().catch(() => null)) as { mimeType?: string; error?: string } | null;
        if (!r.ok) {
          throw new Error(data?.error || "Could not load attachment details.");
        }
        if (!cancelled) setMetaMime(data?.mimeType || attachment.mimeType);
      })
      .catch((e: unknown) => {
        if (!cancelled) setMetaError(e instanceof Error ? e.message : "Could not load attachment details.");
      })
      .finally(() => {
        if (!cancelled) setLoadingMeta(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, attachment, basePath]);

  const kind = attachment ? previewKind(metaMime, attachment.name) : "other";

  return (
    <Modal open={open} onClose={onClose} title={attachment?.name || "Attachment"} size="xl" zClass="z-[10050]">
      <div className="flex flex-col gap-4 p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-[color:var(--wsu-muted)]">
            {loadingMeta ? "Loading preview…" : kind === "other" ? "Preview not available for this file type." : "In-app preview"}
          </p>
          {downloadUrl ? (
            <a
              href={downloadUrl}
              className="inline-flex items-center rounded-lg bg-[color:var(--wsu-crimson)] px-3 py-1.5 text-sm font-medium text-white hover:bg-[color:var(--wsu-crimson)]/90"
            >
              Download
            </a>
          ) : null}
        </div>

        {metaError ? (
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{metaError}</p>
        ) : null}

        <div className="min-h-[50vh] rounded-lg border border-[color:var(--wsu-border)] bg-[color:var(--wsu-stone)]/40">
          {!attachment || !viewUrl ? null : kind === "image" ? (
            // eslint-disable-next-line @next/next/no-img-element -- authenticated API attachment URL; next/image is not suitable
            <img src={viewUrl} alt={attachment.name} className="mx-auto max-h-[70vh] w-auto max-w-full object-contain p-3" />
          ) : kind === "pdf" ? (
            <iframe title={attachment.name} src={viewUrl} className="h-[70vh] w-full rounded-lg bg-white" />
          ) : kind === "text" ? (
            <iframe title={attachment.name} src={viewUrl} className="h-[70vh] w-full rounded-lg bg-white p-0" />
          ) : (
            <div className="flex h-[50vh] flex-col items-center justify-center gap-3 px-6 text-center">
              <p className="text-sm text-[color:var(--wsu-ink)]">This file type can’t be previewed here.</p>
              <p className="text-xs text-[color:var(--wsu-muted)]">Use Download to save it to your device.</p>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
