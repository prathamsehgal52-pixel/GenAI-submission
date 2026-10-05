import { eq } from 'drizzle-orm'
import { Hono } from 'hono'
import { z } from 'zod'
import { CONSENT_VERSION, onboardingSchema, profileUpdateSchema } from '../../shared/schemas'
import { config, integrations } from '../config'
import { auth } from '../auth'
import { isAdmin, requireUser, type Env } from '../context'
import { db, schema } from '../db/client'
import { AppError, parseJson, parseQuery } from '../http'
import { rateLimit } from '../rateLimit'
import { searchPlaces } from '../services/weather'

export const meRoutes = new Hono<Env>()
// The session probe (GET /api/me) answers signed-out visitors with { user: null }.
meRoutes.use('*', async (c, next) => {
  if (c.req.method === 'GET' && (c.req.path === '/api/me' || c.req.path === '/api/me/')) {
    const session = await auth.api.getSession({ headers: c.req.raw.headers })
    if (!session) return c.json({ user: null })
  }
  return requireUser(c, next)
})

export async function getOrCreateProfile(userId: string) {
  const [p] = await db.select().from(schema.profiles).where(eq(schema.profiles.userId, userId))
  if (p) return p
  const [created] = await db.insert(schema.profiles).values({ userId }).onConflictDoNothing().returning()
  return created ?? (await db.select().from(schema.profiles).where(eq(schema.profiles.userId, userId)))[0]
}

const publicProfile = (p: typeof schema.profiles.$inferSelect) => {
  const { userId: _u, createdAt: _c, ...rest } = p
  return rest
}

/** What the signed-in experience can offer right now (no setup details). */
export function capabilities() {
  return {
    autoTagging: integrations.ai(),
    aiStylist: integrations.ai(),
    discovery: integrations.ebay() || integrations.feed(),
    weather: config.WEATHER_ENABLED,
    email: integrations.email(),
  }
}

meRoutes.get('/', async (c) => {
  const u = c.get('user')
  const profile = await getOrCreateProfile(u.id)
  return c.json({
    user: { id: u.id, email: u.email, name: u.name, createdAt: u.createdAt },
    profile: publicProfile(profile),
    isAdmin: isAdmin(u.email),
    capabilities: capabilities(),
  })
})

meRoutes.patch('/profile', async (c) => {
  const u = c.get('user')
  const body = await parseJson(c, profileUpdateSchema)
  await getOrCreateProfile(u.id)
  const [p] = await db.update(schema.profiles).set(body).where(eq(schema.profiles.userId, u.id)).returning()
  return c.json({ profile: publicProfile(p) })
})

meRoutes.post('/onboarding', async (c) => {
  const u = c.get('user')
  const body = await parseJson(c, onboardingSchema)
  await getOrCreateProfile(u.id)
  const now = new Date()
  const [p] = await db
    .update(schema.profiles)
    .set({ ...body.profile, imageConsentAt: now, consentVersion: CONSENT_VERSION, onboardingCompletedAt: now })
    .where(eq(schema.profiles.userId, u.id))
    .returning()
  return c.json({ profile: publicProfile(p) })
})

meRoutes.patch('/name', async (c) => {
  const u = c.get('user')
  const { name } = await parseJson(c, z.object({ name: z.string().trim().min(1).max(80) }))
  await db.update(schema.user).set({ name, updatedAt: new Date() }).where(eq(schema.user.id, u.id))
  return c.json({ name })
})

meRoutes.get('/places', async (c) => {
  const u = c.get('user')
  await rateLimit(`places:${u.id}`, 30, 60)
  const { q } = parseQuery(c, z.object({ q: z.string().max(80) }))
  const places = await searchPlaces(q)
  if (places === null) throw new AppError(503, 'location_unavailable', 'Location search is unavailable right now. Please try again shortly.')
  return c.json({ places })
})

/** Machine-readable export of everything stored about the user (no images). */
meRoutes.get('/export', async (c) => {
  const u = c.get('user')
  await rateLimit(`export:${u.id}`, 5, 3600)
  const [profile, items, outfits, outfitItems, plans, recs] = await Promise.all([
    db.select().from(schema.profiles).where(eq(schema.profiles.userId, u.id)),
    db.select().from(schema.wardrobeItems).where(eq(schema.wardrobeItems.userId, u.id)),
    db.select().from(schema.outfits).where(eq(schema.outfits.userId, u.id)),
    db
      .select({ outfitId: schema.outfitItems.outfitId, itemId: schema.outfitItems.itemId, role: schema.outfitItems.role })
      .from(schema.outfitItems)
      .innerJoin(schema.outfits, eq(schema.outfits.id, schema.outfitItems.outfitId))
      .where(eq(schema.outfits.userId, u.id)),
    db.select().from(schema.outfitPlans).where(eq(schema.outfitPlans.userId, u.id)),
    db
      .select({ status: schema.productRecommendations.status, product: schema.products.title, url: schema.products.productUrl, savedAt: schema.productRecommendations.savedAt })
      .from(schema.productRecommendations)
      .innerJoin(schema.products, eq(schema.products.id, schema.productRecommendations.productId))
      .where(eq(schema.productRecommendations.userId, u.id)),
  ])
  const strip = <T extends Record<string, unknown>>(rows: T[]) => rows.map(({ imageKey: _i, thumbKey: _t, userId: _u, ...r }) => r)
  c.header('content-disposition', 'attachment; filename="armoire-export.json"')
  return c.json({
    exportedAt: new Date().toISOString(),
    account: { email: u.email, name: u.name, createdAt: u.createdAt },
    profile: strip(profile),
    wardrobe: strip(items),
    outfits: strip(outfits),
    outfitItems,
    plans: strip(plans),
    products: recs,
  })
})
