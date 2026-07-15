import { describe, expect, it } from "vitest";
import { normalizeFormSlug } from "@/lib/forms/slug";
import { checkPublicSpamGuards } from "@/lib/forms/turnstile";

describe("slug helpers", () => {
  it("normalizes slugs", () => {
    expect(normalizeFormSlug(" Test FOG Automation ")).toBe("test-fog-automation");
  });
});

describe("public spam guards", () => {
  it("rejects honeypot fills", () => {
    expect(checkPublicSpamGuards({ honeypot: "http://spam" }).ok).toBe(false);
  });
});
