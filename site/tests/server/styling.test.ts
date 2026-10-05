import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { colorHarmony, evaluateOutfit, pairCompatibility, type StyleItem } from '../../shared/styling'
import { FixtureProvider } from '../../server/services/ai/fixture'
import { addItem, onboard, resetDb, signUp, type Client } from './helpers'

beforeEach(resetDb)
afterEach(() => vi.restoreAllMocks())

const item = (over: Partial<StyleItem>): StyleItem => ({ id: Math.random().toString(), category: 'top', colors: ['white'], pattern: 'solid', formality: 2, warmth: 2, seasons: [], occasions: [], styles: [], ...over })

describe('styling rules', () => {
  it('treats neutrals as universally compatible and flags clashes', () => {
    expect(colorHarmony('navy', 'red').score).toBe(1)
    expect(colorHarmony('blue', 'orange').reason).toBe('complementary')
    expect(colorHarmony('red', 'green').score).toBeLessThan(colorHarmony('red', 'pink').score)
  })

  it('never pairs a dress with a top or bottom, or two of the same category', () => {
    expect(pairCompatibility(item({ category: 'dress' }), item({ category: 'top' })).compatible).toBe(false)
    expect(pairCompatibility(item({ category: 'top' }), item({ category: 'top' })).compatible).toBe(false)
    expect(pairCompatibility(item({ category: 'top' }), item({ category: 'bottom', colors: ['navy'] })).compatible).toBe(true)
  })

  it('rejects large formality gaps and penalises two bold patterns', () => {
    expect(pairCompatibility(item({ formality: 1 }), item({ category: 'bottom', formality: 5 })).compatible).toBe(false)
    const plain = pairCompatibility(item({ pattern: 'stripe' }), item({ category: 'bottom', pattern: 'solid' })).score
    const busy = pairCompatibility(item({ pattern: 'stripe' }), item({ category: 'bottom', pattern: 'floral' })).score
    expect(busy).toBeLessThan(plain)
  })

  it('only mentions weather when a temperature is supplied', () => {
    const outfit = [item({}), item({ category: 'bottom', colors: ['navy'] })]
    expect(evaluateOutfit(outfit, { occasion: 'weekend' }).factors.some((f) => f.label === 'Weather')).toBe(false)
    expect(evaluateOutfit(outfit, { occasion: 'weekend', temperatureC: 4 }).factors.some((f) => f.label === 'Weather')).toBe(true)
  })
})

async function wardrobe(c: Client) {
  const ids = {
    whiteTop: await addItem(c, 'top', [240, 240, 236]),
    greyTop: await addItem(c, 'top', [150, 150, 150]),
    navyBottom: await addItem(c, 'bottom', [30, 42, 70]),
    blackBottom: await addItem(c, 'bottom', [20, 20, 20]),
    shoes: await addItem(c, 'shoes', [120, 80, 50]),
  }
  return ids
}

