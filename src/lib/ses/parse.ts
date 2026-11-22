export interface ParsedSesEvent {
  messageId: string;
  eventType: string;
  bounceType: string | null;
  recipientEmail: string;
  senderEmail: string | null;
  subject: string | null;
  outcome: string;
  occurredAt: string;
  payload: unknown;
}

interface AddressRecord {
  emailAddress?: unknown;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function asStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => (typeof item === "string" ? item.trim() : "")).filter(Boolean);
}

function emailsFrom(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const emails: string[] = [];
  for (const item of value) {
    if (typeof item === "string" && item.trim()) {
      emails.push(item.trim());
      continue;
    }
    const record = asRecord(item) as AddressRecord | null;
    const email = asString(record?.emailAddress);
    if (email) emails.push(email);
  }
  return emails;
}

function eventTypeOf(event: Record<string, unknown>): string | null {
  return asString(event.eventType) ?? asString(event.notificationType);
}

function recipientsFor(event: Record<string, unknown>, eventType: string): string[] {
  const mail = asRecord(event.mail);
  const destination = asStringList(mail?.destination);
  if (eventType === "Bounce") {
    const listed = emailsFrom(asRecord(event.bounce)?.bouncedRecipients);
    return listed.length ? listed : destination;
  }
  if (eventType === "Complaint") {
    const listed = emailsFrom(asRecord(event.complaint)?.complainedRecipients);
    return listed.length ? listed : destination;
  }
  if (eventType === "Delivery") {
    const listed = asStringList(asRecord(event.delivery)?.recipients);
    return listed.length ? listed : destination;
  }
  if (eventType === "DeliveryDelay") {
    const listed = emailsFrom(asRecord(event.deliveryDelay)?.delayedRecipients);
    return listed.length ? listed : destination;
  }
  return destination;
}

function firstText(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (Array.isArray(value)) {
    for (const item of value) {
      const text = asString(item);
      if (text) return text;
    }
  }
  return null;
}

function outcomeFor(event: Record<string, unknown>, eventType: string): string {
  if (eventType === "Bounce") {
    const bounce = asRecord(event.bounce);
    const recipient = asRecord(Array.isArray(bounce?.bouncedRecipients) ? bounce.bouncedRecipients[0] : null);
    return (
      asString(recipient?.diagnosticCode) ??
      asString(bounce?.bounceSubType) ??
      asString(bounce?.bounceType) ??
      "Bounce"
    );
  }
  if (eventType === "Complaint") {
    return asString(asRecord(event.complaint)?.complaintFeedbackType) ?? "Marked as spam";
  }
  if (eventType === "Delivery") {
    return asString(asRecord(event.delivery)?.smtpResponse) ?? "Delivered";
  }
  if (eventType === "Reject") {
    return asString(asRecord(event.reject)?.reason) ?? "Rejected";
  }
  if (eventType === "Rendering Failure") {
    const failure = asRecord(event.failure);
    return asString(failure?.errorMessage) ?? asString(failure?.templateName) ?? "Template rendering issue";
  }
  if (eventType === "DeliveryDelay") {
    const delay = asRecord(event.deliveryDelay);
    const recipient = asRecord(Array.isArray(delay?.delayedRecipients) ? delay.delayedRecipients[0] : null);
    const delayType = asString(delay?.delayType);
    const diagnostic = asString(recipient?.diagnosticCode);
    return [delayType, diagnostic].filter(Boolean).join(". ") || "Delivery delayed";
  }
  if (eventType === "Subscription") {
    const subscription = asRecord(event.subscription);
    const list = asString(subscription?.contactList);
    const prefs = Array.isArray(subscription?.newTopicPreferences) ? subscription.newTopicPreferences : [];
    const changes = prefs
      .map((item) => {
        const pref = asRecord(item);
        const topic = asString(pref?.topicName) ?? "topic";
        const status = asString(pref?.subscriptionStatus) ?? "updated";
        return `${topic}: ${status}`;
      })
      .filter(Boolean);
    const summary = [list ? `List ${list}` : null, changes.join(", ") || null].filter(Boolean).join(". ");
    return summary || "Subscription preferences updated";
  }
  if (eventType === "Send") return "Accepted for delivery";
  return eventType;
}

function occurredAtFor(event: Record<string, unknown>, eventType: string): string {
  const mail = asRecord(event.mail);
  const nested =
    eventType === "Bounce"
      ? asRecord(event.bounce)
      : eventType === "Complaint"
        ? asRecord(event.complaint)
        : eventType === "Delivery"
          ? asRecord(event.delivery)
          : eventType === "DeliveryDelay"
            ? asRecord(event.deliveryDelay)
            : eventType === "Reject"
              ? asRecord(event.reject)
              : eventType === "Subscription"
                ? asRecord(event.subscription)
                : null;
  const raw = asString(nested?.timestamp) ?? asString(mail?.timestamp);
  const parsed = raw ? new Date(raw) : new Date();
  return Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
}

function addMessageId(ids: Set<string>, value: string | null) {
  if (!value) return;
  const normalized = value.trim().replace(/^<|>$/g, "");
  if (normalized) ids.add(normalized);
}

/** Ids that can match the message this app handed to SES. */
export function sesCorrelationIds(payload: unknown): string[] {
  const event = asRecord(payload);
  const mail = asRecord(event?.mail);
  const ids = new Set<string>();
  addMessageId(ids, asString(mail?.messageId));
  addMessageId(ids, asString(asRecord(mail?.commonHeaders)?.messageId));
  if (Array.isArray(mail?.headers)) {
    for (const header of mail.headers) {
      const record = asRecord(header);
      const name = asString(record?.name)?.toLowerCase();
      if (name === "x-workflow-message-id" || name === "message-id") addMessageId(ids, asString(record?.value));
    }
  }
  return [...ids];
}

/** Delivery is the only SES event that means the recipient's mail server accepted the message. */
export function workflowStatusForSesEvent(event: { eventType: string; bounceType: string | null }): "sent" | "failed" | null {
  if (event.eventType === "Delivery") return "sent";
  if (event.eventType === "Reject" || event.eventType === "Complaint" || event.eventType === "Rendering Failure") return "failed";
  if (event.eventType === "Bounce" && event.bounceType !== "Transient") return "failed";
  return null;
}

/** Split one SES notification into one record per recipient. */
export function parseSesEvents(payload: unknown): ParsedSesEvent[] {
  const event = asRecord(payload);
  if (!event) return [];
  const eventType = eventTypeOf(event);
  const mail = asRecord(event.mail);
  const messageId = asString(mail?.messageId);
  if (!eventType || !messageId) return [];

  const headers = asRecord(mail?.commonHeaders);
  const sender = asString(mail?.source) ?? firstText(headers?.from);
  const subject = firstText(headers?.subject);
  const bounceType = eventType === "Bounce" ? asString(asRecord(event.bounce)?.bounceType) : null;
  const recipients = recipientsFor(event, eventType);
  const unique = [...new Set((recipients.length ? recipients : ["(unknown)"]).map((email) => email.toLowerCase()))];
  const outcome = outcomeFor(event, eventType);
  const occurredAt = occurredAtFor(event, eventType);

  return unique.map((recipientEmail) => ({
    messageId,
    eventType,
    bounceType,
    recipientEmail,
    senderEmail: sender,
    subject,
    outcome,
    occurredAt,
    payload: event,
  }));
}
