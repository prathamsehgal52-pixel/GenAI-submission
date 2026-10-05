import { and, desc, eq, ilike, inArray, isNull, lt, ne, sql } from 'drizzle-orm'
import { pairCompatibility, type StyleItem } from '../../shared/styling'
import { CATEGORY_SINGULAR, NEUTRALS, type Category, type ColorFamily, type Pattern } from '../../shared/taxonomy'
import { config, integrations } from '../config'
import { db, schema } from '../db/client'
import type { RecommendationReason } from '../db/schema'
import { logger } from '../logger'
import { getOrCreateProfile } from '../routes/me'
import { getAI, runAI } from './ai'
import { esc, layout, sendEmail } from './email'
import { markIntegration } from './integrationStatus'
import { extractAttributes } from './products/attributes'
import { EbayProvider } from './products/ebay'
import { fetchFeed } from './products/feed'
import { FixtureProductProvider } from './products/fixture'
import type { ProductListing, SearchProvider } from './products/types'
import { activeItems, toStyleItem } from './wardrobe'

type Product = typeof schema.products.$inferSelect
type Profile = Awaited<ReturnType<typeof getOrCreateProfile>>

let searchProviders: SearchProvider[] | null = null
export function getSearchProviders(): SearchProvider[] {
  if (searchProviders) return searchProviders
  searchProviders = []
  if (integrations.ebay()) searchProviders.push(new EbayProvider())
  if (config.APP_ENV === 'test' && config.PRODUCT_PROVIDERS.includes('fixture')) searchProviders.push(new FixtureProductProvider())
  return searchProviders
}

export const discoveryAvailable = () => getSearchProviders().length > 0 || integrations.feed()

/* ───────────────────────── Query planning ───────────────────────── */

const TARGET: Record<Category, number> = { top: 5, bottom: 3, dress: 1, outerwear: 2, shoes: 3, bag: 1, accessory: 1 }

const SUGGESTIONS: Record<Category, Record<string, string[]>> = {
  outerwear: { default: ['trench coat', 'wool coat', 'denim jacket'], minimal: ['wool coat', 'trench coat'], edgy: ['leather jacket'], sporty: ['lightweight puffer jacket'], tailored: ['tailored blazer'] },
  shoes: { default: ['leather loafers', 'white sneakers', 'ankle boots'], sporty: ['white sneakers'], romantic: ['ballet flats'], edgy: ['leather boots'], tailored: ['leather loafers'] },
  bag: { default: ['leather tote bag', 'crossbody bag'], minimal: ['leather tote bag'], street: ['crossbody bag'] },
  top: { default: ['cotton shirt', 'knit sweater', 'striped t-shirt'], minimal: ['cashmere sweater', 'white shirt'], romantic: ['silk blouse'], relaxed: ['linen shirt'] },
  bottom: { default: ['straight leg jeans', 'wide leg trousers'], tailored: ['pleated trousers'], relaxed: ['wide leg trousers'], romantic: ['midi skirt'] },
  dress: { default: ['midi dress'], minimal: ['slip dress'], romantic: ['floral midi dress'], classic: ['shirt dress'] },
  accessory: { default: ['leather belt', 'silk scarf'], classic: ['leather belt'] },
}

const COLOR_WORD: Partial<Record<ColorFamily, string>> = { beige: 'camel', brown: 'brown', black: 'black', white: 'white', grey: 'grey', navy: 'navy', olive: 'olive', burgundy: 'burgundy' }

