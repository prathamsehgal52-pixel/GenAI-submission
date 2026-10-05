import { createHash } from 'node:crypto'
import { and, desc, eq, gte, inArray, max } from 'drizzle-orm'
import type { StyleRequest } from '../../shared/schemas'
import { evaluateOutfit, pairCompatibility, type Factor, type OutfitContext, type StyleItem } from '../../shared/styling'
import { OCCASION_FORMALITY, OCCASION_LABELS, type Category, type ColorFamily, NEUTRALS } from '../../shared/taxonomy'
import { db, schema } from '../db/client'
import { getOrCreateProfile } from '../routes/me'
import { AIError, getAI, runAI } from './ai'
import type { CandidateForAI } from './ai/types'
import { activeItems, serializeItem, toStyleItem, type ItemRow } from './wardrobe'
import { describeDay, getForecast } from './weather'

export type Role = 'top' | 'bottom' | 'dress' | 'outerwear' | 'shoes' | 'bag' | 'accessory'
type Candidate = { pieces: { item: StyleItem; role: Role; optional: boolean }[]; score: number; factors: Factor[] }

const OPTIONAL: ReadonlySet<Role> = new Set(['outerwear', 'bag', 'accessory'])
const CACHE_MINUTES = 10

export type StylingOutcome =
  | { status: 'complete'; requestId: string; outfits: SerializedOutfit[]; weather: WeatherUsed | null; source: 'ai' | 'rules'; cached: boolean }
  | { status: 'insufficient'; requestId: string; missing: string[]; message: string }

type WeatherUsed = { summary: string; temperatureC: number; locationName: string; date: string }

/* ───────────────────────── Candidate generation ───────────────────────── */

const sumPair = (a: StyleItem, bs: StyleItem[]) => bs.reduce((s, b) => s + pairCompatibility(a, b).score, 0)

function bestAddition(pool: StyleItem[], with_: StyleItem[]) {
  let best: StyleItem | null = null
  let bestScore = -1
  for (const p of pool) {
    const s = sumPair(p, with_) / Math.max(1, with_.length)
    if (s > bestScore) {
      best = p
      bestScore = s
    }
  }
  return { item: best, score: bestScore }
}

type Weights = { recent: Map<string, number>; disliked: Set<string>; liked: Set<string>; favorites: Set<string> }

