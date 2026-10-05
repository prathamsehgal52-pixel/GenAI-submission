import { sql } from 'drizzle-orm'
import { Hono } from 'hono'
import { db } from '../db/client'
import { storage } from '../storage'

export const healthRoutes = new Hono()

/** Liveness: the process is up. */
healthRoutes.get('/', (c) => c.json({ status: 'ok' }))

/** Readiness: dependencies required to serve traffic are reachable. */
healthRoutes.get('/ready', async (c) => {
  const checks: Record<string, boolean> = {}
  try {
    await db.execute(sql`select 1`)
    checks.database = true
  } catch {
    checks.database = false
  }
  checks.storage = await storage.ready()
  const ok = Object.values(checks).every(Boolean)
  return c.json({ status: ok ? 'ready' : 'degraded', checks }, ok ? 200 : 503)
})
