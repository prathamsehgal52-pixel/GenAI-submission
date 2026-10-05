import { serve } from '@hono/node-server'
import { serveStatic } from '@hono/node-server/serve-static'
import fs from 'node:fs'
import path from 'node:path'
import { createApp } from './app'
import { config } from './config'
import { runMigrations } from './db/migrate'
import { pool } from './db/client'
import { stopBoss } from './jobs/queue'
import { initErrorReporting, logger } from './logger'
import { initStorage } from './storage'

async function main() {
  await initErrorReporting()
  if (process.env.MIGRATE_ON_START === 'true') await runMigrations()
  await initStorage()
  const app = createApp()

  // In production the API also serves the built web app.
  const webRoot = process.env.WEB_ROOT ?? path.resolve('dist')
  if (config.APP_ENV !== 'development' && fs.existsSync(path.join(webRoot, 'index.html'))) {
    const indexHtml = fs.readFileSync(path.join(webRoot, 'index.html'), 'utf8')
    app.use('/assets/*', async (c, next) => {
      await next()
      if (c.res.status === 200) c.header('cache-control', 'public, max-age=31536000, immutable')
    })
    app.use('*', serveStatic({ root: path.relative(process.cwd(), webRoot) }))
    app.get('*', (c) => c.html(indexHtml))
  }

  const server = serve({ fetch: app.fetch, port: config.PORT }, (info) => logger.info({ port: info.port }, 'api listening'))
  let stopping = false
  const shutdown = async () => {
    if (stopping) return
    stopping = true
    logger.info('shutting down')
    server.close()
    await stopBoss()
    await pool.end()
    process.exit(0)
  }
  process.on('SIGTERM', shutdown)
  process.on('SIGINT', shutdown)
}

main().catch((err) => {
  logger.fatal({ err }, 'failed to start')
  process.exit(1)
})
