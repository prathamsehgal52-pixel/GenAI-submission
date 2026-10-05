import { and, arrayContains, asc, count, desc, eq, ilike, inArray, or, sql, type SQL } from 'drizzle-orm'
import { Hono } from 'hono'
import { z } from 'zod'
import { itemUpdateSchema } from '../../shared/schemas'
import { CATEGORIES, COLOR_FAMILIES, OCCASIONS, SEASONS } from '../../shared/taxonomy'
import { requireUser, type Env } from '../context'
import { db, schema } from '../db/client'
import { AppError, notFound, parseJson, parseQuery } from '../http'
import { rateLimit } from '../rateLimit'
import { storage } from '../storage'
import { AIError, getAI, runAI } from '../services/ai'
import { sanitizeGarment } from '../services/garments'
import { forVision, processUpload } from '../services/images'
import { activeItems, compatibleWith, deleteItem, serializeItem, toStyleItem } from '../services/wardrobe'

export const wardrobeRoutes = new Hono<Env>()
wardrobeRoutes.use('*', requireUser)

const listQuery = z.object({
  status: z.enum(['active', 'review', 'archived']).default('active'),
  category: z.enum(CATEGORIES).optional(),
  color: z.enum(COLOR_FAMILIES).optional(),
  season: z.enum(SEASONS).optional(),
  occasion: z.enum(OCCASIONS).optional(),
  favorite: z.enum(['true']).optional(),
  q: z.string().trim().max(80).optional(),
  sort: z.enum(['recent', 'name', 'oldest']).default('recent'),
  limit: z.coerce.number().int().min(1).max(120).default(60),
  offset: z.coerce.number().int().min(0).default(0),
  full: z.enum(['true']).optional(),
})

const W = schema.wardrobeItems

wardrobeRoutes.get('/', async (c) => {
  const u = c.get('user')
  const q = parseQuery(c, listQuery)
  const where: SQL[] = [eq(W.userId, u.id), eq(W.status, q.status)]
  if (q.category) where.push(eq(W.category, q.category))
  if (q.color) where.push(arrayContains(W.colors, [q.color]))
  if (q.season) where.push(arrayContains(W.seasons, [q.season]))
  if (q.occasion) where.push(arrayContains(W.occasions, [q.occasion]))
  if (q.favorite) where.push(eq(W.favorite, true))
  if (q.q) {
    const term = `%${q.q.replace(/[%_\\]/g, (m) => `\\${m}`)}%`
    where.push(
      or(
        ilike(W.name, term),
        ilike(W.subcategory, term),
        ilike(W.brand, term),
        ilike(W.notes, term),
        sql`array_to_string(${W.tags}, ' ') ilike ${term}`,
        sql`array_to_string(${W.colorNames}, ' ') ilike ${term}`,
      )!,
    )
  }
  const order = q.sort === 'name' ? [asc(W.name)] : q.sort === 'oldest' ? [asc(W.createdAt)] : [desc(W.createdAt)]
  const [rows, [{ total }]] = await Promise.all([
    db.select().from(W).where(and(...where)).orderBy(...order, asc(W.id)).limit(q.limit).offset(q.offset),
    db.select({ total: count() }).from(W).where(and(...where)),
  ])
  return c.json({ items: await Promise.all(rows.map((r) => serializeItem(r, { full: !!q.full }))), total, offset: q.offset, limit: q.limit })
})

/** Counts for filter chips, computed over the active wardrobe. */
wardrobeRoutes.get('/facets', async (c) => {
  const u = c.get('user')
  const base = and(eq(W.userId, u.id), eq(W.status, 'active'))
  const [cats, colors, seasons, occasions, statuses] = await Promise.all([
    db.select({ key: W.category, n: count() }).from(W).where(base).groupBy(W.category),
    db.execute<{ key: string; n: number }>(sql`select unnest(colors) as key, count(*)::int as n from wardrobe_items where user_id = ${u.id} and status = 'active' group by 1`),
    db.execute<{ key: string; n: number }>(sql`select unnest(seasons) as key, count(*)::int as n from wardrobe_items where user_id = ${u.id} and status = 'active' group by 1`),
    db.execute<{ key: string; n: number }>(sql`select unnest(occasions) as key, count(*)::int as n from wardrobe_items where user_id = ${u.id} and status = 'active' group by 1`),
    db.select({ key: W.status, n: count() }).from(W).where(eq(W.userId, u.id)).groupBy(W.status),
  ])
  const obj = (rows: { key: string | null; n: number }[]) => Object.fromEntries(rows.filter((r) => r.key).map((r) => [r.key, Number(r.n)]))
  return c.json({
    categories: obj(cats),
    colors: obj(colors.rows),
    seasons: obj(seasons.rows),
    occasions: obj(occasions.rows),
    statuses: obj(statuses),
  })
})

async function loadOwned(userId: string, id: string) {
  if (!z.uuid().safeParse(id).success) throw notFound('That item no longer exists.')
  const [item] = await db.select().from(W).where(and(eq(W.id, id), eq(W.userId, userId)))
  if (!item) throw notFound('That item no longer exists.')
  return item
}

wardrobeRoutes.get('/:id', async (c) => {
  const u = c.get('user')
  const item = await loadOwned(u.id, c.req.param('id'))
  const style = toStyleItem(item)
  const others = (await activeItems(u.id)).filter((o) => o.id !== item.id)
  const compatible = style ? compatibleWith(style, others.map(toStyleItem).filter((s): s is NonNullable<typeof s> => !!s)) : []
  const compatibleRows = others.filter((o) => compatible.some((s) => s.id === o.id)).slice(0, 12)
  const [{ looks }] = await db
    .select({ looks: count() })
    .from(schema.outfitItems)
    .innerJoin(schema.outfits, eq(schema.outfits.id, schema.outfitItems.outfitId))
    .where(and(eq(schema.outfitItems.itemId, item.id), eq(schema.outfits.saved, true)))
  return c.json({
    item: await serializeItem(item, { full: true }),
    pairsWithCount: compatible.length,
    pairsWith: await Promise.all(compatibleRows.map((r) => serializeItem(r))),
    savedLookCount: looks,
  })
})

