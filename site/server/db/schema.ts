import { sql } from 'drizzle-orm'
import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  real,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'

const ts = (name: string) => timestamp(name, { withTimezone: true, mode: 'date' })
const createdAt = () => ts('created_at').notNull().defaultNow()
const updatedAt = () =>
  ts('updated_at')
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date())

/* ───────────────────────── Authentication (Better Auth) ───────────────────────── */

export const user = pgTable('user', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: boolean('email_verified').notNull().default(false),
  image: text('image'),
  createdAt: ts('created_at').notNull().defaultNow(),
  updatedAt: ts('updated_at').notNull().defaultNow(),
})

export const session = pgTable(
  'session',
  {
    id: text('id').primaryKey(),
    expiresAt: ts('expires_at').notNull(),
    token: text('token').notNull().unique(),
    createdAt: ts('created_at').notNull().defaultNow(),
    updatedAt: ts('updated_at').notNull().defaultNow(),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
  },
  (t) => [index('session_user_idx').on(t.userId)],
)

export const account = pgTable(
  'account',
  {
    id: text('id').primaryKey(),
    accountId: text('account_id').notNull(),
    providerId: text('provider_id').notNull(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    accessToken: text('access_token'),
    refreshToken: text('refresh_token'),
    idToken: text('id_token'),
    accessTokenExpiresAt: ts('access_token_expires_at'),
    refreshTokenExpiresAt: ts('refresh_token_expires_at'),
    scope: text('scope'),
    password: text('password'),
    createdAt: ts('created_at').notNull().defaultNow(),
    updatedAt: ts('updated_at').notNull().defaultNow(),
  },
  (t) => [index('account_user_idx').on(t.userId)],
)

export const verification = pgTable(
  'verification',
  {
    id: text('id').primaryKey(),
    identifier: text('identifier').notNull(),
    value: text('value').notNull(),
    expiresAt: ts('expires_at').notNull(),
    createdAt: ts('created_at').notNull().defaultNow(),
    updatedAt: ts('updated_at').notNull().defaultNow(),
  },
  (t) => [index('verification_identifier_idx').on(t.identifier)],
)

/* ───────────────────────── Profile ───────────────────────── */

export const profiles = pgTable('profiles', {
  userId: text('user_id')
    .primaryKey()
    .references(() => user.id, { onDelete: 'cascade' }),
  onboardingCompletedAt: ts('onboarding_completed_at'),
  imageConsentAt: ts('image_consent_at'),
  consentVersion: text('consent_version'),
  department: text('department').notNull().default('any'),
  preferredStyles: text('preferred_styles').array().notNull().default(sql`'{}'`),
  favoriteColors: text('favorite_colors').array().notNull().default(sql`'{}'`),
  avoidColors: text('avoid_colors').array().notNull().default(sql`'{}'`),
  occasions: text('occasions').array().notNull().default(sql`'{}'`),
  fits: text('fits').array().notNull().default(sql`'{}'`),
  budgetMin: integer('budget_min'),
  budgetMax: integer('budget_max'),
  currency: text('currency').notNull().default('USD'),
  preferredBrands: text('preferred_brands').array().notNull().default(sql`'{}'`),
  locationName: text('location_name'),
  latitude: real('latitude'),
  longitude: real('longitude'),
  temperatureUnit: text('temperature_unit').notNull().default('C'),
  notifyDiscoveriesEmail: boolean('notify_discoveries_email').notNull().default(false),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
})

/* ───────────────────────── Wardrobe ───────────────────────── */

export const assetStatus = pgEnum('asset_status', ['processing', 'processed', 'failed'])
export const recognitionStatus = pgEnum('recognition_status', ['pending', 'running', 'complete', 'unavailable', 'failed'])

export const imageAssets = pgTable(
  'image_assets',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    originalName: text('original_name'),
    displayKey: text('display_key'),
    thumbKey: text('thumb_key'),
    width: integer('width'),
    height: integer('height'),
    byteSize: integer('byte_size'),
    sha256: text('sha256').notNull(),
    status: assetStatus('status').notNull().default('processing'),
    recognitionStatus: recognitionStatus('recognition_status').notNull().default('pending'),
    recognitionAttempts: integer('recognition_attempts').notNull().default(0),
    errorCode: text('error_code'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index('assets_user_created_idx').on(t.userId, t.createdAt), uniqueIndex('assets_user_sha_idx').on(t.userId, t.sha256)],
)

export const itemStatus = pgEnum('item_status', ['review', 'active', 'archived'])

export type Crop = { x: number; y: number; w: number; h: number }

export const wardrobeItems = pgTable(
  'wardrobe_items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    imageAssetId: uuid('image_asset_id').references(() => imageAssets.id, { onDelete: 'set null' }),
    crop: jsonb('crop').$type<Crop | null>(),
    imageKey: text('image_key'),
    thumbKey: text('thumb_key'),
    status: itemStatus('status').notNull().default('review'),
    name: text('name').notNull().default(''),
    category: text('category'),
    subcategory: text('subcategory'),
    colors: text('colors').array().notNull().default(sql`'{}'`),
    colorNames: text('color_names').array().notNull().default(sql`'{}'`),
    pattern: text('pattern').notNull().default('solid'),
    materialEstimate: text('material_estimate'),
    styles: text('styles').array().notNull().default(sql`'{}'`),
    occasions: text('occasions').array().notNull().default(sql`'{}'`),
    seasons: text('seasons').array().notNull().default(sql`'{}'`),
    formality: smallint('formality').notNull().default(2),
    warmth: smallint('warmth').notNull().default(2),
    details: text('details').array().notNull().default(sql`'{}'`),
    brand: text('brand'),
    notes: text('notes'),
    tags: text('tags').array().notNull().default(sql`'{}'`),
    favorite: boolean('favorite').notNull().default(false),
    excludeFromStyling: boolean('exclude_from_styling').notNull().default(false),
    aiAttributes: jsonb('ai_attributes').$type<Record<string, unknown> | null>(),
    aiConfidence: real('ai_confidence'),
    /** Fields the user has set or confirmed; the rest are visual estimates. */
    userEditedFields: text('user_edited_fields').array().notNull().default(sql`'{}'`),
    confirmedAt: ts('confirmed_at'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index('items_user_status_idx').on(t.userId, t.status),
    index('items_user_category_idx').on(t.userId, t.category),
    index('items_asset_idx').on(t.imageAssetId),
  ],
)

/* ───────────────────────── Styling ───────────────────────── */

export const stylingRequests = pgTable(
  'styling_requests',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    params: jsonb('params').$type<Record<string, unknown>>().notNull(),
    paramsHash: text('params_hash').notNull(),
    weather: jsonb('weather').$type<Record<string, unknown> | null>(),
    status: text('status').notNull(),
    message: text('message'),
    candidateCount: integer('candidate_count').notNull().default(0),
    aiUsed: boolean('ai_used').notNull().default(false),
    createdAt: createdAt(),
  },
  (t) => [index('styling_user_hash_idx').on(t.userId, t.paramsHash, t.createdAt)],
)

