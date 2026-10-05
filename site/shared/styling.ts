/**
 * Deterministic styling rules. These are the backbone of outfit generation,
 * product matching and wardrobe insights: every compatibility number the
 * product shows is computed here from stored garment attributes.
 */
import {
  FAMILY_HUE,
  NEUTRALS,
  OCCASION_FORMALITY,
  type Category,
  type ColorFamily,
  type Occasion,
  type Pattern,
  type Season,
} from './taxonomy'

export type StyleItem = {
  id: string
  category: Category
  colors: ColorFamily[]
  pattern: Pattern
  formality: number
  warmth: number
  seasons: Season[]
  occasions: Occasion[]
  styles: string[]
}

export type Factor = { kind: 'positive' | 'caution'; label: string; detail: string }

const BOLD_PATTERNS: ReadonlySet<Pattern> = new Set(['stripe', 'check', 'floral', 'print', 'graphic', 'dot', 'animal'])

const hueDistance = (a: number, b: number) => {
  const d = Math.abs(a - b) % 360
  return d > 180 ? 360 - d : d
}

/** How well two colour families sit together, 0..1, with a human reason. */
export function colorHarmony(a: ColorFamily | undefined, b: ColorFamily | undefined): { score: number; reason: string } {
  if (!a || !b) return { score: 0.7, reason: 'colour unknown' }
  if (NEUTRALS.has(a) || NEUTRALS.has(b)) return { score: 1, reason: 'neutral base' }
  if (a === b) return { score: 0.85, reason: 'tonal' }
  if (a === 'multi' || b === 'multi') return { score: 0.45, reason: 'busy mix' }
  const ha = FAMILY_HUE[a]
  const hb = FAMILY_HUE[b]
  if (ha === undefined || hb === undefined) return { score: 0.6, reason: 'mixed' }
  const d = hueDistance(ha, hb)
  if (d <= 45) return { score: 0.85, reason: 'analogous' }
  if (d >= 150) return { score: 0.72, reason: 'complementary' }
  if (d >= 105 && d <= 135) return { score: 0.5, reason: 'triadic' }
  return { score: 0.25, reason: 'clashing' }
}

/** Whether two garment categories can appear together in one outfit. */
export function categoriesCombine(a: Category, b: Category): boolean {
  if (a === b) return a === 'accessory'
  const pair = new Set([a, b])
  if (pair.has('dress') && (pair.has('top') || pair.has('bottom'))) return false
  return true
}

export type PairResult = { compatible: boolean; score: number; reasons: string[] }

/** Compatibility between two garments, used for pairing counts. */
export function pairCompatibility(a: StyleItem, b: StyleItem): PairResult {
  if (a.id === b.id || !categoriesCombine(a.category, b.category)) return { compatible: false, score: 0, reasons: [] }
  const reasons: string[] = []
  const color = colorHarmony(a.colors[0], b.colors[0])
  let score = color.score
  reasons.push(color.reason)

  const fd = Math.abs(a.formality - b.formality)
  if (fd >= 3) return { compatible: false, score: 0, reasons: ['formality gap'] }
  if (fd === 2) {
    score *= 0.6
    reasons.push('formality stretch')
  }

  if (BOLD_PATTERNS.has(a.pattern) && BOLD_PATTERNS.has(b.pattern)) {
    score *= 0.45
    reasons.push('two bold patterns')
  }

  if (a.seasons.length && b.seasons.length && !a.seasons.some((s) => b.seasons.includes(s))) {
    score *= 0.55
    reasons.push('different seasons')
  }

  return { compatible: score >= 0.55, score, reasons }
}

export type OutfitContext = {
  occasion?: Occasion
  /** Temperature in °C when real weather data is available; otherwise null. */
  temperatureC?: number | null
  preferredStyles?: string[]
  preferredColors?: ColorFamily[]
  avoidColors?: ColorFamily[]
}

export type OutfitEvaluation = { score: number; factors: Factor[] }

const MAIN: ReadonlySet<Category> = new Set(['top', 'bottom', 'dress', 'outerwear'])