wardrobeRoutes.patch('/:id', async (c) => {
  const u = c.get('user')
  const item = await loadOwned(u.id, c.req.param('id'))
  const body = await parseJson(c, itemUpdateSchema)
  if (body.status === 'active' && !(body.category ?? item.category)) {
    throw new AppError(422, 'category_required', 'Choose a category before adding this item to your wardrobe.')
  }
  const attributeFields = ['name', 'category', 'subcategory', 'colors', 'pattern', 'materialEstimate', 'styles', 'occasions', 'seasons', 'formality', 'warmth']
  const edited = new Set(item.userEditedFields)
  for (const k of Object.keys(body)) if (attributeFields.includes(k)) edited.add(k)
  const patch: Partial<typeof W.$inferInsert> = { ...body, userEditedFields: [...edited] }
  if (body.status === 'active' && item.status === 'review') patch.confirmedAt = new Date()
  if (body.colors) patch.colorNames = body.colors
  const [updated] = await db.update(W).set(patch).where(eq(W.id, item.id)).returning()
  return c.json({ item: await serializeItem(updated, { full: true }) })
})

/** Accept reviewed items into the wardrobe in one step. */
wardrobeRoutes.post('/confirm', async (c) => {
  const u = c.get('user')
  const { ids } = await parseJson(c, z.object({ ids: z.array(z.uuid()).min(1).max(100) }))
  const rows = await db.select().from(W).where(and(eq(W.userId, u.id), inArray(W.id, ids), eq(W.status, 'review')))
  const missing = rows.filter((r) => !r.category)
  if (missing.length) {
    throw new AppError(422, 'category_required', 'Some items still need a category.', { itemIds: missing.map((m) => m.id) })
  }
  if (rows.length) await db.update(W).set({ status: 'active', confirmedAt: new Date() }).where(inArray(W.id, rows.map((r) => r.id)))
  return c.json({ confirmed: rows.length })
})

wardrobeRoutes.delete('/:id', async (c) => {
  const u = c.get('user')
  await loadOwned(u.id, c.req.param('id'))
  await deleteItem(u.id, c.req.param('id'))
  return c.json({ ok: true })
})

/** Replace the photo for an item (attributes are kept). */
wardrobeRoutes.put('/:id/image', async (c) => {
  const u = c.get('user')
  const item = await loadOwned(u.id, c.req.param('id'))
  await rateLimit(`upload:${u.id}`, 120, 3600)
  const form = await c.req.parseBody()
  const file = form['file']
  if (!(file instanceof File)) throw new AppError(422, 'no_file', 'Choose a photo to upload.')
  const processed = await processUpload(Buffer.from(await file.arrayBuffer()))
  const version = Date.now().toString(36)
  const imageKey = `users/${u.id}/items/${item.id}/image-${version}.webp`
  const thumbKey = `users/${u.id}/items/${item.id}/thumb-${version}.webp`
  await storage.put(imageKey, processed.display, 'image/webp')
  await storage.put(thumbKey, processed.thumb, 'image/webp')
  const previous = [item.imageKey, item.thumbKey].filter((k): k is string => !!k && k.includes(`/items/${item.id}/`))
  const [updated] = await db.update(W).set({ imageKey, thumbKey, crop: null }).where(eq(W.id, item.id)).returning()
  await storage.deleteMany(previous)
  return c.json({ item: await serializeItem(updated, { full: true }) })
})

/**
 * Re-run garment recognition on this item's photo. Fields the user has edited
 * are never overwritten.
 */
wardrobeRoutes.post('/:id/reanalyze', async (c) => {
  const u = c.get('user')
  const item = await loadOwned(u.id, c.req.param('id'))
  if (!getAI() || !item.imageKey) throw new AppError(503, 'tagging_unavailable', 'Automatic tagging isn’t available right now. You can edit the details yourself.')
  await rateLimit(`reanalyze:${u.id}`, 20, 3600)
  let recognition
  try {
    const image = await storage.get(item.imageKey)
    recognition = await runAI('reanalyze_item', u.id, async (ai) => ai.recognizeGarments(await forVision(image)))
  } catch (err) {
    if (err instanceof AIError) {
      throw new AppError(err.code === 'quota_exceeded' ? 429 : 503, 'tagging_failed', err.code === 'quota_exceeded' ? 'You’ve reached today’s limit for automatic tagging. Try again tomorrow.' : 'We couldn’t analyse this photo just now. Please try again in a moment.')
    }
    throw err
  }
  const g = recognition.garments.sort((a, b) => b.box.w * b.box.h - a.box.w * a.box.h)[0]
  if (!g) throw new AppError(422, 'no_clothing_detected', 'We couldn’t find a garment in this photo.')
  const clean = sanitizeGarment(g)
  const { confidence, ...attrs } = clean
  const patch: Record<string, unknown> = { aiAttributes: g, aiConfidence: confidence }
  for (const [k, v] of Object.entries(attrs)) if (!item.userEditedFields.includes(k === 'colorNames' ? 'colors' : k)) patch[k] = v
  const [updated] = await db.update(W).set(patch).where(eq(W.id, item.id)).returning()
  return c.json({ item: await serializeItem(updated, { full: true }) })
})
