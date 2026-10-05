import { and, eq } from 'drizzle-orm'
import { CATEGORIES, COLOR_FAMILIES, OCCASIONS, PATTERNS, SEASONS, STYLES } from '../../shared/taxonomy'
import { db, schema } from '../db/client'
import type { Crop } from '../db/schema'
import { logger } from '../logger'
import { storage } from '../storage'
import { AIError, getAI, runAI } from './ai'
import type { RecognizedGarment } from './ai/types'
import { cropGarment, forVision, isValidCrop } from './images'

const MAX_ATTEMPTS = 3
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * Drives recognizeAsset to a terminal state (complete/unavailable/failed)
 * within this call. recognizeAsset() throws on a retryable failure expecting
 * something to call it again later with backoff — that's normally a
 * background worker, but there isn't one deployed here, so retry inline
 * instead of leaving the asset stuck at 'pending' forever.
 */
export async function recognizeAssetWithRetries(assetId: string) {
  for (let i = 0; i < MAX_ATTEMPTS; i++) {
    try {
      await recognizeAsset(assetId)
      return
    } catch (err) {
      if (i === MAX_ATTEMPTS - 1) throw err
      await sleep(800 * (i + 1))
    }
  }
}

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, Math.round(Number.isFinite(n) ? n : lo)))
const only = <T extends string>(allowed: readonly T[], values: string[]) => [...new Set(values.filter((v): v is T => (allowed as readonly string[]).includes(v)))]
const text = (s: string | null | undefined, max: number) => (s ?? '').replace(/\s+/g, ' ').trim().slice(0, max)

/** Re-validates and normalises AI output before it is stored. */
export function sanitizeGarment(g: RecognizedGarment) {
  const colors = g.colors.filter((c) => (COLOR_FAMILIES as readonly string[]).includes(c.family)).slice(0, 3)
  return {
    name: text(g.name, 80) || text(g.subcategory, 80),
    category: (CATEGORIES as readonly string[]).includes(g.category) ? g.category : null,
    subcategory: text(g.subcategory, 60) || null,
    colors: [...new Set(colors.map((c) => c.family))],
    colorNames: colors.map((c) => text(c.name, 30)).filter(Boolean),
    pattern: (PATTERNS as readonly string[]).includes(g.pattern) ? g.pattern : 'solid',
    materialEstimate: text(g.material_estimate, 80) || null,
    styles: only(STYLES, g.styles),
    occasions: only(OCCASIONS, g.occasions),
    seasons: only(SEASONS, g.seasons),
    formality: clamp(g.formality, 1, 5),
    warmth: clamp(g.warmth, 1, 5),
    details: g.details.map((d) => text(d, 60)).filter(Boolean).slice(0, 5),
    confidence: Math.min(1, Math.max(0, Number(g.confidence) || 0)),
  }
}

/**
 * Background job: identify garments in an uploaded photo and create
 * wardrobe items in the "review" state. Retries transient AI failures; after
 * the final attempt the asset is marked failed and the user can retry or
 * add details manually.
 */
export async function recognizeAsset(assetId: string) {
  const [asset] = await db.select().from(schema.imageAssets).where(eq(schema.imageAssets.id, assetId))
  if (!asset || asset.status !== 'processed' || asset.recognitionStatus === 'complete') return

  if (!getAI()) {
    await db.transaction(async (tx) => {
      await tx.update(schema.imageAssets).set({ recognitionStatus: 'unavailable' }).where(eq(schema.imageAssets.id, assetId))
      const existing = await tx.select({ id: schema.wardrobeItems.id }).from(schema.wardrobeItems).where(eq(schema.wardrobeItems.imageAssetId, assetId))
      if (!existing.length) {
        await tx.insert(schema.wardrobeItems).values({ userId: asset.userId, imageAssetId: assetId, imageKey: asset.displayKey, thumbKey: asset.thumbKey, status: 'review' })
      }
    })
    return
  }

  const attempt = asset.recognitionAttempts + 1
  await db.update(schema.imageAssets).set({ recognitionStatus: 'running', recognitionAttempts: attempt }).where(eq(schema.imageAssets.id, assetId))

  try {
    const display = await storage.get(asset.displayKey!)
    const recognition = await runAI('recognize_garments', asset.userId, (ai) => forVision(display).then((jpeg) => ai.recognizeGarments(jpeg)))
    const garments = recognition.contains_clothing ? recognition.garments.slice(0, 6) : []
    const multiple = garments.length > 1

    const rows: (typeof schema.wardrobeItems.$inferInsert)[] = []
    for (const g of garments) {
      const clean = sanitizeGarment(g)
      const crop: Crop = { x: g.box.x, y: g.box.y, w: g.box.w, h: g.box.h }
      const id = crypto.randomUUID()
      let imageKey = asset.displayKey
      let thumbKey = asset.thumbKey
      let storedCrop: Crop | null = null
      if (multiple && isValidCrop(crop) && crop.w * crop.h < 0.85) {
        const cut = await cropGarment(display, crop)
        imageKey = `users/${asset.userId}/items/${id}/image.webp`
        thumbKey = `users/${asset.userId}/items/${id}/thumb.webp`
        await storage.put(imageKey, cut.image, 'image/webp')
        await storage.put(thumbKey, cut.thumb, 'image/webp')
        storedCrop = crop
      }
      const { confidence, ...attrs } = clean
      rows.push({
        id,
        userId: asset.userId,
        imageAssetId: assetId,
        crop: storedCrop,
        imageKey,
        thumbKey,
        status: 'review',
        ...attrs,
        aiAttributes: g as unknown as Record<string, unknown>,
        aiConfidence: confidence,
      })
    }

    await db.transaction(async (tx) => {
      // Idempotent: replace any review items from an earlier partial run.
      await tx.delete(schema.wardrobeItems).where(and(eq(schema.wardrobeItems.imageAssetId, assetId), eq(schema.wardrobeItems.status, 'review')))
      if (rows.length) await tx.insert(schema.wardrobeItems).values(rows)
      else {
        // Nothing recognisable: keep the photo available so the user can describe it.
        await tx.insert(schema.wardrobeItems).values({ userId: asset.userId, imageAssetId: assetId, imageKey: asset.displayKey, thumbKey: asset.thumbKey, status: 'review' })
      }
      await tx
        .update(schema.imageAssets)
        .set({ recognitionStatus: 'complete', errorCode: rows.length ? null : 'no_clothing_detected' })
        .where(eq(schema.imageAssets.id, assetId))
    })
  } catch (err) {
    const e = err instanceof AIError ? err : null
    const retry = (e ? e.retryable : true) && attempt < MAX_ATTEMPTS
    if (!e) logger.error({ err, assetId }, 'garment recognition failed')
    await db
      .update(schema.imageAssets)
      .set({ recognitionStatus: retry ? 'pending' : 'failed', errorCode: e?.code ?? 'processing_error' })
      .where(eq(schema.imageAssets.id, assetId))
    if (retry) throw err // let the queue retry with backoff
  }
}
