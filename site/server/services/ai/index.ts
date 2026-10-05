import { and, count, eq, gte } from 'drizzle-orm'
import { config, integrations } from '../../config'
import { db, schema } from '../../db/client'
import { logger } from '../../logger'
import { markIntegration } from '../integrationStatus'
import { AnthropicProvider } from './anthropic'
import { FixtureProvider } from './fixture'
import { GeminiProvider } from './gemini'
import { AIError, type AIProvider, type AIUsage } from './types'

let provider: AIProvider | null | undefined

export function getAI(): AIProvider | null {
  if (provider !== undefined) return provider
  if (!integrations.ai()) provider = null
  else if (config.AI_PROVIDER === 'fixture') provider = new FixtureProvider()
  else if (config.AI_PROVIDER === 'gemini') provider = new GeminiProvider()
  else provider = new AnthropicProvider()
  return provider ?? null
}

/** USD per million tokens [input, output]; cache reads bill at 10% of input. */
const PRICES: Record<string, [number, number]> = {
  'claude-opus-5-5': [4, 20],
  'claude-opus-5': [5, 25],
  'claude-opus-4-8': [5, 25],
  'claude-sonnet-5-5': [2, 10],
  'claude-sonnet-5': [2, 10],
  'claude-haiku-4-5': [1, 5],
  // Free tier (requests/day capped by Google, no billing) — $0 either way.
  'gemini-flash-latest': [0, 0],
  'gemini-flash-lite-latest': [0, 0],
}

export function estimateCost(u: AIUsage) {
  const [i, o] = PRICES[u.model] ?? PRICES[config.AI_MODEL] ?? [0, 0]
  return (u.inputTokens * i + u.outputTokens * o + u.cacheReadTokens * i * 0.1) / 1_000_000
}

/**
 * Runs an AI operation with quota enforcement, latency/usage/cost tracking
 * and integration health reporting.
 */
export async function runAI<T>(operation: string, userId: string | null, fn: (ai: AIProvider) => Promise<{ result: T; usage: AIUsage }>): Promise<T> {
  const ai = getAI()
  if (!ai) throw new AIError('unavailable', 'AI is not configured')
  if (userId) {
    const since = new Date(Date.now() - 24 * 3600 * 1000)
    const [{ n }] = await db
      .select({ n: count() })
      .from(schema.aiUsage)
      .where(and(eq(schema.aiUsage.userId, userId), gte(schema.aiUsage.createdAt, since)))
    if (n >= config.AI_DAILY_USER_LIMIT) throw new AIError('quota_exceeded', 'Daily AI limit reached')
  }
  const started = Date.now()
  try {
    const { result, usage } = await fn(ai)
    await db.insert(schema.aiUsage).values({
      userId,
      operation,
      model: usage.model,
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
      cacheReadTokens: usage.cacheReadTokens,
      costUsd: estimateCost(usage).toFixed(5),
      success: true,
      latencyMs: Date.now() - started,
    })
    await markIntegration('ai', true)
    return result
  } catch (err) {
    const e = err instanceof AIError ? err : new AIError('unavailable', 'Unexpected AI failure', true)
    await db.insert(schema.aiUsage).values({ userId, operation, model: config.AI_MODEL, success: false, latencyMs: Date.now() - started })
    if (e.code !== 'quota_exceeded' && e.code !== 'refused') await markIntegration('ai', false, `${e.code}: ${e.message}`)
    logger.warn({ operation, code: e.code, msg: e.message }, 'ai operation failed')
    throw e
  }
}

export { AIError }
