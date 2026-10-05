/** Crop of a source photo: CSS object-position plus an optional zoom. */
export type Crop = {
  position?: string
  scale?: number
}

export type Category = 'Tops' | 'Bottoms' | 'Outerwear' | 'Shoes' | 'Accessories'

export type WardrobeItem = {
  id: string
  name: string
  category: Category
  image: string
  crop?: Crop
  colour: string
  /** Number of other items it pairs with, as shown on the marketing page. */
  pairsWith: number
  wornCount: number
  tip: string
}

export type LookPiece = {
  name: string
  crop: Crop
}

export type Look = {
  id: string
  occasion: string
  title: string
  image: string
  crop?: Crop
  metaTop: [string, string]
  metaBottom: [string, string]
  pieces: LookPiece[]
  reasons: { label: string; body: string }[]
}

export type DiscoveryItem = {
  id: string
  name: string
  /** Product type shown on the marketing page. */
  kind: string
  image: string
  crop?: Crop
  tag: string
  /** Wardrobe item ids this new piece complements. */
  pairs: string[]
  headline: string
  why: string
}
