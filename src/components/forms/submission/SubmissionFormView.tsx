"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useForm } from "react-hook-form";
import { IconCheck, IconFile } from "@/components/forms/icons";
import { RichTextHtml } from "@/components/forms/submission/RichTextHtml";
import {
  buildSubmitPayload,
  conditionalTargetTitles,
  fieldKind,
  fieldLabel,
  hiddenColumnTitles,
  isFieldRequired,
  resolveFormRenderItems,
  validateFormClient,
  type FormSchema,
} from "@/lib/forms/form-ui";
import type { FormFieldDefinition } from "@/lib/forms/form-field-config";
import type { SmartsheetColumn } from "@/lib/forms/types";
import { isRichTextEmpty } from "@/lib/rendering";

type FormValues = Record<string, string>;

interface SubmissionFormViewProps {
  schema: FormSchema;
  serverErrors: string[];
  onSubmit: (
    values: Record<string, string>,
    files: FileList | null,
    extras?: { website?: string; turnstileToken?: string; renderedAt?: number },
  ) => Promise<{ ok: boolean }>;
  /** When true, hide the submit button (builder preview). */
  preview?: boolean;
  /** Public published form — enables honeypot + optional Turnstile. */
  publicMode?: boolean;
  turnstileSiteKey?: string;
  turnstileRequired?: boolean;
  renderedAt?: number;
}

const inputClass =
  "w-full rounded-lg border border-[color:var(--wsu-border)] bg-white px-3 py-2.5 text-sm text-[color:var(--wsu-ink)] placeholder:text-[color:var(--wsu-muted)] focus:border-wsu-crimson focus:outline-none focus:ring-1 focus:ring-wsu-crimson disabled:opacity-60";

const inputErrorClass = "border-red-300 focus:border-red-500 focus:ring-red-500";

function FieldShell({
  id,
  label,
  required,
  hint,
  error,
  children,
}: {
  id: string;
  label: string;
  required?: boolean;
  hint?: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium text-[color:var(--wsu-ink)]">
        {label}
        {required ? <span className="ml-0.5 text-wsu-crimson">*</span> : null}
      </label>
      {hint ? <p className="text-xs text-[color:var(--wsu-muted)]">{hint}</p> : null}
      {children}
      {error ? <p className="text-xs text-red-600" role="alert">{error}</p> : null}
    </div>
  );
}

