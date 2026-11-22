import { createSign, generateKeyPairSync } from "node:crypto";
import { describe, expect, it } from "vitest";
import { sesEventKind } from "@/lib/ses/events";
import { parseSesEvents, sesCorrelationIds, workflowStatusForSesEvent } from "@/lib/ses/parse";
import {
  isAllowedSnsCertUrl,
  isAllowedSnsSubscribeUrl,
  readSnsEnvelope,
  snsStringToSign,
  verifySnsSignature,
  type SnsEnvelope,
} from "@/lib/ses/sns";

function mail(messageId = "msg-1") {
  return {
    timestamp: "2026-11-18T12:00:00.000Z",
    messageId,
    source: "gradschool@wsu.edu",
    destination: ["Ada@wsu.edu"],
    commonHeaders: { subject: "Program update", from: ["gradschool@wsu.edu"], to: ["Ada@wsu.edu"] },
  };
}

describe("parseSesEvents", () => {
  it("records a send", () => {
    const [event] = parseSesEvents({ eventType: "Send", mail: mail() });
    expect(event?.recipientEmail).toBe("ada@wsu.edu");
    expect(sesEventKind(event!.eventType, event!.bounceType)).toBe("send");
    expect(event?.outcome).toBe("Accepted for delivery");
    expect(event?.subject).toBe("Program update");
  });

  it("records a rendering failure", () => {
    const [event] = parseSesEvents({
      eventType: "Rendering Failure",
      mail: mail(),
      failure: { errorMessage: "Template missing", templateName: "notice" },
    });
    expect(sesEventKind(event!.eventType, null)).toBe("rendering_failure");
    expect(event?.outcome).toBe("Template missing");
  });

  it("records a reject", () => {
    const [event] = parseSesEvents({ eventType: "Reject", mail: mail(), reject: { reason: "Bad content" } });
    expect(sesEventKind(event!.eventType, null)).toBe("reject");
    expect(event?.outcome).toBe("Bad content");
  });

  it("treats delivery as sent and a hard bounce as failed", () => {
    expect(workflowStatusForSesEvent({ eventType: "Delivery", bounceType: null })).toBe("sent");
    expect(workflowStatusForSesEvent({ eventType: "Send", bounceType: null })).toBeNull();
    expect(workflowStatusForSesEvent({ eventType: "Bounce", bounceType: "Permanent" })).toBe("failed");
    expect(workflowStatusForSesEvent({ eventType: "Bounce", bounceType: "Transient" })).toBeNull();
    const payload = {
      mail: {
        messageId: "0100018ses",
        commonHeaders: { messageId: "<client@wsu.edu>" },
        headers: [{ name: "X-Workflow-Message-Id", value: "workflow-token" }],
      },
    };
    expect(sesCorrelationIds(payload)).toEqual(["0100018ses", "client@wsu.edu", "workflow-token"]);
  });

  it("records a delivery", () => {
    const [event] = parseSesEvents({
      eventType: "Delivery",
      mail: mail(),
      delivery: { recipients: ["Ada@wsu.edu"], smtpResponse: "250 ok", timestamp: "2026-11-18T12:01:00.000Z" },
    });
    expect(sesEventKind(event!.eventType, null)).toBe("delivery");
    expect(event?.outcome).toBe("250 ok");
    expect(event?.occurredAt).toBe("2026-11-18T12:01:00.000Z");
  });

  it("records a hard bounce and a soft bounce separately", () => {
    const hard = parseSesEvents({
      eventType: "Bounce",
      mail: mail("hard"),
      bounce: {
        bounceType: "Permanent",
        bounceSubType: "General",
        bouncedRecipients: [{ emailAddress: "gone@wsu.edu", diagnosticCode: "smtp; 550 5.1.1 user unknown" }],
      },
    })[0];
    const soft = parseSesEvents({
      eventType: "Bounce",
      mail: mail("soft"),
      bounce: {
        bounceType: "Transient",
        bouncedRecipients: [{ emailAddress: "busy@wsu.edu", diagnosticCode: "smtp; 450 4.2.1 mailbox busy" }],
      },
    })[0];
    expect(sesEventKind(hard!.eventType, hard!.bounceType)).toBe("hard_bounce");
    expect(hard?.outcome).toContain("5.1.1");
    expect(sesEventKind(soft!.eventType, soft!.bounceType)).toBe("soft_bounce");
    expect(soft?.recipientEmail).toBe("busy@wsu.edu");
  });

  it("treats an undetermined bounce as soft", () => {
    const [event] = parseSesEvents({
      eventType: "Bounce",
      mail: mail(),
      bounce: { bounceType: "Undetermined", bouncedRecipients: [{ emailAddress: "ada@wsu.edu" }] },
    });
    expect(sesEventKind(event!.eventType, event!.bounceType)).toBe("soft_bounce");
  });

  it("records a complaint", () => {
    const [event] = parseSesEvents({
      eventType: "Complaint",
      mail: mail(),
      complaint: { complaintFeedbackType: "abuse", complainedRecipients: [{ emailAddress: "ada@wsu.edu" }] },
    });
    expect(sesEventKind(event!.eventType, null)).toBe("complaint");
    expect(event?.outcome).toBe("abuse");
  });

  it("records a delivery delay", () => {
    const [event] = parseSesEvents({
      eventType: "DeliveryDelay",
      mail: mail(),
      deliveryDelay: {
        delayType: "MailboxFull",
        delayedRecipients: [{ emailAddress: "ada@wsu.edu", diagnosticCode: "smtp; 452 mailbox full" }],
      },
    });
    expect(sesEventKind(event!.eventType, null)).toBe("delivery_delay");
    expect(event?.outcome).toContain("MailboxFull");
  });

  it("records a subscription change", () => {
    const [event] = parseSesEvents({
      eventType: "Subscription",
      mail: mail(),
      subscription: {
        contactList: "admissions",
        newTopicPreferences: [{ topicName: "updates", subscriptionStatus: "OptOut" }],
      },
    });
    expect(sesEventKind(event!.eventType, null)).toBe("subscription");
    expect(event?.outcome).toContain("OptOut");
  });

  it("accepts the older notificationType field", () => {
    const [event] = parseSesEvents({ notificationType: "Delivery", mail: mail() });
    expect(event?.eventType).toBe("Delivery");
  });

  it("ignores a payload without a message id", () => {
    expect(parseSesEvents({ eventType: "Send", mail: { destination: ["ada@wsu.edu"] } })).toEqual([]);
  });
});