export function buildCandidates(items: StyleItem[], ctx: OutfitContext, opts: { include: StyleItem[]; excludedCores: Set<string>; weights: Weights; formalityTarget?: number }) {
  const by = (c: Category) => items.filter((i) => i.category === c)
  const band = ctx.occasion ? OCCASION_FORMALITY[ctx.occasion] : [1, 5]
  const target = opts.formalityTarget
  const fits = (i: StyleItem) => (target ? Math.abs(i.formality - target) <= 1 : i.formality >= band[0] - 1 && i.formality <= band[1] + 1)
  const ranked = (list: StyleItem[]) =>
    list
      .filter(fits)
      .map((i) => ({ i, s: (ctx.occasion && i.occasions.includes(ctx.occasion) ? 1.2 : 1) * (opts.weights.favorites.has(i.id) ? 1.05 : 1) }))
      .sort((a, b) => b.s - a.s)
      .slice(0, 40)
      .map((x) => x.i)

  const includeIds = new Set(opts.include.map((i) => i.id))
  const tops = ranked(by('top'))
  const bottoms = ranked(by('bottom'))
  const dresses = ranked(by('dress'))
  const outer = by('outerwear').filter(fits)
  const shoes = by('shoes').filter(fits)
  const bags = by('bag')
  const accessories = by('accessory')

  const bases: { item: StyleItem; role: Role }[][] = []
  for (const t of tops) for (const b of bottoms) if (pairCompatibility(t, b).compatible || (includeIds.has(t.id) || includeIds.has(b.id))) bases.push([{ item: t, role: 'top' }, { item: b, role: 'bottom' }])
  for (const d of dresses) bases.push([{ item: d, role: 'dress' }])

  const candidates: Candidate[] = []
  for (const base of bases) {
    const coreKey = base.map((p) => p.item.id).sort().join('+')
    if (opts.excludedCores.has(coreKey)) continue
    const pieces: Candidate['pieces'] = base.map((p) => ({ ...p, optional: false }))
    const pick = (pool: StyleItem[], role: Role, optional: boolean) => {
      const forced = opts.include.find((i) => i.category === role)
      const chosen = forced ?? bestAddition(pool, pieces.map((p) => p.item)).item
      if (chosen) pieces.push({ item: chosen, role, optional: optional && !forced })
    }
    pick(shoes, 'shoes', false)
    const cold = ctx.temperatureC != null && ctx.temperatureC < 16
    const warm = ctx.temperatureC != null && ctx.temperatureC > 22
    if (opts.include.some((i) => i.category === 'outerwear') || cold || (!warm && outer.length && ['work', 'evening', 'formal', 'travel'].includes(ctx.occasion ?? ''))) {
      pick(outer, 'outerwear', true)
    }
    if (bags.length) pick(bags, 'bag', true)
    if (accessories.length && opts.include.some((i) => i.category === 'accessory')) pick(accessories, 'accessory', true)

    // Required items must be present.
    if ([...includeIds].some((id) => !pieces.some((p) => p.item.id === id))) continue

    const evaluation = evaluateOutfit(pieces.map((p) => p.item), ctx)
    let score = evaluation.score
    for (const p of pieces) {
      score *= Math.pow(0.95, opts.weights.recent.get(p.item.id) ?? 0)
      if (opts.weights.favorites.has(p.item.id)) score *= 1.02
    }
    const ids = pieces.map((p) => p.item.id)
    for (let i = 0; i < ids.length; i++)
      for (let j = i + 1; j < ids.length; j++) {
        const k = [ids[i], ids[j]].sort().join('+')
        if (opts.weights.disliked.has(k)) score *= 0.8
        if (opts.weights.liked.has(k)) score *= 1.06
      }
    candidates.push({ pieces, score, factors: evaluation.factors })
  }

  // Diversity: avoid near-duplicates and over-reliance on any single piece.
  candidates.sort((a, b) => b.score - a.score)
  const chosen: Candidate[] = []
  const use = new Map<string, number>()
  for (const c of candidates) {
    const core = c.pieces.filter((p) => !p.optional && p.role !== 'shoes')
    if (chosen.some((o) => core.every((p) => o.pieces.some((q) => q.item.id === p.item.id)))) continue
    if (core.some((p) => (use.get(p.item.id) ?? 0) >= 3)) continue
    chosen.push(c)
    core.forEach((p) => use.set(p.item.id, (use.get(p.item.id) ?? 0) + 1))
    if (chosen.length >= 12) break
  }
  return chosen
}

export function missingForOutfits(items: StyleItem[]) {
  const has = (c: Category) => items.some((i) => i.category === c)
  const missing: string[] = []
  if (!has('dress') && !(has('top') && has('bottom'))) {
    if (!has('top')) missing.push('top')
    if (!has('bottom')) missing.push('bottom')
  }
  return missing
}

/* ───────────────────────── Explanations ───────────────────────── */

export function ruleTitle(c: Candidate, names: Map<string, string>, occasion?: string) {
  const occ = occasion ? OCCASION_LABELS[occasion as keyof typeof OCCASION_LABELS] : 'Everyday'
  const lead = c.pieces.find((p) => p.role === 'outerwear') ?? c.pieces.find((p) => p.role === 'dress') ?? c.pieces.find((p) => p.role === 'top')
  const chromatic = c.pieces.map((p) => p.item.colors[0]).filter((x): x is ColorFamily => !!x && !NEUTRALS.has(x))
  const leadName = lead ? names.get(lead.item.id)?.toLowerCase() : null
  if (leadName && leadName.length <= 28) return `${occ}, ${leadName}`
  return chromatic.length ? `${occ} in ${chromatic[0]}` : `${occ} neutrals`
}

export function ruleExplanation(c: Candidate, names: Map<string, string>) {
  const lead = c.pieces
    .filter((p) => !p.optional)
    .map((p) => names.get(p.item.id)?.toLowerCase())
    .filter(Boolean)
  const positives = c.factors.filter((f) => f.kind === 'positive').slice(0, 2).map((f) => f.detail)
  return [`Built around your ${lead.slice(0, 2).join(' and ')}.`, ...positives].join(' ')
}

