/**
 * Client-safe channel helpers for alert workflows.
 * Keep this free of Node/DB imports so UI components can use it.
 */
import type { NotificationChannel } from "@/lib/workflows/types";

export const DEFAULT_ALERT_CHANNELS: NotificationChannel[] = ["in_app"];

export function resolveAlertChannels(channels?: NotificationChannel[] | null): NotificationChannel[] {
  const unique = [...new Set((channels?.length ? channels : DEFAULT_ALERT_CHANNELS).filter(Boolean))];
  return unique.length ? unique : [...DEFAULT_ALERT_CHANNELS];
}