function FormField({
  col,
  required,
  label,
  helpText,
  kind,
  register,
  error,
  setValue,
  watchValue,
}: {
  col: SmartsheetColumn;
  required: boolean;
  label: string;
  helpText?: string;
  kind: ReturnType<typeof fieldKind>;
  register: ReturnType<typeof useForm<FormValues>>["register"];
  error?: string;
  setValue: ReturnType<typeof useForm<FormValues>>["setValue"];
  watchValue: string;
}) {
  const id = `field_${col.id}`;
  const hasError = Boolean(error);

  if (kind === "checkbox") {
    return (
      <div className="flex items-start gap-3 rounded-lg border border-[color:var(--wsu-border)] bg-[color:var(--wsu-stone)]/40 px-4 py-3">
        <input
          id={id}
          type="checkbox"
          className="mt-0.5 h-4 w-4 rounded border-[color:var(--wsu-border)] text-wsu-crimson focus:ring-wsu-crimson"
          checked={watchValue === "true"}
          onChange={(e) => setValue(String(col.id), e.target.checked ? "true" : "false", { shouldDirty: true })}
        />
        <label htmlFor={id} className="text-sm text-[color:var(--wsu-ink)]">
          {label}
        </label>
      </div>
    );
  }

  if (kind === "select") {
    return (
      <FieldShell id={id} label={label} required={required} hint={helpText} error={error}>
        <select
          id={id}
          className={`${inputClass} ${hasError ? inputErrorClass : ""}`}
          {...register(String(col.id), { required: required ? `${label} is required.` : false })}
        >
          <option value="">Select…</option>
          {col.options!.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      </FieldShell>
    );
  }

  if (kind === "multiselect") {
    const selected = new Set(
      watchValue
        .split(/;|,|\n/)
        .map((v) => v.trim())
        .filter(Boolean),
    );
    return (
      <FieldShell id={id} label={label} required={required} hint={helpText} error={error}>
        <div className="space-y-2 rounded-lg border border-[color:var(--wsu-border)] bg-[color:var(--wsu-stone)]/30 px-3 py-3">
          {(col.options ?? []).map((option) => {
            const optionId = `${id}_${option}`;
            return (
              <label key={option} htmlFor={optionId} className="flex items-center gap-2 text-sm text-[color:var(--wsu-ink)]">
                <input
                  id={optionId}
                  type="checkbox"
                  className="h-4 w-4 rounded border-[color:var(--wsu-border)] text-wsu-crimson focus:ring-wsu-crimson"
                  checked={selected.has(option)}
                  onChange={(e) => {
                    const next = new Set(selected);
                    if (e.target.checked) next.add(option);
                    else next.delete(option);
                    setValue(String(col.id), [...next].join(";"), { shouldDirty: true });
                  }}
                />
                {option}
              </label>
            );
          })}
        </div>
      </FieldShell>
    );
  }

  if (kind === "textarea") {
    return (
      <FieldShell id={id} label={label} required={required} hint={helpText} error={error}>
        <textarea
          id={id}
          rows={4}
          className={`${inputClass} resize-y min-h-[6rem] ${hasError ? inputErrorClass : ""}`}
          {...register(String(col.id), { required: required ? `${label} is required.` : false })}
        />
      </FieldShell>
    );
  }

  if (kind === "date") {
    return (
      <FieldShell
        id={id}
        label={label}
        required={required}
        hint={helpText || "Select a date from the calendar."}
        error={error}
      >
        <input
          id={id}
          type="date"
          className={`${inputClass} ${hasError ? inputErrorClass : ""}`}
          {...register(String(col.id), { required: required ? `${label} is required.` : false })}
        />
      </FieldShell>
    );
  }

  const emailHint = kind === "email" ? helpText || "Use your institutional email address." : helpText;
  const inputType = kind === "phone" ? "tel" : kind === "number" ? "number" : kind === "email" ? "email" : "text";

  return (
    <FieldShell id={id} label={label} required={required} hint={emailHint} error={error}>
      <input
        id={id}
        type={inputType}
        inputMode={kind === "number" ? "decimal" : kind === "phone" ? "tel" : undefined}
        className={`${inputClass} ${hasError ? inputErrorClass : ""}`}
        autoComplete={kind === "email" ? "email" : kind === "phone" ? "tel" : undefined}
        {...register(String(col.id), { required: required ? `${label} is required.` : false })}
      />
    </FieldShell>
  );
}

function LayoutBlock({ item }: { item: FormFieldDefinition }) {
  if (item.itemKind === "divider") {
    return <hr className="border-[color:var(--wsu-border)]" />;
  }
  if (item.itemKind === "heading") {
    return (
      <RichTextHtml
        value={item.text}
        as="h2"
        className="text-lg font-medium text-[color:var(--wsu-ink)]"
        fallback="Section"
      />
    );
  }
  return (
    <RichTextHtml
      value={item.text}
      as="div"
      className="text-sm leading-6 text-[color:var(--wsu-muted)]"
    />
  );
}

function FileUploadZone({
  files,
  onChange,
  disabled,
}: {
  files: FileList | null;
  onChange: (files: FileList | null) => void;
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const names = files ? Array.from(files).map((f) => f.name) : [];

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-[color:var(--wsu-ink)]">Attachments</p>
      <p className="text-xs text-[color:var(--wsu-muted)]">Optional — PDF, Word, or image files.</p>
      <div
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === "Enter" && inputRef.current?.click()}
        onClick={() => !disabled && inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (!disabled && e.dataTransfer.files.length) onChange(e.dataTransfer.files);
        }}
        className={[
          "cursor-pointer rounded-xl border-2 border-dashed px-4 py-8 text-center transition-colors",
          dragOver
            ? "border-wsu-crimson bg-wsu-crimson/5"
            : "border-[color:var(--wsu-border)] bg-[color:var(--wsu-stone)]/30 hover:border-wsu-crimson/40",
          disabled ? "pointer-events-none opacity-60" : "",
        ].join(" ")}
      >
        <IconFile className="mx-auto h-8 w-8 text-[color:var(--wsu-muted)]" />
        <p className="mt-2 text-sm text-[color:var(--wsu-ink)]">
          Drop files here or <span className="font-medium text-wsu-crimson">browse</span>
        </p>
        <input
          ref={inputRef}
          type="file"
          multiple
          className="sr-only"
          disabled={disabled}
          onChange={(e) => onChange(e.target.files)}
        />
      </div>
      {names.length > 0 ? (
        <ul className="space-y-1 rounded-lg border border-[color:var(--wsu-border)] bg-white px-3 py-2 text-sm">
          {names.map((name) => (
            <li key={name} className="flex items-center gap-2 text-[color:var(--wsu-ink)]">
              <IconFile className="h-4 w-4 shrink-0 text-[color:var(--wsu-muted)]" />
              {name}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export function SubmissionFormView({
  schema,
  serverErrors,
  onSubmit,
  preview = false,
  publicMode = false,
  turnstileSiteKey = "",
  turnstileRequired = false,
  renderedAt,
}: SubmissionFormViewProps) {
  const [files, setFiles] = useState<FileList | null>(null);
  const [clientErrors, setClientErrors] = useState<string[]>([]);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [honeypot, setHoneypot] = useState("");
  const [turnstileToken, setTurnstileToken] = useState("");
  const turnstileRef = useRef<HTMLDivElement | null>(null);

  const defaultValues = useMemo(() => {
    const vals: FormValues = {};
    for (const col of schema.columns) {
      vals[String(col.id)] = col.type === "CHECKBOX" ? "false" : "";
    }
    return vals;
  }, [schema.columns]);

  const { register, handleSubmit, watch, setValue, reset, formState } = useForm<FormValues>({
    defaultValues,
    mode: "onBlur",
  });

  useEffect(() => {
    reset(defaultValues);
  }, [defaultValues, reset]);

  const values = watch();
  const hidden = useMemo(
    () => hiddenColumnTitles(schema.columns, schema.conditionalLogic, values),
    [schema.columns, schema.conditionalLogic, values],
  );
  const conditionalTargets = useMemo(
    () => conditionalTargetTitles(schema.conditionalLogic),
    [schema.conditionalLogic],
  );

  const visibleColumns = schema.columns.filter((col) => !hidden.has(col.title.toLowerCase()));
  const renderItems = useMemo(() => resolveFormRenderItems(schema, hidden), [schema, hidden]);

  const formTitle = schema.formTitle?.trim() || schema.sheetName;
  const formDescription = schema.formDescription?.trim() || "";
  const hasDescription = !isRichTextEmpty(formDescription);

  useEffect(() => {
    if (!publicMode || !turnstileSiteKey || preview) return;
    const existing = document.querySelector('script[data-forms-turnstile="1"]');
    if (existing) return;
    const script = document.createElement("script");
    script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    script.async = true;
    script.dataset.formsTurnstile = "1";
    document.body.appendChild(script);
  }, [publicMode, turnstileSiteKey, preview]);

  useEffect(() => {
    if (!publicMode || !turnstileSiteKey || preview || !turnstileRef.current) return;
    type TurnstileApi = {
      render: (
        el: HTMLElement,
        opts: { sitekey: string; callback: (token: string) => void; "expired-callback"?: () => void },
      ) => string;
      remove?: (id: string) => void;
    };
    const w = window as unknown as { turnstile?: TurnstileApi };
    let widgetId: string | null = null;
    let cancelled = false;

    function tryRender() {
      if (cancelled || !turnstileRef.current || !w.turnstile) return false;
      widgetId = w.turnstile.render(turnstileRef.current, {
        sitekey: turnstileSiteKey,
        callback: (token: string) => setTurnstileToken(token),
        "expired-callback": () => setTurnstileToken(""),
      });
      return true;
    }

    if (!tryRender()) {
      const timer = window.setInterval(() => {
        if (tryRender()) window.clearInterval(timer);
      }, 200);
      return () => {
        cancelled = true;
        window.clearInterval(timer);
        if (widgetId && w.turnstile?.remove) w.turnstile.remove(widgetId);
      };
    }

    return () => {
      cancelled = true;
      if (widgetId && w.turnstile?.remove) w.turnstile.remove(widgetId);
    };
  }, [publicMode, turnstileSiteKey, preview]);

  async function processSubmit(data: FormValues) {
    setClientErrors([]);
    setFieldErrors({});

    if (publicMode && turnstileRequired && !turnstileToken.trim()) {
      setClientErrors(["Please complete the captcha challenge."]);
      return;
    }

    const validation = validateFormClient(
      schema.columns,
      data,
      schema.conditionalLogic,
      schema.allowedDomains,
      schema.fieldMeta,
    );
    if (!validation.ok) {
      setClientErrors(validation.errors);
      setFieldErrors(validation.fieldErrors);
      return;
    }

    const payload = buildSubmitPayload(schema.columns, data, schema.conditionalLogic);
    setSubmitting(true);
    try {
      await onSubmit(payload, files, publicMode
        ? {
            website: honeypot,
            turnstileToken: turnstileToken || undefined,
            renderedAt: renderedAt ?? Date.now(),
          }
        : undefined);
    } finally {
      setSubmitting(false);
    }
  }

  const allErrors = [...clientErrors, ...serverErrors];

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      {allErrors.length > 0 ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3" role="alert">
          <p className="text-sm font-medium text-red-800">Please fix the following:</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-red-700">
            {allErrors.map((err, i) => (
              <li key={`${err}-${i}`}>{err}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <form
        onSubmit={handleSubmit(processSubmit)}
        noValidate
        className="relative overflow-hidden rounded-xl border border-[color:var(--wsu-border)] bg-white shadow-sm"
      >
        <div className="border-b border-[color:var(--wsu-border)] bg-[color:var(--wsu-stone)]/40 px-5 py-4">
          <RichTextHtml
            value={formTitle}
            as="h1"
            className="view-section-title text-xl font-medium text-[color:var(--wsu-ink)]"
            fallback={schema.sheetName}
          />
          {hasDescription ? (
            <RichTextHtml
              value={formDescription}
              as="div"
              className="mt-1 text-sm text-[color:var(--wsu-muted)]"
            />
          ) : null}
          {!hasDescription && schema.allowedDomains.length ? (
            <p className="mt-1 text-sm text-[color:var(--wsu-muted)]">
              Open to @{schema.allowedDomains.join(", @")} email addresses.
              {schema.demo ? " Demo mode." : ""}
            </p>
          ) : schema.demo ? (
            <p className="mt-1 text-sm text-[color:var(--wsu-muted)]">Demo mode.</p>
          ) : null}
        </div>

        <div className="space-y-5 px-5 py-6">
          {renderItems.length === 0 ? (
            <p className="text-sm text-[color:var(--wsu-muted)]">No fields are visible for the current selections.</p>
          ) : (
            renderItems.map((entry) => {
              if (entry.kind === "layout") {
                return <LayoutBlock key={entry.item.columnTitle} item={entry.item} />;
              }
              const meta = schema.fieldMeta?.[entry.col.title.toLowerCase()];
              return (
                <FormField
                  key={entry.col.id}
                  col={entry.col}
                  label={fieldLabel(entry.col, meta)}
                  helpText={meta?.helpText}
                  kind={fieldKind(entry.col, meta)}
                  required={isFieldRequired(entry.col, conditionalTargets, hidden, meta)}
                  register={register}
                  error={fieldErrors[String(entry.col.id)] ?? formState.errors[String(entry.col.id)]?.message}
                  setValue={setValue}
                  watchValue={values[String(entry.col.id)] ?? ""}
                />
              );
            })
          )}

          {schema.attachmentsEnabled !== false ? (
            <FileUploadZone files={files} onChange={setFiles} disabled={submitting} />
          ) : null}

          {publicMode ? (
            <>
              <div className="absolute -left-[9999px] top-auto h-0 w-0 overflow-hidden" aria-hidden="true">
                <label htmlFor="website">Website</label>
                <input
                  id="website"
                  name="website"
                  type="text"
                  tabIndex={-1}
                  autoComplete="off"
                  value={honeypot}
                  onChange={(e) => setHoneypot(e.target.value)}
                />
              </div>
              {turnstileSiteKey ? <div ref={turnstileRef} className="cf-turnstile" /> : null}
            </>
          ) : null}
        </div>

        {!preview ? (
          <div className="flex flex-col gap-3 border-t border-[color:var(--wsu-border)] bg-[color:var(--wsu-stone)]/30 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-[color:var(--wsu-muted)]">
              <span className="text-wsu-crimson">*</span> Required field
            </p>
            <button
              type="submit"
              disabled={submitting || visibleColumns.length === 0}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-wsu-crimson px-5 py-2.5 text-sm font-medium text-white hover:bg-wsu-crimson/90 disabled:opacity-50 sm:w-auto"
            >
              {submitting ? "Submitting…" : "Submit"}
            </button>
          </div>
        ) : (
          <div className="border-t border-[color:var(--wsu-border)] bg-[color:var(--wsu-stone)]/30 px-5 py-3">
            <p className="text-xs text-[color:var(--wsu-muted)]">Preview only — submissions are disabled.</p>
          </div>
        )}
      </form>
    </div>
  );
}

export function SubmissionSuccessView({
  message,
  onSubmitAnother,
  showTrackerLink = true,
}: {
  message: string;
  onSubmitAnother: () => void;
  showTrackerLink?: boolean;
}) {
  return (
    <div className="mx-auto max-w-lg rounded-xl border border-emerald-200 bg-emerald-50/80 px-6 py-10 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
        <IconCheck className="h-6 w-6" />
      </div>
      <h2 className="mt-4 text-lg font-medium text-emerald-950">Submission received</h2>
      <p className="mt-2 text-sm text-emerald-800">{message}</p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <button
          type="button"
          onClick={onSubmitAnother}
          className="rounded-lg border border-emerald-300 bg-white px-4 py-2 text-sm font-medium text-emerald-900 hover:bg-emerald-50"
        >
          Submit another
        </button>
        {showTrackerLink ? (
          <Link
            href="/forms/sheet"
            className="rounded-lg bg-wsu-crimson px-4 py-2 text-sm font-medium text-white hover:bg-wsu-crimson/90"
          >
            Open grid
          </Link>
        ) : null}
      </div>
    </div>
  );
}

export function SubmissionFormEmptyState({
  error,
  onRetry,
  hideManageLink = false,
}: {
  error: string;
  onRetry?: () => void;
  hideManageLink?: boolean;
}) {
  return (
    <div className="mx-auto max-w-lg rounded-xl border border-[color:var(--wsu-border)] bg-white px-6 py-10 text-center">
      <p className="text-sm text-red-700">{error}</p>
      {!hideManageLink ? (
        <p className="mt-3 text-sm text-[color:var(--wsu-muted)]">
          Set up a form on the{" "}
          <Link href="/forms/manage" className="font-medium text-wsu-crimson hover:underline">
            admin page
          </Link>
          .
        </p>
      ) : null}
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="mt-4 rounded-lg border border-[color:var(--wsu-border)] px-4 py-2 text-sm font-medium hover:bg-[color:var(--wsu-stone)]"
        >
          Try again
        </button>
      ) : null}
    </div>
  );
}
