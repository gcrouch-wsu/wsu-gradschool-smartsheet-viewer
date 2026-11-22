/**
 * Server-only delivery entry point for workflow alerts.
 * In-app notices go to the Notifications inbox. Email goes out through Amazon SES.
 *
 * Do not import this module from client components — it pulls in Postgres (`pg`).
 * UI should import channel helpers from `@/lib/workflows/channels` instead.
 */
import { sendWorkflowEmail } from "@/lib/ses/mail";
import { resolveAlertChannels } from "@/lib/workflows/channels";
import { insertNotifications } from "@/lib/workflows/notifications";
import { insertWorkflowDeliveries, listRunDeliveries } from "@/lib/workflows/store";
import type { NotificationChannel, NotificationPayload } from "@/lib/workflows/types";

export type { NotificationChannel };
export { DEFAULT_ALERT_CHANNELS, resolveAlertChannels } from "@/lib/workflows/channels";

export type DeliverWorkflowNotificationsInput = {
  emails: string[];
  title: string;
  body: string;
  payload: NotificationPayload;
  workflowId: string;
  runId: string;
  channels?: NotificationChannel[] | null;
};

export type DeliverWorkflowNotificationsResult = {
  channels: NotificationChannel[];
  inAppCreated: number;
  /** Recipients accepted by SMTP and still waiting for an SES delivery notification. */
  emailQueued: number;
  emailFailed: number;
  emailError: string | null;
  /** In-app notices already recorded for this run, so a retry does not send them again. */
  inAppAlready: number;
};

/** Send the alert copy through SES. Callers record each recipient on the workflow run. */
export async function deliverEmailNotifications(input: {
  emails: string[];
  title: string;
  body: string;
  payload: NotificationPayload;
  workflowId: string;
  runId: string;
}) {
  return sendWorkflowEmail({ emails: input.emails, subject: input.title, text: input.body });
}

/** Deliver alert copy on the selected channels. Always safe to call from engine + preview. */
export async function deliverWorkflowNotifications(
  input: DeliverWorkflowNotificationsInput,
): Promise<DeliverWorkflowNotificationsResult> {
  const channels = resolveAlertChannels(input.channels);
  const prior = await listRunDeliveries([input.runId]);
  const already = new Set(prior.map((delivery) => `${delivery.channel}:${delivery.recipientEmail}`));
  let inAppCreated = 0;
  let emailQueued = 0;
  let emailFailed = 0;
  let emailError: string | null = null;
  const sentEmail = new Set(
    prior
      .filter((delivery) => delivery.channel === "email" && (delivery.status === "sent" || delivery.status === "pending"))
      .map((delivery) => delivery.recipientEmail.toLowerCase()),
  );
  const inAppAlready = input.emails.filter((email) => already.has(`in_app:${email}`)).length;

  if (channels.includes("in_app")) {
    const emails = input.emails.filter((email) => !already.has(`in_app:${email}`));
    inAppCreated = emails.length
      ? await insertNotifications({
          emails,
          title: input.title,
          body: input.body,
          payload: input.payload,
          workflowId: input.workflowId,
          runId: input.runId,
        })
      : 0;
    if (inAppCreated > 0) {
      await insertWorkflowDeliveries({ runId: input.runId, emails, channel: "in_app", status: "sent" });
    }
  }

  if (channels.includes("email")) {
    const emails = input.emails.filter((email) => !sentEmail.has(email.trim().toLowerCase()));
    if (emails.length) {
      const result = await deliverEmailNotifications({
        emails,
        title: input.title,
        body: input.body,
        payload: input.payload,
        workflowId: input.workflowId,
        runId: input.runId,
      });
      emailQueued = result.accepted.length;
      emailFailed = result.failed.length;
      emailError = result.failed[0]?.error ?? null;
      for (const accepted of result.accepted) {
        await insertWorkflowDeliveries({
          runId: input.runId,
          emails: [accepted.email],
          channel: "email",
          status: "pending",
          messageIds: accepted.messageIds,
        });
      }
      for (const failure of result.failed) {
        await insertWorkflowDeliveries({
          runId: input.runId,
          emails: [failure.email],
          channel: "email",
          status: "failed",
          error: failure.error,
        });
      }
    }
  }

  return { channels, inAppCreated, emailQueued, emailFailed, emailError, inAppAlready };
}
