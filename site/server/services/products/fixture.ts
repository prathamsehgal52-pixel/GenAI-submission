import type { ProductListing, SearchProvider, SearchQuery } from './types'

/**
 * Static catalogue for the automated test suite ONLY (PRODUCT_PROVIDERS=fixture
 * is rejected outside APP_ENV=test). Lets tests exercise matching, saving and
 * dismissal deterministically without network access.
 */
const CATALOGUE: Omit<ProductListing, 'provider' | 'attribution' | 'availability' | 'sizes' | 'condition' | 'colorHint' | 'categoryHint' | 'brand'>[] = [
  { externalId: 'fx-1', title: 'Camel wool trench coat', retailer: 'Test Retailer', imageUrl: null, productUrl: 'https://shop.example.com/p/fx-1', price: { amount: 180, currency: 'USD' } },
  { externalId: 'fx-2', title: 'White leather sneakers', retailer: 'Test Retailer', imageUrl: null, productUrl: 'https://shop.example.com/p/fx-2', price: { amount: 95, currency: 'USD' } },
  { externalId: 'fx-3', title: 'Black leather ankle boots', retailer: 'Test Retailer', imageUrl: null, productUrl: 'https://shop.example.com/p/fx-3', price: { amount: 140, currency: 'USD' } },
  { externalId: 'fx-4', title: 'Navy cable knit sweater', retailer: 'Test Retailer', imageUrl: null, productUrl: 'https://shop.example.com/p/fx-4', price: { amount: 70, currency: 'USD' } },
  { externalId: 'fx-5', title: 'Tan leather crossbody bag', retailer: 'Test Retailer', imageUrl: null, productUrl: 'https://shop.example.com/p/fx-5', price: { amount: 120, currency: 'USD' } },
]

export class FixtureProductProvider implements SearchProvider {
  readonly name = 'fixture'
  async search(q: SearchQuery): Promise<ProductListing[]> {
    const words = q.text.toLowerCase().split(/\s+/).filter((w) => w.length > 3 && !["women's", "men's"].includes(w))
    return CATALOGUE.filter((p) => words.some((w) => p.title.toLowerCase().includes(w))).map((p) => ({
      ...p,
      provider: 'fixture',
      brand: null,
      condition: 'New',
      availability: 'in_stock' as const,
      sizes: [],
      colorHint: null,
      categoryHint: null,
      attribution: 'Test catalogue',
    }))
  }
}
