"use client";

import { useEffect, useRef, useState } from "react";

interface Column {
  id: number;
  title: string;
  type: string;
  options?: string[];
}

interface Rule {
  whenColumn: string;
  equals: string[];
  showColumns: string[];
}

interface Schema {
  sheetName: string;
  columns: Column[];
  formColumnSource?: "smartsheet-config" | "auto";
  conditionalLogic: Rule[];
  formToken: string;
  allowedDomains: string[];
  demo: boolean;
  attachmentsEnabled?: boolean;
}

export default function FormPage() {
  const [schema, setSchema] = useState<Schema | null>(null);
  const [loadError, setLoadError] = useState("");
  const [values, setValues] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<string[]>([]);
  const [done, setDone] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const fileRef = useRef<HTMLInputElement>(null);
  const tokenRef = useRef<string>("");

  useEffect(() => {
    fetch("/api/forms/schema")
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || d.message || "Could not load the form.");
        return d as Schema;
      })
      .then((d) => {
        setSchema(d);
        tokenRef.current = d.formToken;
      })
      .catch((e) => setLoadError(e.message));
  }, []);

  function setVal(id: number, v: string) {
    setValues((prev) => ({ ...prev, [id]: v }));
  }

  function fieldKind(col: Column): "checkbox" | "select" | "date" | "email" | "textarea" | "text" {
    if (col.type === "CHECKBOX") return "checkbox";
    if (col.options && col.options.length) return "select";
    if (col.type === "DATE" || col.type === "ABSTRACT_DATETIME") return "date";
    if (/e-?mail/i.test(col.title) || col.type === "CONTACT_LIST") return "email";
    if (/message|comment|description|notes?|details?/i.test(col.title)) return "textarea";
    return "text";
  }

  function hiddenColumns(): Set<string> {
    const hidden = new Set<string>();
    if (!schema) return hidden;
    for (const rule of schema.conditionalLogic) {
      const source = schema.columns.find((c) => c.title.toLowerCase() === rule.whenColumn.toLowerCase());
      const current = source ? (values[source.id] ?? "") : "";
      const show = rule.equals.some((v) => v.toLowerCase() === current.toLowerCase());
      if (!show) for (const t of rule.showColumns) hidden.add(t.toLowerCase());
    }
    return hidden;
  }

  async function refreshToken() {
    try {
      const r = await fetch("/api/forms/schema");
      const d = await r.json();
      if (r.ok) tokenRef.current = d.formToken;
    } catch {
      /* keep old token */
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!schema) return;
    setErrors([]);
    setSubmitting(true);

    const hidden = hiddenColumns();
    const payloadValues: Record<string, string> = {};
    for (const col of schema.columns) {
      if (hidden.has(col.title.toLowerCase())) continue;
      payloadValues[col.id] = values[col.id] ?? "";
    }

    const files = fileRef.current?.files;
    const useMultipart = schema.attachmentsEnabled && files && files.length > 0;

    try {
      let r: Response;
      if (useMultipart) {
        const form = new FormData();
        form.set("values", JSON.stringify(payloadValues));
        form.set("formToken", tokenRef.current);
        for (let i = 0; i < files.length; i++) {
          form.append(`file${i}`, files[i]);
        }
        r = await fetch("/api/forms/submit", { method: "POST", body: form });
      } else {
        r = await fetch("/api/forms/submit", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            values: payloadValues,
            formToken: tokenRef.current,
          }),
        });
      }
      const d = await r.json();
      if (r.ok) {
        setDone(d.message || "Submitted — thank you.");
        return;
      }
      setErrors(d.errors?.length ? d.errors : [d.error || d.message || "Submission failed."]);
      await refreshToken();
    } catch (err: unknown) {
      setErrors([err instanceof Error ? err.message : "Submission failed."]);
    } finally {
      setSubmitting(false);
    }
  }

  const subtitle = schema
    ? [
        schema.allowedDomains?.length ? `Open to @${schema.allowedDomains.join(", @")} email addresses.` : "",
        schema.formColumnSource === "smartsheet-config"
          ? `${schema.columns.length} fields from your Smartsheet form configuration.`
          : schema.formColumnSource === "auto"
            ? `${schema.columns.length} submitter fields (workflow and internal columns hidden).`
            : "",
      ]
        .filter(Boolean)
        .join(" ")
    : undefined;

  return (
    <div className="forms-wrap">
      <div className="mb-5">
        <h2 className="forms-page-title">{schema?.sheetName || "Form"}</h2>
        {subtitle ? <p className="forms-page-subtitle">{subtitle}</p> : null}
      </div>
      <div className="card">
        {loadError ? (
          <>
            <div className="note note--err">{loadError}</div>
            <p className="muted" style={{ marginTop: 12 }}>
              Set up a form on the <a href="/forms/manage">admin page</a>.
            </p>
          </>
        ) : !schema ? (
          <p className="spinner">Loading form…</p>
        ) : done ? (
          <div className="note note--ok">{done}</div>
        ) : (
          <form onSubmit={onSubmit} noValidate>
            {schema.columns.map((col) => {
              if (hiddenColumns().has(col.title.toLowerCase())) return null;
              const kind = fieldKind(col);
              if (kind === "checkbox") {
                return (
                  <div className="field check" key={col.id}>
                    <input
                      id={`f_${col.id}`}
                      type="checkbox"
                      checked={values[col.id] === "true"}
                      onChange={(e) => setVal(col.id, e.target.checked ? "true" : "false")}
                    />
                    <label htmlFor={`f_${col.id}`}>{col.title}</label>
                  </div>
                );
              }
              return (
                <div className="field" key={col.id}>
                  <label htmlFor={`f_${col.id}`}>
                    {col.title}
                    <span className="req">*</span>
                  </label>
                  {kind === "select" ? (
                    <select
                      id={`f_${col.id}`}
                      value={values[col.id] ?? ""}
                      onChange={(e) => setVal(col.id, e.target.value)}
                    >
                      <option value="">Select…</option>
                      {col.options!.map((o) => (
                        <option key={o} value={o}>
                          {o}
                        </option>
                      ))}
                    </select>
                  ) : kind === "textarea" ? (
                    <textarea
                      id={`f_${col.id}`}
                      value={values[col.id] ?? ""}
                      onChange={(e) => setVal(col.id, e.target.value)}
                    />
                  ) : (
                    <input
                      id={`f_${col.id}`}
                      type={kind}
                      value={values[col.id] ?? ""}
                      onChange={(e) => setVal(col.id, e.target.value)}
                    />
                  )}
                </div>
              );
            })}

            {schema.attachmentsEnabled !== false ? (
              <div className="field">
                <label htmlFor="attachments">Attachments (optional)</label>
                <input id="attachments" ref={fileRef} type="file" multiple />
              </div>
            ) : null}

            {errors.length ? (
              <div className="note note--err">
                <ul>
                  {errors.map((x, i) => (
                    <li key={i}>{x}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            <button className="btn btn-crimson" type="submit" disabled={submitting} style={{ marginTop: 6 }}>
              {submitting ? "Submitting…" : "Submit"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