describe('outfit generation', () => {
  it('explains what is missing when the wardrobe is too small', async () => {
    const c = await signUp()
    await onboard(c)
    await addItem(c, 'top', [240, 240, 236])
    const r = await (await c.req('/api/styling', { method: 'POST', json: { occasion: 'weekend' } })).json()
    expect(r.status).toBe('insufficient')
    expect(r.missing).toEqual(['bottom'])
  })

  it('builds outfits only from the user’s own active items', async () => {
    const c = await signUp()
    await onboard(c)
    const ids = await wardrobe(c)
    await c.req(`/api/wardrobe/${ids.greyTop}`, { method: 'PATCH', json: { status: 'archived' } })
    const r = await (await c.req('/api/styling', { method: 'POST', json: { occasion: 'weekend', count: 3 } })).json()
    expect(r.status).toBe('complete')
    expect(r.outfits.length).toBeGreaterThan(0)
    const allowed = new Set([ids.whiteTop, ids.navyBottom, ids.blackBottom, ids.shoes])
    for (const o of r.outfits) {
      for (const p of o.items) expect(allowed.has(p.item.id)).toBe(true)
      const roles = o.items.map((p: { role: string }) => p.role)
      expect(roles).toContain('top')
      expect(roles).toContain('bottom')
      expect(o.explanation.length).toBeGreaterThan(10)
    }
  })

  it('discards AI picks that reference unknown candidates or remove required pieces', async () => {
    const c = await signUp()
    await onboard(c)
    const ids = await wardrobe(c)
    vi.spyOn(FixtureProvider.prototype, 'pickOutfits').mockResolvedValue({
      usage: { model: 'fixture', inputTokens: 0, outputTokens: 0, cacheReadTokens: 0 },
      result: {
        picks: [
          { candidate: 99, remove_item_ids: [], title: 'Ghost', explanation: 'Invented garments.' },
          { candidate: 0, remove_item_ids: [ids.whiteTop, ids.greyTop, ids.navyBottom, ids.blackBottom], title: 'Valid look', explanation: 'Pairs crisp white with dark denim.' },
        ],
      },
    })
    const r = await (await c.req('/api/styling', { method: 'POST', json: { occasion: 'weekend' } })).json()
    expect(r.outfits).toHaveLength(1)
    expect(r.outfits[0].title).toBe('Valid look')
    // Required pieces (top/bottom) survived the attempted removal.
    const roles = r.outfits[0].items.map((p: { role: string }) => p.role)
    expect(roles).toEqual(expect.arrayContaining(['top', 'bottom']))
  })

  it('falls back to rule-based explanations when the AI fails', async () => {
    const c = await signUp()
    await onboard(c)
    await wardrobe(c)
    vi.spyOn(FixtureProvider.prototype, 'pickOutfits').mockRejectedValue(new Error('boom'))
    const res = await c.req('/api/styling', { method: 'POST', json: { occasion: 'work' } })
    expect(res.status).toBe(200)
    const r = await res.json()
    expect(r.source).toBe('rules')
    expect(r.outfits[0].explanationSource).toBe('rules')
  })

  it('honours "wear this" and "not this"', async () => {
    const c = await signUp()
    await onboard(c)
    const ids = await wardrobe(c)
    const r = await (await c.req('/api/styling', { method: 'POST', json: { occasion: 'weekend', includeItemIds: [ids.greyTop], avoidItemIds: [ids.navyBottom] } })).json()
    for (const o of r.outfits) {
      const used = o.items.map((p: { item: { id: string } }) => p.item.id)
      expect(used).toContain(ids.greyTop)
      expect(used).not.toContain(ids.navyBottom)
    }
  })

  it('saves, unsaves and regenerates something different', async () => {
    const c = await signUp()
    await onboard(c)
    await wardrobe(c)
    const first = await (await c.req('/api/styling', { method: 'POST', json: { occasion: 'weekend', count: 1 } })).json()
    const id = first.outfits[0].id
    expect((await c.req(`/api/outfits/${id}/save`, { method: 'POST' })).status).toBe(200)
    expect((await (await c.req('/api/outfits?saved=true')).json()).outfits.map((o: { id: string }) => o.id)).toEqual([id])

    const again = await (await c.req('/api/styling', { method: 'POST', json: { occasion: 'weekend', count: 1, excludeOutfitIds: [id] } })).json()
    const core = (o: { items: { role: string; item: { id: string } }[] }) => o.items.filter((p) => p.role === 'top' || p.role === 'bottom').map((p) => p.item.id).sort().join()
    expect(core(again.outfits[0])).not.toBe(core(first.outfits[0]))

    await c.req(`/api/outfits/${id}/save`, { method: 'DELETE' })
    expect((await (await c.req('/api/outfits?saved=true')).json()).outfits).toHaveLength(0)
  })

  it('reuses an identical recent request instead of recomputing', async () => {
    const c = await signUp()
    await onboard(c)
    await wardrobe(c)
    const spy = vi.spyOn(FixtureProvider.prototype, 'pickOutfits')
    const a = await (await c.req('/api/styling', { method: 'POST', json: { occasion: 'weekend' } })).json()
    const b = await (await c.req('/api/styling', { method: 'POST', json: { occasion: 'weekend' } })).json()
    expect(b.cached).toBe(true)
    expect(b.requestId).toBe(a.requestId)
    expect(spy).toHaveBeenCalledTimes(1)
  })

  it('swaps a piece only for another item of the same category', async () => {
    const c = await signUp()
    await onboard(c)
    const ids = await wardrobe(c)
    const r = await (await c.req('/api/styling', { method: 'POST', json: { occasion: 'weekend', count: 1, includeItemIds: [ids.whiteTop] } })).json()
    const o = r.outfits[0]
    const alts = await (await c.req(`/api/outfits/${o.id}/alternatives?itemId=${ids.whiteTop}`)).json()
    expect(alts.alternatives.map((a: { item: { id: string } }) => a.item.id)).toEqual([ids.greyTop])
    expect((await c.req(`/api/outfits/${o.id}/replace`, { method: 'POST', json: { itemId: ids.whiteTop, withItemId: ids.shoes } })).status).toBe(422)
    const ok = await (await c.req(`/api/outfits/${o.id}/replace`, { method: 'POST', json: { itemId: ids.whiteTop, withItemId: ids.greyTop } })).json()
    expect(ok.outfit.items.map((p: { item: { id: string } }) => p.item.id)).toContain(ids.greyTop)
    expect(ok.outfit.explanationSource).toBe('rules')
  })

  it('records feedback and plans looks', async () => {
    const c = await signUp()
    await onboard(c)
    await wardrobe(c)
    const r = await (await c.req('/api/styling', { method: 'POST', json: { occasion: 'weekend', count: 1 } })).json()
    const id = r.outfits[0].id
    expect((await (await c.req(`/api/outfits/${id}/feedback`, { method: 'POST', json: { value: 1 } })).json()).feedback).toBe(1)
    const plan = await (await c.req('/api/plans', { method: 'POST', json: { outfitId: id, date: '2030-06-01' } })).json()
    await c.req(`/api/plans/${plan.plan.id}`, { method: 'PATCH', json: { worn: true } })
    const week = await (await c.req('/api/plans?from=2030-06-01&to=2030-06-07')).json()
    expect(week.plans).toHaveLength(1)
    expect(week.plans[0].worn).toBe(true)
    // Planning keeps the look saved.
    expect((await (await c.req('/api/outfits?saved=true')).json()).outfits).toHaveLength(1)
  })
})

describe('insights', () => {
  it('separates measured activity from calculated potential', async () => {
    const c = await signUp()
    await onboard(c)
    await wardrobe(c)
    const i = await (await c.req('/api/insights')).json()
    expect(i.calculated.totalItems).toBe(5)
    expect(i.calculated.categories).toMatchObject({ top: 2, bottom: 2, shoes: 1 })
    expect(i.calculated.baseOutfits).toBe(4)
    expect(i.measured.savedLooks).toBe(0)
  })
})
