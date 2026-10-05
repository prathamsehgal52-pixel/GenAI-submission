import { config } from './config'
import { handlers } from './jobs/handlers'
import { getBoss, QUEUES, stopBoss } from './jobs/queue'
import { initErrorReporting, logger, reportError } from './logger'
import { initStorage } from './storage'

/**
 * Background worker: garment recognition, discovery refreshes and scheduled
 * maintenance. Run one or more instances alongside the API.
 */
async function main() {
  await initErrorReporting()
  await initStorage()
  const boss = await getBoss()
  const concurrency: Record<string, number> = { [QUEUES.recognize]: 3, [QUEUES.discovery]: 2, [QUEUES.discoverySweep]: 1, [QUEUES.maintenance]: 1 }
  for (const [name, handler] of Object.entries(handlers)) {
    // Each registration is an independent poller, so N registrations = N concurrent jobs.
    for (let i = 0; i < (concurrency[name] ?? 1); i++) {
      await boss.work<Record<string, unknown>>(name, { batchSize: 1, pollingIntervalSeconds: 2 }, async ([job]) => {
        try {
          await (handler as (d: unknown) => Promise<void>)(job.data)
        } catch (err) {
          reportError(err, { queue: name, jobId: job.id })
          throw err
        }
      })
    }
  }
  await boss.schedule(QUEUES.discoverySweep, config.DISCOVERY_CRON, {}, { tz: 'UTC' })
  await boss.schedule(QUEUES.maintenance, '15 3 * * *', {}, { tz: 'UTC' })
  logger.info('worker started')
  // Plain readiness line for process supervisors and the e2e harness (independent of log level).
  process.stdout.write('worker ready\n')

  const shutdown = async () => {
    logger.info('worker stopping')
    await stopBoss()
    process.exit(0)
  }
  process.on('SIGTERM', shutdown)
  process.on('SIGINT', shutdown)
}

main().catch((err) => {
  logger.fatal({ err }, 'worker failed to start')
  process.exit(1)
})
