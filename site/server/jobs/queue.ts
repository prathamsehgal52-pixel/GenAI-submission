import PgBoss from 'pg-boss'
import { config } from '../config'
import { logger } from '../logger'

export const QUEUES = {
  recognize: 'recognize-garments',
  discovery: 'discovery-refresh',
  discoverySweep: 'discovery-sweep',
  maintenance: 'maintenance',
} as const

export type QueueName = (typeof QUEUES)[keyof typeof QUEUES]

type Handler = (data: any) => Promise<void>
const inlineHandlers = new Map<string, Handler>()

/**
 * Inline mode runs jobs synchronously inside the request. It exists for the
 * unit/integration test suite only (JOBS_INLINE=true with APP_ENV=test).
 */
export const inline = config.APP_ENV === 'test' && process.env.JOBS_INLINE === 'true'

let boss: PgBoss | null = null
let starting: Promise<PgBoss> | null = null

export function getBoss(): Promise<PgBoss> {
  if (boss) return Promise.resolve(boss)
  starting ??= (async () => {
    const b = new PgBoss({ connectionString: config.DATABASE_URL, schema: 'pgboss', max: 4 })
    b.on('error', (err) => logger.error({ err }, 'job queue error'))
    await b.start()
    for (const name of Object.values(QUEUES)) {
      await b.createQueue(name, {
        name,
        retryLimit: 3,
        retryDelay: 20,
        retryBackoff: true,
        expireInSeconds: 600,
        retentionSeconds: 7 * 24 * 3600,
      })
    }
    boss = b
    return b
  })()
  return starting
}

export function registerInline(name: QueueName, handler: Handler) {
  inlineHandlers.set(name, handler)
}

export async function enqueue(name: QueueName, data: object, opts: { singletonKey?: string; startAfter?: number } = {}) {
  if (inline) {
    // Mirror the queue's semantics: up to 1 + retryLimit attempts, final failure is not surfaced to the caller.
    const h = inlineHandlers.get(name)
    if (!h) return
    for (let attempt = 0; attempt < 4; attempt++) {
      try {
        await h(data)
        return
      } catch (err) {
        if (attempt === 3) logger.warn({ name, err: String(err) }, 'inline job failed')
      }
    }
    return
  }
  const b = await getBoss()
  await b.send(name, data, { singletonKey: opts.singletonKey, startAfter: opts.startAfter })
}

export async function stopBoss() {
  await boss?.stop({ graceful: true, timeout: 10_000 })
  boss = null
  starting = null
}
