import { eq } from 'drizzle-orm'
import { beforeEach, describe, expect, it } from 'vitest'
import { db, schema } from '../../server/db/client'
import { sentEmails } from '../../server/services/email'
import { storage } from '../../server/storage'
import { addItem, app, onboard, resetDb, signUp } from './helpers'

beforeEach(resetDb)

describe('authentication', () => {
  it('signs up, exposes the session, and signs out', async () => {
    const c = await signUp('ava@example.com')
    const me = await (await c.req('/api/me')).json()
    expect(me.user.email).toBe('ava@example.com')
    expect(me.profile.onboardingCompletedAt).toBeNull()

    const out = await c.req('/api/auth/sign-out', { method: 'POST', json: {} })
    expect(out.status).toBe(200)
    const after = await (await c.req('/api/me')).json()
    expect(after.user).toBeNull()
  })

  it('never stores plaintext passwords', async () => {
    await signUp('hash@example.com', 'correct horse battery')
    const [acct] = await db.select().from(schema.account)
    expect(acct.password).toBeTruthy()
    expect(acct.password).not.toContain('correct horse battery')
  })

  it('rejects wrong passwords and short passwords', async () => {
    await signUp('pw@example.com')
    const bad = await app.request('/api/auth/sign-in/email', {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: 'http://localhost:5173' },
      body: JSON.stringify({ email: 'pw@example.com', password: 'nope-nope-nope' }),
    })
    expect(bad.status).toBe(401)
    const short = await app.request('/api/auth/sign-up/email', {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: 'http://localhost:5173' },
      body: JSON.stringify({ email: 'short@example.com', password: 'short', name: 'S' }),
    })
    expect(short.status).toBe(400)
  })

  it('protects application routes', async () => {
    for (const path of ['/api/wardrobe', '/api/outfits', '/api/discovery', '/api/plans?from=2026-01-01&to=2026-01-07', '/api/insights', '/api/uploads']) {
      const res = await app.request(path)
      expect(res.status, path).toBe(401)
    }
  })

  it('blocks state-changing requests from other origins (CSRF)', async () => {
    const c = await signUp()
    const res = await c.req('/api/me/profile', { method: 'PATCH', json: { department: 'mens' }, headers: { origin: 'https://evil.example' } })
    expect(res.status).toBe(403)
  })

  it('resets a password through the emailed link', async () => {
    await signUp('reset@example.com', 'original password 1')
    sentEmails.length = 0
    const req = await app.request('/api/auth/request-password-reset', {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: 'http://localhost:5173' },
      body: JSON.stringify({ email: 'reset@example.com', redirectTo: 'http://localhost:5173/reset-password' }),
    })
    expect(req.status).toBe(200)
    expect(sentEmails).toHaveLength(1)
    const link = sentEmails[0].text.match(/https?:\/\/\S+/)![0]
    const token = new URL(link).pathname.split('/').pop()!
    const reset = await app.request('/api/auth/reset-password', {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: 'http://localhost:5173' },
      body: JSON.stringify({ newPassword: 'brand new password 2', token }),
    })
    expect(reset.status).toBe(200)
    const signIn = await app.request('/api/auth/sign-in/email', {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: 'http://localhost:5173' },
      body: JSON.stringify({ email: 'reset@example.com', password: 'brand new password 2' }),
    })
    expect(signIn.status).toBe(200)
  })

  it('deletes the account and all associated data and photos', async () => {
    const c = await signUp('gone@example.com', 'delete me please 1')
    await onboard(c)
    await addItem(c, 'top', [240, 240, 236])
    const keys = (await db.select().from(schema.imageAssets)).flatMap((a) => [a.displayKey!, a.thumbKey!])
    expect(keys.length).toBeGreaterThan(0)
    for (const k of keys) await expect(storage.get(k)).resolves.toBeTruthy()

    const res = await c.req('/api/auth/delete-user', { method: 'POST', json: { password: 'delete me please 1' } })
    expect(res.status).toBe(200)
    expect(await db.select().from(schema.user).where(eq(schema.user.email, 'gone@example.com'))).toHaveLength(0)
    expect(await db.select().from(schema.wardrobeItems)).toHaveLength(0)
    expect(await db.select().from(schema.imageAssets)).toHaveLength(0)
    expect(await db.select().from(schema.profiles)).toHaveLength(0)
    for (const k of keys) await expect(storage.get(k)).rejects.toThrow()
  })
})
