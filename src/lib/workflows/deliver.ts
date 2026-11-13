/**
 * Server-only delivery entry point for workflow alerts.
 * Today: in-app notifications (Notifications inbox).
 * Later: plug email into deliverEmailNotifications without changing callers.
 *
 * Do not import this module from client components — it pulls in Postgres (`pg`).
 * UI should import channel helpers from `@/lib/workflows/channels` instead.
 */
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
  /** Reserved for a future mailer; always 0 until email is implemented. */
  emailQueued: number;
  emailFailed: number;
  emailError: string | null;
  /** In-app notices already recorded for this run, so a retry does not send them again. */
  inAppAlready: number;
};

/**
 * Future hook: send the same alert copy over email.
 * Keep this stub so engine/preview already call one place when mail ships.
 */
export async function deliverEmailNotifications(_input: {
  emails: string[];
  title: string;
  body: string;
  payload: NotificationPayload;
  workflowId: string;
  runId: string;
}): Promise<number> {
  // Intentionally no-op until an outbound mail provider is configured.
  return 0;
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
    const emails = input.emails.filter((email) => !already.has(`email:${email}`));
    emailQueued = emails.length
      ? await deliverEmailNotifications({
          emails,
          title: input.title,
          body: input.body,
          payload: input.payload,
          workflowId: input.workflowId,
          runId: input.runId,
        })
      : 0;
    if (emails.length && emailQueued === 0) {
      emailFailed = emails.length;
      emailError = "Email is not configured.";
      await insertWorkflowDeliveries({
        runId: input.runId,
        emails,
        channel: "email",
        status: "failed",
        error: emailError,
      });
    } else if (emailQueued > 0) {
      await insertWorkflowDeliveries({ runId: input.runId, emails, channel: "email", status: "sent" });
    }
  }

  return { channels, inAppCreated, emailQueued, emailFailed, emailError, inAppAlready };
}
