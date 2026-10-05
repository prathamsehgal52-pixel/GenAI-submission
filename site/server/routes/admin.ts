import { desc, gte, sql } from 'drizzle-orm'
import { Hono } from 'hono'
import { config, integrations } from '../config'
import { requireAdmin, requireUser, type Env } from '../context'
import { db, schema } from '../db/client'
import { storage } from '../storage'

export const adminRoutes = new Hono<Env>()
adminRoutes.use('*', requireUser, requireAdmin)

/** Operator view: integration health, queue depth and AI spend. No secrets. */
adminRoutes.get('/status', async (c) => {
  const since = new Date(Date.now() - 30 * 24 * 3600 * 1000)
  const [status, usage, byOp, counts, queues] = await Promise.all([
    db.select().from(schema.integrationStatus),
    db
      .select({
        calls: sql<number>`count(*)::int`,
        failures: sql<number>`count(*) filter (where not ${schema.aiUsage.success})::int`,
        inputTokens: sql<number>`coalesce(sum(${schema.aiUsage.inputTokens}),0)::bigint`,
        outputTokens: sql<number>`coalesce(sum(${schema.aiUsage.outputTokens}),0)::bigint`,
        cost: sql<string>`coalesce(sum(${schema.aiUsage.costUsd}),0)::text`,
        p50: sql<number>`coalesce(percentile_cont(0.5) within group (order by ${schema.aiUsage.latencyMs}),0)::int`,
      })
      .from(schema.aiUsage)
      .where(gte(schema.aiUsage.createdAt, since)),
    db
      .select({ operation: schema.aiUsage.operation, calls: sql<number>`count(*)::int`, cost: sql<string>`coalesce(sum(${schema.aiUsage.costUsd}),0)::text` })
      .from(schema.aiUsage)
      .where(gte(schema.aiUsage.createdAt, since))
      .groupBy(schema.aiUsage.operation)
      .orderBy(desc(sql`count(*)`)),
    db.execute<{ users: number; items: number; products: number; runs: number }>(sql`
      SELECT (SELECT count(*)::int FROM "user") users,
             (SELECT count(*)::int FROM wardrobe_items) items,
             (SELECT count(*)::int FROM products) products,
             (SELECT count(*)::int FROM discovery_runs WHERE created_at > now() - interval '1 day') runs`),
    db
      .execute<{ name: string; state: string; n: number }>(sql`SELECT name, state, count(*)::int n FROM pgboss.job GROUP BY 1, 2`)
      .then((r) => r.rows)
      .catch(() => []),
  ])
  return c.json({
    environment: config.APP_ENV,
    configured: {
      ai: integrations.ai(),
      aiModel: integrations.ai() ? config.AI_MODEL : null,
      ebay: integrations.ebay(),
      feed: integrations.feed(),
      email: integrations.email(),
      weather: config.WEATHER_ENABLED,
      storage: await storage.ready(),
      errorReporting: !!config.SENTRY_DSN,
    },
    health: status,
    ai30d: { ...usage[0], byOperation: byOp },
    totals: counts.rows[0],
    queues,
  })
})
