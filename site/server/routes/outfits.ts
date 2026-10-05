import { and, eq } from 'drizzle-orm'
import { Hono } from 'hono'
import { z } from 'zod'
import { requireUser, type Env } from '../context'
import { db, schema } from '../db/client'
import { AppError, notFound, parseJson, parseQuery } from '../http'
import { alternativesFor, loadOutfits, replaceItem } from '../services/styling'

export const outfitRoutes = new Hono<Env>()
outfitRoutes.use('*', requireUser)

const idParam = (id: string) => {
  if (!z.uuid().safeParse(id).success) throw notFound('That look no longer exists.')
  return id
}

outfitRoutes.get('/', async (c) => {
  const u = c.get('user')
  const q = parseQuery(c, z.object({ saved: z.enum(['true']).optional(), limit: z.coerce.number().int().min(1).max(100).default(60), offset: z.coerce.number().int().min(0).default(0) }))
  const outfits = await loadOutfits(u.id, { saved: true, limit: q.limit, offset: q.offset })
  return c.json({ outfits })
})

outfitRoutes.get('/:id', async (c) => {
  const u = c.get('user')
  const [outfit] = await loadOutfits(u.id, { ids: [idParam(c.req.param('id'))] })
  if (!outfit) throw notFound('That look no longer exists.')
  const plans = await db
    .select({ id: schema.outfitPlans.id, date: schema.outfitPlans.date, worn: schema.outfitPlans.worn })
    .from(schema.outfitPlans)
    .where(and(eq(schema.outfitPlans.outfitId, outfit.id), eq(schema.outfitPlans.userId, u.id)))
  return c.json({ outfit, plans })
})

async function setSaved(userId: string, id: string, saved: boolean) {
  const [row] = await db
    .update(schema.outfits)
    .set({ saved, savedAt: saved ? new Date() : null })
    .where(and(eq(schema.outfits.id, idParam(id)), eq(schema.outfits.userId, userId)))
    .returning({ id: schema.outfits.id })
  if (!row) throw notFound('That look no longer exists.')
}

outfitRoutes.post('/:id/save', async (c) => {
  await setSaved(c.get('user').id, c.req.param('id'), true)
  return c.json({ saved: true })
})

outfitRoutes.delete('/:id/save', async (c) => {
  await setSaved(c.get('user').id, c.req.param('id'), false)
  return c.json({ saved: false })
})

outfitRoutes.post('/:id/feedback', async (c) => {
  const u = c.get('user')
  const { value } = await parseJson(c, z.object({ value: z.union([z.literal(-1), z.literal(0), z.literal(1)]) }))
  const [row] = await db
    .update(schema.outfits)
    .set({ feedback: value })
    .where(and(eq(schema.outfits.id, idParam(c.req.param('id'))), eq(schema.outfits.userId, u.id)))
    .returning({ id: schema.outfits.id })
  if (!row) throw notFound('That look no longer exists.')
  return c.json({ feedback: value })
})

outfitRoutes.get('/:id/alternatives', async (c) => {
  const u = c.get('user')
  const { itemId } = parseQuery(c, z.object({ itemId: z.uuid() }))
  const options = await alternativesFor(u.id, idParam(c.req.param('id')), itemId)
  if (!options) throw notFound('That look or piece no longer exists.')
  return c.json({ alternatives: options })
})

outfitRoutes.post('/:id/replace', async (c) => {
  const u = c.get('user')
  const body = await parseJson(c, z.object({ itemId: z.uuid(), withItemId: z.uuid() }))
  const outfit = await replaceItem(u.id, idParam(c.req.param('id')), body.itemId, body.withItemId)
  if (!outfit) throw new AppError(422, 'invalid_replacement', 'That piece can’t be swapped in here. Choose another item of the same type.')
  return c.json({ outfit })
})

outfitRoutes.delete('/:id', async (c) => {
  const u = c.get('user')
  const [row] = await db
    .delete(schema.outfits)
    .where(and(eq(schema.outfits.id, idParam(c.req.param('id'))), eq(schema.outfits.userId, u.id)))
    .returning({ id: schema.outfits.id })
  if (!row) throw notFound('That look no longer exists.')
  return c.json({ ok: true })
})
