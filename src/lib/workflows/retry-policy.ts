/** A failed run tries again after one minute, and stops after three attempts. */
export const RETRY_DELAY_MS = 60_000;
export const MAX_RUN_ATTEMPTS = 3;
export const WORKFLOW_TIME_ZONE = "America/Los_Angeles";

export function nextRetryAt(attemptCount: number, now = Date.now()): string | null {
  if (attemptCount >= MAX_RUN_ATTEMPTS) return null;
  return new Date(now + RETRY_DELAY_MS).toISOString();
}

export interface PacificClock {
  weekday: string;
  dateKey: string;
  minutes: number;
}

export function pacificClock(now: Date): PacificClock {
  const weekday = new Intl.DateTimeFormat("en-US", { timeZone: WORKFLOW_TIME_ZONE, weekday: "long" }).format(now);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: WORKFLOW_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const read = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  const hour = Number(read("hour"));
  const minute = Number(read("minute"));
  return {
    weekday,
    dateKey: `${read("year")}-${read("month")}-${read("day")}`,
    minutes: (Number.isFinite(hour) ? hour : 0) * 60 + (Number.isFinite(minute) ? minute : 0),
  };
}

/** True once the scheduled Pacific time has passed today and this date has not fired yet. */
export function scheduleIsDue(
  schedule: { day?: string; time?: string } | undefined,
  now: Date,
  alreadyFiredToday: boolean,
): boolean {
  if (!schedule || alreadyFiredToday) return false;
  const clock = pacificClock(now);
  const day = (schedule.day ?? "").trim().toLowerCase();
  const everyDay = day === "" || day === "every day" || day === "*";
  if (!everyDay && day !== clock.weekday.toLowerCase()) return false;
  const [hourRaw, minuteRaw] = (schedule.time ?? "09:00").split(":");
  const hour = Number(hourRaw);
  const minute = Number(minuteRaw);
  if (!Number.isFinite(hour)) return false;
  const target = hour * 60 + (Number.isFinite(minute) ? minute : 0);
  return clock.minutes >= target;
}
