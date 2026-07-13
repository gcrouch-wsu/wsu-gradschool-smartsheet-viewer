import { ensureFormsTables, isFormsDatabaseEnabled, queryFormsDb } from "@/lib/forms/db";

const hitsMemory = new Map<string, number[]>();

const DB_PRUNE_INTERVAL_MS = 5 * 60 * 1000;
let lastDbPruneAt = 0;

function pruneMemory(now: number, windowMs: number) {
  for (const [key, times] of hitsMemory) {
    const recent = times.filter((t) => now - t < windowMs);
    if (recent.length === 0) {
      hitsMemory.delete(key);
    } else {
      hitsMemory.set(key, recent);
    }
  }
}

function memoryRateLimit(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  pruneMemory(now, windowMs);
  const recent = (hitsMemory.get(key) ?? []).filter((t) => now - t < windowMs);
  if (recent.length >= max) {
    hitsMemory.set(key, recent);
    return false;
  }
  recent.push(now);
  hitsMemory.set(key, recent);
  return true;
}

async function dbRateLimit(key: string, max: number, windowMs: number): Promise<boolean> {
  await ensureFormsTables();
  const windowSeconds = Math.max(1, Math.ceil(windowMs / 1000));
  const { rows } = await queryFormsDb<{ count: string }>(
    `SELECT COUNT(*)::text AS count
     FROM form_rate_limit_buckets
     WHERE bucket_key = $1
       AND hit_at > now() - make_interval(secs => $2)`,
    [key, windowSeconds],
  );
  const count = Number(rows[0]?.count ?? 0);
  if (count >= max) {
    return false;
  }

  await queryFormsDb(
    `INSERT INTO form_rate_limit_buckets (bucket_key, hit_at) VALUES ($1, now())`,
    [key],
  );

  const now = Date.now();
  if (now - lastDbPruneAt >= DB_PRUNE_INTERVAL_MS) {
    lastDbPruneAt = now;
    await queryFormsDb(
      `DELETE FROM form_rate_limit_buckets
       WHERE hit_at < now() - interval '1 day'`,
    );
  }

  return true;
}

/** Returns true if allowed, false if the key has exceeded `max` within `windowMs`. */
export async function rateLimit(key: string, max = 5, windowMs = 60_000): Promise<boolean> {
  if (!isFormsDatabaseEnabled()) {
    return memoryRateLimit(key, max, windowMs);
  }
  return dbRateLimit(key, max, windowMs);
}