describe("sns signatures", () => {
  const { publicKey, privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const certificatePem = publicKey.export({ type: "spki", format: "pem" }).toString();

  function signed(message: SnsEnvelope): SnsEnvelope {
    const payload = snsStringToSign(message);
    const signer = createSign("sha256");
    signer.update(payload!, "utf8");
    return { ...message, Signature: signer.sign(privateKey).toString("base64") };
  }

  const base: SnsEnvelope = {
    Type: "Notification",
    MessageId: "id-1",
    TopicArn: "arn:aws:sns:us-west-2:123456789012:ses-events",
    Message: "{\"eventType\":\"Send\"}",
    Timestamp: "2026-11-18T12:00:00.000Z",
    SignatureVersion: "2",
    Signature: "c2lnbmF0dXJl",
    SigningCertURL: "https://sns.us-west-2.amazonaws.com/SimpleNotificationService-example.pem",
    Subject: "Amazon SES Email Event Notification",
  };

  it("verifies a version 2 signature and rejects a tampered message", () => {
    const message = signed(base);
    expect(verifySnsSignature(message, certificatePem)).toBe(true);
    expect(verifySnsSignature({ ...message, Message: "tampered" }, certificatePem)).toBe(false);
  });

  it("includes Subject only on notifications", () => {
    expect(snsStringToSign(base)).toContain("Subject\nAmazon SES Email Event Notification\n");
    const confirmation = snsStringToSign({
      ...base,
      Type: "SubscriptionConfirmation",
      Subject: undefined,
      Token: "token",
      SubscribeURL: "https://sns.us-west-2.amazonaws.com/?Action=ConfirmSubscription&Token=token",
    });
    expect(confirmation).toContain("SubscribeURL\n");
    expect(confirmation).not.toContain("Subject\n");
  });

  it("only allows Amazon SNS certificate and subscribe hosts", () => {
    expect(isAllowedSnsCertUrl("https://sns.us-west-2.amazonaws.com/SimpleNotificationService-example.pem")).toBe(true);
    expect(isAllowedSnsCertUrl("http://sns.us-west-2.amazonaws.com/cert.pem")).toBe(false);
    expect(isAllowedSnsCertUrl("https://sns.us-west-2.amazonaws.com.evil.com/cert.pem")).toBe(false);
    expect(isAllowedSnsCertUrl("https://user:pass@sns.us-east-1.amazonaws.com/cert.pem")).toBe(false);
    expect(isAllowedSnsSubscribeUrl("https://sns.us-west-2.amazonaws.com/?Action=ConfirmSubscription&Token=abc")).toBe(
      true,
    );
    expect(isAllowedSnsSubscribeUrl("https://example.com/?Action=ConfirmSubscription")).toBe(false);
  });

  it("reads a complete envelope and rejects a partial one", () => {
    expect(readSnsEnvelope(base)?.TopicArn).toBe(base.TopicArn);
    expect(readSnsEnvelope({ Type: "Notification" })).toBeNull();
  });
});
