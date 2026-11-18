import { describe, expect, it, vi } from "vitest";
import { sendWorkflowEmail, type MailTransport } from "@/lib/ses/mail";

const configured = {
  SMTP_HOST: "email-smtp.us-west-2.amazonaws.com",
  SMTP_PORT: "587",
  SMTP_USER: "smtp-user",
  SMTP_PASSWORD: "smtp-secret",
  MAIL_FROM: "gradschool@wsu.edu",
  SES_CONFIGURATION_SET: "workflow-events",
};

function transport(send: MailTransport["send"]): MailTransport {
  return { send };
}

describe("sendWorkflowEmail", () => {
  it("does not send when SMTP settings are missing", async () => {
    const send = vi.fn();
    const result = await sendWorkflowEmail(
      { emails: ["ada@wsu.edu"], subject: "Update", text: "A row changed." },
      { env: {}, transport: transport(send) },
    );
    expect(send).not.toHaveBeenCalled();
    expect(result.configured).toBe(false);
    expect(result.sent).toEqual([]);
    expect(result.failed).toEqual([{ email: "ada@wsu.edu", error: "Email is not configured." }]);
  });

  it("sends one message per recipient through the configuration set", async () => {
    const sent: Array<{ to: string; headers?: Record<string, string> }> = [];
    const result = await sendWorkflowEmail(
      { emails: ["Ada@wsu.edu", "ada@wsu.edu", "busola@wsu.edu"], subject: "Update", text: "A row changed." },
      {
        env: configured,
        transport: transport(async (message) => {
          sent.push({ to: message.to, headers: message.headers });
        }),
      },
    );
    expect(result.sent).toEqual(["ada@wsu.edu", "busola@wsu.edu"]);
    expect(result.failed).toEqual([]);
    expect(sent).toEqual([
      { to: "ada@wsu.edu", headers: { "X-SES-CONFIGURATION-SET": "workflow-events" } },
      { to: "busola@wsu.edu", headers: { "X-SES-CONFIGURATION-SET": "workflow-events" } },
    ]);
  });

  it("keeps a successful recipient when another address is rejected", async () => {
    const result = await sendWorkflowEmail(
      { emails: ["ada@wsu.edu", "gone@wsu.edu"], subject: "Update", text: "A row changed." },
      {
        env: configured,
        transport: transport(async (message) => {
          if (message.to === "gone@wsu.edu") throw new Error("550 user unknown");
        }),
      },
    );
    expect(result.configured).toBe(true);
    expect(result.sent).toEqual(["ada@wsu.edu"]);
    expect(result.failed).toEqual([{ email: "gone@wsu.edu", error: "550 user unknown" }]);
  });
});
