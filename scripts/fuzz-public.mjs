/**
 * Staging-only HTTP fuzz for public write surfaces.
 *
 * Targets:
 *   POST  /api/forms/public/[slug]/submit
 *   PATCH /api/public/views/[slug]/rows/[rowId]
 *
 * Safety gates (all required unless noted):
 *   FUZZ_ALLOW_STAGING=1
 *   BASE_URL must be localhost / 127.0.0.1 / *.local, or set FUZZ_ALLOW_ANY_HOST=1
 *     (still never set FUZZ_ALLOW_STAGING against production Smartsheet data)
 *
 * Usage:
 *   FUZZ_ALLOW_STAGING=1 BASE_URL=http://localhost:8080 FORM_SLUG=demo \
 *     VIEW_SLUG=demo VIEW_ID=view-1 ROW_ID=123 \
 *     node scripts/fuzz-public.mjs
 *
 * Optional:
 *   COOKIE="smartsheets_view_contributor_session=..."   # authenticated PATCH cases
 *   ITERATIONS=40 DELAY_MS=250
 *   SKIP_SUBMIT=1 | SKIP_PATCH=1
 */
import { setTimeout as sleep } from "node:timers/promises";

function fail(message) {
  console.error(`fuzz-public: ${message}`);
  process.exit(1);
}

function env(name, fallback = "") {
  return (process.env[name] ?? fallback).trim();
}

const allow = env("FUZZ_ALLOW_STAGING");
if (allow !== "1") {
  fail("Refusing to run. Set FUZZ_ALLOW_STAGING=1 against a disposable staging/local target only.");
}

const baseUrl = env("BASE_URL", "http://localhost:8080").replace(/\/+$/, "");
let host;
try {
  host = new URL(baseUrl).hostname;
} catch {
  fail(`Invalid BASE_URL: ${baseUrl}`);
}

const localHost =
  host === "localhost" ||
  host === "127.0.0.1" ||
  host === "::1" ||
  host.endsWith(".local");

if (!localHost && env("FUZZ_ALLOW_ANY_HOST") !== "1") {
  fail(
    `BASE_URL host "${host}" is not local. Use localhost, or set FUZZ_ALLOW_ANY_HOST=1 for a dedicated staging host (never production).`,
  );
}

const formSlug = env("FORM_SLUG", "fuzz-missing-form");
const viewSlug = env("VIEW_SLUG", "fuzz-missing-view");
const viewId = env("VIEW_ID", "fuzz-view-id");
const rowId = env("ROW_ID", "1");
const cookie = env("COOKIE");
const iterations = Math.max(1, Number(env("ITERATIONS", "30")) || 30);
const delayMs = Math.max(0, Number(env("DELAY_MS", "200")) || 200);
const skipSubmit = env("SKIP_SUBMIT") === "1";
const skipPatch = env("SKIP_PATCH") === "1";

const BIG = "A".repeat(50_000);
const NESTED = { a: { b: { c: { d: Array.from({ length: 200 }, (_, i) => i) } } } };

function mutateSubmitBodies() {
  const renderedOk = Date.now() - 5_000;
  const base = {
    values: { Name: "fuzz", Email: "fuzz@example.edu" },
    website: "",
    renderedAt: renderedOk,
  };

  return [
    { label: "submit:baseline-json", body: base, contentType: "application/json" },
    { label: "submit:empty-object", body: {}, contentType: "application/json" },
    { label: "submit:null-body", raw: "null", contentType: "application/json" },
    { label: "submit:array-body", raw: "[]", contentType: "application/json" },
    { label: "submit:not-json", raw: "<<<not-json>>>", contentType: "application/json" },
    { label: "submit:honeypot-filled", body: { ...base, website: "http://spam.example" }, contentType: "application/json" },
    { label: "submit:too-fast", body: { ...base, renderedAt: Date.now() }, contentType: "application/json" },
    { label: "submit:huge-string", body: { ...base, values: { Name: BIG } }, contentType: "application/json" },
    { label: "submit:nested-junk", body: { ...base, values: NESTED }, contentType: "application/json" },
    {
      label: "submit:prototype-pollution-keys",
      body: { ...base, values: { "__proto__": { admin: true }, constructor: { prototype: { x: 1 } } } },
      contentType: "application/json",
    },
    {
      label: "submit:extra-keys",
      body: { ...base, turnstileToken: "' OR 1=1 --", files: BIG, admin: true },
      contentType: "application/json",
    },
    {
      label: "submit:multipart-empty",
      multipart: true,
      fields: { values: "{}", website: "", renderedAt: String(renderedOk) },
    },
    {
      label: "submit:multipart-bad-values-json",
      multipart: true,
      fields: { values: "{not-json", website: "", renderedAt: String(renderedOk) },
    },
  ];
}

function mutatePatchBodies() {
  const baseline = {
    viewId,
    cells: [{ columnId: 1, value: "fuzz" }],
  };

  return [
    { label: "patch:baseline", body: baseline },
    { label: "patch:missing-viewId", body: { cells: baseline.cells } },
    { label: "patch:empty-cells", body: { viewId, cells: [] } },
    { label: "patch:null", raw: "null" },
    { label: "patch:array", raw: "[]" },
    { label: "patch:not-json", raw: "not-json" },
    { label: "patch:string-columnId", body: { viewId, cells: [{ columnId: "abc", value: "x" }] } },
    { label: "patch:negative-columnId", body: { viewId, cells: [{ columnId: -1, value: "x" }] } },
    { label: "patch:huge-value", body: { viewId, cells: [{ columnId: 1, value: BIG }] } },
    {
      label: "patch:objectValue-junk",
      body: { viewId, cells: [{ columnId: 1, objectValue: NESTED }] },
    },
    {
      label: "patch:many-cells",
      body: {
        viewId,
        cells: Array.from({ length: 500 }, (_, i) => ({ columnId: i, value: `v${i}` })),
      },
    },
    { label: "patch:sql-ish-viewId", body: { viewId: "' OR 1=1 --", cells: baseline.cells } },
  ];
}

