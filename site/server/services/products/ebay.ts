import { config } from '../../config'
import { ProviderError, type ProductListing, type SearchProvider, type SearchQuery } from './types'
import { safeExternalUrl } from './urlSafety'

/**
 * eBay Browse API (official, OAuth client-credentials). Returns active
 * fixed-price new listings in Clothing, Shoes & Accessories. Listings link to
 * eBay item pages; affiliate links are used when a Partner Network campaign is
 * configured.
 */
const EBAY_LINK_HOSTS = ['ebay.com', 'ebay.co.uk', 'ebay.de', 'ebay.fr', 'ebay.it', 'ebay.es', 'ebay.ca', 'ebay.com.au', 'ebay.ie', 'ebay.at', 'ebay.ch', 'ebay.nl', 'ebay.be', 'ebay.pl']
const EBAY_IMAGE_HOSTS = ['ebayimg.com']
const CLOTHING_SHOES_ACCESSORIES = '11450'

type Summary = {
  itemId: string
  title: string
  price?: { value: string; currency: string }
  image?: { imageUrl: string }
  thumbnailImages?: { imageUrl: string }[]
  itemWebUrl?: string
  itemAffiliateWebUrl?: string
  condition?: string
  seller?: { username?: string }
  categories?: { categoryName?: string }[]
}

export class EbayProvider implements SearchProvider {
  readonly name = 'ebay'
  private token: { value: string; expiresAt: number } | null = null
  private host = config.EBAY_ENVIRONMENT === 'sandbox' ? 'https://api.sandbox.ebay.com' : 'https://api.ebay.com'

  private async accessToken() {
    if (this.token && this.token.expiresAt > Date.now() + 60_000) return this.token.value
    const basic = Buffer.from(`${config.EBAY_CLIENT_ID}:${config.EBAY_CLIENT_SECRET}`).toString('base64')
    const res = await fetch(`${this.host}/identity/v1/oauth2/token`, {
      method: 'POST',
      headers: { authorization: `Basic ${basic}`, 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'client_credentials', scope: 'https://api.ebay.com/oauth/api_scope' }),
      signal: AbortSignal.timeout(10_000),
    })
    if (res.status === 401 || res.status === 400) throw new ProviderError('ebay', 'eBay rejected the configured credentials', false)
    if (!res.ok) throw new ProviderError('ebay', `eBay token request failed (${res.status})`)
    const j = (await res.json()) as { access_token: string; expires_in: number }
    this.token = { value: j.access_token, expiresAt: Date.now() + j.expires_in * 1000 }
    return j.access_token
  }

  async search(q: SearchQuery): Promise<ProductListing[]> {
    const token = await this.accessToken()
    const filters = ['buyingOptions:{FIXED_PRICE}', 'conditions:{NEW}']
    if (q.priceMin != null || q.priceMax != null) {
      filters.push(`price:[${q.priceMin ?? ''}..${q.priceMax ?? ''}]`, `priceCurrency:${q.currency}`)
    }
    const url = new URL(`${this.host}/buy/browse/v1/item_summary/search`)
    url.search = new URLSearchParams({
      q: q.text.slice(0, 100),
      category_ids: CLOTHING_SHOES_ACCESSORIES,
      limit: String(Math.min(50, q.limit)),
      filter: filters.join(','),
    }).toString()
    const headers: Record<string, string> = { authorization: `Bearer ${token}`, 'x-ebay-c-marketplace-id': config.EBAY_MARKETPLACE_ID }
    if (config.EBAY_AFFILIATE_CAMPAIGN_ID) headers['x-ebay-c-enduserctx'] = `affiliateCampaignId=${config.EBAY_AFFILIATE_CAMPAIGN_ID}`
    const res = await fetch(url, { headers, signal: AbortSignal.timeout(12_000) })
    if (res.status === 429) throw new ProviderError('ebay', 'eBay rate limit reached')
    if (res.status === 401 || res.status === 403) {
      this.token = null
      throw new ProviderError('ebay', 'eBay rejected the request credentials', false)
    }
    if (!res.ok) throw new ProviderError('ebay', `eBay search failed (${res.status})`)
    const j = (await res.json()) as { itemSummaries?: Summary[] }
    const out: ProductListing[] = []
    for (const s of j.itemSummaries ?? []) {
      const productUrl = safeExternalUrl(s.itemAffiliateWebUrl ?? s.itemWebUrl, EBAY_LINK_HOSTS)
      if (!productUrl) continue
      const amount = s.price ? Number(s.price.value) : NaN
      out.push({
        provider: 'ebay',
        externalId: s.itemId,
        title: s.title.slice(0, 300),
        brand: null,
        retailer: s.seller?.username ? `${s.seller.username} on eBay` : 'eBay',
        imageUrl: safeExternalUrl(s.image?.imageUrl ?? s.thumbnailImages?.[0]?.imageUrl, EBAY_IMAGE_HOSTS),
        productUrl,
        price: Number.isFinite(amount) && s.price ? { amount, currency: s.price.currency } : null,
        condition: s.condition ?? null,
        availability: 'listed',
        sizes: [],
        colorHint: null,
        categoryHint: s.categories?.map((c) => c.categoryName).join(' ') ?? null,
        attribution: 'Listing from eBay',
      })
    }
    return out
  }
}