export function planQueries(profile: Pick<Profile, 'department' | 'preferredStyles' | 'favoriteColors' | 'avoidColors'>, items: StyleItem[], max: number) {
  const dept = profile.department === 'womens' ? "women's " : profile.department === 'mens' ? "men's " : ''
  const counts = new Map<Category, number>()
  items.forEach((i) => counts.set(i.category, (counts.get(i.category) ?? 0) + 1))
  const gaps = (Object.keys(TARGET) as Category[])
    .filter((c) => !(profile.department === 'mens' && c === 'dress'))
    .map((c) => ({ c, deficit: TARGET[c] - (counts.get(c) ?? 0) }))
    .sort((a, b) => b.deficit - a.deficit)

  // Colour: a neutral wardrobe can take an accent the user likes; a colourful one benefits from neutrals.
  const chromatic = items.filter((i) => i.colors[0] && !NEUTRALS.has(i.colors[0])).length
  const avoid = new Set(profile.avoidColors)
  const accent = (profile.favoriteColors as ColorFamily[]).find((c) => !avoid.has(c))
  const neutral = (['beige', 'black', 'white', 'navy', 'grey', 'brown'] as ColorFamily[]).find((c) => !avoid.has(c)) ?? 'black'
  const colorFor = (i: number) => (chromatic / Math.max(1, items.length) < 0.25 && accent && i % 2 === 1 ? accent : neutral)

  const style = profile.preferredStyles[0] ?? 'default'
  const queries: { text: string; category: Category }[] = []
  for (const [i, g] of gaps.entries()) {
    if (queries.length >= max) break
    if (g.deficit <= 0 && queries.length >= 2) break
    const options = SUGGESTIONS[g.c][style] ?? SUGGESTIONS[g.c].default
    const term = options[i % options.length]
    const color = COLOR_WORD[colorFor(i)] ?? colorFor(i)
    queries.push({ text: `${dept}${color} ${term}`.trim(), category: g.c })
  }
  return queries
}

/* ───────────────────────── Matching ───────────────────────── */

export function productStyleItem(p: Pick<Product, 'id' | 'category' | 'colors' | 'pattern' | 'formality' | 'styles'>): StyleItem | null {
  if (!p.category || p.category === 'other') return null
  return {
    id: p.id,
    category: p.category as Category,
    colors: p.colors as ColorFamily[],
    pattern: (p.pattern ?? 'solid') as Pattern,
    formality: p.formality ?? 3,
    warmth: 2,
    seasons: [],
    occasions: [],
    styles: p.styles,
  }
}

export type Match = { score: number; reasons: RecommendationReason[]; pairsWith: string[]; pairCount: number; gapCategory: string | null }

/**
 * Explainable product-to-wardrobe matching. Every number in the reasons is
 * computed from the user's stored items with the shared pairing rules.
 */
export function matchProduct(
  p: Pick<Product, 'id' | 'category' | 'colors' | 'pattern' | 'formality' | 'styles' | 'priceAmount' | 'subcategory'>,
  wardrobe: { item: StyleItem; name: string; subcategory: string | null }[],
  profile: Pick<Profile, 'preferredStyles' | 'avoidColors' | 'budgetMin' | 'budgetMax'>,
): Match | null {
  const ps = productStyleItem(p)
  if (!ps) return null
  if (ps.colors.some((c) => profile.avoidColors.includes(c))) return null
  const price = p.priceAmount != null ? Number(p.priceAmount) : null
  if (price != null && profile.budgetMax != null && price > profile.budgetMax * 1.15) return null

  const reasons: RecommendationReason[] = []
  const pairs = wardrobe.filter((w) => pairCompatibility(ps, w.item).compatible)
  const pairCount = pairs.length
  if (pairCount > 0) {
    const named = pairs.slice(0, 2).map((w) => `your ${w.name.toLowerCase()}`)
    reasons.push({ kind: 'complements', text: `Pairs with ${pairCount} ${pairCount === 1 ? 'item' : 'items'} in your wardrobe, including ${named.join(' and ')}.` })
  }

  const sameCategory = wardrobe.filter((w) => w.item.category === ps.category)
  let gap = 0
  let gapCategory: string | null = null
  const label = CATEGORY_SINGULAR[ps.category].toLowerCase()
  if (sameCategory.length === 0) {
    gap = 1
    gapCategory = ps.category
    reasons.push({ kind: 'gap', text: `Fills a gap: you don't have any ${ps.category === 'shoes' ? 'shoes' : label + (label.endsWith('s') ? '' : 's')} yet.` })
  } else if (sameCategory.length < Math.ceil(TARGET[ps.category] / 2)) {
    gap = 0.6
    gapCategory = ps.category
    reasons.push({ kind: 'gap', text: `Adds another ${label} option; you have ${sameCategory.length}.` })
  }

  const duplicate = sameCategory.some(
    (w) => w.item.colors[0] === ps.colors[0] && w.subcategory && p.subcategory && w.subcategory.toLowerCase() === p.subcategory.toLowerCase(),
  )

  const styleHit = ps.styles.find((s) => profile.preferredStyles.includes(s))
  if (styleHit) reasons.push({ kind: 'style', text: `Fits the ${styleHit} style in your profile.` })

  let budget = 0.5
  if (price != null && (profile.budgetMin != null || profile.budgetMax != null)) {
    const within = (profile.budgetMin == null || price >= profile.budgetMin) && (profile.budgetMax == null || price <= profile.budgetMax)
    budget = within ? 1 : 0.2
    if (within) reasons.push({ kind: 'budget', text: 'Within your budget.' })
  }

  const neutral = ps.colors[0] ? NEUTRALS.has(ps.colors[0]) : false
  if (neutral && pairCount >= 5) reasons.push({ kind: 'versatile', text: 'A versatile neutral that layers with much of what you own.' })

  if (pairCount === 0 && gap === 0) return null
  const score = Math.max(0, 0.45 * Math.min(1, pairCount / 8) + 0.2 * gap + 0.15 * (styleHit ? 1 : 0) + 0.1 * budget + 0.1 * (neutral ? 1 : 0.5) - (duplicate ? 0.25 : 0))
  return { score, reasons, pairsWith: pairs.slice(0, 12).map((w) => w.item.id), pairCount, gapCategory }
}