export type OutfitFactor = { kind: 'positive' | 'caution'; label: string; detail: string }

export const outfits = pgTable(
  'outfits',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    requestId: uuid('request_id').references(() => stylingRequests.id, { onDelete: 'set null' }),
    title: text('title').notNull(),
    occasion: text('occasion'),
    style: text('style'),
    explanation: text('explanation').notNull(),
    factors: jsonb('factors').$type<OutfitFactor[]>().notNull().default(sql`'[]'::jsonb`),
    explanationSource: text('explanation_source').notNull(),
    score: real('score').notNull().default(0),
    saved: boolean('saved').notNull().default(false),
    savedAt: ts('saved_at'),
    feedback: smallint('feedback').notNull().default(0),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index('outfits_user_saved_idx').on(t.userId, t.saved, t.savedAt), index('outfits_request_idx').on(t.requestId)],
)

export const outfitItems = pgTable(
  'outfit_items',
  {
    outfitId: uuid('outfit_id')
      .notNull()
      .references(() => outfits.id, { onDelete: 'cascade' }),
    itemId: uuid('item_id')
      .notNull()
      .references(() => wardrobeItems.id, { onDelete: 'cascade' }),
    role: text('role').notNull(),
    position: smallint('position').notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.outfitId, t.itemId] }), index('outfit_items_item_idx').on(t.itemId)],
)

export const outfitPlans = pgTable(
  'outfit_plans',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    outfitId: uuid('outfit_id')
      .notNull()
      .references(() => outfits.id, { onDelete: 'cascade' }),
    date: date('date', { mode: 'string' }).notNull(),
    occasion: text('occasion'),
    note: text('note'),
    worn: boolean('worn').notNull().default(false),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index('plans_user_date_idx').on(t.userId, t.date)],
)

