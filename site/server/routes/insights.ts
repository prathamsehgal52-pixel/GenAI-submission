import { and, eq, gte, sql } from 'drizzle-orm'
import { Hono } from 'hono'
import { pairCompatibility, type StyleItem } from '../../shared/styling'
import { CATEGORIES, type Category } from '../../shared/taxonomy'
import { requireUser, type Env } from '../context'
import { db, schema } from '../db/client'
import { activeItems, serializeItem, toStyleItem } from '../services/wardrobe'

export const insightsRoutes = new Hono<Env>()
insightsRoutes.use('*', requireUser)

/**
 * Wardrobe insights. "measured" values come from recorded activity (saved
 * looks, planned and worn outfits); "calculated" values come from the
 * pairing rules applied to stored attributes; "suggestions" are inferences.
 */
insightsRoutes.get('/', async (c) => {
  const u = c.get('user')
  const rows = await activeItems(u.id)
  const styled = rows.map((r) => ({ row: r, s: toStyleItem(r) })).filter((x): x is { row: typeof x.row; s: StyleItem } => !!x.s)

  const since = new Date(Date.now() - 60 * 24 * 3600 * 1000).toISOString().slice(0, 10)
  const [savedUse, wornUse, totals] = await Promise.all([
    db
      .select({ itemId: schema.outfitItems.itemId, n: sql<number>`count(*)::int` })
      .from(schema.outfitItems)
      .innerJoin(schema.outfits, eq(schema.outfits.id, schema.outfitItems.outfitId))
      .where(and(eq(schema.outfits.userId, u.id), eq(schema.outfits.saved, true)))
      .groupBy(schema.outfitItems.itemId),
    db
      .select({ itemId: schema.outfitItems.itemId, n: sql<number>`count(*)::int` })
      .from(schema.outfitPlans)
      .innerJoin(schema.outfitItems, eq(schema.outfitItems.outfitId, schema.outfitPlans.outfitId))
      .where(and(eq(schema.outfitPlans.userId, u.id), eq(schema.outfitPlans.worn, true), gte(schema.outfitPlans.date, since)))
      .groupBy(schema.outfitItems.itemId),
    db.execute<{ saved: number; planned: number; worn: number }>(sql`
      SELECT
        (SELECT count(*)::int FROM outfits WHERE user_id = ${u.id} AND saved) AS saved,
        (SELECT count(*)::int FROM outfit_plans WHERE user_id = ${u.id} AND date >= current_date) AS planned,
        (SELECT count(*)::int FROM outfit_plans WHERE user_id = ${u.id} AND worn AND date >= ${since}) AS worn`),
  ])
  const saved = new Map(savedUse.map((r) => [r.itemId, Number(r.n)]))
  const worn = new Map(wornUse.map((r) => [r.itemId, Number(r.n)]))

  const categories = Object.fromEntries(CATEGORIES.map((cat) => [cat, styled.filter((x) => x.s.category === cat).length])) as Record<Category, number>
  const colors: Record<string, number> = {}
  styled.forEach((x) => x.s.colors[0] && (colors[x.s.colors[0]] = (colors[x.s.colors[0]] ?? 0) + 1))

  const pairCounts = styled.map((x) => ({ x, n: styled.filter((y) => pairCompatibility(x.s, y.s).compatible).length }))
  const versatile = [...pairCounts].sort((a, b) => b.n - a.n).slice(0, 6)

  const tops = styled.filter((x) => x.s.category === 'top')
  const bottoms = styled.filter((x) => x.s.category === 'bottom')
  let baseOutfits = styled.filter((x) => x.s.category === 'dress').length
  for (const t of tops) for (const b of bottoms) if (pairCompatibility(t.s, b.s).compatible) baseOutfits++

  const fortnight = Date.now() - 14 * 24 * 3600 * 1000
  const underused = styled
    .filter((x) => !saved.get(x.row.id) && !worn.get(x.row.id) && x.row.createdAt.getTime() < fortnight)
    .slice(0, 8)
  const mostWorn = styled
    .filter((x) => worn.get(x.row.id))
    .sort((a, b) => (worn.get(b.row.id) ?? 0) - (worn.get(a.row.id) ?? 0))
    .slice(0, 6)

  const suggestions: { text: string; category?: string }[] = []
  if (!categories.shoes) suggestions.push({ text: 'Add your shoes so every outfit can be complete.', category: 'shoes' })
  if (!categories.outerwear) suggestions.push({ text: 'Add a coat or jacket to unlock layered looks for cooler days.', category: 'outerwear' })
  if (categories.top && categories.bottom && baseOutfits < categories.top) {
    suggestions.push({ text: 'Several tops don’t pair with your current bottoms. A neutral bottom (black, navy or denim) would connect them.', category: 'bottom' })
  }
  if (underused.length >= 3) suggestions.push({ text: `${underused.length} pieces haven’t appeared in a saved or worn look yet. Try asking your stylist to build around one.` })

  const ser = (r: (typeof styled)[number]['row']) => serializeItem(r)
  return c.json({
    measured: {
      savedLooks: Number(totals.rows[0]?.saved ?? 0),
      upcomingPlans: Number(totals.rows[0]?.planned ?? 0),
      wornLast60Days: Number(totals.rows[0]?.worn ?? 0),
      mostWorn: await Promise.all(mostWorn.map(async (x) => ({ item: await ser(x.row), count: worn.get(x.row.id)! }))),
      underused: await Promise.all(underused.map((x) => ser(x.row))),
    },
    calculated: {
      totalItems: styled.length,
      categories,
      colors,
      baseOutfits,
      mostVersatile: await Promise.all(versatile.filter((v) => v.n > 0).map(async (v) => ({ item: await ser(v.x.row), pairsWith: v.n }))),
    },
    suggestions,
  })
})
