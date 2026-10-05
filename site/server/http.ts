import type { Context } from 'hono'
import { HTTPException } from 'hono/http-exception'
import type { ZodType } from 'zod'

/** An error whose message is safe to show to the user. */
export class AppError extends Error {
  constructor(
    public status: 400 | 401 | 403 | 404 | 409 | 413 | 415 | 422 | 429 | 502 | 503,
    public code: string,
    message: string,
    public extra?: Record<string, unknown>,
  ) {
    super(message)
  }
}

export const notFound = (what = 'Not found') => new AppError(404, 'not_found', what)

export async function parseJson<T>(c: Context, schema: ZodType<T>): Promise<T> {
  let body: unknown
  try {
    body = await c.req.json()
  } catch {
    throw new AppError(400, 'invalid_json', 'The request body must be valid JSON.')
  }
  const r = schema.safeParse(body)
  if (!r.success) {
    throw new AppError(422, 'validation_failed', 'Some fields are invalid.', {
      fields: r.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
    })
  }
  return r.data
}

export function parseQuery<T>(c: Context, schema: ZodType<T>): T {
  const r = schema.safeParse(c.req.query())
  if (!r.success) throw new AppError(422, 'validation_failed', 'Some parameters are invalid.')
  return r.data
}

export { HTTPException }
