import pino from 'pino'
import { config } from './config'

/**
 * Structured JSON logs. Credentials, cookies and signed URLs are redacted so
 * they never reach log storage.
 */
export const logger = pino({
  level: config.APP_ENV === 'test' ? 'warn' : config.LOG_LEVEL,
  base: { service: 'armoire' },
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'headers.cookie',
      'headers.authorization',
      '*.password',
      '*.token',
      '*.signedUrl',
      '*.url',
      'apiKey',
    ],
    censor: '[redacted]',
  },
  transport:
    config.APP_ENV === 'development'
      ? { target: 'pino-pretty', options: { colorize: true, ignore: 'pid,hostname,service' } }
      : undefined,
})

type Reporter = (err: unknown, context?: Record<string, unknown>) => void

let reporter: Reporter | null = null

/** Error monitoring hook. Sentry is wired in when SENTRY_DSN is set. */
export async function initErrorReporting() {
  if (!config.SENTRY_DSN) return
  try {
    const mod = (await import(/* @vite-ignore */ '@sentry/node' as string)) as {
      init: (o: object) => void
      captureException: (e: unknown, ctx?: object) => void
    }
    mod.init({ dsn: config.SENTRY_DSN, environment: config.APP_ENV, sendDefaultPii: false })
    reporter = (err, context) => mod.captureException(err, { extra: context })
    logger.info('error reporting enabled')
  } catch {
    logger.warn('SENTRY_DSN is set but @sentry/node is not installed; errors are logged only')
  }
}

export function reportError(err: unknown, context?: Record<string, unknown>) {
  logger.error({ err, ...context }, 'unhandled error')
  reporter?.(err, context)
}
