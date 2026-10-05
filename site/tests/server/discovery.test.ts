import { eq, sql } from 'drizzle-orm'
import { beforeEach, describe, expect, it } from 'vitest'
import { pairCompatibility, type StyleItem } from '../../shared/styling'
import { db, schema } from '../../server/db/client'
import { matchProduct, planQueries, productStyleItem } from '../../server/services/discovery'
import { extractAttributes } from '../../server/services/products/attributes'
import { mapAwinRow, parseCsv } from '../../server/services/products/feed'
import { isPrivateAddress, safeExternalUrl } from '../../server/services/products/urlSafety'
import { toStyleItem } from '../../server/services/wardrobe'
import { addItem, onboard, resetDb, signUp, type Client } from './helpers'

beforeEach(resetDb)

async function wardrobe(c: Client) {
  await addItem(c, 'top', [240, 240, 236])
  await addItem(c, 'top', [150, 150, 150])
  await addItem(c, 'bottom', [30, 42, 70])
  await addItem(c, 'bottom', [20, 20, 20])
}

describe('product matching', () => {
  it('derives attributes from listing text', () => {
    expect(extractAttributes('Camel Wool Trench Coat Belted')).toMatchObject({ category: 'outerwear', colors: ['beige'] })
    expect(extractAttributes('White Leather Low-Top Sneakers')).toMatchObject({ category: 'shoes', colors: ['white'] })
    expect(extractAttributes('Striped Breton Cotton Top').pattern).toBe('stripe')
  })

  it('computes pair counts from stored wardrobe items with the shared rules', async () => {
    const c = await signUp()
    await onboard(c)
    await wardrobe(c)
    expect((await c.req('/api/discovery/refresh', { method: 'POST' })).status).toBe(202)
    const recs = (await (await c.req('/api/discovery')).json()).recommendations
    expect(recs.length).toBeGreaterThan(0)

    const items = (await db.select().from(schema.wardrobeItems).where(eq(schema.wardrobeItems.userId, c.userId))).map(toStyleItem).filter(Boolean) as StyleItem[]
    for (const r of recs) {
      const [p] = await db.select().from(schema.products).where(eq(schema.products.id, r.product.id))
      const ps = productStyleItem(p)!
      const expected = items.filter((i) => pairCompatibility(ps, i).compatible).length
      expect(r.pairCount).toBe(expected)
      for (const w of r.pairsWith) expect(items.some((i) => i.id === w.id)).toBe(true)
      expect(r.reasons.length).toBeGreaterThan(0)
      expect(r.product.productUrl).toMatch(/^https:\/\//)
    }
  })

  it('saves and dismisses; dismissed products are not suggested again', async () => {
    const c = await signUp()
    await onboard(c)
    await wardrobe(c)
    await c.req('/api/discovery/refresh', { method: 'POST' })
    const recs = (await (await c.req('/api/discovery')).json()).recommendations
    const [first, second] = recs
    await c.req(`/api/discovery/${first.id}/save`, { method: 'POST' })
    await c.req(`/api/discovery/${second.id}/dismiss`, { method: 'POST' })
    const saved = (await (await c.req('/api/discovery?status=saved')).json()).recommendations
    expect(saved.map((r: { id: string }) => r.id)).toEqual([first.id])

    // A later refresh keeps the dismissal and the saved state.
    await db.execute(sql`UPDATE discovery_runs SET created_at = now() - interval '1 hour', status = 'complete'`)
    await c.req('/api/discovery/refresh', { method: 'POST' })
    const fresh = (await (await c.req('/api/discovery')).json()).recommendations
    expect(fresh.find((r: { id: string }) => r.id === second.id)).toBeUndefined()
    const [savedRow] = await db.select().from(schema.productRecommendations).where(eq(schema.productRecommendations.id, first.id))
    expect(savedRow.status).toBe('saved')
  })

  it('excludes avoided colours and products far over budget', () => {
    const wardrobeItems = [{ item: { id: 'w1', category: 'bottom', colors: ['navy'], pattern: 'solid', formality: 2, warmth: 2, seasons: [], occasions: [], styles: [] } as StyleItem, name: 'Jeans', subcategory: 'jeans' }]
    const base = { id: 'p', category: 'top', colors: ['red'], pattern: 'solid', formality: 2, styles: [], priceAmount: '50', subcategory: null }
    const profile = { preferredStyles: [], avoidColors: [] as string[], budgetMin: null, budgetMax: null }
    expect(matchProduct(base, wardrobeItems, profile)).not.toBeNull()
    expect(matchProduct(base, wardrobeItems, { ...profile, avoidColors: ['red'] })).toBeNull()
    expect(matchProduct({ ...base, priceAmount: '500' }, wardrobeItems, { ...profile, budgetMax: 100 })).toBeNull()
  })

  it('plans queries around wardrobe gaps', () => {
    const mk = (category: string, i: number) => ({ id: `${category}${i}`, category, colors: ['white'], pattern: 'solid', formality: 2, warmth: 2, seasons: [], occasions: [], styles: [] }) as StyleItem
    // Plenty of tops and bottoms, nothing else: queries target the real gaps.
    const items = [...[1, 2, 3, 4, 5, 6].map((i) => mk('top', i)), ...[1, 2, 3, 4].map((i) => mk('bottom', i))]
    const q = planQueries({ department: 'womens', preferredStyles: ['minimal'], favoriteColors: [], avoidColors: [] }, items, 4)
    expect(q.length).toBe(4)
    expect(q.every((x) => x.text.startsWith("women's "))).toBe(true)
    expect(q.map((x) => x.category)).not.toContain('top')
    expect(q.map((x) => x.category)).not.toContain('bottom')
    expect(q[0].category).toBe('shoes')
  })

  it('starts with an empty feed rather than placeholder products', async () => {
    const c = await signUp()
    const feed = await (await c.req('/api/discovery')).json()
    expect(feed.recommendations).toEqual([])
    expect(feed.latestRun).toBeNull()
  })
})

describe('external URL safety', () => {
  it('accepts only https URLs on allow-listed hosts', () => {
    expect(safeExternalUrl('https://www.ebay.com/itm/123', ['ebay.com'])).toBe('https://www.ebay.com/itm/123')
    expect(safeExternalUrl('http://www.ebay.com/itm/123', ['ebay.com'])).toBeNull()
    expect(safeExternalUrl('javascript:alert(1)', ['ebay.com'])).toBeNull()
    expect(safeExternalUrl('https://ebay.com.evil.net/x', ['ebay.com'])).toBeNull()
    expect(safeExternalUrl('https://user:pass@ebay.com/x', ['ebay.com'])).toBeNull()
    expect(safeExternalUrl('https://127.0.0.1/x', ['127.0.0.1'])).toBeNull()
    expect(safeExternalUrl('https://ebay.com:8443/x', ['ebay.com'])).toBeNull()
  })

  it('identifies private network addresses (SSRF guard)', () => {
    for (const ip of ['10.0.0.1', '127.0.0.1', '192.168.1.2', '172.16.5.4', '169.254.169.254', '::1', 'fd00::1']) expect(isPrivateAddress(ip), ip).toBe(true)
    expect(isPrivateAddress('93.184.216.34')).toBe(false)
  })

  it('parses affiliate CSV feeds and drops rows with disallowed links', () => {
    const csv = 'aw_product_id,product_name,aw_deep_link,search_price,currency,merchant_name,in_stock,colour\n1,"Camel coat, wool",https://www.awin1.com/pclick.php?p=1,120.00,GBP,Shop A,1,Camel\n2,Bad link,http://evil.example/x,10,GBP,Shop B,1,\n'
    const rows = parseCsv(csv)
    expect(rows).toHaveLength(2)
    expect(rows[0].product_name).toBe('Camel coat, wool')
    const mapped = rows.map((r) => mapAwinRow(r, ['awin1.com']))
    // Link host allow-list comes from PRODUCT_FEED_ALLOWED_LINK_HOSTS (empty in tests) → all rejected.
    expect(mapped.every((m) => m === null)).toBe(true)
  })
})
