import { GoogleGenAI } from '@google/genai'
import type { z } from 'zod'
import { CATEGORIES, COLOR_FAMILIES, OCCASIONS, PATTERNS, SEASONS, STYLES } from '../../../shared/taxonomy'
import { config } from '../../config'
import {
  AIError,
  OutfitPickSchema,
  ProductClassSchema,
  RecognitionSchema,
  type AIProvider,
  type AIUsage,
  type CandidateForAI,
  type OutfitBrief,
} from './types'

const RECOGNITION_SYSTEM = `You catalogue clothing for a personal wardrobe app.
Look at the photo and list each distinct garment, shoe, bag or accessory that is a clear subject of the photo (up to 6). If a person is wearing an outfit, list each visible piece separately. Ignore background objects and items that are mostly out of frame.
Describe only what is visible. Material is an estimate from appearance; never assert fabric composition or brand as fact. If the photo contains no clothing, set contains_clothing to false and return an empty list.
Bounding boxes: x, y, w, h MUST each be a fraction between 0 and 1 of the image's width or height (x, y = top-left corner), never pixel counts. For example a box covering the full image is {"x":0,"y":0,"w":1,"h":1}.`

const STYLIST_SYSTEM = `You are a thoughtful personal stylist. You choose between candidate outfits that were assembled only from garments the client already owns.
Choose the strongest, most distinct candidates for the brief. You may leave out pieces marked optional, but never add or invent garments. Refer to garments by what they are (e.g. "the camel trench"), never by id.
Explanations are 2-3 warm, specific sentences about colour, proportion, texture and occasion. Do not mention weather unless a forecast is provided in the brief.`

const PRODUCT_SYSTEM = `You classify retail product listings into a fixed clothing taxonomy using only the listing text. Use "other" for non-clothing items. Formality: 1 very casual to 5 black tie.`

/** Gemini's structured-output schema only supports a JSON-Schema subset (lowercase types, no zod). */
const colorSchema = { type: 'object', properties: { family: { type: 'string', enum: [...COLOR_FAMILIES] }, name: { type: 'string' } }, required: ['family', 'name'] } as const

const garmentSchema = {
  type: 'object',
  properties: {
    name: { type: 'string', description: 'Short, specific garment name, e.g. "Cropped camel trench coat"' },
    category: { type: 'string', enum: [...CATEGORIES] },
    subcategory: { type: 'string', description: 'e.g. trench coat, straight-leg jeans, ankle boot' },
    colors: { type: 'array', items: colorSchema, description: 'Dominant colours, most prominent first (1-3)' },
    pattern: { type: 'string', enum: [...PATTERNS] },
    material_estimate: { type: 'string', nullable: true, description: 'Apparent fabric from the photo only. Null if unclear. Never state composition as fact.' },
    styles: { type: 'array', items: { type: 'string', enum: [...STYLES] } },
    occasions: { type: 'array', items: { type: 'string', enum: [...OCCASIONS] } },
    seasons: { type: 'array', items: { type: 'string', enum: [...SEASONS] } },
    formality: { type: 'integer', description: '1 = very casual, 5 = black tie' },
    warmth: { type: 'integer', description: '1 = very light, 5 = heavy winter weight' },
    details: { type: 'array', items: { type: 'string' }, description: 'Distinctive visible details (max 5)' },
    box: {
      type: 'object',
      properties: { x: { type: 'number' }, y: { type: 'number' }, w: { type: 'number' }, h: { type: 'number' } },
      required: ['x', 'y', 'w', 'h'],
      description: 'Bounding box as fractions (0-1) of image width/height, origin top-left',
    },
    confidence: { type: 'number', description: '0-1 confidence in the category and colours' },
  },
  required: ['name', 'category', 'subcategory', 'colors', 'pattern', 'material_estimate', 'styles', 'occasions', 'seasons', 'formality', 'warmth', 'details', 'box', 'confidence'],
} as const

const recognitionResponseSchema = {
  type: 'object',
  properties: { contains_clothing: { type: 'boolean' }, garments: { type: 'array', items: garmentSchema } },
  required: ['contains_clothing', 'garments'],
}

