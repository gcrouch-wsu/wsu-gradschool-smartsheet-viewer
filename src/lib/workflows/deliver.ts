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
  let inAppCreated = 0;
  let emailQueued = 0;

  if (channels.includes("in_app")) {
    inAppCreated = await insertNotifications({
      emails: input.emails,
      title: input.title,
      body: input.body,
      payload: input.payload,
      workflowId: input.workflowId,
      runId: input.runId,
    });
  }

  if (channels.includes("email")) {
    emailQueued = await deliverEmailNotifications({
      emails: input.emails,
      title: input.title,
      body: input.body,
      payload: input.payload,
      workflowId: input.workflowId,
      runId: input.runId,
    });
  }

  return { channels, inAppCreated, emailQueued };
}
