export type Availability = 'in_stock' | 'out_of_stock' | 'listed' | 'unknown'

/** A normalised product listing from a permitted data source. */
export type ProductListing = {
  provider: string
  externalId: string
  title: string
  brand: string | null
  retailer: string | null
  imageUrl: string | null
  productUrl: string
  price: { amount: number; currency: string } | null
  condition: string | null
  availability: Availability
  sizes: string[]
  colorHint: string | null
  categoryHint: string | null
  /** Attribution text required/appropriate for the source. */
  attribution: string
}

export type SearchQuery = {
  text: string
  priceMin?: number | null
  priceMax?: number | null
  currency: string
  limit: number
}

export interface SearchProvider {
  readonly name: string
  search(q: SearchQuery): Promise<ProductListing[]>
}

export class ProviderError extends Error {
  constructor(
    public provider: string,
    message: string,
    public retryable = true,
  ) {
    super(message)
  }
}
