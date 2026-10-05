/** Response shapes returned by the API (mirrors server serializers). */
export type Item = {
  id: string
  status: 'review' | 'active' | 'archived'
  name: string
  category: string | null
  subcategory: string | null
  colors: string[]
  colorNames: string[]
  pattern: string
  materialEstimate: string | null
  styles: string[]
  occasions: string[]
  seasons: string[]
  formality: number
  warmth: number
  details: string[]
  brand: string | null
  notes: string | null
  tags: string[]
  favorite: boolean
  excludeFromStyling: boolean
  aiTagged: boolean
  aiConfidence: number | null
  userEditedFields: string[]
  imageAssetId: string | null
  thumbUrl: string | null
  imageUrl: string | null
  createdAt: string
  updatedAt: string
}

export type Upload = {
  id: string
  status: 'processing' | 'processed' | 'failed'
  recognitionStatus: 'pending' | 'running' | 'complete' | 'unavailable' | 'failed'
  errorCode: string | null
  originalName: string | null
  thumbUrl: string | null
  createdAt: string
  reviewCount: number
  activeCount: number
}

export type Factor = { kind: 'positive' | 'caution'; label: string; detail: string }

export type Outfit = {
  id: string
  title: string
  occasion: string | null
  style: string | null
  explanation: string
  explanationSource: 'ai' | 'rules'
  factors: Factor[]
  saved: boolean
  savedAt: string | null
  feedback: number
  createdAt: string
  items: { role: string; item: Item }[]
}

export type Profile = {
  onboardingCompletedAt: string | null
  imageConsentAt: string | null
  department: 'womens' | 'mens' | 'any'
  preferredStyles: string[]
  favoriteColors: string[]
  avoidColors: string[]
  occasions: string[]
  fits: string[]
  budgetMin: number | null
  budgetMax: number | null
  currency: string
  preferredBrands: string[]
  locationName: string | null
  latitude: number | null
  longitude: number | null
  temperatureUnit: 'C' | 'F'
  notifyDiscoveriesEmail: boolean
}

export type Me = {
  user: { id: string; email: string; name: string; createdAt: string }
  profile: Profile
  isAdmin: boolean
  capabilities: { autoTagging: boolean; aiStylist: boolean; discovery: boolean; weather: boolean; email: boolean }
}

export type Recommendation = {
  id: string
  status: 'new' | 'saved' | 'dismissed'
  score: number
  reasons: { kind: string; text: string }[]
  pairCount: number
  gapCategory: string | null
  savedAt: string | null
  createdAt: string
  pairsWith: Item[]
  product: {
    id: string
    title: string
    brand: string | null
    retailer: string | null
    imageUrl: string | null
    productUrl: string
    price: { amount: number; currency: string | null } | null
    category: string | null
    colors: string[]
    condition: string | null
    availability: 'in_stock' | 'out_of_stock' | 'listed' | 'unknown'
    sizes: string[]
    provider: string
    attribution: string
    lastVerifiedAt: string
  }
}

export type DayForecast = { date: string; maxC: number; minC: number; precipitationChance: number | null; code: number | null }
