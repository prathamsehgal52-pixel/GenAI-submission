import sharp from 'sharp'
import type { Category, ColorFamily } from '../../../shared/taxonomy'
import type { AIProvider, AIUsage, CandidateForAI, OutfitBrief, OutfitPicks, ProductClasses, Recognition } from './types'

/**
 * Deterministic stand-in used ONLY by the automated test suite
 * (AI_PROVIDER=fixture, permitted only when APP_ENV=test). It derives garment
 * attributes from simple image properties so tests can assert exact results
 * without calling a paid API.
 *
 * - colour: nearest family to the image's mean colour
 * - category: tall images → bottom, wide images → shoes, otherwise top
 */
const usage: AIUsage = { model: 'fixture', inputTokens: 0, outputTokens: 0, cacheReadTokens: 0 }

const PALETTE: [ColorFamily, [number, number, number]][] = [
  ['black', [20, 20, 20]],
  ['white', [240, 240, 236]],
  ['grey', [150, 150, 150]],
  ['beige', [215, 196, 160]],
  ['navy', [30, 42, 70]],
  ['blue', [60, 115, 200]],
  ['red', [190, 50, 40]],
  ['green', [60, 125, 85]],
  ['brown', [120, 80, 50]],
]

export class FixtureProvider implements AIProvider {
  readonly name = 'fixture'

  async recognizeGarments(jpeg: Buffer): Promise<{ result: Recognition; usage: AIUsage }> {
    const { width = 1, height = 1 } = await sharp(jpeg).metadata()
    const { channels } = await sharp(jpeg).stats()
    const rgb = channels.slice(0, 3).map((c) => c.mean)
    const [family] = PALETTE.reduce((best, cur) => (dist(cur[1], rgb) < dist(best[1], rgb) ? cur : best))
    const ratio = height / width
    const category: Category = ratio > 1.3 ? 'bottom' : ratio < 0.77 ? 'shoes' : 'top'
    const sub = ({ bottom: 'trousers', shoes: 'sneakers', top: 't-shirt' } as Record<string, string>)[category]
    return {
      usage,
      result: {
        contains_clothing: true,
        garments: [
          {
            name: `${family} ${sub}`,
            category,
            subcategory: sub,
            colors: [{ family, name: family as string }],
            pattern: 'solid' as const,
            material_estimate: null,
            styles: ['minimal' as const],
            occasions: ['everyday' as const, 'weekend' as const],
            seasons: ['spring' as const, 'autumn' as const],
            formality: 2,
            warmth: 2,
            details: [],
            box: { x: 0, y: 0, w: 1, h: 1 },
            confidence: 0.9,
          },
        ],
      },
    }
  }

  async pickOutfits(_brief: OutfitBrief, candidates: CandidateForAI[], count: number): Promise<{ result: OutfitPicks; usage: AIUsage }> {
    return {
      usage,
      result: {
        picks: candidates.slice(0, count).map((c) => ({
          candidate: c.index,
          remove_item_ids: [],
          title: 'Easy neutrals',
          explanation: `Pairs the ${c.items.map((i) => i.name).join(', ')} for a balanced look.`,
        })),
      },
    }
  }

  async classifyProducts(items: { id: string; title: string; hints: string }[]): Promise<{ result: ProductClasses; usage: AIUsage }> {
    return { usage, result: { products: items.map((i) => ({ id: i.id, category: 'other' as const, subcategory: '', colors: [], pattern: 'solid' as const, formality: 2, styles: [] })) } }
  }
}

function dist(a: number[], b: number[]) {
  return a.reduce((s, v, i) => s + (v - b[i]) ** 2, 0)
}