/* ───────────────────────── Catalogue storage ───────────────────────── */

export async function upsertListings(listings: ProductListing[]) {
  if (!listings.length) return [] as Product[]
  const now = new Date()
  const rows = listings.map((l) => {
    const attrs = extractAttributes(l.title, { color: l.colorHint, category: l.categoryHint })
    return {
      provider: l.provider,
      externalId: l.externalId,
      title: l.title,
      brand: l.brand,
      retailer: l.retailer,
      imageUrl: l.imageUrl,
      productUrl: l.productUrl,
      priceAmount: l.price ? l.price.amount.toFixed(2) : null,
      currency: l.price?.currency ?? null,
      category: attrs.category,
      colors: attrs.colors,
      styles: attrs.styles,
      pattern: attrs.pattern,
      formality: attrs.formality,
      sizes: l.sizes,
      condition: l.condition,
      availability: l.availability,
      attribution: l.attribution,
      lastVerifiedAt: now,
    }
  })
  const out: Product[] = []
  for (let i = 0; i < rows.length; i += 200) {
    const chunk = rows.slice(i, i + 200)
    const res = await db
      .insert(schema.products)
      .values(chunk)
      .onConflictDoUpdate({
        target: [schema.products.provider, schema.products.externalId],
        set: {
          title: sql`excluded.title`,
          imageUrl: sql`excluded.image_url`,
          productUrl: sql`excluded.product_url`,
          priceAmount: sql`excluded.price_amount`,
          currency: sql`excluded.currency`,
          availability: sql`excluded.availability`,
          retailer: sql`excluded.retailer`,
          lastVerifiedAt: sql`excluded.last_verified_at`,
          updatedAt: now,
        },
      })
      .returning()
    out.push(...res)
  }
  return out
}

/** Optional AI pass for listings the rules couldn't place (cached on the row). */
async function refineUnclassified(products: Product[], userId: string) {
  const todo = products.filter((p) => !p.category && p.attributesSource === 'listing').slice(0, 50)
  if (!todo.length || !getAI()) return products
  try {
    const result = await runAI('classify_products', userId, (ai) => ai.classifyProducts(todo.map((p) => ({ id: p.id, title: p.title, hints: p.retailer ?? '' }))))
    const byId = new Map(result.products.map((r) => [r.id, r]))
    for (const p of todo) {
      const r = byId.get(p.id)
      if (!r) continue
      const patch = {
        category: r.category,
        subcategory: r.subcategory.slice(0, 60) || null,
        colors: r.colors.slice(0, 2),
        pattern: r.pattern,
        formality: Math.min(5, Math.max(1, Math.round(r.formality))),
        styles: r.styles,
        attributesSource: 'ai',
      }
      await db.update(schema.products).set(patch).where(eq(schema.products.id, p.id))
      Object.assign(p, patch)
    }
  } catch (err) {
    logger.warn({ err: String(err) }, 'product classification skipped')
  }
  return products
}

/* ───────────────────────── Runs ───────────────────────── */

export async function createRun(userId: string, trigger: 'manual' | 'scheduled') {
  const [run] = await db.insert(schema.discoveryRuns).values({ userId, trigger }).returning()
  return run
}

