import { afterEach, describe, expect, it, vi } from "vitest";
import { resolveAllowedDomains } from "@/lib/forms/allowed-domains";
import { hiddenColumnTitles, validateFormClient } from "@/lib/forms/form-ui";
import { normalizeFormSlug, slugFromFormName } from "@/lib/forms/slug";
import { checkPublicSpamGuards } from "@/lib/forms/turnstile";
import { validateSubmission } from "@/lib/forms/validation";
import type { SmartsheetColumn } from "@/lib/forms/types";
import type { SyncState } from "@/lib/forms/sync-state";
import { FORM_WEBHOOK_SECRET_ENV_VAR, validateWebhookSecret } from "@/lib/forms/webhook-auth";
import { buildCallbackUrl, maskCallbackUrl } from "@/lib/forms/webhook-callback";

const { getSyncState } = vi.hoisted(() => ({
  getSyncState: vi.fn(async (): Promise<SyncState> => ({ recentEvents: [] })),
}));

vi.mock("@/lib/forms/sync-state", () => ({
  getSyncState,
}));

describe("forms validation", () => {
  it("requires non-optional fields", () => {
    const columns: SmartsheetColumn[] = [
      { id: 1, title: "Full Name", type: "TEXT_NUMBER", primary: true },
      { id: 2, title: "Email", type: "TEXT_NUMBER" },
    ];
    const result = validateSubmission(columns, {}, []);
    expect(result.ok).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it("accepts valid wsu.edu email", () => {
    const columns: SmartsheetColumn[] = [
      { id: 1, title: "Full Name", type: "TEXT_NUMBER" },
      { id: 2, title: "Email", type: "TEXT_NUMBER" },
    ];
    const result = validateSubmission(columns, { "1": "Jane", "2": "jane@wsu.edu" }, []);
    expect(result.ok).toBe(true);
    expect(result.cells).toHaveLength(2);
  });

  it("uses per-form allowed domains when provided", () => {
    const columns: SmartsheetColumn[] = [{ id: 1, title: "Email", type: "TEXT_NUMBER" }];
    const ok = validateSubmission(columns, { "1": "a@email.wsu.edu" }, [], undefined, ["email.wsu.edu"]);
    expect(ok.ok).toBe(true);
    const bad = validateSubmission(columns, { "1": "a@wsu.edu" }, [], undefined, ["email.wsu.edu"]);
    expect(bad.ok).toBe(false);
  });

  it("accepts ISO calendar dates for Smartsheet DATE columns", () => {
    const columns: SmartsheetColumn[] = [{ id: 1, title: "Start Date", type: "DATE" }];
    const result = validateSubmission(columns, { "1": "2026-07-15" }, []);
    expect(result.ok).toBe(true);
    expect(result.cells).toEqual([{ columnId: 1, value: "2026-07-15" }]);
  });

  it("normalizes US typed dates to ISO for Smartsheet DATE columns", () => {
    const columns: SmartsheetColumn[] = [{ id: 1, title: "Start Date", type: "DATE" }];
    const result = validateSubmission(columns, { "1": "07/15/2026" }, []);
    expect(result.ok).toBe(true);
    expect(result.cells).toEqual([{ columnId: 1, value: "2026-07-15" }]);
  });

  it("rejects invalid dates", () => {
    const columns: SmartsheetColumn[] = [{ id: 1, title: "Start Date", type: "DATE" }];
    const result = validateSubmission(columns, { "1": "13/40/2026" }, []);
    expect(result.ok).toBe(false);
  });

  it("skips column-formula fields and does not write them", () => {
    const columns: SmartsheetColumn[] = [
      { id: 1, title: "Full Name", type: "TEXT_NUMBER" },
      { id: 2, title: "Computed", type: "TEXT_NUMBER", formula: '=[Full Name]@row' },
    ];
    const result = validateSubmission(columns, { "1": "Jane", "2": "should-ignore" }, []);
    expect(result.ok).toBe(true);
    expect(result.cells).toEqual([{ columnId: 1, value: "Jane" }]);
  });
});

describe("form ui helpers", () => {
  it("hides conditional fields when trigger does not match", () => {
    const columns: SmartsheetColumn[] = [
      { id: 1, title: "Type", type: "PICKLIST", options: ["A", "B"] },
      { id: 2, title: "Extra", type: "TEXT_NUMBER" },
    ];
    const hidden = hiddenColumnTitles(columns, [{ whenColumn: "Type", equals: ["B"], showColumns: ["Extra"] }], {
      "1": "A",
    });
    expect(hidden.has("extra")).toBe(true);
  });

  it("client validation matches server rules for email domain", () => {
    const columns: SmartsheetColumn[] = [{ id: 1, title: "Email", type: "TEXT_NUMBER" }];
    const result = validateFormClient(columns, { "1": "jane@example.com" }, [], ["wsu.edu"]);
    expect(result.ok).toBe(false);
    expect(result.fieldErrors["1"]).toMatch(/wsu\.edu/);
  });
});

describe("slug helpers", () => {
  it("normalizes slugs", () => {
    expect(normalizeFormSlug(" Test FOG Automation ")).toBe("test-fog-automation");
    expect(slugFromFormName("Hello World!", "123")).toBe("hello-world");
  });
});

describe("allowed domains resolve", () => {
  it("prefers per-form domains", () => {
    expect(resolveAllowedDomains({ columns: [], allowedDomains: ["Email.WSU.edu"] })).toEqual(["email.wsu.edu"]);
  });
});

describe("public spam guards", () => {
  it("rejects honeypot fills", () => {
    expect(checkPublicSpamGuards({ honeypot: "http://spam" }).ok).toBe(false);
    expect(checkPublicSpamGuards({ honeypot: "" }).ok).toBe(true);
  });

  it("rejects too-fast submits", () => {
    expect(checkPublicSpamGuards({ renderedAt: Date.now() }).ok).toBe(false);
    expect(checkPublicSpamGuards({ renderedAt: Date.now() - 5000 }).ok).toBe(true);
  });
});

describe("webhook auth", () => {
  const prevSecret = process.env[FORM_WEBHOOK_SECRET_ENV_VAR];

  afterEach(() => {
    if (prevSecret === undefined) delete process.env[FORM_WEBHOOK_SECRET_ENV_VAR];
    else process.env[FORM_WEBHOOK_SECRET_ENV_VAR] = prevSecret;
    getSyncState.mockReset();
    getSyncState.mockResolvedValue({ recentEvents: [] });
  });

  it("rejects missing secret when env and store are unset", async () => {
    delete process.env[FORM_WEBHOOK_SECRET_ENV_VAR];
    getSyncState.mockResolvedValue({ recentEvents: [] });
    const request = new Request("http://localhost/api/forms/webhooks/smartsheet");
    expect(await validateWebhookSecret(request)).toBe(false);
  });

  it("accepts query secret from env override", async () => {
    process.env[FORM_WEBHOOK_SECRET_ENV_VAR] = "env-secret-value";
    getSyncState.mockResolvedValue({ recentEvents: [], webhookSecret: "stored-ignored" });
    const request = new Request("http://localhost/api/forms/webhooks/smartsheet?secret=env-secret-value");
    expect(await validateWebhookSecret(request)).toBe(true);
  });

  it("accepts header secret from stored state when env unset", async () => {
    delete process.env[FORM_WEBHOOK_SECRET_ENV_VAR];
    getSyncState.mockResolvedValue({ recentEvents: [], webhookSecret: "stored-secret" });
    const request = new Request("http://localhost/api/forms/webhooks/smartsheet", {
      headers: { "x-forms-webhook-secret": "stored-secret" },
    });
    expect(await validateWebhookSecret(request)).toBe(true);
  });

  it("rejects wrong stored secret", async () => {
    delete process.env[FORM_WEBHOOK_SECRET_ENV_VAR];
    getSyncState.mockResolvedValue({ recentEvents: [], webhookSecret: "stored-secret" });
    const request = new Request("http://localhost/api/forms/webhooks/smartsheet?secret=wrong");
    expect(await validateWebhookSecret(request)).toBe(false);
  });
});

describe("webhook callback url", () => {
  it("builds callback from request origin when env unset", () => {
    const request = new Request("https://forms.example.edu/api/forms/webhooks");
    const result = buildCallbackUrl(request, "abc123", "");
    expect(result).toEqual({
      url: "https://forms.example.edu/api/forms/webhooks/smartsheet?secret=abc123",
    });
  });

  it("rejects localhost origins without configured override", () => {
    const request = new Request("http://localhost:3000/api/forms/webhooks");
    const result = buildCallbackUrl(request, "abc123", "");
    expect(result).toHaveProperty("error");
  });

  it("uses configured override for localhost", () => {
    const request = new Request("http://localhost:3000/api/forms/webhooks");
    const result = buildCallbackUrl(request, "abc123", "https://tunnel.example/api/forms/webhooks/smartsheet");
    expect(result).toEqual({
      url: "https://tunnel.example/api/forms/webhooks/smartsheet?secret=abc123",
    });
  });

  it("masks secret in callback urls", () => {
    expect(maskCallbackUrl("https://x.example/api/forms/webhooks/smartsheet?secret=topsecret")).toBe(
      "https://x.example/api/forms/webhooks/smartsheet?secret=********",
    );
  });
});

describe("multi-select and contact cells", () => {
  it("emits MULTI_PICKLIST objectValue", () => {
    const columns: SmartsheetColumn[] = [
      { id: 1, title: "Tags", type: "MULTI_PICKLIST", options: ["A", "B", "C"] },
    ];
    const result = validateSubmission(columns, { "1": "A, B" }, []);
    expect(result.ok).toBe(true);
    expect(result.cells).toEqual([
      { columnId: 1, objectValue: { objectType: "MULTI_PICKLIST", values: ["A", "B"] } },
    ]);
  });

  it("emits CONTACT objectValue for CONTACT_LIST", () => {
    const columns: SmartsheetColumn[] = [{ id: 1, title: "Contact", type: "CONTACT_LIST" }];
    const result = validateSubmission(columns, { "1": "jane@wsu.edu" }, []);
    expect(result.ok).toBe(true);
    expect(result.cells).toEqual([
      { columnId: 1, objectValue: { objectType: "CONTACT", email: "jane@wsu.edu" } },
    ]);
  });
});

describe("form field config normalize", () => {
  it("derives columns from visible field items", async () => {
    const { normalizeFormFieldConfig } = await import("@/lib/forms/form-field-config");
    const normalized = normalizeFormFieldConfig({
      columns: [],
      fields: [
        { columnTitle: "Name", order: 0 },
        { columnTitle: "Hidden", order: 1, hiddenOnForm: true },
        { columnTitle: "__heading:1", order: 2, itemKind: "heading", text: "Section" },
      ],
    });
    expect(normalized.columns).toEqual(["Name"]);
  });
});

describe("identity roles", () => {
  it("maps admin owner to expected roles", async () => {
    const { rolesFromPrincipal } = await import("@/lib/identity/roles");
    const roles = rolesFromPrincipal({
      kind: "admin",
      id: "1",
      identifier: "owner",
      displayName: "Owner",
      role: "owner",
      source: "env",
      capabilities: ["admin.manage", "admin.owner", "forms.admin", "forms.approver", "contributor.edit", "viewer"],
      session: { issuedAt: 0, expiresAt: 1 },
    });
    expect(roles).toContain("owner");
    expect(roles).toContain("forms_admin");
  });
});

describe("csv export helper", () => {
  it("escapes quotes and commas", async () => {
    const { rowsToCsv } = await import("@/lib/export-csv");
    const csv = rowsToCsv(["Name", "Note"], [["Ada", 'Hello, "world"']]);
    expect(csv).toContain('"Hello, ""world"""');
  });
});