/** Scores a full outfit and explains the result in plain terms. */
export function evaluateOutfit(items: StyleItem[], ctx: OutfitContext): OutfitEvaluation {
  const factors: Factor[] = []
  const main = items.filter((i) => MAIN.has(i.category))
  let score = 1

  // Pairwise harmony across the main pieces and shoes.
  const core = items.filter((i) => i.category !== 'accessory' && i.category !== 'bag')
  let pairTotal = 0
  let pairs = 0
  for (let i = 0; i < core.length; i++)
    for (let j = i + 1; j < core.length; j++) {
      pairTotal += pairCompatibility(core[i], core[j]).score
      pairs++
    }
  const harmony = pairs ? pairTotal / pairs : 0.7
  score *= 0.4 + harmony * 0.6

  const chromatic = new Set(main.map((i) => i.colors[0]).filter((c): c is ColorFamily => !!c && !NEUTRALS.has(c)))
  if (chromatic.size === 0) factors.push({ kind: 'positive', label: 'Colour', detail: 'An all-neutral palette keeps the look calm and easy to wear.' })
  else if (chromatic.size === 1) {
    const [c] = chromatic
    factors.push({ kind: 'positive', label: 'Colour', detail: `One accent colour (${c}) against neutrals gives the look a clear focal point.` })
  } else if (chromatic.size === 2) {
    const [a, b] = [...chromatic]
    const h = colorHarmony(a, b)
    if (h.score >= 0.7) factors.push({ kind: 'positive', label: 'Colour', detail: `${cap(a)} and ${b} are ${h.reason}, so the two colours support each other.` })
    else {
      score *= 0.75
      factors.push({ kind: 'caution', label: 'Colour', detail: `${cap(a)} and ${b} compete a little; keep accessories neutral.` })
    }
  } else {
    score *= 0.55
    factors.push({ kind: 'caution', label: 'Colour', detail: 'Three or more strong colours make the look busy.' })
  }

  const bold = main.filter((i) => BOLD_PATTERNS.has(i.pattern))
  if (bold.length > 1) {
    score *= 0.6
    factors.push({ kind: 'caution', label: 'Pattern', detail: 'Two bold patterns are competing for attention.' })
  } else if (bold.length === 1) {
    factors.push({ kind: 'positive', label: 'Pattern', detail: `The ${bold[0].pattern} piece is the only pattern, so it reads as intentional.` })
  }

  if (ctx.occasion) {
    const [lo, hi] = OCCASION_FORMALITY[ctx.occasion]
    const avg = main.length ? main.reduce((s, i) => s + i.formality, 0) / main.length : (lo + hi) / 2
    if (avg < lo - 0.5 || avg > hi + 0.5) {
      score *= 0.6
      factors.push({ kind: 'caution', label: 'Occasion', detail: avg < lo ? 'A little casual for this occasion.' : 'A little dressy for this occasion.' })
    } else {
      factors.push({ kind: 'positive', label: 'Occasion', detail: `The formality sits right for ${occasionPhrase(ctx.occasion)}.` })
    }
    const tagged = items.filter((i) => i.occasions.includes(ctx.occasion!)).length
    score *= 0.85 + 0.15 * (tagged / Math.max(1, items.length))
  }

  const formalities = main.map((i) => i.formality)
  if (formalities.length > 1 && Math.max(...formalities) - Math.min(...formalities) <= 1) {
    factors.push({ kind: 'positive', label: 'Balance', detail: 'Every piece sits at a similar level of polish.' })
  }

  if (ctx.temperatureC != null) {
    const t = ctx.temperatureC
    const outer = items.find((i) => i.category === 'outerwear')
    const warmth = Math.max(0, ...main.map((i) => i.warmth)) + (outer ? 1 : 0)
    if (t < 10 && (!outer || outer.warmth < 3)) {
      score *= 0.55
      factors.push({ kind: 'caution', label: 'Weather', detail: `At ${Math.round(t)}°C you'll want a warmer layer.` })
    } else if (t > 24 && warmth >= 5) {
      score *= 0.6
      factors.push({ kind: 'caution', label: 'Weather', detail: `Heavy for ${Math.round(t)}°C.` })
    } else {
      factors.push({ kind: 'positive', label: 'Weather', detail: `Suited to the forecast of about ${Math.round(t)}°C.` })
    }
  }

  if (ctx.preferredStyles?.length) {
    const overlap = items.filter((i) => i.styles.some((s) => ctx.preferredStyles!.includes(s))).length
    score *= 0.9 + 0.1 * (overlap / Math.max(1, items.length))
    if (overlap >= Math.ceil(items.length / 2)) {
      factors.push({ kind: 'positive', label: 'Your style', detail: `Leans ${ctx.preferredStyles.slice(0, 2).join(' and ')}, as in your style profile.` })
    }
  }

  if (ctx.avoidColors?.length && items.some((i) => i.colors.some((c) => ctx.avoidColors!.includes(c)))) {
    score *= 0.4
    factors.push({ kind: 'caution', label: 'Colour', detail: 'Includes a colour you said you prefer to avoid.' })
  }
  if (ctx.preferredColors?.length && items.some((i) => ctx.preferredColors!.includes(i.colors[0]))) score *= 1.05

  return { score: Math.min(1, score), factors }
}

function cap(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

function occasionPhrase(o: Occasion) {
  return { everyday: 'every day', work: 'work', weekend: 'the weekend', evening: 'an evening out', date: 'a date', formal: 'a formal event', travel: 'travel', active: 'being active', lounge: 'time at home' }[o]
}
