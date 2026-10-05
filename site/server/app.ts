import { Hono, type Context } from 'hono'
import { bodyLimit } from 'hono/body-limit'
import { secureHeaders } from 'hono/secure-headers'
import { getConnInfo } from '@hono/node-server/conninfo'
import { auth } from './auth'
import { config } from './config'
import type { Env } from './context'
import { AppError } from './http'
import { logger, reportError } from './logger'
import { adminRoutes } from './routes/admin'
import { discoveryRoutes } from './routes/discovery'
import { healthRoutes } from './routes/health'
import { insightsRoutes } from './routes/insights'
import { meRoutes } from './routes/me'
import { outfitRoutes } from './routes/outfits'
import { planRoutes } from './routes/plans'
import { stylingRoutes } from './routes/styling'
import { uploadRoutes } from './routes/uploads'
import { wardrobeRoutes } from './routes/wardrobe'
import { MAX_UPLOAD_BYTES } from './services/images'

const appOrigin = new URL(config.APP_URL).origin
export const CLIENT_IP_HEADER = 'x-armoire-client-ip'

export function clientIp(c: Context) {
  if (config.TRUST_PROXY) {
    const fwd = c.req.header('x-forwarded-for')?.split(',')[0]?.trim()
    if (fwd) return fwd
  }
  try {
    return getConnInfo(c).remote.address ?? 'unknown'
  } catch {
    return 'unknown'
  }
}

/** Builds the API application (also used directly by integration tests). */
export function createApp() {
  const app = new Hono<Env>()

  app.use('*', async (c, next) => {
    const id = c.req.header('x-request-id') ?? crypto.randomUUID()
    c.set('requestId', id)
    const started = Date.now()
    await next()
    c.header('x-request-id', id)
    if (!c.req.path.startsWith('/api/health')) {
      logger.info({ id, method: c.req.method, path: c.req.path, status: c.res.status, ms: Date.now() - started }, 'request')
    }
  })

  app.use(
    '*',
    secureHeaders({
      contentSecurityPolicy: {
        defaultSrc: ["'self'"],
        imgSrc: ["'self'", 'data:', 'blob:', 'https:', ...(config.S3_ENDPOINT ? [new URL(config.S3_ENDPOINT).origin] : [])],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com'],
        scriptSrc: ["'self'"],
        connectSrc: ["'self'"],
        frameAncestors: ["'none'"],
        formAction: ["'self'"],
        baseUri: ["'self'"],
        objectSrc: ["'none'"],
      },
      referrerPolicy: 'strict-origin-when-cross-origin',
      crossOriginResourcePolicy: 'same-site',
    }),
  )

  // CSRF defence: state-changing API calls must come from the app's own origin.
  app.use('/api/*', async (c, next) => {
    if (!['GET', 'HEAD', 'OPTIONS'].includes(c.req.method) && !c.req.path.startsWith('/api/auth/')) {
      const origin = c.req.header('origin') ?? (c.req.header('referer') ? new URL(c.req.header('referer')!).origin : null)
      if (origin !== appOrigin) throw new AppError(403, 'bad_origin', 'This request was blocked for your security. Reload the page and try again.')
    }
    await next()
  })

  // Pass the verified client IP to auth rate limiting; never trust a client-supplied value.
  app.on(['GET', 'POST'], '/api/auth/*', (c) => {
    const headers = new Headers(c.req.raw.headers)
    headers.set(CLIENT_IP_HEADER, clientIp(c))
    return auth.handler(new Request(c.req.raw, { headers }))
  })

  app.use('/api/uploads', bodyLimit({ maxSize: MAX_UPLOAD_BYTES * 10 + 1024 * 1024, onError: () => { throw new AppError(413, 'payload_too_large', 'That upload is too large. Add up to 10 photos of 15 MB each at a time.') } }))
  app.use('/api/*', async (c, next) => {
    if (c.req.path.startsWith('/api/uploads') || c.req.path.match(/^\/api\/wardrobe\/[^/]+\/image$/)) return next()
    return bodyLimit({ maxSize: 256 * 1024, onError: () => { throw new AppError(413, 'payload_too_large', 'That request is too large.') } })(c, next)
  })

  app.route('/api/health', healthRoutes)
  app.route('/api/me', meRoutes)
  app.route('/api/uploads', uploadRoutes)
  app.route('/api/wardrobe', wardrobeRoutes)
  app.route('/api/styling', stylingRoutes)
  app.route('/api/outfits', outfitRoutes)
  app.route('/api/plans', planRoutes)
  app.route('/api/discovery', discoveryRoutes)
  app.route('/api/insights', insightsRoutes)
  app.route('/api/admin', adminRoutes)

  app.all('/api/*', () => {
    throw new AppError(404, 'not_found', 'Not found')
  })

  app.onError((err, c) => {
    if (err instanceof AppError) {
      return c.json({ error: { code: err.code, message: err.message, ...err.extra } }, err.status)
    }
    reportError(err, { path: c.req.path, method: c.req.method, requestId: c.get('requestId') })
    return c.json({ error: { code: 'internal_error', message: 'Something went wrong on our side. Please try again.' } }, 500)
  })

  return app
}
