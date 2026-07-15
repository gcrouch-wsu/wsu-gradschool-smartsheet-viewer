"use client";

import { useId, useState } from "react";
import { useToast } from "@/components/ui/Toast";
import type { ViewPresentationConfig } from "@/lib/config/types";
import {
  HEADER_BRAND_TEXT_MAX_LENGTH,
  HEADER_LOGO_ALT_MAX_LENGTH,
  readLogoFileAsDataUrl,
} from "@/lib/header-logo";

export function HeaderLogoBrandingSection({
  viewLabel,
  presentation,
  onPresentationChange,
}: {
  viewLabel: string;
  presentation?: ViewPresentationConfig;
  onPresentationChange: (next: ViewPresentationConfig | undefined) => void;
}) {
  const toast = useToast();
  const fileInputId = useId();
  const [busy, setBusy] = useState(false);
  const hasLogo = Boolean(presentation?.headerLogoDataUrl && presentation?.headerLogoAlt);

  function patch(next: Partial<ViewPresentationConfig>) {
    onPresentationChange({ ...presentation, ...next });
  }

  async function onPickFile(file: File | null) {
    if (!file) return;
    setBusy(true);
    try {
      const result = await readLogoFileAsDataUrl(file);
      if (!result.ok) {
        toast.addToast(result.error, "error");
        return;
      }
      const alt =
        presentation?.headerLogoAlt?.trim() ||
        `Logo for ${viewLabel || "this page"}`;
      patch({
        headerLogoDataUrl: result.dataUrl,
        headerLogoAlt: alt.slice(0, HEADER_LOGO_ALT_MAX_LENGTH),
        hideHeaderLogo: false,
      });
      toast.addToast("Logo added. Adjust the description so it describes the image accurately.", "success");
    } finally {
      setBusy(false);
    }
  }

  function clearLogo() {
    patch({
      headerLogoDataUrl: undefined,
      headerLogoAlt: undefined,
      hideHeaderLogo: false,
    });
    toast.addToast("Logo removed.", "success");
  }

  return (
    <div className="space-y-6 border-t border-[color:var(--wsu-border)] pt-8">
      <div>
        <h4 className="text-sm font-semibold text-[color:var(--wsu-ink)]">Header branding</h4>
        <p className="mt-1 text-xs text-[color:var(--wsu-muted)]">
          Upload a mark (e.g. cougar icon) and optional text so the public header matches a classic layout:{" "}
          <strong>logo</strong>, a thin vertical rule, then <strong>organization line</strong> and <strong>title line</strong>. Logo
          must be <strong>PNG</strong> or <strong>JPEG</strong>, max <strong>256KB</strong>, with alt text for accessibility.
        </p>
      </div>

      <div className="space-y-3 rounded-xl border border-[color:var(--wsu-border)] bg-white p-4">
        <p className="text-xs font-semibold text-[color:var(--wsu-ink)]">Text beside logo</p>
        <p className="text-[11px] text-[color:var(--wsu-muted)]">
          Both fields are optional. Use either or both: one line is smaller (muted), the second is larger and bold—similar to
          “Washington State University” and “The Graduate School.”
        </p>
        <label className="block space-y-1">
          <span className="text-xs font-medium text-[color:var(--wsu-muted)]">Organization / top line</span>
          <input
            type="text"
            value={presentation?.headerBrandSubline ?? ""}
            maxLength={HEADER_BRAND_TEXT_MAX_LENGTH}
            onChange={(e) => patch({ headerBrandSubline: e.target.value || undefined })}
            className="w-full rounded-lg border border-[color:var(--wsu-border)] bg-white px-3 py-2 text-sm"
            placeholder="e.g. Washington State University"
            autoComplete="off"
          />
        </label>
        <label className="block space-y-1">
          <span className="text-xs font-medium text-[color:var(--wsu-muted)]">Unit / main title line</span>
          <input
            type="text"
            value={presentation?.headerBrandTitle ?? ""}
            maxLength={HEADER_BRAND_TEXT_MAX_LENGTH}
            onChange={(e) => patch({ headerBrandTitle: e.target.value || undefined })}
            className="w-full rounded-lg border border-[color:var(--wsu-border)] bg-white px-3 py-2 text-sm font-medium"
            placeholder="e.g. The Graduate School"
            autoComplete="off"
          />
        </label>
      </div>

      {hasLogo && (
        <div className="flex flex-wrap items-end gap-4 rounded-xl border border-[color:var(--wsu-border)] bg-[color:var(--wsu-stone)]/15 p-4">
          <div className="shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element -- admin preview of user-uploaded data URL */}
            <img
              src={presentation!.headerLogoDataUrl}
              alt=""
              className="h-14 max-h-16 w-auto max-w-[12rem] object-contain"
              decoding="async"
            />
          </div>
          <div className="min-w-[200px] flex-1 space-y-3">
            <label className="block space-y-1">
              <span className="text-xs font-medium text-[color:var(--wsu-muted)]">Alt text (required for accessibility)</span>
              <input
                type="text"
                value={presentation?.headerLogoAlt ?? ""}
                maxLength={HEADER_LOGO_ALT_MAX_LENGTH}
                onChange={(e) => patch({ headerLogoAlt: e.target.value || undefined })}
                className="w-full rounded-lg border border-[color:var(--wsu-border)] bg-white px-3 py-2 text-sm"
                placeholder='e.g. "Washington State University logo"'
                aria-required
              />
              <span className="text-[10px] text-[color:var(--wsu-muted)]">
                {(presentation?.headerLogoAlt ?? "").length} / {HEADER_LOGO_ALT_MAX_LENGTH}
              </span>
            </label>
            <label className="flex items-center gap-2 text-xs font-medium text-[color:var(--wsu-muted)]">
              <input
                type="checkbox"
                checked={presentation?.hideHeaderLogo ?? false}
                onChange={(e) => patch({ hideHeaderLogo: e.target.checked })}
                className="rounded border-[color:var(--wsu-border)]"
              />
              Hide logo on public page (keep file saved)
            </label>
          </div>
          <button
            type="button"
            onClick={clearLogo}
            className="shrink-0 rounded-full border border-rose-200 bg-white px-3 py-1.5 text-xs font-medium text-rose-700 hover:bg-rose-50"
          >
            Remove logo
          </button>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <input
          id={fileInputId}
          type="file"
          accept="image/png,image/jpeg"
          className="sr-only"
          disabled={busy}
          onChange={(e) => void onPickFile(e.target.files?.[0] ?? null)}
        />
        <label
          htmlFor={fileInputId}
          className="inline-flex cursor-pointer rounded-full border border-[color:var(--wsu-border)] bg-white px-4 py-2 text-sm font-medium text-[color:var(--wsu-ink)] hover:border-[color:var(--wsu-crimson)] hover:text-[color:var(--wsu-crimson)]"
        >
          {busy ? "Reading…" : hasLogo ? "Replace logo…" : "Upload logo…"}
        </label>
        {!hasLogo && (
          <p className="text-xs text-[color:var(--wsu-muted)]">After upload, set the alt text to describe the image.</p>
        )}
      </div>
    </div>
  );
}
