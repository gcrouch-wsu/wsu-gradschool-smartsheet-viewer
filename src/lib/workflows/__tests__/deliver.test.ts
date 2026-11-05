import { describe, expect, it } from "vitest";
import { DEFAULT_ALERT_CHANNELS, resolveAlertChannels } from "@/lib/workflows/channels";

describe("resolveAlertChannels", () => {
  it("defaults to in-app when channels are missing", () => {
    expect(resolveAlertChannels(undefined)).toEqual(DEFAULT_ALERT_CHANNELS);
    expect(resolveAlertChannels(null)).toEqual(["in_app"]);
    expect(resolveAlertChannels([])).toEqual(["in_app"]);
  });

  it("keeps in_app and email when both selected", () => {
    expect(resolveAlertChannels(["in_app", "email"])).toEqual(["in_app", "email"]);
  });
});
