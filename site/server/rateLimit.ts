import { sql } from 'drizzle-orm'
import { db } from './db/client'
import { AppError } from './http'

/**
 * Fixed-window rate limiting stored in Postgres so limits hold across
 * multiple API instances.
 */
export async function rateLimit(key: string, limit: number, windowSeconds: number) {
  const res = await db.execute<{ count: number }>(sql`
    INSERT INTO rate_limits (key, window_start, count) VALUES (${key}, now(), 1)
    ON CONFLICT (key) DO UPDATE SET
      count = CASE WHEN rate_limits.window_start < now() - make_interval(secs => ${windowSeconds}) THEN 1 ELSE rate_limits.count + 1 END,
      window_start = CASE WHEN rate_limits.window_start < now() - make_interval(secs => ${windowSeconds}) THEN now() ELSE rate_limits.window_start END
    RETURNING count`)
  const count = Number(res.rows[0]?.count ?? 0)
  if (count > limit) {
    throw new AppError(429, 'rate_limited', 'You are doing that a little too often. Please wait a moment and try again.', {
      retryAfterSeconds: windowSeconds,
    })
  }
}

export async function pruneRateLimits() {
  await db.execute(sql`DELETE FROM rate_limits WHERE window_start < now() - interval '1 day'`)
}
