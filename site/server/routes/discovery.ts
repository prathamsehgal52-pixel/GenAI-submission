import { and, asc, desc, eq, inArray, sql, type SQL } from 'drizzle-orm'
import { Hono } from 'hono'
import { z } from 'zod'
import { CATEGORIES } from '../../shared/taxonomy'
import { requireUser, type Env } from '../context'
import { db, schema } from '../db/client'
import { AppError, notFound, parseQuery } from '../http'
import { enqueue, QUEUES } from '../jobs/queue'
import { rateLimit } from '../rateLimit'
import { createRun, discoveryAvailable } from '../services/discovery'
import { ownedItems, serializeItem } from '../services/wardrobe'

export const discoveryRoutes = new Hono<Env>()
discoveryRoutes.use('*', requireUser)

const R = schema.productRecommendations
const P = schema.products

type Row = { rec: typeof R.$inferSelect; product: typeof P.$inferSelect }

async function serialize(userId: string, rows: Row[], pairLimit = 4) {
  const ids = [...new Set(rows.flatMap((r) => r.rec.pairsWith.slice(0, pairLimit)))]
  const items = await ownedItems(userId, ids)
  const active = new Map(items.filter((i) => i.status === 'active').map((i) => [i.id, i]))
  const serialized = new Map(await Promise.all([...active.values()].map(async (i) => [i.id, await serializeItem(i)] as const)))
  return rows.map(({ rec, product }) => ({
    id: rec.id,
    status: rec.status,
    score: Math.round(rec.score * 100) / 100,
    reasons: rec.reasons,
    pairCount: rec.pairCount,
    gapCategory: rec.gapCategory,
    savedAt: rec.savedAt,
    createdAt: rec.createdAt,
    pairsWith: rec.pairsWith.slice(0, pairLimit).map((id) => serialized.get(id)).filter(Boolean),
    product: {
      id: product.id,
      title: product.title,
      brand: product.brand,
      retailer: product.retailer,
      imageUrl: product.imageUrl,
      productUrl: product.productUrl,
      price: product.priceAmount != null ? { amount: Number(product.priceAmount), currency: product.currency } : null,
      category: product.category,
      colors: product.colors,
      condition: product.condition,
      availability: product.availability,
      sizes: product.sizes,
      provider: product.provider,
      attribution: product.attribution,
      lastVerifiedAt: product.lastVerifiedAt,
    },
  }))
}

discoveryRoutes.get('/', async (c) => {
  const u = c.get('user')
  const q = parseQuery(
    c,
    z.object({
      status: z.enum(['new', 'saved', 'dismissed']).default('new'),
      category: z.enum(CATEGORIES).optional(),
      sort: z.enum(['match', 'price_asc', 'price_desc', 'newest']).default('match'),
      limit: z.coerce.number().int().min(1).max(60).default(30),
      offset: z.coerce.number().int().min(0).default(0),
    }),
  )
  const where: SQL[] = [eq(R.userId, u.id), eq(R.status, q.status)]
  if (q.category) where.push(eq(P.category, q.category))
  const order =
    q.sort === 'price_asc'
      ? [sql`${P.priceAmount} asc nulls last`]
      : q.sort === 'price_desc'
        ? [sql`${P.priceAmount} desc nulls last`]
        : q.sort === 'newest'
          ? [desc(R.createdAt)]
          : q.status === 'saved'
            ? [desc(R.savedAt)]
            : [desc(R.score)]
  const rows = await db
    .select({ rec: R, product: P })
    .from(R)
    .innerJoin(P, eq(P.id, R.productId))
    .where(and(...where))
    .orderBy(...order, asc(R.id))
    .limit(q.limit)
    .offset(q.offset)
  const [latest] = await db
    .select()
    .from(schema.discoveryRuns)
    .where(eq(schema.discoveryRuns.userId, u.id))
    .orderBy(desc(schema.discoveryRuns.createdAt))
    .limit(1)
  return c.json({
    available: discoveryAvailable(),
    recommendations: await serialize(u.id, rows),
    latestRun: latest ? { id: latest.id, status: latest.status, errorCode: latest.errorCode, finishedAt: latest.finishedAt, createdAt: latest.createdAt, recommendationsCreated: latest.recommendationsCreated } : null,
  })
})

discoveryRoutes.post('/refresh', async (c) => {
  const u = c.get('user')
  if (!discoveryAvailable()) throw new AppError(503, 'discovery_unavailable', 'New finds aren’t available right now. Please check back later.')
  const [running] = await db
    .select()
    .from(schema.discoveryRuns)
    .where(and(eq(schema.discoveryRuns.userId, u.id), inArray(schema.discoveryRuns.status, ['queued', 'running']), sql`${schema.discoveryRuns.createdAt} > now() - interval '15 minutes'`))
    .limit(1)
  if (running) return c.json({ run: { id: running.id, status: running.status } })
  await rateLimit(`discovery:${u.id}`, 8, 24 * 3600)
  const run = await createRun(u.id, 'manual')
  await enqueue(QUEUES.discovery, { userId: u.id, runId: run.id }, { singletonKey: `discovery:${u.id}` })
  const [fresh] = await db.select().from(schema.discoveryRuns).where(eq(schema.discoveryRuns.id, run.id))
  return c.json({ run: { id: fresh.id, status: fresh.status, errorCode: fresh.errorCode } }, 202)
})

discoveryRoutes.get('/runs/:id', async (c) => {
  const u = c.get('user')
  const id = c.req.param('id')
  if (!z.uuid().safeParse(id).success) throw notFound()
  const [run] = await db.select().from(schema.discoveryRuns).where(and(eq(schema.discoveryRuns.id, id), eq(schema.discoveryRuns.userId, u.id)))
  if (!run) throw notFound()
  return c.json({ run: { id: run.id, status: run.status, errorCode: run.errorCode, recommendationsCreated: run.recommendationsCreated, finishedAt: run.finishedAt } })
})

async function loadRec(userId: string, id: string) {
  if (!z.uuid().safeParse(id).success) throw notFound('That find is no longer available.')
  const [row] = await db.select({ rec: R, product: P }).from(R).innerJoin(P, eq(P.id, R.productId)).where(and(eq(R.id, id), eq(R.userId, userId)))
  if (!row) throw notFound('That find is no longer available.')
  return row
}

discoveryRoutes.get('/:id', async (c) => {
  const u = c.get('user')
  const row = await loadRec(u.id, c.req.param('id'))
  const [rec] = await serialize(u.id, [row], 12)
  return c.json({ recommendation: rec })
})

async function setStatus(userId: string, id: string, status: 'new' | 'saved' | 'dismissed') {
  await loadRec(userId, id)
  await db
    .update(R)
    .set({ status, savedAt: status === 'saved' ? new Date() : null })
    .where(and(eq(R.id, id), eq(R.userId, userId)))
}

discoveryRoutes.post('/:id/save', async (c) => {
  await setStatus(c.get('user').id, c.req.param('id'), 'saved')
  return c.json({ status: 'saved' })
})
discoveryRoutes.delete('/:id/save', async (c) => {
  await setStatus(c.get('user').id, c.req.param('id'), 'new')
  return c.json({ status: 'new' })
})
discoveryRoutes.post('/:id/dismiss', async (c) => {
  await setStatus(c.get('user').id, c.req.param('id'), 'dismissed')
  return c.json({ status: 'dismissed' })
})
discoveryRoutes.post('/:id/restore', async (c) => {
  await setStatus(c.get('user').id, c.req.param('id'), 'new')
  return c.json({ status: 'new' })
})
