import { logger } from '../logger'
import { pruneRateLimits } from '../rateLimit'
import { createRun, pruneOldRuns, runDiscovery, sweepEligibleUsers } from '../services/discovery'
import { recognizeAsset } from '../services/garments'
import { enqueue, QUEUES, registerInline } from './queue'

export const handlers = {
  [QUEUES.recognize]: async (data: { assetId: string }) => recognizeAsset(data.assetId),
  [QUEUES.discovery]: async (data: { userId: string; runId: string }) => runDiscovery(data.userId, data.runId),
  [QUEUES.discoverySweep]: async () => {
    const users = await sweepEligibleUsers()
    // Spread the work out to respect provider rate limits.
    for (const [i, userId] of users.entries()) {
      const run = await createRun(userId, 'scheduled')
      await enqueue(QUEUES.discovery, { userId, runId: run.id }, { singletonKey: `discovery:${userId}`, startAfter: Math.floor(i * 4) })
    }
    logger.info({ users: users.length }, 'scheduled discovery queued')
  },
  [QUEUES.maintenance]: async () => {
    await pruneRateLimits()
    await pruneOldRuns()
  },
} as const

export function registerInlineHandlers() {
  for (const [name, h] of Object.entries(handlers)) registerInline(name as keyof typeof handlers, h as (d: unknown) => Promise<void>)
}
