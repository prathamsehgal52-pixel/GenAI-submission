import { sql } from 'drizzle-orm'
import { describe, expect, it, vi } from 'vitest'
import { db } from '../../server/db/client'
import { runMigrations } from '../../server/db/migrate'
import { app } from './helpers'

describe('database migrations', () => {
  it('creates the expected schema and can be re-run safely', async () => {
    await runMigrations()
    const res = await db.execute<{ table_name: string }>(sql`select table_name from information_schema.tables where table_schema = 'public'`)
    const tables = res.rows.map((r) => r.table_name)
    for (const t of ['user', 'session', 'account', 'profiles', 'image_assets', 'wardrobe_items', 'outfits', 'outfit_items', 'outfit_plans', 'styling_requests', 'products', 'product_recommendations', 'discovery_runs', 'notification_deliveries', 'ai_usage', 'integration_status', 'rate_limits']) {
      expect(tables, t).toContain(t)
    }
    const fks = await db.execute<{ n: number }>(sql`select count(*)::int n from information_schema.table_constraints where constraint_type = 'FOREIGN KEY' and table_schema = 'public'`)
    expect(Number(fks.rows[0].n)).toBeGreaterThanOrEqual(15)
  })
})

describe('health and errors', () => {
  it('reports liveness and readiness', async () => {
    expect((await app.request('/api/health')).status).toBe(200)
    const ready = await (await app.request('/api/health/ready')).json()
    expect(ready.checks).toEqual({ database: true, storage: true })
  })

  it('returns JSON errors without internals', async () => {
    const res = await app.request('/api/nope')
    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error.code).toBe('not_found')
    expect(JSON.stringify(body)).not.toMatch(/at \w+ \(|node_modules/)
  })

  it('sets security headers', async () => {
    const res = await app.request('/api/health')
    expect(res.headers.get('content-security-policy')).toContain("default-src 'self'")
    expect(res.headers.get('x-content-type-options')).toBe('nosniff')
  })
})

describe('configuration', () => {
  it('refuses test-only adapters outside the test environment', async () => {
    vi.resetModules()
    const prev = { ...process.env }
    process.env.APP_ENV = 'production'
    process.env.APP_URL = 'https://armoire.example'
    process.env.EMAIL_DRIVER = 'smtp'
    process.env.SMTP_URL = 'smtp://localhost:25'
    await expect(import('../../server/config')).rejects.toThrow(/only allowed when APP_ENV=test/)
    process.env = prev
    vi.resetModules()
  })
})