/* ───────────────────────── Orchestration ───────────────────────── */

async function loadWeights(userId: string): Promise<Weights> {
  const since = new Date(Date.now() - 3 * 24 * 3600 * 1000)
  const recentRows = await db
    .select({ itemId: schema.outfitItems.itemId })
    .from(schema.outfitItems)
    .innerJoin(schema.outfits, eq(schema.outfits.id, schema.outfitItems.outfitId))
    .where(and(eq(schema.outfits.userId, userId), gte(schema.outfits.createdAt, since)))
  const recent = new Map<string, number>()
  recentRows.forEach((r) => recent.set(r.itemId, (recent.get(r.itemId) ?? 0) + 1))

  const fbRows = await db
    .select({ outfitId: schema.outfits.id, feedback: schema.outfits.feedback, saved: schema.outfits.saved, itemId: schema.outfitItems.itemId })
    .from(schema.outfits)
    .innerJoin(schema.outfitItems, eq(schema.outfitItems.outfitId, schema.outfits.id))
    .where(and(eq(schema.outfits.userId, userId), inArray(schema.outfits.feedback, [-1, 1])))
  const groups = new Map<string, { fb: number; items: string[] }>()
  fbRows.forEach((r) => {
    const g = groups.get(r.outfitId) ?? { fb: r.feedback, items: [] }
    g.items.push(r.itemId)
    groups.set(r.outfitId, g)
  })
  const liked = new Set<string>()
  const disliked = new Set<string>()
  for (const g of groups.values())
    for (let i = 0; i < g.items.length; i++)
      for (let j = i + 1; j < g.items.length; j++) (g.fb > 0 ? liked : disliked).add([g.items[i], g.items[j]].sort().join('+'))
  return { recent, liked, disliked, favorites: new Set() }
}

