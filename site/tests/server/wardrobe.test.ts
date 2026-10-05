import { eq } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { db, schema } from '../../server/db/client'
import { FixtureProvider } from '../../server/services/ai/fixture'
import { AIError } from '../../server/services/ai/types'
import { storage } from '../../server/storage'
import { addItem, garmentPhoto, onboard, resetDb, signUp, upload } from './helpers'

beforeEach(resetDb)
afterEach(() => vi.restoreAllMocks())

describe('uploads', () => {
  it('requires consent before accepting photos', async () => {
    const c = await signUp()
    const res = await upload(c, await garmentPhoto('top', [240, 240, 240]))
    expect(res.status).toBe(403)
    expect((await res.json()).error.code).toBe('consent_required')
  })

  it('rejects files that are not decodable images, whatever their name or type', async () => {
    const c = await signUp()
    await onboard(c)
    const res = await upload(c, Buffer.from('<?php echo "hi"; ?>'.repeat(50)), 'evil.jpg', 'image/jpeg')
    expect(res.status).toBe(422)
    const body = await res.json()
    expect(body.results[0].ok).toBe(false)
    expect(body.results[0].error.code).toBe('unsupported_image')
  })

  it('rejects tiny images and oversized files', async () => {
    const c = await signUp()
    await onboard(c)
    const sharp = (await import('sharp')).default
    const tiny = await sharp({ create: { width: 50, height: 50, channels: 3, background: '#fff' } }).png().toBuffer()
    expect((await (await upload(c, tiny, 'tiny.png', 'image/png')).json()).results[0].error.code).toBe('image_too_small')
    const big = Buffer.alloc(16 * 1024 * 1024, 1)
    expect((await (await upload(c, big)).json()).results[0].error.code).toBe('file_too_large')
  })

  it('strips metadata and creates a review item from recognition', async () => {
    const c = await signUp()
    await onboard(c)
    const res = await upload(c, await garmentPhoto('bottom', [30, 42, 70]))
    expect(res.status).toBe(200)
    const [asset] = await db.select().from(schema.imageAssets)
    expect(asset.recognitionStatus).toBe('complete')
    const sharp = (await import('sharp')).default
    const meta = await sharp(await storage.get(asset.displayKey!)).metadata()
    expect(meta.format).toBe('webp')
    expect(meta.exif).toBeUndefined()
    const review = await (await c.req('/api/wardrobe?status=review')).json()
    expect(review.items).toHaveLength(1)
    expect(review.items[0]).toMatchObject({ category: 'bottom', colors: ['navy'], aiTagged: true, status: 'review' })
  })

  it('returns the existing upload for an identical photo (idempotent)', async () => {
    const c = await signUp()
    await onboard(c)
    const photo = await garmentPhoto('top', [240, 240, 236])
    await upload(c, photo)
    const second = await (await upload(c, photo)).json()
    expect(second.results[0].duplicate).toBe(true)
    expect(await db.select().from(schema.imageAssets)).toHaveLength(1)
  })

  it('retries transient AI failures, then marks the photo failed and allows a retry', async () => {
    const c = await signUp()
    await onboard(c)
    const spy = vi.spyOn(FixtureProvider.prototype, 'recognizeGarments').mockRejectedValue(new AIError('unavailable', 'down', true))
    await upload(c, await garmentPhoto('top', [240, 240, 236]))
    const [asset] = await db.select().from(schema.imageAssets)
    expect(asset.recognitionStatus).toBe('failed')
    expect(asset.recognitionAttempts).toBe(3)
    expect(spy).toHaveBeenCalledTimes(3)
    // Never shown as processed: no review items were created.
    expect((await (await c.req('/api/wardrobe?status=review')).json()).items).toHaveLength(0)
    const pending = await (await c.req('/api/uploads')).json()
    expect(pending.uploads[0].recognitionStatus).toBe('failed')

    spy.mockRestore()
    const retry = await c.req(`/api/uploads/${asset.id}/retry`, { method: 'POST' })
    expect(retry.status).toBe(200)
    const [after] = await db.select().from(schema.imageAssets)
    expect(after.recognitionStatus).toBe('complete')
  })

  it('lets the user describe a photo whose tagging failed', async () => {
    const c = await signUp()
    await onboard(c)
    vi.spyOn(FixtureProvider.prototype, 'recognizeGarments').mockRejectedValue(new AIError('refused', 'no', false))
    await upload(c, await garmentPhoto('top', [240, 240, 236]))
    const [asset] = await db.select().from(schema.imageAssets)
    expect(asset.recognitionStatus).toBe('failed')
    expect(asset.recognitionAttempts).toBe(1)
    const res = await (await c.req(`/api/uploads/${asset.id}/describe`, { method: 'POST' })).json()
    const item = await (await c.req(`/api/wardrobe/${res.itemId}`)).json()
    expect(item.item).toMatchObject({ status: 'review', category: null, aiTagged: false })
  })
})

