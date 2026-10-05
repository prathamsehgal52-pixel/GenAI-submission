import { z } from 'zod'
import { CATEGORIES, COLOR_FAMILIES, OCCASIONS, PATTERNS, SEASONS, STYLES } from '../../../shared/taxonomy'

/**
 * Schemas for AI output. The model's response is parsed against these and
 * then re-validated and clamped server-side before anything is stored.
 * Numeric ranges are enforced in code (not in the schema) because structured
 * output schemas support only a subset of JSON Schema keywords.
 */

export const GarmentSchema = z.object({
  name: z.string().describe('Short, specific garment name, e.g. "Cropped camel trench coat"'),
  category: z.enum(CATEGORIES),
  subcategory: z.string().describe('e.g. trench coat, straight-leg jeans, ankle boot'),
  colors: z
    .array(z.object({ family: z.enum(COLOR_FAMILIES), name: z.string().describe('Descriptive colour name, e.g. "camel"') }))
    .describe('Dominant colours, most prominent first (1-3)'),
  pattern: z.enum(PATTERNS),
  material_estimate: z
    .string()
    .nullable()
    .describe('Apparent fabric from the photo only, e.g. "looks like cotton twill". Null if unclear. Never state composition as fact.'),
  styles: z.array(z.enum(STYLES)),
  occasions: z.array(z.enum(OCCASIONS)),
  seasons: z.array(z.enum(SEASONS)),
  formality: z.number().int().describe('1 = very casual, 5 = black tie'),
  warmth: z.number().int().describe('1 = very light, 5 = heavy winter weight'),
  details: z.array(z.string()).describe('Distinctive visible details, e.g. "double-breasted", "raw hem" (max 5)'),
  box: z
    .object({ x: z.number(), y: z.number(), w: z.number(), h: z.number() })
    .describe('Bounding box of this garment as fractions (0-1) of image width/height, origin top-left'),
  confidence: z.number().describe('0-1 confidence in the category and colours'),
})

export const RecognitionSchema = z.object({
  contains_clothing: z.boolean(),
  garments: z.array(GarmentSchema),
})

export type Recognition = z.infer<typeof RecognitionSchema>
export type RecognizedGarment = z.infer<typeof GarmentSchema>

export const OutfitPickSchema = z.object({
  picks: z.array(
    z.object({
      candidate: z.number().int().describe('Index of the chosen candidate outfit'),
      remove_item_ids: z.array(z.string()).describe('Optional pieces from that candidate to leave out (only optional slots)'),
      title: z.string().describe('Evocative 2-4 word outfit name'),
      explanation: z.string().describe('2-3 sentences on why the pieces work together, referencing the actual garments'),
    }),
  ),
})
export type OutfitPicks = z.infer<typeof OutfitPickSchema>

export const ProductClassSchema = z.object({
  products: z.array(
    z.object({
      id: z.string(),
      category: z.enum([...CATEGORIES, 'other']),
      subcategory: z.string(),
      colors: z.array(z.enum(COLOR_FAMILIES)),
      pattern: z.enum(PATTERNS),
      formality: z.number().int(),
      styles: z.array(z.enum(STYLES)),
    }),
  ),
})
export type ProductClasses = z.infer<typeof ProductClassSchema>

export type CandidateForAI = {
  index: number
  items: { id: string; role: string; optional: boolean; name: string; color: string; pattern: string; formality: number; details: string[] }[]
  ruleScore: number
}

export type OutfitBrief = {
  occasion?: string
  style?: string
  formality?: number
  weather?: string | null
  notes?: string
  preferredStyles: string[]
  avoidColors: string[]
}

export type AIUsage = { inputTokens: number; outputTokens: number; cacheReadTokens: number; model: string }

export interface AIProvider {
  readonly name: string
  recognizeGarments(jpeg: Buffer): Promise<{ result: Recognition; usage: AIUsage }>
  pickOutfits(brief: OutfitBrief, candidates: CandidateForAI[], count: number): Promise<{ result: OutfitPicks; usage: AIUsage }>
  classifyProducts(items: { id: string; title: string; hints: string }[]): Promise<{ result: ProductClasses; usage: AIUsage }>
}

export class AIError extends Error {
  constructor(
    public code: 'unavailable' | 'rate_limited' | 'refused' | 'invalid_output' | 'misconfigured' | 'quota_exceeded' | 'timeout',
    message: string,
    public retryable = false,
  ) {
    super(message)
  }
}
