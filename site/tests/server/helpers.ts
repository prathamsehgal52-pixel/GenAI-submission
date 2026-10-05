import { sql } from 'drizzle-orm'
import sharp from 'sharp'
import { createApp } from '../../server/app'
import { db } from '../../server/db/client'
import { registerInlineHandlers } from '../../server/jobs/handlers'

registerInlineHandlers()
export const app = createApp()
const ORIGIN = 'http://localhost:5173'

/** Clears all application data between tests (keeps the schema). */
export async function resetDb() {
  await db.execute(sql`TRUNCATE "user", products, rate_limits, integration_status, ai_usage RESTART IDENTITY CASCADE`)
}

export type Client = { cookie: string; userId: string; email: string; req: (path: string, init?: RequestInit & { json?: unknown }) => Promise<Response> }

/** Signs up a fresh user and returns a client carrying its session cookie. */
export async function signUp(email = `u${Math.random().toString(36).slice(2, 8)}@example.com`, password = 'correct horse battery'): Promise<Client> {
  const res = await app.request('/api/auth/sign-up/email', {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: ORIGIN },
    body: JSON.stringify({ email, password, name: 'Test User' }),
  })
  if (res.status !== 200) throw new Error(`signup failed ${res.status} ${await res.text()}`)
  const cookie = (res.headers.getSetCookie?.() ?? []).map((c) => c.split(';')[0]).join('; ')
  const body = (await res.json()) as { user: { id: string } }
  const req = (path: string, init: RequestInit & { json?: unknown } = {}) => {
    const headers = new Headers(init.headers)
    headers.set('cookie', cookie)
    if (!headers.has('origin')) headers.set('origin', ORIGIN)
    if (init.json !== undefined) headers.set('content-type', 'application/json')
    return Promise.resolve(app.request(path, { ...init, headers, body: init.json !== undefined ? JSON.stringify(init.json) : init.body }))
  }
  return { cookie, userId: body.user.id, email, req }
}

export async function onboard(c: Client, profile: Record<string, unknown> = {}) {
  const res = await c.req('/api/me/onboarding', { method: 'POST', json: { imageConsent: true, profile: { department: 'womens', preferredStyles: ['minimal'], ...profile } } })
  if (res.status !== 200) throw new Error(`onboarding failed ${res.status}`)
}

/**
 * Synthetic garment photos for the fixture AI provider, which derives
 * category from aspect ratio (tall → bottom, wide → shoes, square → top)
 * and colour from the mean pixel colour.
 */
export async function garmentPhoto(kind: 'top' | 'bottom' | 'shoes', rgb: [number, number, number]) {
  const [w, h] = kind === 'bottom' ? [400, 700] : kind === 'shoes' ? [700, 400] : [500, 500]
  return sharp({ create: { width: w, height: h, channels: 3, background: { r: rgb[0], g: rgb[1], b: rgb[2] } } }).jpeg().toBuffer()
}

export async function upload(c: Client, file: Buffer, name = 'photo.jpg', type = 'image/jpeg') {
  const form = new FormData()
  form.append('file', new File([new Uint8Array(file)], name, { type }))
  return c.req('/api/uploads', { method: 'POST', body: form })
}

/** Uploads a photo, waits for (inline) recognition, and confirms the item. */
export async function addItem(c: Client, kind: 'top' | 'bottom' | 'shoes', rgb: [number, number, number]) {
  const res = await upload(c, await garmentPhoto(kind, rgb), `${kind}.jpg`)
  const body = (await res.json()) as { results: { ok: boolean; asset: { id: string } }[] }
  if (!body.results[0].ok) throw new Error('upload failed')
  const items = (await (await c.req('/api/wardrobe?status=review&limit=120')).json()) as { items: { id: string; imageAssetId: string }[] }
  const item = items.items.find((i) => i.imageAssetId === body.results[0].asset.id)!
  const confirm = await c.req('/api/wardrobe/confirm', { method: 'POST', json: { ids: [item.id] } })
  if (confirm.status !== 200) throw new Error('confirm failed')
  return item.id
}
