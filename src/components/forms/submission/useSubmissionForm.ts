"use client";

import { useCallback, useEffect, useState } from "react";
import type { FormSchema } from "@/lib/forms/form-ui";

async function parseApiJson(r: Response): Promise<Record<string, unknown>> {
  const text = await r.text();
  if (!text) return {};
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    throw new Error(r.ok ? "Invalid response from server." : text.slice(0, 120) || `Request failed (${r.status}).`);
  }
}

export function useSubmissionForm() {
  const [schema, setSchema] = useState<FormSchema | null>(null);
  const [loadError, setLoadError] = useState("");
  const [loading, setLoading] = useState(true);
  const [successMessage, setSuccessMessage] = useState("");
  const [serverErrors, setServerErrors] = useState<string[]>([]);

  const loadSchema = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/forms/schema");
      const d = await parseApiJson(r);
      if (!r.ok) {
        throw new Error(
          (typeof d.error === "string" && d.error) ||
            (typeof d.message === "string" && d.message) ||
            `Could not load the form (${r.status}).`,
        );
      }
      setSchema({
        sheetName: String(d.sheetName ?? "Form"),
        formTitle: typeof d.formTitle === "string" ? d.formTitle : "",
        formDescription: typeof d.formDescription === "string" ? d.formDescription : "",
        columns: (d.columns as FormSchema["columns"]) ?? [],
        formItems: Array.isArray(d.formItems) ? (d.formItems as FormSchema["formItems"]) : [],
        formColumnSource: d.formColumnSource as FormSchema["formColumnSource"],
        fieldMeta: (d.fieldMeta as FormSchema["fieldMeta"]) ?? {},
        conditionalLogic: (d.conditionalLogic as FormSchema["conditionalLogic"]) ?? [],
        allowedDomains: Array.isArray(d.allowedDomains) ? (d.allowedDomains as string[]) : [],
        demo: Boolean(d.demo),
        attachmentsEnabled: d.attachmentsEnabled !== false,
        headerLogoDataUrl: typeof d.headerLogoDataUrl === "string" ? d.headerLogoDataUrl : undefined,
        headerLogoAlt: typeof d.headerLogoAlt === "string" ? d.headerLogoAlt : undefined,
      });
      setLoadError("");
    } catch (e: unknown) {
      setLoadError(e instanceof Error ? e.message : "Could not load the form.");
      setSchema(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSchema();
  }, [loadSchema]);

  async function submit(
    payloadValues: Record<string, string>,
    files: FileList | null,
  ): Promise<{ ok: boolean; errors?: string[] }> {
    setServerErrors([]);
    const useMultipart = schema?.attachmentsEnabled && files && files.length > 0;

    try {
      let r: Response;
      if (useMultipart) {
        const form = new FormData();
        form.set("values", JSON.stringify(payloadValues));
        for (let i = 0; i < files.length; i++) {
          form.append(`file${i}`, files[i]!);
        }
        r = await fetch("/api/forms/submit", { method: "POST", body: form });
      } else {
        r = await fetch("/api/forms/submit", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ values: payloadValues }),
        });
      }

      const d = await parseApiJson(r);
      if (r.ok) {
        setSuccessMessage(typeof d.message === "string" ? d.message : "Submitted — thank you.");
        return { ok: true };
      }

      const errs = Array.isArray(d.errors)
        ? (d.errors as string[])
        : [typeof d.error === "string" ? d.error : typeof d.message === "string" ? d.message : "Submission failed."];
      setServerErrors(errs);
      return { ok: false, errors: errs };
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Submission failed.";
      setServerErrors([msg]);
      return { ok: false, errors: [msg] };
    }
  }

  function resetSuccess() {
    setSuccessMessage("");
    setServerErrors([]);
  }

  return {
    schema,
    loadError,
    loading,
    successMessage,
    serverErrors,
    loadSchema,
    submit,
    resetSuccess,
  };
}