/** Background job: search sources, match against the wardrobe, store recommendations. */
export async function runDiscovery(userId: string, runId: string) {
  const [run] = await db.select().from(schema.discoveryRuns).where(eq(schema.discoveryRuns.id, runId))
  if (!run || run.status === 'complete') return
  const finish = (patch: Partial<typeof schema.discoveryRuns.$inferInsert>) =>
    db.update(schema.discoveryRuns).set({ finishedAt: new Date(), ...patch }).where(eq(schema.discoveryRuns.id, runId))

  if (!discoveryAvailable()) return finish({ status: 'unavailable', errorCode: 'no_provider' })
  await db.update(schema.discoveryRuns).set({ status: 'running', startedAt: new Date() }).where(eq(schema.discoveryRuns.id, runId))

  const profile = await getOrCreateProfile(userId)
  const rows = await activeItems(userId)
  const wardrobe = rows
    .map((r) => ({ item: toStyleItem(r), name: r.name || r.subcategory || 'piece', subcategory: r.subcategory }))
    .filter((w): w is { item: StyleItem; name: string; subcategory: string | null } => !!w.item)
  if (wardrobe.length < 3) return finish({ status: 'complete', errorCode: 'wardrobe_too_small' })

  const queries = planQueries(profile, wardrobe.map((w) => w.item), config.DISCOVERY_MAX_QUERIES_PER_USER)
  const found = new Map<string, Product>()
  let providerErrors = 0
  for (const q of queries) {
    for (const provider of getSearchProviders()) {
      try {
        const listings = await provider.search({ text: q.text, priceMin: profile.budgetMin, priceMax: profile.budgetMax, currency: profile.currency, limit: 30 })
        const stored = await upsertListings(listings)
        stored.forEach((p) => found.set(p.id, p))
        await markIntegration(provider.name, true)
      } catch (err) {
        providerErrors++
        await markIntegration(provider.name, false, String((err as Error).message))
        logger.warn({ provider: provider.name, err: String(err) }, 'product search failed')
      }
    }
    if (integrations.feed()) {
      const words = q.text.replace(/women's|men's/g, '').split(/\s+/).filter((w) => w.length > 2)
      const feedRows = await db
        .select()
        .from(schema.products)
        .where(and(eq(schema.products.provider, 'feed'), ...words.slice(-2).map((w) => ilike(schema.products.title, `%${w}%`)), ne(schema.products.availability, 'out_of_stock')))
        .limit(40)
      feedRows.forEach((p) => found.set(p.id, p))
    }
  }

  const products = await refineUnclassified([...found.values()], userId)
  const existing = await db
    .select({ productId: schema.productRecommendations.productId, status: schema.productRecommendations.status })
    .from(schema.productRecommendations)
    .where(eq(schema.productRecommendations.userId, userId))
  const dismissed = new Set(existing.filter((e) => e.status === 'dismissed').map((e) => e.productId))

  let created = 0
  for (const p of products) {
    if (dismissed.has(p.id)) continue
    const m = matchProduct(p, wardrobe, profile)
    if (!m || m.score < 0.3) continue
    const res = await db
      .insert(schema.productRecommendations)
      .values({ userId, productId: p.id, runId, score: m.score, reasons: m.reasons, pairsWith: m.pairsWith, pairCount: m.pairCount, gapCategory: m.gapCategory, query: null })
      .onConflictDoUpdate({
        target: [schema.productRecommendations.userId, schema.productRecommendations.productId],
        set: { score: m.score, reasons: m.reasons, pairsWith: m.pairsWith, pairCount: m.pairCount, gapCategory: m.gapCategory, runId, updatedAt: new Date() },
      })
      .returning({ createdAt: schema.productRecommendations.createdAt, updatedAt: schema.productRecommendations.updatedAt })
    if (res[0] && Math.abs(res[0].createdAt.getTime() - res[0].updatedAt.getTime()) < 1000) created++
  }

  // Hide unsaved suggestions whose listing hasn't been re-verified recently.
  const stale = new Date(Date.now() - 7 * 24 * 3600 * 1000)
  await db.execute(sql`
    DELETE FROM product_recommendations r USING products p
    WHERE r.product_id = p.id AND r.user_id = ${userId} AND r.status = 'new' AND p.last_verified_at < ${stale}`)

  const allFailed = providerErrors > 0 && found.size === 0 && getSearchProviders().length > 0
  await finish({ status: allFailed ? 'failed' : 'complete', queries: queries.map((q) => q.text), productsFound: found.size, recommendationsCreated: created, errorCode: allFailed ? 'provider_error' : null })
  if (run.trigger === 'scheduled' && created > 0) await maybeNotify(userId)
}

