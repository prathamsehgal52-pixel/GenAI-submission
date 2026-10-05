import { beforeEach, describe, expect, it } from 'vitest'
import { db, schema } from '../../server/db/client'
import { addItem, onboard, resetDb, signUp } from './helpers'

beforeEach(resetDb)

/** Every user-owned resource must be invisible and immutable to other users. */
describe('cross-user authorization', () => {
  it('isolates wardrobe items, outfits, plans, uploads and recommendations', async () => {
    const a = await signUp('a@example.com')
    const b = await signUp('b@example.com')
    await onboard(a)
    await onboard(b)
    const top = await addItem(a, 'top', [240, 240, 236])
    await addItem(a, 'bottom', [30, 42, 70])
    await addItem(a, 'shoes', [20, 20, 20])

    // Wardrobe
    expect((await b.req(`/api/wardrobe/${top}`)).status).toBe(404)
    expect((await b.req(`/api/wardrobe/${top}`, { method: 'PATCH', json: { name: 'stolen' } })).status).toBe(404)
    expect((await b.req(`/api/wardrobe/${top}`, { method: 'DELETE' })).status).toBe(404)
    expect((await b.req(`/api/wardrobe/${top}/reanalyze`, { method: 'POST' })).status).toBe(404)
    const bList = await (await b.req('/api/wardrobe')).json()
    expect(bList.items).toHaveLength(0)
    const confirm = await (await b.req('/api/wardrobe/confirm', { method: 'POST', json: { ids: [top] } })).json()
    expect(confirm.confirmed).toBe(0)

    // Uploads
    const [asset] = await db.select().from(schema.imageAssets)
    expect((await b.req(`/api/uploads/${asset.id}/retry`, { method: 'POST' })).status).toBe(404)
    expect((await b.req(`/api/uploads/${asset.id}`, { method: 'DELETE' })).status).toBe(404)

    // Styling: B cannot force A's items into an outfit
    const style = await (await b.req('/api/styling', { method: 'POST', json: { occasion: 'everyday', includeItemIds: [top] } })).json()
    expect(style.status).toBe('insufficient')

    // Outfits
    const aStyle = await (await a.req('/api/styling', { method: 'POST', json: { occasion: 'everyday' } })).json()
    expect(aStyle.status).toBe('complete')
    const outfitId = aStyle.outfits[0].id
    expect((await b.req(`/api/outfits/${outfitId}`)).status).toBe(404)
    expect((await b.req(`/api/outfits/${outfitId}/save`, { method: 'POST' })).status).toBe(404)
    expect((await b.req(`/api/outfits/${outfitId}`, { method: 'DELETE' })).status).toBe(404)
    expect((await b.req(`/api/outfits/${outfitId}/alternatives?itemId=${top}`)).status).toBe(404)

    // Plans
    expect((await b.req('/api/plans', { method: 'POST', json: { outfitId, date: '2030-01-01' } })).status).toBe(404)
    const plan = await (await a.req('/api/plans', { method: 'POST', json: { outfitId, date: '2030-01-01' } })).json()
    expect((await b.req(`/api/plans/${plan.plan.id}`, { method: 'PATCH', json: { worn: true } })).status).toBe(404)
    expect((await b.req(`/api/plans/${plan.plan.id}`, { method: 'DELETE' })).status).toBe(404)
    const bPlans = await (await b.req('/api/plans?from=2030-01-01&to=2030-01-07')).json()
    expect(bPlans.plans).toHaveLength(0)

    // Recommendations
    await a.req('/api/discovery/refresh', { method: 'POST' })
    const recs = await (await a.req('/api/discovery')).json()
    expect(recs.recommendations.length).toBeGreaterThan(0)
    const recId = recs.recommendations[0].id
    expect((await b.req(`/api/discovery/${recId}`)).status).toBe(404)
    expect((await b.req(`/api/discovery/${recId}/save`, { method: 'POST' })).status).toBe(404)
    expect((await b.req(`/api/discovery/${recId}/dismiss`, { method: 'POST' })).status).toBe(404)
  })

  it('hides the operator status page from non-admins', async () => {
    const u = await signUp('user@example.com')
    expect((await u.req('/api/admin/status')).status).toBe(404)
    const admin = await signUp('admin@example.com')
    expect((await admin.req('/api/admin/status')).status).toBe(200)
  })

  it('stores photos under the owner’s private prefix', async () => {
    const a = await signUp()
    await onboard(a)
    await addItem(a, 'top', [240, 240, 236])
    const [asset] = await db.select().from(schema.imageAssets)
    expect(asset.displayKey).toContain(`users/${a.userId}/`)
  })
})
