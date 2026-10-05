import Anthropic from '@anthropic-ai/sdk'
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod'
import type { z } from 'zod'
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
Bounding boxes are fractions of the image (x, y = top-left corner).`

const STYLIST_SYSTEM = `You are a thoughtful personal stylist. You choose between candidate outfits that were assembled only from garments the client already owns.
Choose the strongest, most distinct candidates for the brief. You may leave out pieces marked optional, but never add or invent garments. Refer to garments by what they are (e.g. "the camel trench"), never by id.
Explanations are 2-3 warm, specific sentences about colour, proportion, texture and occasion. Do not mention weather unless a forecast is provided in the brief.`

const PRODUCT_SYSTEM = `You classify retail product listings into a fixed clothing taxonomy using only the listing text. Use "other" for non-clothing items. Formality: 1 very casual to 5 black tie.`

export class AnthropicProvider implements AIProvider {
  readonly name = 'anthropic'
  private client = new Anthropic({ apiKey: config.ANTHROPIC_API_KEY, timeout: config.AI_TIMEOUT_MS, maxRetries: 2 })

  private async call<S extends z.ZodType>(opts: {
    schema: S
    system: string
    content: Anthropic.Beta.BetaContentBlockParam[]
    effort: 'low' | 'medium'
  }): Promise<{ result: z.infer<S>; usage: AIUsage }> {
    let response
    try {
      response = await this.client.beta.messages.parse({
        model: config.AI_MODEL,
        max_tokens: 16000,
        // Server-side fallback: if a safeguard declines, the API retries on a fallback model in the same call.
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
        system: opts.system,
        output_config: { effort: opts.effort, format: betaZodOutputFormat(opts.schema) },
        messages: [{ role: 'user', content: opts.content }],
      })
    } catch (err) {
      throw mapError(err)
    }
    if (response.stop_reason === 'refusal') throw new AIError('refused', 'The model declined this request')
    if (response.stop_reason === 'max_tokens') throw new AIError('invalid_output', 'The model response was cut off', true)
    const parsed = response.parsed_output
    if (!parsed) throw new AIError('invalid_output', 'The model response did not match the expected format', true)
    return {
      result: parsed as z.infer<S>,
      usage: {
        model: response.model,
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
        cacheReadTokens: response.usage.cache_read_input_tokens ?? 0,
      },
    }
  }

  recognizeGarments(jpeg: Buffer) {
    return this.call({
      schema: RecognitionSchema,
      system: RECOGNITION_SYSTEM,
      effort: 'low',
      content: [
        { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: jpeg.toString('base64') } },
        { type: 'text', text: 'Catalogue the clothing in this photo.' },
      ],
    })
  }

  pickOutfits(brief: OutfitBrief, candidates: CandidateForAI[], count: number) {
    return this.call({
      schema: OutfitPickSchema,
      system: STYLIST_SYSTEM,
      effort: 'medium',
      content: [
        {
          type: 'text',
          text: `Brief:\n${JSON.stringify(brief, null, 1)}\n\nCandidates (ranked by a rules engine; higher ruleScore is better):\n${JSON.stringify(candidates, null, 1)}\n\nReturn the best ${count} distinct candidate(s).`,
        },
      ],
    })
  }

  classifyProducts(items: { id: string; title: string; hints: string }[]) {
    return this.call({
      schema: ProductClassSchema,
      system: PRODUCT_SYSTEM,
      effort: 'low',
      content: [{ type: 'text', text: `Classify each listing. Return every id.\n${JSON.stringify(items)}` }],
    })
  }
}

function mapError(err: unknown): AIError {
  if (err instanceof Anthropic.AuthenticationError || err instanceof Anthropic.PermissionDeniedError) {
    return new AIError('misconfigured', 'The AI provider rejected the configured credentials')
  }
  if (err instanceof Anthropic.RateLimitError) return new AIError('rate_limited', 'The AI provider is rate limiting requests', true)
  if (err instanceof Anthropic.APIConnectionTimeoutError) return new AIError('timeout', 'The AI provider timed out', true)
  if (err instanceof Anthropic.BadRequestError) return new AIError('invalid_output', `The AI provider rejected the request: ${err.message}`)
  if (err instanceof Anthropic.APIError) return new AIError('unavailable', `AI provider error ${err.status ?? ''}`.trim(), true)
  return new AIError('unavailable', 'The AI provider could not be reached', true)
}