/** Weekly-at-most email digest of strong new matches, only when opted in. */
async function maybeNotify(userId: string) {
  const profile = await getOrCreateProfile(userId)
  if (!profile.notifyDiscoveriesEmail || !integrations.email()) return
  const [last] = await db
    .select({ at: schema.notificationDeliveries.createdAt })
    .from(schema.notificationDeliveries)
    .where(and(eq(schema.notificationDeliveries.userId, userId), eq(schema.notificationDeliveries.kind, 'discovery_digest'), eq(schema.notificationDeliveries.status, 'sent')))
    .orderBy(desc(schema.notificationDeliveries.createdAt))
    .limit(1)
  if (last && Date.now() - last.at.getTime() < 6.5 * 24 * 3600 * 1000) return
  const recs = await db
    .select({ id: schema.productRecommendations.id, title: schema.products.title, pairCount: schema.productRecommendations.pairCount })
    .from(schema.productRecommendations)
    .innerJoin(schema.products, eq(schema.products.id, schema.productRecommendations.productId))
    .where(and(eq(schema.productRecommendations.userId, userId), eq(schema.productRecommendations.status, 'new'), isNull(schema.productRecommendations.notifiedAt), sql`${schema.productRecommendations.score} >= 0.55`))
    .orderBy(desc(schema.productRecommendations.score))
    .limit(4)
  if (!recs.length) return
  const [u] = await db.select({ email: schema.user.email, name: schema.user.name }).from(schema.user).where(eq(schema.user.id, userId))
  try {
    await sendEmail({
      to: u.email,
      subject: `${recs.length} new ${recs.length === 1 ? 'piece' : 'pieces'} that work with your wardrobe`,
      text: recs.map((r) => `• ${r.title}: pairs with ${r.pairCount} of your items`).join('\n') + `\n\n${config.APP_URL}/app/discover`,
      html: layout(
        'New finds for your wardrobe',
        `<ul style="padding-left:18px;font-size:15px;line-height:1.6;color:#55595e">${recs.map((r) => `<li>${esc(r.title)}: pairs with ${r.pairCount} of your items</li>`).join('')}</ul>`,
        { label: 'See your finds', url: `${config.APP_URL}/app/discover` },
      ),
    })
    await db.update(schema.productRecommendations).set({ notifiedAt: new Date() }).where(inArray(schema.productRecommendations.id, recs.map((r) => r.id)))
    await db.insert(schema.notificationDeliveries).values({ userId, channel: 'email', kind: 'discovery_digest', status: 'sent', detail: { count: recs.length } })
  } catch (err) {
    await db.insert(schema.notificationDeliveries).values({ userId, channel: 'email', kind: 'discovery_digest', status: 'failed', detail: { error: String(err).slice(0, 200) } })
  }
}

/** Scheduled: import feeds, then queue a refresh for each eligible user. */
export async function sweepEligibleUsers() {
  if (integrations.feed()) {
    for (const url of config.PRODUCT_FEED_URLS) {
      try {
        const listings = await fetchFeed(url)
        await upsertListings(listings)
        await markIntegration('feed', true)
      } catch (err) {
        await markIntegration('feed', false, String((err as Error).message))
        logger.warn({ err: String(err) }, 'feed import failed')
      }
    }
  }
  const since = new Date(Date.now() - 20 * 3600 * 1000)
  const eligible = await db.execute<{ user_id: string }>(sql`
    SELECT p.user_id FROM profiles p
    WHERE p.onboarding_completed_at IS NOT NULL
      AND (SELECT count(*) FROM wardrobe_items w WHERE w.user_id = p.user_id AND w.status = 'active') >= 3
      AND NOT EXISTS (SELECT 1 FROM discovery_runs r WHERE r.user_id = p.user_id AND r.created_at > ${since})
    LIMIT 5000`)
  return eligible.rows.map((r) => r.user_id)
}

export async function pruneOldRuns() {
  await db.delete(schema.discoveryRuns).where(lt(schema.discoveryRuns.createdAt, new Date(Date.now() - 30 * 24 * 3600 * 1000)))
}
