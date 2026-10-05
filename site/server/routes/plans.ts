import { and, asc, eq, gte, lte } from 'drizzle-orm'
import { Hono } from 'hono'
import { z } from 'zod'
import { planCreateSchema } from '../../shared/schemas'
import { requireUser, type Env } from '../context'
import { db, schema } from '../db/client'
import { notFound, parseJson, parseQuery } from '../http'
import { loadOutfits } from '../services/styling'
import { getForecast } from '../services/weather'
import { getOrCreateProfile } from './me'

export const planRoutes = new Hono<Env>()
planRoutes.use('*', requireUser)

planRoutes.get('/', async (c) => {
  const u = c.get('user')
  const q = parseQuery(c, z.object({ from: z.iso.date(), to: z.iso.date() }))
  const rows = await db
    .select()
    .from(schema.outfitPlans)
    .where(and(eq(schema.outfitPlans.userId, u.id), gte(schema.outfitPlans.date, q.from), lte(schema.outfitPlans.date, q.to)))
    .orderBy(asc(schema.outfitPlans.date), asc(schema.outfitPlans.createdAt))
  const outfits = await loadOutfits(u.id, { ids: [...new Set(rows.map((r) => r.outfitId))] })
  const byId = new Map(outfits.map((o) => [o.id, o]))
  const profile = await getOrCreateProfile(u.id)
  const forecast =
    profile.latitude != null && profile.longitude != null ? await getForecast(profile.latitude, profile.longitude, profile.locationName ?? '') : null
  return c.json({
    plans: rows.filter((r) => byId.has(r.outfitId)).map((r) => ({ id: r.id, date: r.date, occasion: r.occasion, note: r.note, worn: r.worn, outfit: byId.get(r.outfitId)! })),
    forecast: forecast?.days.filter((d) => d.date >= q.from && d.date <= q.to) ?? [],
  })
})

planRoutes.post('/', async (c) => {
  const u = c.get('user')
  const body = await parseJson(c, planCreateSchema)
  const [outfit] = await db
    .select({ id: schema.outfits.id })
    .from(schema.outfits)
    .where(and(eq(schema.outfits.id, body.outfitId), eq(schema.outfits.userId, u.id)))
  if (!outfit) throw notFound('That look no longer exists.')
  // Planning a look keeps it: it is saved so it stays in Saved looks.
  await db.update(schema.outfits).set({ saved: true, savedAt: new Date() }).where(and(eq(schema.outfits.id, outfit.id), eq(schema.outfits.saved, false)))
  const [plan] = await db
    .insert(schema.outfitPlans)
    .values({ userId: u.id, outfitId: outfit.id, date: body.date, occasion: body.occasion ?? null, note: body.note ?? null })
    .returning()
  return c.json({ plan }, 201)
})

planRoutes.patch('/:id', async (c) => {
  const u = c.get('user')
  const body = await parseJson(c, z.object({ worn: z.boolean().optional(), date: z.iso.date().optional(), note: z.string().trim().max(200).nullable().optional() }))
  const id = c.req.param('id')
  if (!z.uuid().safeParse(id).success) throw notFound()
  const [plan] = await db
    .update(schema.outfitPlans)
    .set(body)
    .where(and(eq(schema.outfitPlans.id, id), eq(schema.outfitPlans.userId, u.id)))
    .returning()
  if (!plan) throw notFound('That plan no longer exists.')
  return c.json({ plan })
})

planRoutes.delete('/:id', async (c) => {
  const u = c.get('user')
  const id = c.req.param('id')
  if (!z.uuid().safeParse(id).success) throw notFound()
  const [row] = await db
    .delete(schema.outfitPlans)
    .where(and(eq(schema.outfitPlans.id, id), eq(schema.outfitPlans.userId, u.id)))
    .returning({ id: schema.outfitPlans.id })
  if (!row) throw notFound('That plan no longer exists.')
  return c.json({ ok: true })
})
