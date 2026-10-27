import { afterEach, describe, expect, it, vi } from "vitest";
import {
  isOktaConfigured,
  normalizeOktaNextPath,
  parseOktaIntent,
} from "@/lib/okta/config";

describe("okta config helpers", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("reports configured only when issuer, client id, and secret are set", () => {
    expect(isOktaConfigured()).toBe(false);
    vi.stubEnv("OKTA_ISSUER", "https://login.wsu.edu/oauth2/default");
    vi.stubEnv("OKTA_CLIENT_ID", "client");
    expect(isOktaConfigured()).toBe(false);
    vi.stubEnv("OKTA_CLIENT_SECRET", "secret");
    expect(isOktaConfigured()).toBe(true);
  });

  it("parses intents and normalizes return paths", () => {
    expect(parseOktaIntent("student")).toBe("student");
    expect(parseOktaIntent("nope")).toBe("admin");
    expect(normalizeOktaNextPath("/admin/views", "admin")).toBe("/admin/views");
    expect(normalizeOktaNextPath("/student", "admin")).toBe("/admin");
    expect(normalizeOktaNextPath("/admin/views", "student")).toBe("/student");
    expect(normalizeOktaNextPath("/view/demo", "contributor")).toBe("/view/demo");
  });
});
