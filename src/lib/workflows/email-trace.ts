import { sesEventKind, SES_EVENT_LABELS } from "@/lib/ses/events";
import { workflowStatusForSesEvent } from "@/lib/ses/parse";

export interface EmailTraceNotice {
  eventType: string;
  bounceType: string | null;
  outcome: string;
  occurredAt: string;
}

export interface EmailTraceStep {
  label: string;
  state: "done" | "current" | "failed" | "upcoming";
  detail: string;
}

export interface EmailTrace {
  headline: string;
  steps: EmailTraceStep[];
}

function noticeLabel(notice: EmailTraceNotice): string {
  const kind = sesEventKind(notice.eventType, notice.bounceType);
  return kind ? SES_EVENT_LABELS[kind] : notice.eventType;
}

/** The four steps between a workflow send and an SES delivery notification. */
export function buildEmailTrace(input: {
  recipientEmail: string;
  status: string;
  error: string | null;
  messageIds: string[];
  notices: EmailTraceNotice[];
}): EmailTrace {
  const notices = [...input.notices].sort((a, b) => a.occurredAt.localeCompare(b.occurredAt));
  const smtpRejected = input.status === "failed" && input.messageIds.length === 0;
  const smtpError = input.error || "The mail server rejected the message.";
  const sesFailure = notices.find((notice) => workflowStatusForSesEvent(notice) === "failed");
  const delivered = notices.some((notice) => workflowStatusForSesEvent(notice) === "sent");

  const headline = smtpRejected
    ? smtpError
    : input.status === "sent" || delivered
      ? "SES reported that this message was delivered."
      : sesFailure
        ? sesFailure.outcome
        : "Stopped after the mail server accepted the message. SES has not sent a notification.";

  const mailStep: EmailTraceStep = smtpRejected
    ? { label: "Accepted by the mail server", state: "failed", detail: smtpError }
    : {
        label: "Accepted by the mail server",
        state: "done",
        detail: input.messageIds.length
          ? `Accepted. Message id ${input.messageIds[input.messageIds.length - 1]}.`
          : "Accepted.",
      };

  const sesStep: EmailTraceStep = smtpRejected
    ? { label: "SES notification", state: "upcoming", detail: "Not reached." }
    : notices.length
      ? {
          label: "SES notification",
          state: sesFailure ? "failed" : "done",
          detail: notices.map((notice) => `${noticeLabel(notice)}: ${notice.outcome}`).join("\n"),
        }
      : {
          label: "SES notification",
          state: "current",
          detail: "No notification has arrived. The run stays here until SES reports a delivery, bounce, or reject.",
        };

  const outcomeStep: EmailTraceStep = smtpRejected
    ? { label: "Outcome", state: "failed", detail: "The message never reached SES." }
    : input.status === "sent" || delivered
      ? { label: "Outcome", state: "done", detail: "Delivered." }
      : sesFailure
        ? { label: "Outcome", state: "failed", detail: input.error || sesFailure.outcome }
        : { label: "Outcome", state: "upcoming", detail: "Sent is recorded only after SES reports delivery." };

  return {
    headline,
    steps: [
      { label: "Recipient chosen", state: "done", detail: input.recipientEmail },
      mailStep,
      sesStep,
      outcomeStep,
    ],
  };
}
