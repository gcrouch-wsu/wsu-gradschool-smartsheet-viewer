import { describe, expect, it } from "vitest";
import { buildEmailTrace } from "@/lib/workflows/email-trace";

const waiting = {
  recipientEmail: "success@simulator.amazonses.com",
  status: "pending",
  error: null,
  messageIds: ["token", "0100018ses"],
  notices: [],
};

describe("buildEmailTrace", () => {
  it("stops after the mail server accepts the message when SES is silent", () => {
    const trace = buildEmailTrace(waiting);
    expect(trace.headline).toContain("SES has not sent a notification");
    expect(trace.steps.map((step) => step.state)).toEqual(["done", "done", "current", "upcoming"]);
    expect(trace.steps[2]?.detail).toContain("No notification has arrived");
  });

  it("shows the SES delivery message when delivery is reported", () => {
    const trace = buildEmailTrace({
      ...waiting,
      status: "sent",
      notices: [{ eventType: "Delivery", bounceType: null, outcome: "250 ok", occurredAt: "2026-11-19T00:21:00.000Z" }],
    });
    expect(trace.headline).toContain("delivered");
    expect(trace.steps[2]?.detail).toContain("250 ok");
    expect(trace.steps[3]?.state).toBe("done");
  });

  it("shows the SES failure text when the message is rejected", () => {
    const trace = buildEmailTrace({
      ...waiting,
      status: "failed",
      error: "smtp; 550 5.1.1 user unknown",
      notices: [
        {
          eventType: "Bounce",
          bounceType: "Permanent",
          outcome: "smtp; 550 5.1.1 user unknown",
          occurredAt: "2026-11-19T00:21:00.000Z",
        },
      ],
    });
    expect(trace.headline).toContain("550 5.1.1");
    expect(trace.steps[2]?.state).toBe("failed");
    expect(trace.steps[3]?.detail).toContain("550 5.1.1");
  });

  it("stops at the mail server when SMTP rejects the message", () => {
    const trace = buildEmailTrace({ ...waiting, status: "failed", error: "550 user unknown", messageIds: [] });
    expect(trace.steps.map((step) => step.state)).toEqual(["done", "failed", "upcoming", "failed"]);
    expect(trace.steps[1]?.detail).toBe("550 user unknown");
  });
});