/* ───────────────────────── Discovery ───────────────────────── */

export const products = pgTable(
  'products',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    provider: text('provider').notNull(),
    externalId: text('external_id').notNull(),
    title: text('title').notNull(),
    brand: text('brand'),
    retailer: text('retailer'),
    imageUrl: text('image_url'),
    productUrl: text('product_url').notNull(),
    priceAmount: numeric('price_amount', { precision: 12, scale: 2 }),
    currency: text('currency'),
    category: text('category'),
    subcategory: text('subcategory'),
    colors: text('colors').array().notNull().default(sql`'{}'`),
    styles: text('styles').array().notNull().default(sql`'{}'`),
    pattern: text('pattern'),
    formality: smallint('formality'),
    sizes: text('sizes').array().notNull().default(sql`'{}'`),
    condition: text('condition'),
    availability: text('availability').notNull().default('unknown'),
    attributesSource: text('attributes_source').notNull().default('listing'),
    attribution: text('attribution').notNull(),
    lastVerifiedAt: ts('last_verified_at').notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex('products_provider_external_idx').on(t.provider, t.externalId), index('products_category_idx').on(t.category)],
)

export const recommendationStatus = pgEnum('recommendation_status', ['new', 'saved', 'dismissed'])

export type RecommendationReason = { kind: 'complements' | 'gap' | 'style' | 'budget' | 'versatile' | 'color'; text: string }

export const productRecommendations = pgTable(
  'product_recommendations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    productId: uuid('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    runId: uuid('run_id'),
    score: real('score').notNull(),
    reasons: jsonb('reasons').$type<RecommendationReason[]>().notNull(),
    pairsWith: uuid('pairs_with').array().notNull().default(sql`'{}'`),
    pairCount: integer('pair_count').notNull().default(0),
    gapCategory: text('gap_category'),
    query: text('query'),
    status: recommendationStatus('status').notNull().default('new'),
    savedAt: ts('saved_at'),
    notifiedAt: ts('notified_at'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex('recs_user_product_idx').on(t.userId, t.productId), index('recs_user_status_idx').on(t.userId, t.status, t.score)],
)

export const discoveryRuns = pgTable(
  'discovery_runs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    trigger: text('trigger').notNull(),
    status: text('status').notNull().default('queued'),
    queries: jsonb('queries').$type<string[]>().notNull().default(sql`'[]'::jsonb`),
    productsFound: integer('products_found').notNull().default(0),
    recommendationsCreated: integer('recommendations_created').notNull().default(0),
    errorCode: text('error_code'),
    startedAt: ts('started_at'),
    finishedAt: ts('finished_at'),
    createdAt: createdAt(),
  },
  (t) => [index('runs_user_created_idx').on(t.userId, t.createdAt)],
)

/* ───────────────────────── Operations ───────────────────────── */

export const notificationDeliveries = pgTable(
  'notification_deliveries',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    channel: text('channel').notNull(),
    kind: text('kind').notNull(),
    status: text('status').notNull(),
    detail: jsonb('detail').$type<Record<string, unknown>>(),
    createdAt: createdAt(),
  },
  (t) => [index('notifications_user_idx').on(t.userId, t.createdAt)],
)

export const aiUsage = pgTable(
  'ai_usage',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: text('user_id').references(() => user.id, { onDelete: 'set null' }),
    operation: text('operation').notNull(),
    model: text('model').notNull(),
    inputTokens: integer('input_tokens').notNull().default(0),
    outputTokens: integer('output_tokens').notNull().default(0),
    cacheReadTokens: integer('cache_read_tokens').notNull().default(0),
    costUsd: numeric('cost_usd', { precision: 10, scale: 5 }).notNull().default('0'),
    success: boolean('success').notNull(),
    latencyMs: integer('latency_ms').notNull().default(0),
    createdAt: createdAt(),
  },
  (t) => [index('ai_usage_created_idx').on(t.createdAt), index('ai_usage_user_idx').on(t.userId, t.createdAt)],
)

export const integrationStatus = pgTable('integration_status', {
  integration: text('integration').primaryKey(),
  lastSuccessAt: ts('last_success_at'),
  lastFailureAt: ts('last_failure_at'),
  lastError: text('last_error'),
  updatedAt: updatedAt(),
})

export const rateLimits = pgTable('rate_limits', {
  key: text('key').primaryKey(),
  windowStart: ts('window_start').notNull(),
  count: integer('count').notNull(),
})
