import { config } from '../../config'
import { logger } from '../../logger'
import type { Availability, ProductListing } from './types'
import { assertFetchable, safeExternalUrl } from './urlSafety'

/**
 * Imports authorized affiliate product feeds (e.g. Awin product feeds).
 * Feeds are operator-configured; each product's link must point to an
 * allow-listed host.
 */
const MAX_FEED_BYTES = 80 * 1024 * 1024

export function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i++
        } else quoted = false
      } else field += ch
    } else if (ch === '"') quoted = true
    else if (ch === ',') {
      row.push(field)
      field = ''
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++
      row.push(field)
      rows.push(row)
      row = []
      field = ''
    } else field += ch
  }
  if (field || row.length) {
    row.push(field)
    rows.push(row)
  }
  const [header, ...data] = rows.filter((r) => r.length > 1 || r[0])
  if (!header) return []
  return data.map((r) => Object.fromEntries(header.map((h, i) => [h.trim(), (r[i] ?? '').trim()])))
}

function availability(v: string | undefined): Availability {
  if (v === undefined || v === '') return 'unknown'
  return ['1', 'yes', 'true', 'in stock', 'instock'].includes(v.toLowerCase()) ? 'in_stock' : ['0', 'no', 'false', 'out of stock'].includes(v.toLowerCase()) ? 'out_of_stock' : 'unknown'
}

export function mapAwinRow(r: Record<string, string>, imageHosts: string[]): ProductListing | null {
  const productUrl = safeExternalUrl(r.aw_deep_link || r.merchant_deep_link, config.PRODUCT_FEED_ALLOWED_LINK_HOSTS)
  const id = r.aw_product_id || r.merchant_product_id
  const title = r.product_name
  if (!productUrl || !id || !title) return null
  const amount = Number(r.search_price || r.store_price)
  return {
    provider: 'feed',
    externalId: id,
    title: title.slice(0, 300),
    brand: r.brand_name || null,
    retailer: r.merchant_name || null,
    imageUrl: safeExternalUrl(r.merchant_image_url || r.aw_image_url || r.large_image, imageHosts),
    productUrl,
    price: Number.isFinite(amount) && amount > 0 ? { amount, currency: r.currency || 'USD' } : null,
    condition: r.condition || null,
    availability: availability(r.in_stock),
    sizes: (r['Fashion:size'] || r.size || '').split(/[,|]/).map((s) => s.trim()).filter(Boolean).slice(0, 20),
    colorHint: r.colour || r.color || null,
    categoryHint: [r.category_name, r.merchant_category].filter(Boolean).join(' ') || null,
    attribution: r.merchant_name ? `Sold by ${r.merchant_name}` : 'Partner retailer',
  }
}

export function mapJsonRow(r: Record<string, unknown>, imageHosts: string[]): ProductListing | null {
  const s = (k: string) => (typeof r[k] === 'string' ? (r[k] as string) : typeof r[k] === 'number' ? String(r[k]) : '')
  const productUrl = safeExternalUrl(s('url'), config.PRODUCT_FEED_ALLOWED_LINK_HOSTS)
  if (!productUrl || !s('id') || !s('title')) return null
  const amount = Number(s('price'))
  return {
    provider: 'feed',
    externalId: s('id'),
    title: s('title').slice(0, 300),
    brand: s('brand') || null,
    retailer: s('retailer') || null,
    imageUrl: safeExternalUrl(s('image'), imageHosts),
    productUrl,
    price: Number.isFinite(amount) && amount > 0 ? { amount, currency: s('currency') || 'USD' } : null,
    condition: s('condition') || null,
    availability: typeof r.inStock === 'boolean' ? (r.inStock ? 'in_stock' : 'out_of_stock') : 'unknown',
    sizes: Array.isArray(r.sizes) ? (r.sizes as unknown[]).map(String).slice(0, 20) : [],
    colorHint: s('color') || null,
    categoryHint: s('category') || null,
    attribution: s('retailer') ? `Sold by ${s('retailer')}` : 'Partner retailer',
  }
}

export async function fetchFeed(url: string): Promise<ProductListing[]> {
  const safe = await assertFetchable(url)
  const res = await fetch(safe, { redirect: 'error', signal: AbortSignal.timeout(90_000) })
  if (!res.ok) throw new Error(`feed responded ${res.status}`)
  const len = Number(res.headers.get('content-length') ?? 0)
  if (len > MAX_FEED_BYTES) throw new Error('feed too large')
  const body = await res.text()
  if (body.length > MAX_FEED_BYTES) throw new Error('feed too large')
  // Images may be served from CDNs; allow the link hosts plus any https host
  // already listed by the operator.
  const imageHosts = config.PRODUCT_FEED_ALLOWED_LINK_HOSTS.concat(['awin1.com', 'awin.com', 'cloudfront.net', 'scene7.com', 'shopify.com', 'cdn.shopify.com'])
  const rows = config.PRODUCT_FEED_FORMAT === 'json' ? ((JSON.parse(body) as Record<string, unknown>[]) ?? []) : parseCsv(body)
  const mapped = rows.map((r) => (config.PRODUCT_FEED_FORMAT === 'json' ? mapJsonRow(r as Record<string, unknown>, imageHosts) : mapAwinRow(r as Record<string, string>, imageHosts)))
  const ok = mapped.filter((m): m is ProductListing => !!m)
  logger.info({ rows: rows.length, accepted: ok.length }, 'product feed parsed')
  return ok
}
