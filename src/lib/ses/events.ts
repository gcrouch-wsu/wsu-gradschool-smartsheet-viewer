export const SES_EVENT_KINDS = [
  "send",
  "rendering_failure",
  "reject",
  "delivery",
  "hard_bounce",
  "soft_bounce",
  "complaint",
  "delivery_delay",
  "subscription",
] as const;

export type SesEventKind = (typeof SES_EVENT_KINDS)[number];

export const SES_EVENT_LABELS: Record<SesEventKind, string> = {
  send: "Sends",
  rendering_failure: "Rendering failures",
  reject: "Rejects",
  delivery: "Deliveries",
  hard_bounce: "Hard bounces",
  soft_bounce: "Soft bounces",
  complaint: "Complaints",
  delivery_delay: "Delivery delays",
  subscription: "Subscriptions",
};

/** Plain-language meaning shown when an event is opened. */
export const SES_EVENT_MEANINGS: Record<SesEventKind, string> = {
  send: "The call was successful and Amazon SES will attempt to deliver the message to the recipient’s mail server.",
  rendering_failure: "The message wasn’t sent because of a template rendering issue.",
  reject: "Amazon SES accepted the message, but determined that it contained a virus and didn’t attempt to deliver it to the recipient’s mail server.",
  delivery: "Amazon SES successfully delivered the message to the recipient’s mail server.",
  hard_bounce: "The recipient's mail server permanently rejected the email.",
  soft_bounce: "The recipient's mail server temporarily rejected the email. Amazon SES includes these when it still cannot deliver after multiple attempts.",
  complaint: "The message was successfully delivered to the recipient’s mail server, but the recipient marked it as spam.",
  delivery_delay: "The message couldn't be delivered to the recipient’s mail server because a temporary issue occurred.",
  subscription:
    "The email was successfully delivered to the recipient. The recipient updated the subscription preferences by clicking the List-Unsubscribe header or via the unsubscribe webpage linked to the email footer.",
};

export function emptySesCounts(): Record<SesEventKind, number> {
  return {
    send: 0,
    rendering_failure: 0,
    reject: 0,
    delivery: 0,
    hard_bounce: 0,
    soft_bounce: 0,
    complaint: 0,
    delivery_delay: 0,
    subscription: 0,
  };
}

export function sesEventKind(eventType: string, bounceType: string | null): SesEventKind | null {
  switch (eventType) {
    case "Send":
      return "send";
    case "Rendering Failure":
      return "rendering_failure";
    case "Reject":
      return "reject";
    case "Delivery":
      return "delivery";
    case "Bounce":
      return bounceType === "Permanent" ? "hard_bounce" : "soft_bounce";
    case "Complaint":
      return "complaint";
    case "DeliveryDelay":
      return "delivery_delay";
    case "Subscription":
      return "subscription";
    default:
      return null;
  }
}

export function isSesEventKind(value: string): value is SesEventKind {
  return (SES_EVENT_KINDS as readonly string[]).includes(value);
}