export async function generateOutfits(userId: string, req: StyleRequest): Promise<StylingOutcome> {
  const profile = await getOrCreateProfile(userId)
  const rows = (await activeItems(userId)).filter((r) => !r.excludeFromStyling && !req.avoidItemIds.includes(r.id))
  const styleItems = rows.map(toStyleItem).filter((s): s is StyleItem => !!s)
  const byId = new Map(rows.map((r) => [r.id, r]))

  // Weather, only when the user has a location and real data is available.
  let weather: WeatherUsed | null = null
  if (req.useWeather && profile.latitude != null && profile.longitude != null) {
    const forecast = await getForecast(profile.latitude, profile.longitude, profile.locationName ?? 'your area')
    const date = req.date ?? new Date().toISOString().slice(0, 10)
    const day = forecast?.days.find((d) => d.date === date)
    if (forecast && day) weather = { summary: describeDay(day), temperatureC: day.maxC * 0.6 + day.minC * 0.4, locationName: forecast.locationName, date }
  }

  const [{ version }] = await db.select({ version: max(schema.wardrobeItems.updatedAt) }).from(schema.wardrobeItems).where(eq(schema.wardrobeItems.userId, userId))
  const { excludeOutfitIds, ...cacheable } = req
  const paramsHash = createHash('sha256')
    .update(JSON.stringify({ cacheable, version: version?.toISOString() ?? '', weather: weather?.summary ?? null }))
    .digest('hex')

  const missing = missingForOutfits(styleItems)
  if (missing.length) {
    const [r] = await db
      .insert(schema.stylingRequests)
      .values({ userId, params: req, paramsHash, status: 'insufficient', message: missing.join(',') })
      .returning({ id: schema.stylingRequests.id })
    return {
      status: 'insufficient',
      requestId: r.id,
      missing,
      message: `Add ${missing.map((m) => (m === 'top' ? 'a top' : 'a bottom')).join(' and ')} (or a dress) so your stylist can build complete outfits.`,
    }
  }

  // Identical request, unchanged wardrobe, within a few minutes: reuse the result.
  if (!excludeOutfitIds.length) {
    const since = new Date(Date.now() - CACHE_MINUTES * 60 * 1000)
    const [prev] = await db
      .select()
      .from(schema.stylingRequests)
      .where(and(eq(schema.stylingRequests.userId, userId), eq(schema.stylingRequests.paramsHash, paramsHash), eq(schema.stylingRequests.status, 'complete'), gte(schema.stylingRequests.createdAt, since)))
      .orderBy(desc(schema.stylingRequests.createdAt))
      .limit(1)
    if (prev) {
      const outfits = await loadOutfits(userId, { requestId: prev.id })
      if (outfits.length) return { status: 'complete', requestId: prev.id, outfits, weather, source: prev.aiUsed ? 'ai' : 'rules', cached: true }
    }
  }

  const excludedCores = new Set<string>()
  if (excludeOutfitIds.length) {
    const ex = await db
      .select({ outfitId: schema.outfitItems.outfitId, itemId: schema.outfitItems.itemId, role: schema.outfitItems.role })
      .from(schema.outfitItems)
      .innerJoin(schema.outfits, eq(schema.outfits.id, schema.outfitItems.outfitId))
      .where(and(eq(schema.outfits.userId, userId), inArray(schema.outfitItems.outfitId, excludeOutfitIds)))
    const grouped = new Map<string, string[]>()
    ex.filter((e) => ['top', 'bottom', 'dress'].includes(e.role)).forEach((e) => grouped.set(e.outfitId, [...(grouped.get(e.outfitId) ?? []), e.itemId]))
    grouped.forEach((ids) => excludedCores.add(ids.sort().join('+')))
  }

  const weights = await loadWeights(userId)
  rows.filter((r) => r.favorite).forEach((r) => weights.favorites.add(r.id))
  const ctx: OutfitContext = {
    occasion: req.occasion,
    temperatureC: weather?.temperatureC ?? null,
    preferredStyles: req.style ? [req.style] : profile.preferredStyles,
    preferredColors: (req.preferredColors.length ? req.preferredColors : profile.favoriteColors) as ColorFamily[],
    avoidColors: profile.avoidColors as ColorFamily[],
  }
  const include = styleItems.filter((s) => req.includeItemIds.includes(s.id))
  const candidates = buildCandidates(styleItems, ctx, { include, excludedCores, weights, formalityTarget: req.formality })

  if (!candidates.length) {
    const [r] = await db
      .insert(schema.stylingRequests)
      .values({ userId, params: req, paramsHash, status: 'insufficient', message: 'no_candidates' })
      .returning({ id: schema.stylingRequests.id })
    return {
      status: 'insufficient',
      requestId: r.id,
      missing: [],
      message: excludeOutfitIds.length
        ? 'You’ve seen every combination that fits this brief. Try a different occasion, or add more pieces to your wardrobe.'
        : 'None of your pieces fit this brief together yet. Try a different occasion or formality, or add a few more items.',
    }
  }

  const names = new Map(rows.map((r) => [r.id, r.name || r.subcategory || 'piece']))
  let picks: { candidate: Candidate; title: string; explanation: string; source: 'ai' | 'rules' }[] = []
  let aiUsed = false
  if (getAI()) {
    try {
      const forAI: CandidateForAI[] = candidates.map((c, index) => ({
        index,
        ruleScore: Math.round(c.score * 100) / 100,
        items: c.pieces.map((p) => {
          const r = byId.get(p.item.id)!
          return { id: r.id, role: p.role, optional: p.optional, name: names.get(r.id)!, color: r.colorNames[0] ?? r.colors[0] ?? 'unknown', pattern: r.pattern, formality: r.formality, details: r.details.slice(0, 3) }
        }),
      }))
      const result = await runAI('style_outfits', userId, (ai) =>
        ai.pickOutfits(
          {
            occasion: OCCASION_LABELS[req.occasion],
            style: req.style,
            formality: req.formality,
            weather: weather ? `${weather.summary} in ${weather.locationName}` : null,
            notes: req.notes,
            preferredStyles: profile.preferredStyles,
            avoidColors: profile.avoidColors,
          },
          forAI,
          Math.min(req.count, candidates.length),
        ),
      )
      const seen = new Set<number>()
      for (const p of result.picks) {
        const cand = candidates[p.candidate]
        if (!cand || seen.has(p.candidate)) continue
        seen.add(p.candidate)
        // Only optional pieces that belong to this candidate may be removed; anything else is ignored.
        const removable = new Set(cand.pieces.filter((x) => x.optional).map((x) => x.item.id))
        const remove = new Set(p.remove_item_ids.filter((id) => removable.has(id)))
        const pieces = cand.pieces.filter((x) => !remove.has(x.item.id))
        const title = p.title.trim().slice(0, 60)
        const explanation = p.explanation.trim().slice(0, 700)
        if (!title || !explanation) continue
        picks.push({ candidate: { ...cand, pieces }, title, explanation, source: 'ai' })
      }
      aiUsed = picks.length > 0
    } catch (err) {
      if (!(err instanceof AIError)) throw err
      picks = []
    }
  }
  if (!picks.length) {
    picks = candidates.slice(0, req.count).map((c) => ({ candidate: c, title: ruleTitle(c, names, req.occasion), explanation: ruleExplanation(c, names), source: 'rules' as const }))
  }

  const ids = await db.transaction(async (tx) => {
    const [request] = await tx
      .insert(schema.stylingRequests)
      .values({ userId, params: req, paramsHash, weather, status: 'complete', candidateCount: candidates.length, aiUsed })
      .returning({ id: schema.stylingRequests.id })
    for (const p of picks) {
      // Final guard: every referenced item must be one of this user's active items.
      if (!p.candidate.pieces.every((x) => byId.has(x.item.id))) continue
      const evaluation = evaluateOutfit(p.candidate.pieces.map((x) => x.item), ctx)
      const [o] = await tx
        .insert(schema.outfits)
        .values({
          userId,
          requestId: request.id,
          title: p.title,
          occasion: req.occasion,
          style: req.style ?? null,
          explanation: p.explanation,
          factors: evaluation.factors,
          explanationSource: p.source,
          score: p.candidate.score,
        })
        .returning({ id: schema.outfits.id })
      await tx.insert(schema.outfitItems).values(p.candidate.pieces.map((x, i) => ({ outfitId: o.id, itemId: x.item.id, role: x.role, position: i })))
    }
    return request.id
  })

  const outfits = await loadOutfits(userId, { requestId: ids })
  return { status: 'complete', requestId: ids, outfits, weather, source: aiUsed ? 'ai' : 'rules', cached: false }
}

