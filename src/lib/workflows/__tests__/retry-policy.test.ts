import { describe, expect, it } from "vitest";
import { MAX_RUN_ATTEMPTS, nextRetryAt, pacificClock, scheduleIsDue } from "@/lib/workflows/retry-policy";

describe("workflow retry", () => {
  it("retries after 60 seconds until the third attempt", () => {
    const now = Date.parse("2026-11-12T18:00:00.000Z");
    expect(nextRetryAt(1, now)).toBe(new Date(now + 60_000).toISOString());
    expect(nextRetryAt(2, now)).toBe(new Date(now + 60_000).toISOString());
    expect(nextRetryAt(MAX_RUN_ATTEMPTS, now)).toBeNull();
  });

  it("fires a Pacific schedule after the chosen time, once per day", () => {
    const clock = pacificClock(new Date("2026-11-12T18:30:00.000Z"));
    expect(clock.weekday).toBe("Thursday");
    expect(clock.dateKey).toBe("2026-11-12");
    const schedule = { day: "Thursday", time: "09:00" };
    expect(scheduleIsDue(schedule, new Date("2026-11-12T18:30:00.000Z"), false)).toBe(true);
    expect(scheduleIsDue(schedule, new Date("2026-11-12T18:30:00.000Z"), true)).toBe(false);
    expect(scheduleIsDue(schedule, new Date("2026-11-12T15:00:00.000Z"), false)).toBe(false);
  });
});