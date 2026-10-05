import { and, desc, eq, inArray, or, sql } from 'drizzle-orm'
import { Hono } from 'hono'
import { requireUser, type Env } from '../context'
import { db, schema } from '../db/client'
import { AppError, notFound } from '../http'
import { rateLimit } from '../rateLimit'
import { storage } from '../storage'
import { recognizeAsset } from '../services/garments'
import { processUpload } from '../services/images'
import { logger } from '../logger'
import { getOrCreateProfile } from './me'

export const uploadRoutes = new Hono<Env>()
uploadRoutes.use('*', requireUser)

type Asset = typeof schema.imageAssets.$inferSelect

async function serializeAsset(a: Asset, itemCounts?: { review: number; active: number }) {
  return {
    id: a.id,
    status: a.status,
    recognitionStatus: a.recognitionStatus,
    errorCode: a.errorCode,
    originalName: a.originalName,
    thumbUrl: a.thumbKey ? await storage.signedUrl(a.thumbKey) : null,
    createdAt: a.createdAt,
    reviewCount: itemCounts?.review ?? 0,
    activeCount: itemCounts?.active ?? 0,
  }
}

/**
 * Upload one or more photos (multipart field "file"). Each file is decoded
 * and re-encoded server-side, stored privately, then queued for garment
 * recognition. Re-uploading an identical photo returns the existing upload.
 */
uploadRoutes.post('/', async (c) => {
  const u = c.get('user')
  const profile = await getOrCreateProfile(u.id)
  if (!profile.imageConsentAt) {
    throw new AppError(403, 'consent_required', 'Please review how we use your photos and give consent before uploading.')
  }
  const form = await c.req.parseBody({ all: true }).catch(() => {
    throw new AppError(400, 'invalid_upload', 'We couldn’t read that upload. Please try again.')
  })
  const raw = form['file']
  const files = (Array.isArray(raw) ? raw : raw ? [raw] : []).filter((f): f is File => f instanceof File)
  if (!files.length) throw new AppError(422, 'no_file', 'Choose at least one photo to upload.')
  if (files.length > 10) throw new AppError(422, 'too_many_files', 'Upload up to 10 photos at a time.')
  await rateLimit(`upload:${u.id}`, 120, 3600)

  const results = []
  for (const file of files) {
    const name = file.name.slice(0, 120)
    try {
      const processed = await processUpload(Buffer.from(await file.arrayBuffer()))
      const [existing] = await db
        .select()
        .from(schema.imageAssets)
        .where(and(eq(schema.imageAssets.userId, u.id), eq(schema.imageAssets.sha256, processed.sha256)))
      if (existing) {
        results.push({ name, ok: true, duplicate: true, asset: await serializeAsset(existing) })
        continue
      }
      const id = crypto.randomUUID()
      const displayKey = `users/${u.id}/assets/${id}/display.webp`
      const thumbKey = `users/${u.id}/assets/${id}/thumb.webp`
      await storage.put(displayKey, processed.display, 'image/webp')
      await storage.put(thumbKey, processed.thumb, 'image/webp')
      const [asset] = await db
        .insert(schema.imageAssets)
        .values({
          id,
          userId: u.id,
          originalName: name,
          displayKey,
          thumbKey,
          width: processed.width,
          height: processed.height,
          byteSize: processed.display.byteLength,
          sha256: processed.sha256,
          status: 'processed',
          recognitionStatus: 'pending',
        })
        .returning()
      // Runs inline (no background worker deployed): identifies garments
      // synchronously before the upload response returns. recognizeAsset
      // already handles AI-unavailable and transient-failure cases itself.
      try {
        await recognizeAsset(id)
      } catch (err) {
        logger.warn({ err, assetId: id }, 'inline garment recognition failed; item left for manual review')
      }
      const [fresh] = await db.select().from(schema.imageAssets).where(eq(schema.imageAssets.id, id))
      results.push({ name, ok: true, duplicate: false, asset: await serializeAsset(fresh ?? asset) })
    } catch (err) {
      if (err instanceof AppError) results.push({ name, ok: false, error: { code: err.code, message: err.message } })
      else throw err
    }
  }
  const status = results.every((r) => !r.ok) ? 422 : 200
  return c.json({ results }, status)
})