/* ───────────────────────── Loading & serialization ───────────────────────── */

const ROLE_ORDER: Role[] = ['outerwear', 'top', 'dress', 'bottom', 'shoes', 'bag', 'accessory']

export async function loadOutfits(userId: string, where: { requestId?: string; ids?: string[]; saved?: boolean; limit?: number; offset?: number }) {
  const conds = [eq(schema.outfits.userId, userId)]
  if (where.requestId) conds.push(eq(schema.outfits.requestId, where.requestId))
  if (where.ids) {
    if (!where.ids.length) return []
    conds.push(inArray(schema.outfits.id, where.ids))
  }
  if (where.saved !== undefined) conds.push(eq(schema.outfits.saved, where.saved))
  const outfitRows = await db
    .select()
    .from(schema.outfits)
    .where(and(...conds))
    .orderBy(where.saved ? desc(schema.outfits.savedAt) : desc(schema.outfits.score))
    .limit(where.limit ?? 100)
    .offset(where.offset ?? 0)
  if (!outfitRows.length) return []
  const links = await db
    .select({ link: schema.outfitItems, item: schema.wardrobeItems })
    .from(schema.outfitItems)
    .innerJoin(schema.wardrobeItems, eq(schema.wardrobeItems.id, schema.outfitItems.itemId))
    .where(and(inArray(schema.outfitItems.outfitId, outfitRows.map((o) => o.id)), eq(schema.wardrobeItems.userId, userId)))
  const serialized = new Map<string, Awaited<ReturnType<typeof serializeItem>>>()
  await Promise.all(
    [...new Map(links.map((l) => [l.item.id, l.item])).values()].map(async (it) => serialized.set(it.id, await serializeItem(it as ItemRow, { full: true }))),
  )
  return outfitRows.map((o) => ({
    id: o.id,
    title: o.title,
    occasion: o.occasion,
    style: o.style,
    explanation: o.explanation,
    explanationSource: o.explanationSource as 'ai' | 'rules',
    factors: o.factors,
    saved: o.saved,
    savedAt: o.savedAt,
    feedback: o.feedback,
    createdAt: o.createdAt,
    items: links
      .filter((l) => l.link.outfitId === o.id)
      .sort((a, b) => ROLE_ORDER.indexOf(a.link.role as Role) - ROLE_ORDER.indexOf(b.link.role as Role))
      .map((l) => ({ role: l.link.role, item: serialized.get(l.item.id)! })),
  }))
}