const outfitPickResponseSchema = {
  type: 'object',
  properties: {
    picks: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          candidate: { type: 'integer' },
          remove_item_ids: { type: 'array', items: { type: 'string' } },
          title: { type: 'string', description: 'Evocative 2-4 word outfit name' },
          explanation: { type: 'string', description: '2-3 sentences on why the pieces work together, referencing the actual garments' },
        },
        required: ['candidate', 'remove_item_ids', 'title', 'explanation'],
      },
    },
  },
  required: ['picks'],
}

const productClassResponseSchema = {
  type: 'object',
  properties: {
    products: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          category: { type: 'string', enum: [...CATEGORIES, 'other'] },
          subcategory: { type: 'string' },
          colors: { type: 'array', items: { type: 'string', enum: [...COLOR_FAMILIES] } },
          pattern: { type: 'string', enum: [...PATTERNS] },
          formality: { type: 'integer' },
          styles: { type: 'array', items: { type: 'string', enum: [...STYLES] } },
        },
        required: ['id', 'category', 'subcategory', 'colors', 'pattern', 'formality', 'styles'],
      },
    },
  },
  required: ['products'],
}

export class GeminiProvider implements AIProvider {
  readonly name = 'gemini'
  private client = new GoogleGenAI({ apiKey: config.GEMINI_API_KEY })

  private async call<S extends z.ZodType>(opts: {
    schema: S
    responseSchema: object
    system: string
    parts: ({ text: string } | { inlineData: { mimeType: string; data: string } })[]
  }): Promise<{ result: z.infer<S>; usage: AIUsage }> {
    let response
    try {
      response = await this.client.models.generateContent({
        model: config.AI_MODEL,
        contents: [{ role: 'user', parts: opts.parts }],
        config: { systemInstruction: opts.system, responseMimeType: 'application/json', responseSchema: opts.responseSchema },
      })
    } catch (err) {
      throw mapError(err)
    }
    const text = response.text
    if (!text) throw new AIError('refused', 'The model declined this request')
    let json: unknown
    try {
      json = JSON.parse(text)
    } catch {
      throw new AIError('invalid_output', 'The model response was not valid JSON', true)
    }
    const parsed = opts.schema.safeParse(json)
    if (!parsed.success) throw new AIError('invalid_output', 'The model response did not match the expected format', true)
    const usage = response.usageMetadata
    return {
      result: parsed.data,
      usage: {
        model: config.AI_MODEL,
        inputTokens: usage?.promptTokenCount ?? 0,
        outputTokens: usage?.candidatesTokenCount ?? 0,
        cacheReadTokens: usage?.cachedContentTokenCount ?? 0,
      },
    }
  }

  recognizeGarments(jpeg: Buffer) {
    return this.call({
      schema: RecognitionSchema,
      responseSchema: recognitionResponseSchema,
      system: RECOGNITION_SYSTEM,
      parts: [{ inlineData: { mimeType: 'image/jpeg', data: jpeg.toString('base64') } }, { text: 'Catalogue the clothing in this photo.' }],
    })
  }

  pickOutfits(brief: OutfitBrief, candidates: CandidateForAI[], count: number) {
    return this.call({
      schema: OutfitPickSchema,
      responseSchema: outfitPickResponseSchema,
      system: STYLIST_SYSTEM,
      parts: [
        {
          text: `Brief:\n${JSON.stringify(brief, null, 1)}\n\nCandidates (ranked by a rules engine; higher ruleScore is better):\n${JSON.stringify(candidates, null, 1)}\n\nReturn the best ${count} distinct candidate(s).`,
        },
      ],
    })
  }

  classifyProducts(items: { id: string; title: string; hints: string }[]) {
    return this.call({
      schema: ProductClassSchema,
      responseSchema: productClassResponseSchema,
      system: PRODUCT_SYSTEM,
      parts: [{ text: `Classify each listing. Return every id.\n${JSON.stringify(items)}` }],
    })
  }
}

function mapError(err: unknown): AIError {
  const status = (err as { status?: number })?.status
  const message = err instanceof Error ? err.message : String(err)
  if (status === 401 || status === 403) return new AIError('misconfigured', 'The AI provider rejected the configured credentials')
  if (status === 429) return new AIError('rate_limited', 'The AI provider is rate limiting requests', true)
  if (status === 408 || status === 504) return new AIError('timeout', 'The AI provider timed out', true)
  if (status === 400) return new AIError('invalid_output', `The AI provider rejected the request: ${message}`)
  return new AIError('unavailable', `The AI provider could not be reached: ${message}`, true)
}