/** Uploads that still need attention: processing, failed, or awaiting review. */
uploadRoutes.get('/', async (c) => {
  const u = c.get('user')
  const counts = db
    .select({
      assetId: schema.wardrobeItems.imageAssetId,
      review: sql<number>`count(*) filter (where ${schema.wardrobeItems.status} = 'review')`.as('review'),
      active: sql<number>`count(*) filter (where ${schema.wardrobeItems.status} <> 'review')`.as('active'),
    })
    .from(schema.wardrobeItems)
    .where(eq(schema.wardrobeItems.userId, u.id))
    .groupBy(schema.wardrobeItems.imageAssetId)
    .as('counts')
  const rows = await db
    .select({ asset: schema.imageAssets, review: counts.review, active: counts.active })
    .from(schema.imageAssets)
    .leftJoin(counts, eq(counts.assetId, schema.imageAssets.id))
    .where(
      and(
        eq(schema.imageAssets.userId, u.id),
        or(inArray(schema.imageAssets.recognitionStatus, ['pending', 'running', 'failed']), sql`coalesce(${counts.review}, 0) > 0`),
      ),
    )
    .orderBy(desc(schema.imageAssets.createdAt))
    .limit(100)
  return c.json({
    uploads: await Promise.all(rows.map((r) => serializeAsset(r.asset, { review: Number(r.review ?? 0), active: Number(r.active ?? 0) }))),
  })
})

uploadRoutes.post('/:id/retry', async (c) => {
  const u = c.get('user')
  const [asset] = await db
    .select()
    .from(schema.imageAssets)
    .where(and(eq(schema.imageAssets.id, c.req.param('id')), eq(schema.imageAssets.userId, u.id)))
  if (!asset) throw notFound('That upload no longer exists.')
  if (asset.recognitionStatus !== 'failed') throw new AppError(409, 'not_failed', 'This photo is not waiting for a retry.')
  await rateLimit(`retry:${u.id}`, 30, 3600)
  await db.update(schema.imageAssets).set({ recognitionStatus: 'pending', recognitionAttempts: 0, errorCode: null }).where(eq(schema.imageAssets.id, asset.id))
  try {
    await recognizeAsset(asset.id)
  } catch (err) {
    logger.warn({ err, assetId: asset.id }, 'inline garment recognition retry failed')
  }
  return c.json({ ok: true })
})

/** Turn a photo whose automatic tagging failed into an item to describe by hand. */
uploadRoutes.post('/:id/describe', async (c) => {
  const u = c.get('user')
  const [asset] = await db
    .select()
    .from(schema.imageAssets)
    .where(and(eq(schema.imageAssets.id, c.req.param('id')), eq(schema.imageAssets.userId, u.id)))
  if (!asset) throw notFound('That upload no longer exists.')
  const [item] = await db.transaction(async (tx) => {
    await tx.update(schema.imageAssets).set({ recognitionStatus: 'unavailable' }).where(eq(schema.imageAssets.id, asset.id))
    return tx
      .insert(schema.wardrobeItems)
      .values({ userId: u.id, imageAssetId: asset.id, imageKey: asset.displayKey, thumbKey: asset.thumbKey, status: 'review' })
      .returning({ id: schema.wardrobeItems.id })
  })
  return c.json({ itemId: item.id })
})

/** Discard an upload and the unreviewed items created from it. */
uploadRoutes.delete('/:id', async (c) => {
  const u = c.get('user')
  const [asset] = await db
    .select()
    .from(schema.imageAssets)
    .where(and(eq(schema.imageAssets.id, c.req.param('id')), eq(schema.imageAssets.userId, u.id)))
  if (!asset) throw notFound('That upload no longer exists.')
  const items = await db.select().from(schema.wardrobeItems).where(eq(schema.wardrobeItems.imageAssetId, asset.id))
  const review = items.filter((i) => i.status === 'review')
  const kept = items.filter((i) => i.status !== 'review')
  const keys = review.flatMap((i) => [i.imageKey, i.thumbKey]).filter((k): k is string => !!k && k !== asset.displayKey && k !== asset.thumbKey)
  if (!kept.length) keys.push(...[asset.displayKey, asset.thumbKey].filter((k): k is string => !!k))
  await db.transaction(async (tx) => {
    if (review.length) await tx.delete(schema.wardrobeItems).where(inArray(schema.wardrobeItems.id, review.map((i) => i.id)))
    if (!kept.length) await tx.delete(schema.imageAssets).where(eq(schema.imageAssets.id, asset.id))
  })
  await storage.deleteMany(keys)
  return c.json({ ok: true, removedItems: review.length })
})