function slugVariants(base) {
  return [
    base,
    "",
    "../admin",
    "%00",
    "a".repeat(300),
    `${base}'\"<>`,
    encodeURIComponent(base),
  ];
}

async function send({ method, path, label, body, raw, contentType, multipart, fields, headers = {} }) {
  const url = `${baseUrl}${path}`;
  /** @type {RequestInit} */
  const init = { method, headers: { ...headers } };

  if (cookie) {
    init.headers.Cookie = cookie;
  }

  if (multipart) {
    const form = new FormData();
    for (const [k, v] of Object.entries(fields ?? {})) {
      form.set(k, v);
    }
    init.body = form;
  } else if (raw !== undefined) {
    init.headers["Content-Type"] = contentType ?? "application/json";
    init.body = raw;
  } else if (body !== undefined) {
    init.headers["Content-Type"] = contentType ?? "application/json";
    init.body = JSON.stringify(body);
  }

  const started = Date.now();
  let status = 0;
  let snippet = "";
  let error = "";
  try {
    const res = await fetch(url, init);
    status = res.status;
    const text = await res.text();
    snippet = text.slice(0, 160).replace(/\s+/g, " ");
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
  }

  return {
    label,
    method,
    path,
    status,
    ms: Date.now() - started,
    snippet,
    error,
  };
}

function interesting(result) {
  if (result.error) return true;
  if (result.status >= 500) return true;
  // Unexpected success on clearly garbage unauthenticated PATCH
  if (result.method === "PATCH" && !cookie && result.status === 200) return true;
  return false;
}

async function main() {
  console.log("fuzz-public — staging HTTP fuzz");
  console.log(`  BASE_URL=${baseUrl}`);
  console.log(`  FORM_SLUG=${formSlug} VIEW_SLUG=${viewSlug} VIEW_ID=${viewId} ROW_ID=${rowId}`);
  console.log(`  ITERATIONS=${iterations} DELAY_MS=${delayMs} COOKIE=${cookie ? "(set)" : "(none)"}`);
  console.log("");

  /** @type {Awaited<ReturnType<typeof send>>[]} */
  const results = [];
  let n = 0;

  const submitCases = mutateSubmitBodies();
  const patchCases = mutatePatchBodies();
  const formSlugs = slugVariants(formSlug);
  const viewSlugs = slugVariants(viewSlug);
  const rowIds = [rowId, "0", "-1", "999999999999", "abc", `${rowId}/../1`];

  while (n < iterations) {
    if (!skipSubmit) {
      const slug = formSlugs[n % formSlugs.length];
      const c = submitCases[n % submitCases.length];
      const path = `/api/forms/public/${encodeURIComponent(slug || "x")}/submit`;
      results.push(
        await send({
          method: "POST",
          path,
          label: `${c.label} slug=${JSON.stringify(slug)}`,
          body: c.body,
          raw: c.raw,
          contentType: c.contentType,
          multipart: c.multipart,
          fields: c.fields,
        }),
      );
      n += 1;
      if (delayMs) await sleep(delayMs);
      if (n >= iterations) break;
    }

    if (!skipPatch) {
      const slug = viewSlugs[n % viewSlugs.length];
      const rid = rowIds[n % rowIds.length];
      const c = patchCases[n % patchCases.length];
      const path = `/api/public/views/${encodeURIComponent(slug || "x")}/rows/${encodeURIComponent(rid)}`;
      results.push(
        await send({
          method: "PATCH",
          path,
          label: `${c.label} slug=${JSON.stringify(slug)} row=${rid}`,
          body: c.body,
          raw: c.raw,
        }),
      );
      n += 1;
      if (delayMs) await sleep(delayMs);
    }

    if (skipSubmit && skipPatch) {
      fail("Both SKIP_SUBMIT and SKIP_PATCH are set — nothing to fuzz.");
    }
  }

  const byStatus = new Map();
  for (const r of results) {
    const key = r.error ? "ERR" : String(r.status);
    byStatus.set(key, (byStatus.get(key) ?? 0) + 1);
  }

  console.log("Status counts:");
  for (const [status, count] of [...byStatus.entries()].sort()) {
    console.log(`  ${status}: ${count}`);
  }
  console.log("");

  const flags = results.filter(interesting);
  if (flags.length === 0) {
    console.log("No 5xx / network errors / unexpected unauth 200s in this run.");
  } else {
    console.log(`Interesting results (${flags.length}):`);
    for (const r of flags) {
      console.log(
        `  [${r.status || "ERR"}] ${r.method} ${r.path} — ${r.label}${r.error ? ` error=${r.error}` : ""} ${r.snippet}`,
      );
    }
  }

  console.log("");
  console.log("Full log (status method path label):");
  for (const r of results) {
    console.log(`  ${String(r.status || "ERR").padStart(3)} ${r.ms.toString().padStart(4)}ms ${r.method.padEnd(5)} ${r.path}  ${r.label}`);
  }

  const hardFail = results.some((r) => r.status >= 500 || r.error);
  process.exit(hardFail ? 2 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