export type SerializedOutfit = Awaited<ReturnType<typeof loadOutfits>>[number]

/** Ranked same-category alternatives for one piece of an outfit. */
export async function alternativesFor(userId: string, outfitId: string, itemId: string) {
  const [outfit] = await loadOutfits(userId, { ids: [outfitId] })
  if (!outfit) return null
  const target = outfit.items.find((i) => i.item.id === itemId)
  if (!target) return null
  const rows = (await activeItems(userId)).filter((r) => !r.excludeFromStyling)
  const all = rows.map(toStyleItem).filter((s): s is StyleItem => !!s)
  const rest = all.filter((s) => outfit.items.some((i) => i.item.id === s.id && i.item.id !== itemId))
  const ctx: OutfitContext = { occasion: (outfit.occasion ?? undefined) as OutfitContext['occasion'] }
  const options = all
    .filter((s) => s.category === target.item.category && s.id !== itemId && !rest.some((r) => r.id === s.id))
    .map((s) => ({ s, score: evaluateOutfit([...rest, s], ctx).score }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 8)
  const byId = new Map(rows.map((r) => [r.id, r]))
  return Promise.all(options.map(async (o) => ({ item: await serializeItem(byId.get(o.s.id)!), score: Math.round(o.score * 100) / 100 })))
}

/** Swaps one piece, then recomputes the rule factors and a factual explanation. */
export async function replaceItem(userId: string, outfitId: string, itemId: string, withItemId: string) {
  const [outfit] = await loadOutfits(userId, { ids: [outfitId] })
  if (!outfit) return null
  const current = outfit.items.find((i) => i.item.id === itemId)
  if (!current) return null
  const rows = await activeItems(userId)
  const replacement = rows.find((r) => r.id === withItemId)
  if (!replacement || replacement.category !== current.item.category || outfit.items.some((i) => i.item.id === withItemId)) return null
  const byId = new Map(rows.map((r) => [r.id, r]))
  const newIds = outfit.items.map((i) => (i.item.id === itemId ? withItemId : i.item.id))
  const styleItems = newIds.map((id) => byId.get(id)).filter((r): r is ItemRow => !!r).map(toStyleItem).filter((s): s is StyleItem => !!s)
  const evaluation = evaluateOutfit(styleItems, { occasion: (outfit.occasion ?? undefined) as OutfitContext['occasion'] })
  const names = new Map(rows.map((r) => [r.id, r.name || r.subcategory || 'piece']))
  const cand: Candidate = {
    pieces: outfit.items.map((i) => ({ item: styleItems.find((s) => s.id === (i.item.id === itemId ? withItemId : i.item.id))!, role: i.role as Role, optional: OPTIONAL.has(i.role as Role) })).filter((p) => p.item),
    score: evaluation.score,
    factors: evaluation.factors,
  }
  await db.transaction(async (tx) => {
    await tx.update(schema.outfitItems).set({ itemId: withItemId }).where(and(eq(schema.outfitItems.outfitId, outfitId), eq(schema.outfitItems.itemId, itemId)))
    await tx
      .update(schema.outfits)
      .set({ factors: evaluation.factors, score: evaluation.score, explanation: ruleExplanation(cand, names), explanationSource: 'rules' })
      .where(eq(schema.outfits.id, outfitId))
  })
  return (await loadOutfits(userId, { ids: [outfitId] }))[0]
}
