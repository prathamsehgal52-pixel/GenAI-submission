import { createMiddleware } from 'hono/factory'
import { auth } from './auth'
import { config } from './config'
import { AppError } from './http'

export type AuthedUser = { id: string; email: string; name: string; emailVerified: boolean; createdAt: Date }
export type Env = { Variables: { user: AuthedUser; requestId: string } }

/** Resolves the session cookie; rejects anonymous requests. */
export const requireUser = createMiddleware<Env>(async (c, next) => {
  const session = await auth.api.getSession({ headers: c.req.raw.headers })
  if (!session) throw new AppError(401, 'unauthenticated', 'Please sign in to continue.')
  const u = session.user
  c.set('user', { id: u.id, email: u.email, name: u.name, emailVerified: u.emailVerified, createdAt: u.createdAt })
  await next()
})

export const requireAdmin = createMiddleware<Env>(async (c, next) => {
  const u = c.get('user')
  if (!config.ADMIN_EMAILS.map((e) => e.toLowerCase()).includes(u.email.toLowerCase())) throw new AppError(404, 'not_found', 'Not found')
  await next()
})

export const isAdmin = (email: string) => config.ADMIN_EMAILS.map((e) => e.toLowerCase()).includes(email.toLowerCase())