describe('wardrobe management', () => {
  it('requires a category before an item joins the wardrobe', async () => {
    const c = await signUp()
    await onboard(c)
    vi.spyOn(FixtureProvider.prototype, 'recognizeGarments').mockRejectedValue(new AIError('refused', 'no', false))
    await upload(c, await garmentPhoto('top', [240, 240, 236]))
    const [asset] = await db.select().from(schema.imageAssets)
    const { itemId } = await (await c.req(`/api/uploads/${asset.id}/describe`, { method: 'POST' })).json()
    expect((await c.req('/api/wardrobe/confirm', { method: 'POST', json: { ids: [itemId] } })).status).toBe(422)
    expect((await c.req(`/api/wardrobe/${itemId}`, { method: 'PATCH', json: { status: 'active' } })).status).toBe(422)
    const ok = await c.req(`/api/wardrobe/${itemId}`, { method: 'PATCH', json: { category: 'top', status: 'active' } })
    expect(ok.status).toBe(200)
  })

  it('edits attributes and records which fields the user confirmed', async () => {
    const c = await signUp()
    await onboard(c)
    const id = await addItem(c, 'top', [240, 240, 236])
    const res = await c.req(`/api/wardrobe/${id}`, { method: 'PATCH', json: { name: 'Linen shirt', colors: ['beige'], notes: 'Hand wash', tags: ['summer'], favorite: true } })
    const { item } = await res.json()
    expect(item).toMatchObject({ name: 'Linen shirt', colors: ['beige'], notes: 'Hand wash', tags: ['summer'], favorite: true })
    expect(item.userEditedFields).toEqual(expect.arrayContaining(['name', 'colors']))
    expect(item.userEditedFields).not.toContain('notes')
  })

  it('validates edits on the server', async () => {
    const c = await signUp()
    await onboard(c)
    const id = await addItem(c, 'top', [240, 240, 236])
    const bad = await c.req(`/api/wardrobe/${id}`, { method: 'PATCH', json: { formality: 9, colors: ['chartreuse'] } })
    expect(bad.status).toBe(422)
  })

  it('filters, searches and counts', async () => {
    const c = await signUp()
    await onboard(c)
    const white = await addItem(c, 'top', [240, 240, 236])
    await addItem(c, 'bottom', [30, 42, 70])
    await addItem(c, 'shoes', [20, 20, 20])
    await c.req(`/api/wardrobe/${white}`, { method: 'PATCH', json: { name: 'Poplin shirt', tags: ['office'] } })

    const tops = await (await c.req('/api/wardrobe?category=top')).json()
    expect(tops.items.map((i: { id: string }) => i.id)).toEqual([white])
    const navy = await (await c.req('/api/wardrobe?color=navy')).json()
    expect(navy.items).toHaveLength(1)
    const search = await (await c.req('/api/wardrobe?q=office')).json()
    expect(search.items.map((i: { id: string }) => i.id)).toEqual([white])
    const injection = await c.req(`/api/wardrobe?q=${encodeURIComponent("%' OR 1=1 --")}`)
    expect(injection.status).toBe(200)
    expect((await injection.json()).items).toHaveLength(0)
    const facets = await (await c.req('/api/wardrobe/facets')).json()
    expect(facets.categories).toMatchObject({ top: 1, bottom: 1, shoes: 1 })
    expect(facets.statuses.active).toBe(3)
  })

  it('archives, restores and deletes (removing the photo)', async () => {
    const c = await signUp()
    await onboard(c)
    const id = await addItem(c, 'top', [240, 240, 236])
    await c.req(`/api/wardrobe/${id}`, { method: 'PATCH', json: { status: 'archived' } })
    expect((await (await c.req('/api/wardrobe')).json()).items).toHaveLength(0)
    expect((await (await c.req('/api/wardrobe?status=archived')).json()).items).toHaveLength(1)
    await c.req(`/api/wardrobe/${id}`, { method: 'PATCH', json: { status: 'active' } })
    const [asset] = await db.select().from(schema.imageAssets)
    expect((await c.req(`/api/wardrobe/${id}`, { method: 'DELETE' })).status).toBe(200)
    expect(await db.select().from(schema.wardrobeItems).where(eq(schema.wardrobeItems.id, id))).toHaveLength(0)
    await expect(storage.get(asset.displayKey!)).rejects.toThrow()
  })

  it('replaces an item photo and keeps its attributes', async () => {
    const c = await signUp()
    await onboard(c)
    const id = await addItem(c, 'top', [240, 240, 236])
    await c.req(`/api/wardrobe/${id}`, { method: 'PATCH', json: { name: 'Keep me' } })
    const form = new FormData()
    form.append('file', new File([new Uint8Array(await garmentPhoto('top', [190, 50, 40]))], 'new.jpg', { type: 'image/jpeg' }))
    const res = await c.req(`/api/wardrobe/${id}/image`, { method: 'PUT', body: form })
    expect(res.status).toBe(200)
    const [row] = await db.select().from(schema.wardrobeItems).where(eq(schema.wardrobeItems.id, id))
    expect(row.name).toBe('Keep me')
    expect(row.imageKey).toContain(`/items/${id}/`)
  })
})
