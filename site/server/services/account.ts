import { eq } from 'drizzle-orm'
import { db, schema } from '../db/client'
import { logger } from '../logger'
import { storage } from '../storage'

/**
 * Removes everything a user owns outside the cascading database rows: stored
 * photos and crops. Database rows are removed by ON DELETE CASCADE when the
 * auth user is deleted.
 */
export async function deleteUserData(userId: string) {
  const assets = await db
    .select({ d: schema.imageAssets.displayKey, t: schema.imageAssets.thumbKey })
    .from(schema.imageAssets)
    .where(eq(schema.imageAssets.userId, userId))
  const items = await db
    .select({ i: schema.wardrobeItems.imageKey, t: schema.wardrobeItems.thumbKey })
    .from(schema.wardrobeItems)
    .where(eq(schema.wardrobeItems.userId, userId))
  const keys = [...assets.flatMap((a) => [a.d, a.t]), ...items.flatMap((i) => [i.i, i.t])].filter((k): k is string => !!k)
  await storage.deleteMany([...new Set(keys)])
  logger.info({ userId, objects: keys.length }, 'user media deleted')
}
