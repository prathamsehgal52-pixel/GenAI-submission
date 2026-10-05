import { and, eq, inArray, ne } from 'drizzle-orm'
import { pairCompatibility, type StyleItem } from '../../shared/styling'
import type { Category, ColorFamily, Occasion, Pattern, Season } from '../../shared/taxonomy'
import { db, schema } from '../db/client'
import { storage } from '../storage'

export type ItemRow = typeof schema.wardrobeItems.$inferSelect

/** Converts a stored item into the shape the styling rules understand. */
export function toStyleItem(i: ItemRow): StyleItem | null {
  if (!i.category) return null
  return {
    id: i.id,
    category: i.category as Category,
    colors: i.colors as ColorFamily[],
    pattern: i.pattern as Pattern,
    formality: i.formality,
    warmth: i.warmth,
    seasons: i.seasons as Season[],
    occasions: i.occasions as Occasion[],
    styles: i.styles,
  }
}

export async function serializeItem(i: ItemRow, opts: { full?: boolean } = {}) {
  const [thumbUrl, imageUrl] = await Promise.all([
    i.thumbKey ? storage.signedUrl(i.thumbKey) : null,
    opts.full && i.imageKey ? storage.signedUrl(i.imageKey) : null,
  ])
  return {
    id: i.id,
    status: i.status,
    name: i.name,
    category: i.category,
    subcategory: i.subcategory,
    colors: i.colors,
    colorNames: i.colorNames,
    pattern: i.pattern,
    materialEstimate: i.materialEstimate,
    styles: i.styles,
    occasions: i.occasions,
    seasons: i.seasons,
    formality: i.formality,
    warmth: i.warmth,
    details: i.details,
    brand: i.brand,
    notes: i.notes,
    tags: i.tags,
    favorite: i.favorite,
    excludeFromStyling: i.excludeFromStyling,
    aiTagged: !!i.aiAttributes,
    aiConfidence: i.aiConfidence,
    userEditedFields: i.userEditedFields,
    imageAssetId: i.imageAssetId,
    thumbUrl,
    imageUrl,
    createdAt: i.createdAt,
    updatedAt: i.updatedAt,
  }
}

export type SerializedItem = Awaited<ReturnType<typeof serializeItem>>

export async function activeItems(userId: string) {
  return db
    .select()
    .from(schema.wardrobeItems)
    .where(and(eq(schema.wardrobeItems.userId, userId), eq(schema.wardrobeItems.status, 'active')))
}

/** Fetches items by id, constrained to the owner. Missing/foreign ids are dropped. */
export async function ownedItems(userId: string, ids: string[]) {
  if (!ids.length) return []
  return db
    .select()
    .from(schema.wardrobeItems)
    .where(and(eq(schema.wardrobeItems.userId, userId), inArray(schema.wardrobeItems.id, ids)))
}

/** Items in the user's active wardrobe that pair with the given item. */
export function compatibleWith(item: StyleItem, others: StyleItem[]) {
  return others.filter((o) => pairCompatibility(item, o).compatible)
}

/**
 * Deletes an item and any image files that belong only to it. The source
 * photo is removed once no other item references it.
 */
export async function deleteItem(userId: string, itemId: string) {
  const [item] = await db
    .select()
    .from(schema.wardrobeItems)
    .where(and(eq(schema.wardrobeItems.id, itemId), eq(schema.wardrobeItems.userId, userId)))
  if (!item) return false
  const keys: string[] = []
  let assetToDelete: typeof schema.imageAssets.$inferSelect | null = null
  if (item.imageAssetId) {
    const [asset] = await db.select().from(schema.imageAssets).where(eq(schema.imageAssets.id, item.imageAssetId))
    const siblings = await db
      .select({ id: schema.wardrobeItems.id })
      .from(schema.wardrobeItems)
      .where(and(eq(schema.wardrobeItems.imageAssetId, item.imageAssetId), ne(schema.wardrobeItems.id, item.id)))
    if (asset && siblings.length === 0) {
      assetToDelete = asset
      keys.push(...[asset.displayKey, asset.thumbKey].filter((k): k is string => !!k))
    }
    if (asset) {
      // Own crop files (not the shared source photo) can always go.
      for (const k of [item.imageKey, item.thumbKey]) if (k && k !== asset.displayKey && k !== asset.thumbKey) keys.push(k)
    }
  } else {
    keys.push(...[item.imageKey, item.thumbKey].filter((k): k is string => !!k))
  }
  await db.transaction(async (tx) => {
    await tx.delete(schema.wardrobeItems).where(eq(schema.wardrobeItems.id, item.id))
    if (assetToDelete) await tx.delete(schema.imageAssets).where(eq(schema.imageAssets.id, assetToDelete.id))
  })
  await storage.deleteMany([...new Set(keys)])
  return true
}
