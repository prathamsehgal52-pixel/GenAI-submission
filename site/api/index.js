var __defProp = Object.defineProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// server/vercel-entry.ts
import { handle } from "@hono/vercel";

// server/app.ts
import { Hono as Hono11 } from "hono";
import { bodyLimit } from "hono/body-limit";
import { secureHeaders } from "hono/secure-headers";
import { getConnInfo } from "@hono/node-server/conninfo";

// server/auth.ts
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";

// server/config.ts
import { z } from "zod";
var bool = z.enum(["true", "false", "1", "0", ""]).optional().transform((v) => v === "true" || v === "1");
var list = z.string().optional().transform((v) => v ? v.split(",").map((s) => s.trim()).filter(Boolean) : []);
var schema = z.object({
  APP_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().default(8787),
  APP_URL: z.url().default("http://localhost:5173"),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),
  DATABASE_URL: z.string().min(1),
  DATABASE_POOL_MAX: z.coerce.number().int().default(10),
  AUTH_SECRET: z.string().min(32, "AUTH_SECRET must be at least 32 characters"),
  ADMIN_EMAILS: list,
  STORAGE_DRIVER: z.enum(["s3", "memory"]).default("s3"),
  S3_ENDPOINT: z.string().optional(),
  S3_REGION: z.string().default("us-east-1"),
  S3_BUCKET: z.string().default("armoire-media"),
  S3_ACCESS_KEY_ID: z.string().optional(),
  S3_SECRET_ACCESS_KEY: z.string().optional(),
  S3_FORCE_PATH_STYLE: bool,
  S3_AUTO_CREATE_BUCKET: bool,
  SIGNED_URL_TTL_SECONDS: z.coerce.number().int().min(60).max(86400).default(3600),
  AI_PROVIDER: z.enum(["anthropic", "none", "fixture"]).default("anthropic"),
  ANTHROPIC_API_KEY: z.string().optional(),
  AI_MODEL: z.string().default("claude-opus-5-5"),
  AI_TIMEOUT_MS: z.coerce.number().int().default(6e4),
  AI_DAILY_USER_LIMIT: z.coerce.number().int().default(200),
  PRODUCT_PROVIDERS: list,
  EBAY_CLIENT_ID: z.string().optional(),
  EBAY_CLIENT_SECRET: z.string().optional(),
  EBAY_MARKETPLACE_ID: z.string().default("EBAY_US"),
  EBAY_AFFILIATE_CAMPAIGN_ID: z.string().optional(),
  EBAY_ENVIRONMENT: z.enum(["production", "sandbox"]).default("production"),
  PRODUCT_FEED_URLS: list,
  PRODUCT_FEED_FORMAT: z.enum(["awin_csv", "json"]).default("awin_csv"),
  PRODUCT_FEED_ALLOWED_LINK_HOSTS: list,
  DISCOVERY_CRON: z.string().default("0 6 * * *"),
  DISCOVERY_MAX_QUERIES_PER_USER: z.coerce.number().int().min(1).max(20).default(6),
  WEATHER_ENABLED: bool.default(true),
  EMAIL_DRIVER: z.enum(["smtp", "memory", "none"]).default("none"),
  SMTP_URL: z.string().optional(),
  EMAIL_FROM: z.string().default("Armoire <hello@armoire.app>"),
  SENTRY_DSN: z.string().optional(),
  TRUST_PROXY: bool
});
function load() {
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`).join("\n");
    throw new Error(`Invalid configuration:
${issues}`);
  }
  const c = parsed.data;
  const problems = [];
  const prod = c.APP_ENV === "production";
  if (c.APP_ENV !== "test") {
    if (c.STORAGE_DRIVER === "memory") problems.push("STORAGE_DRIVER=memory is only allowed when APP_ENV=test");
    if (c.AI_PROVIDER === "fixture") problems.push("AI_PROVIDER=fixture is only allowed when APP_ENV=test");
    if (c.PRODUCT_PROVIDERS.includes("fixture")) problems.push("PRODUCT_PROVIDERS=fixture is only allowed when APP_ENV=test");
    if (c.EMAIL_DRIVER === "memory") problems.push("EMAIL_DRIVER=memory is only allowed when APP_ENV=test");
  }
  if (c.STORAGE_DRIVER === "s3" && (!c.S3_ACCESS_KEY_ID || !c.S3_SECRET_ACCESS_KEY)) {
    problems.push("S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY are required when STORAGE_DRIVER=s3");
  }
  if (c.EMAIL_DRIVER === "smtp" && !c.SMTP_URL) problems.push("SMTP_URL is required when EMAIL_DRIVER=smtp");
  if (prod && !c.APP_URL.startsWith("https://")) problems.push("APP_URL must use https in production");
  if (problems.length) throw new Error(`Invalid configuration:
${problems.map((p) => `  - ${p}`).join("\n")}`);
  return c;
}
var config = load();
var integrations = {
  ai: () => config.AI_PROVIDER === "fixture" || config.AI_PROVIDER === "anthropic" && !!config.ANTHROPIC_API_KEY,
  ebay: () => config.PRODUCT_PROVIDERS.includes("ebay") && !!config.EBAY_CLIENT_ID && !!config.EBAY_CLIENT_SECRET,
  feed: () => config.PRODUCT_PROVIDERS.includes("feed") && config.PRODUCT_FEED_URLS.length > 0,
  email: () => config.EMAIL_DRIVER !== "none"
};

// server/db/client.ts
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";

// server/db/schema.ts
var schema_exports = {};
__export(schema_exports, {
  account: () => account,
  aiUsage: () => aiUsage,
  assetStatus: () => assetStatus,
  discoveryRuns: () => discoveryRuns,
  imageAssets: () => imageAssets,
  integrationStatus: () => integrationStatus,
  itemStatus: () => itemStatus,
  notificationDeliveries: () => notificationDeliveries,
  outfitItems: () => outfitItems,
  outfitPlans: () => outfitPlans,
  outfits: () => outfits,
  productRecommendations: () => productRecommendations,
  products: () => products,
  profiles: () => profiles,
  rateLimits: () => rateLimits,
  recognitionStatus: () => recognitionStatus,
  recommendationStatus: () => recommendationStatus,
  session: () => session,
  stylingRequests: () => stylingRequests,
  user: () => user,
  verification: () => verification,
  wardrobeItems: () => wardrobeItems
});
import { sql } from "drizzle-orm";
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
  uuid
} from "drizzle-orm/pg-core";
var ts = (name) => timestamp(name, { withTimezone: true, mode: "date" });
var createdAt = () => ts("created_at").notNull().defaultNow();
var updatedAt = () => ts("updated_at").notNull().defaultNow().$onUpdate(() => /* @__PURE__ */ new Date());
var user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  createdAt: ts("created_at").notNull().defaultNow(),
  updatedAt: ts("updated_at").notNull().defaultNow()
});
var session = pgTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: ts("expires_at").notNull(),
    token: text("token").notNull().unique(),
    createdAt: ts("created_at").notNull().defaultNow(),
    updatedAt: ts("updated_at").notNull().defaultNow(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" })
  },
  (t) => [index("session_user_idx").on(t.userId)]
);
var account = pgTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: ts("access_token_expires_at"),
    refreshTokenExpiresAt: ts("refresh_token_expires_at"),
    scope: text("scope"),
    password: text("password"),
    createdAt: ts("created_at").notNull().defaultNow(),
    updatedAt: ts("updated_at").notNull().defaultNow()
  },
  (t) => [index("account_user_idx").on(t.userId)]
);
var verification = pgTable(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: ts("expires_at").notNull(),
    createdAt: ts("created_at").notNull().defaultNow(),
    updatedAt: ts("updated_at").notNull().defaultNow()
  },
  (t) => [index("verification_identifier_idx").on(t.identifier)]
);
var profiles = pgTable("profiles", {
  userId: text("user_id").primaryKey().references(() => user.id, { onDelete: "cascade" }),
  onboardingCompletedAt: ts("onboarding_completed_at"),
  imageConsentAt: ts("image_consent_at"),
  consentVersion: text("consent_version"),
  department: text("department").notNull().default("any"),
  preferredStyles: text("preferred_styles").array().notNull().default(sql`'{}'`),
  favoriteColors: text("favorite_colors").array().notNull().default(sql`'{}'`),
  avoidColors: text("avoid_colors").array().notNull().default(sql`'{}'`),
  occasions: text("occasions").array().notNull().default(sql`'{}'`),
  fits: text("fits").array().notNull().default(sql`'{}'`),
  budgetMin: integer("budget_min"),
  budgetMax: integer("budget_max"),
  currency: text("currency").notNull().default("USD"),
  preferredBrands: text("preferred_brands").array().notNull().default(sql`'{}'`),
  locationName: text("location_name"),
  latitude: real("latitude"),
  longitude: real("longitude"),
  temperatureUnit: text("temperature_unit").notNull().default("C"),
  notifyDiscoveriesEmail: boolean("notify_discoveries_email").notNull().default(false),
  createdAt: createdAt(),
  updatedAt: updatedAt()
});
var assetStatus = pgEnum("asset_status", ["processing", "processed", "failed"]);
var recognitionStatus = pgEnum("recognition_status", ["pending", "running", "complete", "unavailable", "failed"]);
var imageAssets = pgTable(
  "image_assets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
    originalName: text("original_name"),
    displayKey: text("display_key"),
    thumbKey: text("thumb_key"),
    width: integer("width"),
    height: integer("height"),
    byteSize: integer("byte_size"),
    sha256: text("sha256").notNull(),
    status: assetStatus("status").notNull().default("processing"),
    recognitionStatus: recognitionStatus("recognition_status").notNull().default("pending"),
    recognitionAttempts: integer("recognition_attempts").notNull().default(0),
    errorCode: text("error_code"),
    createdAt: createdAt(),
    updatedAt: updatedAt()
  },
  (t) => [index("assets_user_created_idx").on(t.userId, t.createdAt), uniqueIndex("assets_user_sha_idx").on(t.userId, t.sha256)]
);
var itemStatus = pgEnum("item_status", ["review", "active", "archived"]);
var wardrobeItems = pgTable(
  "wardrobe_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
    imageAssetId: uuid("image_asset_id").references(() => imageAssets.id, { onDelete: "set null" }),
    crop: jsonb("crop").$type(),
    imageKey: text("image_key"),
    thumbKey: text("thumb_key"),
    status: itemStatus("status").notNull().default("review"),
    name: text("name").notNull().default(""),
    category: text("category"),
    subcategory: text("subcategory"),
    colors: text("colors").array().notNull().default(sql`'{}'`),
    colorNames: text("color_names").array().notNull().default(sql`'{}'`),
    pattern: text("pattern").notNull().default("solid"),
    materialEstimate: text("material_estimate"),
    styles: text("styles").array().notNull().default(sql`'{}'`),
    occasions: text("occasions").array().notNull().default(sql`'{}'`),
    seasons: text("seasons").array().notNull().default(sql`'{}'`),
    formality: smallint("formality").notNull().default(2),
    warmth: smallint("warmth").notNull().default(2),
    details: text("details").array().notNull().default(sql`'{}'`),
    brand: text("brand"),
    notes: text("notes"),
    tags: text("tags").array().notNull().default(sql`'{}'`),
    favorite: boolean("favorite").notNull().default(false),
    excludeFromStyling: boolean("exclude_from_styling").notNull().default(false),
    aiAttributes: jsonb("ai_attributes").$type(),
    aiConfidence: real("ai_confidence"),
    /** Fields the user has set or confirmed; the rest are visual estimates. */
    userEditedFields: text("user_edited_fields").array().notNull().default(sql`'{}'`),
    confirmedAt: ts("confirmed_at"),
    createdAt: createdAt(),
    updatedAt: updatedAt()
  },
  (t) => [
    index("items_user_status_idx").on(t.userId, t.status),
    index("items_user_category_idx").on(t.userId, t.category),
    index("items_asset_idx").on(t.imageAssetId)
  ]
);
var stylingRequests = pgTable(
  "styling_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
    params: jsonb("params").$type().notNull(),
    paramsHash: text("params_hash").notNull(),
    weather: jsonb("weather").$type(),
    status: text("status").notNull(),
    message: text("message"),
    candidateCount: integer("candidate_count").notNull().default(0),
    aiUsed: boolean("ai_used").notNull().default(false),
    createdAt: createdAt()
  },
  (t) => [index("styling_user_hash_idx").on(t.userId, t.paramsHash, t.createdAt)]
);
var outfits = pgTable(
  "outfits",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
    requestId: uuid("request_id").references(() => stylingRequests.id, { onDelete: "set null" }),
    title: text("title").notNull(),
    occasion: text("occasion"),
    style: text("style"),
    explanation: text("explanation").notNull(),
    factors: jsonb("factors").$type().notNull().default(sql`'[]'::jsonb`),
    explanationSource: text("explanation_source").notNull(),
    score: real("score").notNull().default(0),
    saved: boolean("saved").notNull().default(false),
    savedAt: ts("saved_at"),
    feedback: smallint("feedback").notNull().default(0),
    createdAt: createdAt(),
    updatedAt: updatedAt()
  },
  (t) => [index("outfits_user_saved_idx").on(t.userId, t.saved, t.savedAt), index("outfits_request_idx").on(t.requestId)]
);
var outfitItems = pgTable(
  "outfit_items",
  {
    outfitId: uuid("outfit_id").notNull().references(() => outfits.id, { onDelete: "cascade" }),
    itemId: uuid("item_id").notNull().references(() => wardrobeItems.id, { onDelete: "cascade" }),
    role: text("role").notNull(),
    position: smallint("position").notNull().default(0)
  },
  (t) => [primaryKey({ columns: [t.outfitId, t.itemId] }), index("outfit_items_item_idx").on(t.itemId)]
);
var outfitPlans = pgTable(
  "outfit_plans",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
    outfitId: uuid("outfit_id").notNull().references(() => outfits.id, { onDelete: "cascade" }),
    date: date("date", { mode: "string" }).notNull(),
    occasion: text("occasion"),
    note: text("note"),
    worn: boolean("worn").notNull().default(false),
    createdAt: createdAt(),
    updatedAt: updatedAt()
  },
  (t) => [index("plans_user_date_idx").on(t.userId, t.date)]
);
var products = pgTable(
  "products",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    provider: text("provider").notNull(),
    externalId: text("external_id").notNull(),
    title: text("title").notNull(),
    brand: text("brand"),
    retailer: text("retailer"),
    imageUrl: text("image_url"),
    productUrl: text("product_url").notNull(),
    priceAmount: numeric("price_amount", { precision: 12, scale: 2 }),
    currency: text("currency"),
    category: text("category"),
    subcategory: text("subcategory"),
    colors: text("colors").array().notNull().default(sql`'{}'`),
    styles: text("styles").array().notNull().default(sql`'{}'`),
    pattern: text("pattern"),
    formality: smallint("formality"),
    sizes: text("sizes").array().notNull().default(sql`'{}'`),
    condition: text("condition"),
    availability: text("availability").notNull().default("unknown"),
    attributesSource: text("attributes_source").notNull().default("listing"),
    attribution: text("attribution").notNull(),
    lastVerifiedAt: ts("last_verified_at").notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt()
  },
  (t) => [uniqueIndex("products_provider_external_idx").on(t.provider, t.externalId), index("products_category_idx").on(t.category)]
);
var recommendationStatus = pgEnum("recommendation_status", ["new", "saved", "dismissed"]);
var productRecommendations = pgTable(
  "product_recommendations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
    productId: uuid("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
    runId: uuid("run_id"),
    score: real("score").notNull(),
    reasons: jsonb("reasons").$type().notNull(),
    pairsWith: uuid("pairs_with").array().notNull().default(sql`'{}'`),
    pairCount: integer("pair_count").notNull().default(0),
    gapCategory: text("gap_category"),
    query: text("query"),
    status: recommendationStatus("status").notNull().default("new"),
    savedAt: ts("saved_at"),
    notifiedAt: ts("notified_at"),
    createdAt: createdAt(),
    updatedAt: updatedAt()
  },
  (t) => [uniqueIndex("recs_user_product_idx").on(t.userId, t.productId), index("recs_user_status_idx").on(t.userId, t.status, t.score)]
);
var discoveryRuns = pgTable(
  "discovery_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
    trigger: text("trigger").notNull(),
    status: text("status").notNull().default("queued"),
    queries: jsonb("queries").$type().notNull().default(sql`'[]'::jsonb`),
    productsFound: integer("products_found").notNull().default(0),
    recommendationsCreated: integer("recommendations_created").notNull().default(0),
    errorCode: text("error_code"),
    startedAt: ts("started_at"),
    finishedAt: ts("finished_at"),
    createdAt: createdAt()
  },
  (t) => [index("runs_user_created_idx").on(t.userId, t.createdAt)]
);
var notificationDeliveries = pgTable(
  "notification_deliveries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
    channel: text("channel").notNull(),
    kind: text("kind").notNull(),
    status: text("status").notNull(),
    detail: jsonb("detail").$type(),
    createdAt: createdAt()
  },
  (t) => [index("notifications_user_idx").on(t.userId, t.createdAt)]
);
var aiUsage = pgTable(
  "ai_usage",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id").references(() => user.id, { onDelete: "set null" }),
    operation: text("operation").notNull(),
    model: text("model").notNull(),
    inputTokens: integer("input_tokens").notNull().default(0),
    outputTokens: integer("output_tokens").notNull().default(0),
    cacheReadTokens: integer("cache_read_tokens").notNull().default(0),
    costUsd: numeric("cost_usd", { precision: 10, scale: 5 }).notNull().default("0"),
    success: boolean("success").notNull(),
    latencyMs: integer("latency_ms").notNull().default(0),
    createdAt: createdAt()
  },
  (t) => [index("ai_usage_created_idx").on(t.createdAt), index("ai_usage_user_idx").on(t.userId, t.createdAt)]
);
var integrationStatus = pgTable("integration_status", {
  integration: text("integration").primaryKey(),
  lastSuccessAt: ts("last_success_at"),
  lastFailureAt: ts("last_failure_at"),
  lastError: text("last_error"),
  updatedAt: updatedAt()
});
var rateLimits = pgTable("rate_limits", {
  key: text("key").primaryKey(),
  windowStart: ts("window_start").notNull(),
  count: integer("count").notNull()
});

// server/db/client.ts
var pool = new pg.Pool({
  connectionString: config.DATABASE_URL,
  max: config.DATABASE_POOL_MAX,
  statement_timeout: 3e4
});
var db = drizzle(pool, { schema: schema_exports, casing: "snake_case" });

// server/services/account.ts
import { eq } from "drizzle-orm";

// server/logger.ts
import pino from "pino";
var logger = pino({
  level: config.APP_ENV === "test" ? "warn" : config.LOG_LEVEL,
  base: { service: "armoire" },
  redact: {
    paths: [
      "req.headers.authorization",
      "req.headers.cookie",
      "headers.cookie",
      "headers.authorization",
      "*.password",
      "*.token",
      "*.signedUrl",
      "*.url",
      "apiKey"
    ],
    censor: "[redacted]"
  },
  transport: config.APP_ENV === "development" ? { target: "pino-pretty", options: { colorize: true, ignore: "pid,hostname,service" } } : void 0
});
var reporter = null;
function reportError(err, context) {
  logger.error({ err, ...context }, "unhandled error");
  reporter?.(err, context);
}

// server/storage/index.ts
import { CreateBucketCommand, DeleteObjectsCommand, GetObjectCommand, HeadBucketCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
var S3Storage = class {
  client = new S3Client({
    region: config.S3_REGION,
    endpoint: config.S3_ENDPOINT || void 0,
    forcePathStyle: config.S3_FORCE_PATH_STYLE,
    credentials: { accessKeyId: config.S3_ACCESS_KEY_ID, secretAccessKey: config.S3_SECRET_ACCESS_KEY }
  });
  bucket = config.S3_BUCKET;
  async init() {
    if (!config.S3_AUTO_CREATE_BUCKET) return;
    try {
      await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }));
    } catch {
      await this.client.send(new CreateBucketCommand({ Bucket: this.bucket }));
      logger.info({ bucket: this.bucket }, "created storage bucket");
    }
  }
  async put(key, body, contentType) {
    await this.client.send(
      new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: body, ContentType: contentType, CacheControl: "private, max-age=31536000, immutable" })
    );
  }
  async get(key) {
    const res = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
    return Buffer.from(await res.Body.transformToByteArray());
  }
  signedUrl(key) {
    return getSignedUrl(this.client, new GetObjectCommand({ Bucket: this.bucket, Key: key }), { expiresIn: config.SIGNED_URL_TTL_SECONDS });
  }
  async deleteMany(keys) {
    for (let i = 0; i < keys.length; i += 1e3) {
      const chunk = keys.slice(i, i + 1e3);
      if (!chunk.length) continue;
      await this.client.send(new DeleteObjectsCommand({ Bucket: this.bucket, Delete: { Objects: chunk.map((Key) => ({ Key })), Quiet: true } }));
    }
  }
  async ready() {
    try {
      await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }));
      return true;
    } catch {
      return false;
    }
  }
};
var MemoryStorage = class {
  objects = /* @__PURE__ */ new Map();
  async put(key, body, type) {
    this.objects.set(key, { body, type });
  }
  async get(key) {
    const o = this.objects.get(key);
    if (!o) throw new Error("not found");
    return o.body;
  }
  async signedUrl(key) {
    return `/__test-storage/${encodeURIComponent(key)}`;
  }
  async deleteMany(keys) {
    keys.forEach((k) => this.objects.delete(k));
  }
  async ready() {
    return true;
  }
};
var s3 = config.STORAGE_DRIVER === "s3" ? new S3Storage() : null;
var storage = s3 ?? new MemoryStorage();
async function initStorage() {
  await s3?.init();
}

// server/services/account.ts
async function deleteUserData(userId) {
  const assets = await db.select({ d: schema_exports.imageAssets.displayKey, t: schema_exports.imageAssets.thumbKey }).from(schema_exports.imageAssets).where(eq(schema_exports.imageAssets.userId, userId));
  const items = await db.select({ i: schema_exports.wardrobeItems.imageKey, t: schema_exports.wardrobeItems.thumbKey }).from(schema_exports.wardrobeItems).where(eq(schema_exports.wardrobeItems.userId, userId));
  const keys = [...assets.flatMap((a) => [a.d, a.t]), ...items.flatMap((i) => [i.i, i.t])].filter((k) => !!k);
  await storage.deleteMany([...new Set(keys)]);
  logger.info({ userId, objects: keys.length }, "user media deleted");
}

// server/services/email.ts
import nodemailer from "nodemailer";
var sentEmails = [];
var transport = config.EMAIL_DRIVER === "smtp" ? nodemailer.createTransport(config.SMTP_URL) : null;
var EmailUnavailableError = class extends Error {
  code = "email_unavailable";
};
async function sendEmail(email) {
  if (config.EMAIL_DRIVER === "memory") {
    sentEmails.push(email);
    return;
  }
  if (!transport) throw new EmailUnavailableError("Email delivery is not configured");
  await transport.sendMail({ from: config.EMAIL_FROM, ...email });
  logger.info({ subject: email.subject }, "email sent");
}
var esc = (s) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
function layout(title, bodyHtml, cta) {
  return `<!doctype html><html><body style="margin:0;background:#e9ebed;font-family:Helvetica,Arial,sans-serif;color:#121212">
<div style="max-width:520px;margin:0 auto;padding:40px 24px">
<p style="font-size:20px;letter-spacing:-0.04em;text-transform:uppercase;margin:0 0 32px">Armoire</p>
<div style="background:#ffffff;border-radius:24px;padding:32px">
<h1 style="font-size:26px;line-height:1;text-transform:uppercase;letter-spacing:-0.03em;margin:0 0 16px">${esc(title)}</h1>
${bodyHtml}
${cta ? `<p style="margin:28px 0 0"><a href="${esc(cta.url)}" style="display:inline-block;background:#121212;color:#fff;text-decoration:none;border-radius:999px;padding:14px 24px;font-size:13px;text-transform:uppercase">${esc(cta.label)}</a></p>` : ""}
</div>
<p style="font-size:11px;color:#8b9096;margin-top:24px">You're receiving this because you have an Armoire account.</p>
</div></body></html>`;
}

// server/auth.ts
var auth = betterAuth({
  appName: "Armoire",
  baseURL: config.APP_URL,
  basePath: "/api/auth",
  secret: config.AUTH_SECRET,
  trustedOrigins: [config.APP_URL],
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: { user: schema_exports.user, session: schema_exports.session, account: schema_exports.account, verification: schema_exports.verification }
  }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 10,
    maxPasswordLength: 128,
    autoSignIn: true,
    revokeSessionsOnPasswordReset: true,
    resetPasswordTokenExpiresIn: 60 * 60,
    sendResetPassword: async ({ user: user2, url }) => {
      await sendEmail({
        to: user2.email,
        subject: "Reset your Armoire password",
        text: `Use this link to choose a new password. It expires in one hour.

${url}

If you didn't ask for this, you can ignore this email.`,
        html: layout(
          "Reset your password",
          `<p style="font-size:15px;line-height:1.5;color:#55595e">Hi ${esc(user2.name)}, use the button below to choose a new password. The link expires in one hour.</p><p style="font-size:13px;color:#8b9096">If you didn't ask for this, you can ignore this email.</p>`,
          { label: "Choose a new password", url }
        )
      });
    }
  },
  session: {
    expiresIn: 60 * 60 * 24 * 30,
    updateAge: 60 * 60 * 24
  },
  user: {
    deleteUser: {
      enabled: true,
      beforeDelete: async (u) => {
        await deleteUserData(u.id);
      }
    }
  },
  rateLimit: {
    enabled: config.APP_ENV !== "test",
    window: 60,
    max: 30,
    customRules: {
      "/sign-in/email": { window: 60, max: 8 },
      "/sign-up/email": { window: 60, max: 5 },
      "/request-password-reset": { window: 300, max: 3 }
    }
  },
  advanced: {
    useSecureCookies: config.APP_ENV === "production",
    database: { generateId: () => crypto.randomUUID() },
    ipAddress: { ipAddressHeaders: ["x-armoire-client-ip"] }
  },
  telemetry: { enabled: false }
});

// server/http.ts
import { HTTPException } from "hono/http-exception";
var AppError = class extends Error {
  constructor(status, code, message, extra) {
    super(message);
    this.status = status;
    this.code = code;
    this.extra = extra;
  }
  status;
  code;
  extra;
};
var notFound = (what = "Not found") => new AppError(404, "not_found", what);
async function parseJson(c, schema2) {
  let body;
  try {
    body = await c.req.json();
  } catch {
    throw new AppError(400, "invalid_json", "The request body must be valid JSON.");
  }
  const r = schema2.safeParse(body);
  if (!r.success) {
    throw new AppError(422, "validation_failed", "Some fields are invalid.", {
      fields: r.error.issues.map((i) => ({ path: i.path.join("."), message: i.message }))
    });
  }
  return r.data;
}
function parseQuery(c, schema2) {
  const r = schema2.safeParse(c.req.query());
  if (!r.success) throw new AppError(422, "validation_failed", "Some parameters are invalid.");
  return r.data;
}

// server/routes/admin.ts
import { desc, gte, sql as sql2 } from "drizzle-orm";
import { Hono } from "hono";

// server/context.ts
import { createMiddleware } from "hono/factory";
var requireUser = createMiddleware(async (c, next) => {
  const session2 = await auth.api.getSession({ headers: c.req.raw.headers });
  if (!session2) throw new AppError(401, "unauthenticated", "Please sign in to continue.");
  const u = session2.user;
  c.set("user", { id: u.id, email: u.email, name: u.name, emailVerified: u.emailVerified, createdAt: u.createdAt });
  await next();
});
var requireAdmin = createMiddleware(async (c, next) => {
  const u = c.get("user");
  if (!config.ADMIN_EMAILS.map((e) => e.toLowerCase()).includes(u.email.toLowerCase())) throw new AppError(404, "not_found", "Not found");
  await next();
});
var isAdmin = (email) => config.ADMIN_EMAILS.map((e) => e.toLowerCase()).includes(email.toLowerCase());

// server/routes/admin.ts
var adminRoutes = new Hono();
adminRoutes.use("*", requireUser, requireAdmin);
adminRoutes.get("/status", async (c) => {
  const since = new Date(Date.now() - 30 * 24 * 3600 * 1e3);
  const [status, usage2, byOp, counts, queues] = await Promise.all([
    db.select().from(schema_exports.integrationStatus),
    db.select({
      calls: sql2`count(*)::int`,
      failures: sql2`count(*) filter (where not ${schema_exports.aiUsage.success})::int`,
      inputTokens: sql2`coalesce(sum(${schema_exports.aiUsage.inputTokens}),0)::bigint`,
      outputTokens: sql2`coalesce(sum(${schema_exports.aiUsage.outputTokens}),0)::bigint`,
      cost: sql2`coalesce(sum(${schema_exports.aiUsage.costUsd}),0)::text`,
      p50: sql2`coalesce(percentile_cont(0.5) within group (order by ${schema_exports.aiUsage.latencyMs}),0)::int`
    }).from(schema_exports.aiUsage).where(gte(schema_exports.aiUsage.createdAt, since)),
    db.select({ operation: schema_exports.aiUsage.operation, calls: sql2`count(*)::int`, cost: sql2`coalesce(sum(${schema_exports.aiUsage.costUsd}),0)::text` }).from(schema_exports.aiUsage).where(gte(schema_exports.aiUsage.createdAt, since)).groupBy(schema_exports.aiUsage.operation).orderBy(desc(sql2`count(*)`)),
    db.execute(sql2`
      SELECT (SELECT count(*)::int FROM "user") users,
             (SELECT count(*)::int FROM wardrobe_items) items,
             (SELECT count(*)::int FROM products) products,
             (SELECT count(*)::int FROM discovery_runs WHERE created_at > now() - interval '1 day') runs`),
    db.execute(sql2`SELECT name, state, count(*)::int n FROM pgboss.job GROUP BY 1, 2`).then((r) => r.rows).catch(() => [])
  ]);
  return c.json({
    environment: config.APP_ENV,
    configured: {
      ai: integrations.ai(),
      aiModel: integrations.ai() ? config.AI_MODEL : null,
      ebay: integrations.ebay(),
      feed: integrations.feed(),
      email: integrations.email(),
      weather: config.WEATHER_ENABLED,
      storage: await storage.ready(),
      errorReporting: !!config.SENTRY_DSN
    },
    health: status,
    ai30d: { ...usage2[0], byOperation: byOp },
    totals: counts.rows[0],
    queues
  });
});

// server/routes/discovery.ts
import { and as and4, asc, desc as desc3, eq as eq6, inArray as inArray3, sql as sql5 } from "drizzle-orm";
import { Hono as Hono3 } from "hono";
import { z as z5 } from "zod";

// shared/taxonomy.ts
var CATEGORIES = ["top", "bottom", "dress", "outerwear", "shoes", "bag", "accessory"];
var COLOR_FAMILIES = [
  "black",
  "white",
  "grey",
  "beige",
  "brown",
  "navy",
  "denim",
  "blue",
  "green",
  "olive",
  "red",
  "burgundy",
  "pink",
  "purple",
  "yellow",
  "orange",
  "metallic",
  "multi"
];
var NEUTRALS = /* @__PURE__ */ new Set(["black", "white", "grey", "beige", "brown", "navy", "denim", "metallic"]);
var FAMILY_HUE = {
  red: 0,
  burgundy: 345,
  pink: 340,
  orange: 28,
  yellow: 52,
  olive: 65,
  green: 130,
  blue: 215,
  purple: 275
};
var PATTERNS = ["solid", "stripe", "check", "floral", "print", "graphic", "dot", "animal", "texture"];
var OCCASIONS = ["everyday", "work", "weekend", "evening", "date", "formal", "travel", "active", "lounge"];
var OCCASION_LABELS = {
  everyday: "Everyday",
  work: "Work",
  weekend: "Weekend",
  evening: "Evening out",
  date: "Date",
  formal: "Formal event",
  travel: "Travel",
  active: "Active",
  lounge: "At home"
};
var OCCASION_FORMALITY = {
  everyday: [1, 3],
  work: [3, 4],
  weekend: [1, 2],
  evening: [3, 5],
  date: [2, 4],
  formal: [4, 5],
  travel: [1, 3],
  active: [1, 1],
  lounge: [1, 1]
};
var SEASONS = ["spring", "summer", "autumn", "winter"];
var STYLES = ["minimal", "classic", "relaxed", "romantic", "street", "tailored", "bohemian", "sporty", "edgy", "preppy"];
var FITS = ["fitted", "regular", "relaxed", "oversized"];
var DEPARTMENTS = ["womens", "mens", "any"];

// server/jobs/queue.ts
import PgBoss from "pg-boss";
var QUEUES = {
  recognize: "recognize-garments",
  discovery: "discovery-refresh",
  discoverySweep: "discovery-sweep",
  maintenance: "maintenance"
};
var inlineHandlers = /* @__PURE__ */ new Map();
var inline = config.APP_ENV === "test" && process.env.JOBS_INLINE === "true";
var boss = null;
var starting = null;
function getBoss() {
  if (boss) return Promise.resolve(boss);
  starting ??= (async () => {
    const b = new PgBoss({ connectionString: config.DATABASE_URL, schema: "pgboss", max: 4 });
    b.on("error", (err) => logger.error({ err }, "job queue error"));
    await b.start();
    for (const name of Object.values(QUEUES)) {
      await b.createQueue(name, {
        name,
        retryLimit: 3,
        retryDelay: 20,
        retryBackoff: true,
        expireInSeconds: 600,
        retentionSeconds: 7 * 24 * 3600
      });
    }
    boss = b;
    return b;
  })();
  return starting;
}
async function enqueue(name, data, opts = {}) {
  if (inline) {
    const h = inlineHandlers.get(name);
    if (!h) return;
    for (let attempt = 0; attempt < 4; attempt++) {
      try {
        await h(data);
        return;
      } catch (err) {
        if (attempt === 3) logger.warn({ name, err: String(err) }, "inline job failed");
      }
    }
    return;
  }
  const b = await getBoss();
  await b.send(name, data, { singletonKey: opts.singletonKey, startAfter: opts.startAfter });
}

// server/rateLimit.ts
import { sql as sql3 } from "drizzle-orm";
async function rateLimit(key, limit, windowSeconds) {
  const res = await db.execute(sql3`
    INSERT INTO rate_limits (key, window_start, count) VALUES (${key}, now(), 1)
    ON CONFLICT (key) DO UPDATE SET
      count = CASE WHEN rate_limits.window_start < now() - make_interval(secs => ${windowSeconds}) THEN 1 ELSE rate_limits.count + 1 END,
      window_start = CASE WHEN rate_limits.window_start < now() - make_interval(secs => ${windowSeconds}) THEN now() ELSE rate_limits.window_start END
    RETURNING count`);
  const count3 = Number(res.rows[0]?.count ?? 0);
  if (count3 > limit) {
    throw new AppError(429, "rate_limited", "You are doing that a little too often. Please wait a moment and try again.", {
      retryAfterSeconds: windowSeconds
    });
  }
}

// server/services/discovery.ts
import { and as and3, desc as desc2, eq as eq5, ilike, inArray as inArray2, isNull, lt, ne as ne2, sql as sql4 } from "drizzle-orm";

// shared/styling.ts
var BOLD_PATTERNS = /* @__PURE__ */ new Set(["stripe", "check", "floral", "print", "graphic", "dot", "animal"]);
var hueDistance = (a, b) => {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
};
function colorHarmony(a, b) {
  if (!a || !b) return { score: 0.7, reason: "colour unknown" };
  if (NEUTRALS.has(a) || NEUTRALS.has(b)) return { score: 1, reason: "neutral base" };
  if (a === b) return { score: 0.85, reason: "tonal" };
  if (a === "multi" || b === "multi") return { score: 0.45, reason: "busy mix" };
  const ha = FAMILY_HUE[a];
  const hb = FAMILY_HUE[b];
  if (ha === void 0 || hb === void 0) return { score: 0.6, reason: "mixed" };
  const d = hueDistance(ha, hb);
  if (d <= 45) return { score: 0.85, reason: "analogous" };
  if (d >= 150) return { score: 0.72, reason: "complementary" };
  if (d >= 105 && d <= 135) return { score: 0.5, reason: "triadic" };
  return { score: 0.25, reason: "clashing" };
}
function categoriesCombine(a, b) {
  if (a === b) return a === "accessory";
  const pair = /* @__PURE__ */ new Set([a, b]);
  if (pair.has("dress") && (pair.has("top") || pair.has("bottom"))) return false;
  return true;
}
function pairCompatibility(a, b) {
  if (a.id === b.id || !categoriesCombine(a.category, b.category)) return { compatible: false, score: 0, reasons: [] };
  const reasons = [];
  const color = colorHarmony(a.colors[0], b.colors[0]);
  let score = color.score;
  reasons.push(color.reason);
  const fd = Math.abs(a.formality - b.formality);
  if (fd >= 3) return { compatible: false, score: 0, reasons: ["formality gap"] };
  if (fd === 2) {
    score *= 0.6;
    reasons.push("formality stretch");
  }
  if (BOLD_PATTERNS.has(a.pattern) && BOLD_PATTERNS.has(b.pattern)) {
    score *= 0.45;
    reasons.push("two bold patterns");
  }
  if (a.seasons.length && b.seasons.length && !a.seasons.some((s) => b.seasons.includes(s))) {
    score *= 0.55;
    reasons.push("different seasons");
  }
  return { compatible: score >= 0.55, score, reasons };
}
var MAIN = /* @__PURE__ */ new Set(["top", "bottom", "dress", "outerwear"]);
function evaluateOutfit(items, ctx) {
  const factors = [];
  const main = items.filter((i) => MAIN.has(i.category));
  let score = 1;
  const core = items.filter((i) => i.category !== "accessory" && i.category !== "bag");
  let pairTotal = 0;
  let pairs = 0;
  for (let i = 0; i < core.length; i++)
    for (let j = i + 1; j < core.length; j++) {
      pairTotal += pairCompatibility(core[i], core[j]).score;
      pairs++;
    }
  const harmony = pairs ? pairTotal / pairs : 0.7;
  score *= 0.4 + harmony * 0.6;
  const chromatic = new Set(main.map((i) => i.colors[0]).filter((c) => !!c && !NEUTRALS.has(c)));
  if (chromatic.size === 0) factors.push({ kind: "positive", label: "Colour", detail: "An all-neutral palette keeps the look calm and easy to wear." });
  else if (chromatic.size === 1) {
    const [c] = chromatic;
    factors.push({ kind: "positive", label: "Colour", detail: `One accent colour (${c}) against neutrals gives the look a clear focal point.` });
  } else if (chromatic.size === 2) {
    const [a, b] = [...chromatic];
    const h = colorHarmony(a, b);
    if (h.score >= 0.7) factors.push({ kind: "positive", label: "Colour", detail: `${cap(a)} and ${b} are ${h.reason}, so the two colours support each other.` });
    else {
      score *= 0.75;
      factors.push({ kind: "caution", label: "Colour", detail: `${cap(a)} and ${b} compete a little; keep accessories neutral.` });
    }
  } else {
    score *= 0.55;
    factors.push({ kind: "caution", label: "Colour", detail: "Three or more strong colours make the look busy." });
  }
  const bold = main.filter((i) => BOLD_PATTERNS.has(i.pattern));
  if (bold.length > 1) {
    score *= 0.6;
    factors.push({ kind: "caution", label: "Pattern", detail: "Two bold patterns are competing for attention." });
  } else if (bold.length === 1) {
    factors.push({ kind: "positive", label: "Pattern", detail: `The ${bold[0].pattern} piece is the only pattern, so it reads as intentional.` });
  }
  if (ctx.occasion) {
    const [lo, hi] = OCCASION_FORMALITY[ctx.occasion];
    const avg = main.length ? main.reduce((s, i) => s + i.formality, 0) / main.length : (lo + hi) / 2;
    if (avg < lo - 0.5 || avg > hi + 0.5) {
      score *= 0.6;
      factors.push({ kind: "caution", label: "Occasion", detail: avg < lo ? "A little casual for this occasion." : "A little dressy for this occasion." });
    } else {
      factors.push({ kind: "positive", label: "Occasion", detail: `The formality sits right for ${occasionPhrase(ctx.occasion)}.` });
    }
    const tagged = items.filter((i) => i.occasions.includes(ctx.occasion)).length;
    score *= 0.85 + 0.15 * (tagged / Math.max(1, items.length));
  }
  const formalities = main.map((i) => i.formality);
  if (formalities.length > 1 && Math.max(...formalities) - Math.min(...formalities) <= 1) {
    factors.push({ kind: "positive", label: "Balance", detail: "Every piece sits at a similar level of polish." });
  }
  if (ctx.temperatureC != null) {
    const t = ctx.temperatureC;
    const outer = items.find((i) => i.category === "outerwear");
    const warmth = Math.max(0, ...main.map((i) => i.warmth)) + (outer ? 1 : 0);
    if (t < 10 && (!outer || outer.warmth < 3)) {
      score *= 0.55;
      factors.push({ kind: "caution", label: "Weather", detail: `At ${Math.round(t)}\xB0C you'll want a warmer layer.` });
    } else if (t > 24 && warmth >= 5) {
      score *= 0.6;
      factors.push({ kind: "caution", label: "Weather", detail: `Heavy for ${Math.round(t)}\xB0C.` });
    } else {
      factors.push({ kind: "positive", label: "Weather", detail: `Suited to the forecast of about ${Math.round(t)}\xB0C.` });
    }
  }
  if (ctx.preferredStyles?.length) {
    const overlap = items.filter((i) => i.styles.some((s) => ctx.preferredStyles.includes(s))).length;
    score *= 0.9 + 0.1 * (overlap / Math.max(1, items.length));
    if (overlap >= Math.ceil(items.length / 2)) {
      factors.push({ kind: "positive", label: "Your style", detail: `Leans ${ctx.preferredStyles.slice(0, 2).join(" and ")}, as in your style profile.` });
    }
  }
  if (ctx.avoidColors?.length && items.some((i) => i.colors.some((c) => ctx.avoidColors.includes(c)))) {
    score *= 0.4;
    factors.push({ kind: "caution", label: "Colour", detail: "Includes a colour you said you prefer to avoid." });
  }
  if (ctx.preferredColors?.length && items.some((i) => ctx.preferredColors.includes(i.colors[0]))) score *= 1.05;
  return { score: Math.min(1, score), factors };
}
function cap(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
function occasionPhrase(o) {
  return { everyday: "every day", work: "work", weekend: "the weekend", evening: "an evening out", date: "a date", formal: "a formal event", travel: "travel", active: "being active", lounge: "time at home" }[o];
}

// server/routes/me.ts
import { eq as eq2 } from "drizzle-orm";
import { Hono as Hono2 } from "hono";
import { z as z3 } from "zod";

// shared/schemas.ts
import { z as z2 } from "zod";
var CONSENT_VERSION = "2026-10";
var tagList = (max2, len = 40) => z2.array(z2.string().trim().min(1).max(len)).max(max2);
var profileUpdateSchema = z2.object({
  department: z2.enum(DEPARTMENTS),
  preferredStyles: z2.array(z2.enum(STYLES)).max(10),
  favoriteColors: z2.array(z2.enum(COLOR_FAMILIES)).max(18),
  avoidColors: z2.array(z2.enum(COLOR_FAMILIES)).max(18),
  occasions: z2.array(z2.enum(OCCASIONS)).max(9),
  fits: z2.array(z2.enum(FITS)).max(4),
  budgetMin: z2.number().int().min(0).max(1e5).nullable(),
  budgetMax: z2.number().int().min(0).max(1e5).nullable(),
  currency: z2.enum(["USD", "GBP", "EUR", "CAD", "AUD"]),
  preferredBrands: tagList(20, 60),
  locationName: z2.string().trim().max(120).nullable(),
  latitude: z2.number().min(-90).max(90).nullable(),
  longitude: z2.number().min(-180).max(180).nullable(),
  temperatureUnit: z2.enum(["C", "F"]),
  notifyDiscoveriesEmail: z2.boolean()
}).partial().refine((p) => p.budgetMin == null || p.budgetMax == null || p.budgetMin <= p.budgetMax, { message: "Minimum budget must be below maximum", path: ["budgetMin"] });
var onboardingSchema = z2.object({
  imageConsent: z2.literal(true, { message: "Consent is required to upload photos" }),
  profile: profileUpdateSchema
});
var itemUpdateSchema = z2.object({
  name: z2.string().trim().max(80),
  category: z2.enum(CATEGORIES),
  subcategory: z2.string().trim().max(60).nullable(),
  colors: z2.array(z2.enum(COLOR_FAMILIES)).max(3),
  pattern: z2.enum(PATTERNS),
  materialEstimate: z2.string().trim().max(80).nullable(),
  styles: z2.array(z2.enum(STYLES)).max(10),
  occasions: z2.array(z2.enum(OCCASIONS)).max(9),
  seasons: z2.array(z2.enum(SEASONS)).max(4),
  formality: z2.number().int().min(1).max(5),
  warmth: z2.number().int().min(1).max(5),
  brand: z2.string().trim().max(60).nullable(),
  notes: z2.string().trim().max(1e3).nullable(),
  tags: tagList(20, 30),
  favorite: z2.boolean(),
  excludeFromStyling: z2.boolean(),
  status: z2.enum(["active", "archived"])
}).partial();
var styleRequestSchema = z2.object({
  occasion: z2.enum(OCCASIONS),
  style: z2.enum(STYLES).optional(),
  formality: z2.number().int().min(1).max(5).optional(),
  date: z2.iso.date().optional(),
  useWeather: z2.boolean().default(true),
  preferredColors: z2.array(z2.enum(COLOR_FAMILIES)).max(6).default([]),
  includeItemIds: z2.array(z2.uuid()).max(3).default([]),
  avoidItemIds: z2.array(z2.uuid()).max(50).default([]),
  notes: z2.string().trim().max(240).optional(),
  count: z2.number().int().min(1).max(3).default(3),
  /** Outfit ids already shown, so regenerate produces something different. */
  excludeOutfitIds: z2.array(z2.uuid()).max(30).default([])
});
var planCreateSchema = z2.object({
  outfitId: z2.uuid(),
  date: z2.iso.date(),
  occasion: z2.enum(OCCASIONS).nullable().optional(),
  note: z2.string().trim().max(200).nullable().optional()
});

// server/services/integrationStatus.ts
async function markIntegration(integration, ok, error) {
  const now = /* @__PURE__ */ new Date();
  await db.insert(schema_exports.integrationStatus).values({ integration, lastSuccessAt: ok ? now : null, lastFailureAt: ok ? null : now, lastError: ok ? null : error ?? null }).onConflictDoUpdate({
    target: schema_exports.integrationStatus.integration,
    set: ok ? { lastSuccessAt: now, updatedAt: now } : { lastFailureAt: now, lastError: (error ?? "").slice(0, 500), updatedAt: now }
  });
}

// server/services/weather.ts
var cache = /* @__PURE__ */ new Map();
var TTL = 30 * 60 * 1e3;
async function getForecast(lat, lon, locationName) {
  if (!config.WEATHER_ENABLED) return null;
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
  const key = `${lat.toFixed(2)},${lon.toFixed(2)}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL) return { locationName, days: hit.data, fetchedAt: new Date(hit.at).toISOString() };
  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.search = new URLSearchParams({
    latitude: lat.toFixed(4),
    longitude: lon.toFixed(4),
    daily: "temperature_2m_max,temperature_2m_min,precipitation_probability_max,weather_code",
    timezone: "auto",
    forecast_days: "14"
  }).toString();
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(6e3) });
    if (!res.ok) throw new Error(`status ${res.status}`);
    const j = await res.json();
    const days = j.daily.time.map((date2, i) => ({
      date: date2,
      maxC: j.daily.temperature_2m_max[i],
      minC: j.daily.temperature_2m_min[i],
      precipitationChance: j.daily.precipitation_probability_max?.[i] ?? null,
      code: j.daily.weather_code?.[i] ?? null
    }));
    cache.set(key, { at: Date.now(), data: days });
    await markIntegration("weather", true);
    return { locationName, days, fetchedAt: (/* @__PURE__ */ new Date()).toISOString() };
  } catch (err) {
    logger.warn({ err: String(err) }, "weather fetch failed");
    await markIntegration("weather", false, String(err));
    return null;
  }
}
async function searchPlaces(query) {
  const q = query.trim().slice(0, 80);
  if (q.length < 2) return [];
  const url = new URL("https://geocoding-api.open-meteo.com/v1/search");
  url.search = new URLSearchParams({ name: q, count: "6", language: "en", format: "json" }).toString();
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(6e3) });
    if (!res.ok) throw new Error(`status ${res.status}`);
    const j = await res.json();
    return (j.results ?? []).map((r) => ({ name: r.name, region: r.admin1 ?? null, country: r.country ?? null, latitude: r.latitude, longitude: r.longitude }));
  } catch (err) {
    logger.warn({ err: String(err) }, "geocoding failed");
    return null;
  }
}
function describeDay(d) {
  return `${Math.round(d.minC)}\u2013${Math.round(d.maxC)}\xB0C${d.precipitationChance != null && d.precipitationChance >= 50 ? `, ${d.precipitationChance}% chance of rain` : ""}`;
}

// server/routes/me.ts
var meRoutes = new Hono2();
meRoutes.use("*", async (c, next) => {
  if (c.req.method === "GET" && (c.req.path === "/api/me" || c.req.path === "/api/me/")) {
    const session2 = await auth.api.getSession({ headers: c.req.raw.headers });
    if (!session2) return c.json({ user: null });
  }
  return requireUser(c, next);
});
async function getOrCreateProfile(userId) {
  const [p] = await db.select().from(schema_exports.profiles).where(eq2(schema_exports.profiles.userId, userId));
  if (p) return p;
  const [created] = await db.insert(schema_exports.profiles).values({ userId }).onConflictDoNothing().returning();
  return created ?? (await db.select().from(schema_exports.profiles).where(eq2(schema_exports.profiles.userId, userId)))[0];
}
var publicProfile = (p) => {
  const { userId: _u, createdAt: _c, ...rest } = p;
  return rest;
};
function capabilities() {
  return {
    autoTagging: integrations.ai(),
    aiStylist: integrations.ai(),
    discovery: integrations.ebay() || integrations.feed(),
    weather: config.WEATHER_ENABLED,
    email: integrations.email()
  };
}
meRoutes.get("/", async (c) => {
  const u = c.get("user");
  const profile = await getOrCreateProfile(u.id);
  return c.json({
    user: { id: u.id, email: u.email, name: u.name, createdAt: u.createdAt },
    profile: publicProfile(profile),
    isAdmin: isAdmin(u.email),
    capabilities: capabilities()
  });
});
meRoutes.patch("/profile", async (c) => {
  const u = c.get("user");
  const body = await parseJson(c, profileUpdateSchema);
  await getOrCreateProfile(u.id);
  const [p] = await db.update(schema_exports.profiles).set(body).where(eq2(schema_exports.profiles.userId, u.id)).returning();
  return c.json({ profile: publicProfile(p) });
});
meRoutes.post("/onboarding", async (c) => {
  const u = c.get("user");
  const body = await parseJson(c, onboardingSchema);
  await getOrCreateProfile(u.id);
  const now = /* @__PURE__ */ new Date();
  const [p] = await db.update(schema_exports.profiles).set({ ...body.profile, imageConsentAt: now, consentVersion: CONSENT_VERSION, onboardingCompletedAt: now }).where(eq2(schema_exports.profiles.userId, u.id)).returning();
  return c.json({ profile: publicProfile(p) });
});
meRoutes.patch("/name", async (c) => {
  const u = c.get("user");
  const { name } = await parseJson(c, z3.object({ name: z3.string().trim().min(1).max(80) }));
  await db.update(schema_exports.user).set({ name, updatedAt: /* @__PURE__ */ new Date() }).where(eq2(schema_exports.user.id, u.id));
  return c.json({ name });
});
meRoutes.get("/places", async (c) => {
  const u = c.get("user");
  await rateLimit(`places:${u.id}`, 30, 60);
  const { q } = parseQuery(c, z3.object({ q: z3.string().max(80) }));
  const places = await searchPlaces(q);
  if (places === null) throw new AppError(503, "location_unavailable", "Location search is unavailable right now. Please try again shortly.");
  return c.json({ places });
});
meRoutes.get("/export", async (c) => {
  const u = c.get("user");
  await rateLimit(`export:${u.id}`, 5, 3600);
  const [profile, items, outfits2, outfitItems2, plans, recs] = await Promise.all([
    db.select().from(schema_exports.profiles).where(eq2(schema_exports.profiles.userId, u.id)),
    db.select().from(schema_exports.wardrobeItems).where(eq2(schema_exports.wardrobeItems.userId, u.id)),
    db.select().from(schema_exports.outfits).where(eq2(schema_exports.outfits.userId, u.id)),
    db.select({ outfitId: schema_exports.outfitItems.outfitId, itemId: schema_exports.outfitItems.itemId, role: schema_exports.outfitItems.role }).from(schema_exports.outfitItems).innerJoin(schema_exports.outfits, eq2(schema_exports.outfits.id, schema_exports.outfitItems.outfitId)).where(eq2(schema_exports.outfits.userId, u.id)),
    db.select().from(schema_exports.outfitPlans).where(eq2(schema_exports.outfitPlans.userId, u.id)),
    db.select({ status: schema_exports.productRecommendations.status, product: schema_exports.products.title, url: schema_exports.products.productUrl, savedAt: schema_exports.productRecommendations.savedAt }).from(schema_exports.productRecommendations).innerJoin(schema_exports.products, eq2(schema_exports.products.id, schema_exports.productRecommendations.productId)).where(eq2(schema_exports.productRecommendations.userId, u.id))
  ]);
  const strip = (rows) => rows.map(({ imageKey: _i, thumbKey: _t, userId: _u, ...r }) => r);
  c.header("content-disposition", 'attachment; filename="armoire-export.json"');
  return c.json({
    exportedAt: (/* @__PURE__ */ new Date()).toISOString(),
    account: { email: u.email, name: u.name, createdAt: u.createdAt },
    profile: strip(profile),
    wardrobe: strip(items),
    outfits: strip(outfits2),
    outfitItems: outfitItems2,
    plans: strip(plans),
    products: recs
  });
});

// server/services/ai/index.ts
import { and, count, eq as eq3, gte as gte2 } from "drizzle-orm";

// server/services/ai/anthropic.ts
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";

// server/services/ai/types.ts
import { z as z4 } from "zod";
var GarmentSchema = z4.object({
  name: z4.string().describe('Short, specific garment name, e.g. "Cropped camel trench coat"'),
  category: z4.enum(CATEGORIES),
  subcategory: z4.string().describe("e.g. trench coat, straight-leg jeans, ankle boot"),
  colors: z4.array(z4.object({ family: z4.enum(COLOR_FAMILIES), name: z4.string().describe('Descriptive colour name, e.g. "camel"') })).describe("Dominant colours, most prominent first (1-3)"),
  pattern: z4.enum(PATTERNS),
  material_estimate: z4.string().nullable().describe('Apparent fabric from the photo only, e.g. "looks like cotton twill". Null if unclear. Never state composition as fact.'),
  styles: z4.array(z4.enum(STYLES)),
  occasions: z4.array(z4.enum(OCCASIONS)),
  seasons: z4.array(z4.enum(SEASONS)),
  formality: z4.number().int().describe("1 = very casual, 5 = black tie"),
  warmth: z4.number().int().describe("1 = very light, 5 = heavy winter weight"),
  details: z4.array(z4.string()).describe('Distinctive visible details, e.g. "double-breasted", "raw hem" (max 5)'),
  box: z4.object({ x: z4.number(), y: z4.number(), w: z4.number(), h: z4.number() }).describe("Bounding box of this garment as fractions (0-1) of image width/height, origin top-left"),
  confidence: z4.number().describe("0-1 confidence in the category and colours")
});
var RecognitionSchema = z4.object({
  contains_clothing: z4.boolean(),
  garments: z4.array(GarmentSchema)
});
var OutfitPickSchema = z4.object({
  picks: z4.array(
    z4.object({
      candidate: z4.number().int().describe("Index of the chosen candidate outfit"),
      remove_item_ids: z4.array(z4.string()).describe("Optional pieces from that candidate to leave out (only optional slots)"),
      title: z4.string().describe("Evocative 2-4 word outfit name"),
      explanation: z4.string().describe("2-3 sentences on why the pieces work together, referencing the actual garments")
    })
  )
});
var ProductClassSchema = z4.object({
  products: z4.array(
    z4.object({
      id: z4.string(),
      category: z4.enum([...CATEGORIES, "other"]),
      subcategory: z4.string(),
      colors: z4.array(z4.enum(COLOR_FAMILIES)),
      pattern: z4.enum(PATTERNS),
      formality: z4.number().int(),
      styles: z4.array(z4.enum(STYLES))
    })
  )
});
var AIError = class extends Error {
  constructor(code, message, retryable = false) {
    super(message);
    this.code = code;
    this.retryable = retryable;
  }
  code;
  retryable;
};

// server/services/ai/anthropic.ts
var RECOGNITION_SYSTEM = `You catalogue clothing for a personal wardrobe app.
Look at the photo and list each distinct garment, shoe, bag or accessory that is a clear subject of the photo (up to 6). If a person is wearing an outfit, list each visible piece separately. Ignore background objects and items that are mostly out of frame.
Describe only what is visible. Material is an estimate from appearance; never assert fabric composition or brand as fact. If the photo contains no clothing, set contains_clothing to false and return an empty list.
Bounding boxes are fractions of the image (x, y = top-left corner).`;
var STYLIST_SYSTEM = `You are a thoughtful personal stylist. You choose between candidate outfits that were assembled only from garments the client already owns.
Choose the strongest, most distinct candidates for the brief. You may leave out pieces marked optional, but never add or invent garments. Refer to garments by what they are (e.g. "the camel trench"), never by id.
Explanations are 2-3 warm, specific sentences about colour, proportion, texture and occasion. Do not mention weather unless a forecast is provided in the brief.`;
var PRODUCT_SYSTEM = `You classify retail product listings into a fixed clothing taxonomy using only the listing text. Use "other" for non-clothing items. Formality: 1 very casual to 5 black tie.`;
var AnthropicProvider = class {
  name = "anthropic";
  client = new Anthropic({ apiKey: config.ANTHROPIC_API_KEY, timeout: config.AI_TIMEOUT_MS, maxRetries: 2 });
  async call(opts) {
    let response;
    try {
      response = await this.client.beta.messages.parse({
        model: config.AI_MODEL,
        max_tokens: 16e3,
        // Server-side fallback: if a safeguard declines, the API retries on a fallback model in the same call.
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        system: opts.system,
        output_config: { effort: opts.effort, format: betaZodOutputFormat(opts.schema) },
        messages: [{ role: "user", content: opts.content }]
      });
    } catch (err) {
      throw mapError(err);
    }
    if (response.stop_reason === "refusal") throw new AIError("refused", "The model declined this request");
    if (response.stop_reason === "max_tokens") throw new AIError("invalid_output", "The model response was cut off", true);
    const parsed = response.parsed_output;
    if (!parsed) throw new AIError("invalid_output", "The model response did not match the expected format", true);
    return {
      result: parsed,
      usage: {
        model: response.model,
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
        cacheReadTokens: response.usage.cache_read_input_tokens ?? 0
      }
    };
  }
  recognizeGarments(jpeg) {
    return this.call({
      schema: RecognitionSchema,
      system: RECOGNITION_SYSTEM,
      effort: "low",
      content: [
        { type: "image", source: { type: "base64", media_type: "image/jpeg", data: jpeg.toString("base64") } },
        { type: "text", text: "Catalogue the clothing in this photo." }
      ]
    });
  }
  pickOutfits(brief, candidates, count3) {
    return this.call({
      schema: OutfitPickSchema,
      system: STYLIST_SYSTEM,
      effort: "medium",
      content: [
        {
          type: "text",
          text: `Brief:
${JSON.stringify(brief, null, 1)}

Candidates (ranked by a rules engine; higher ruleScore is better):
${JSON.stringify(candidates, null, 1)}

Return the best ${count3} distinct candidate(s).`
        }
      ]
    });
  }
  classifyProducts(items) {
    return this.call({
      schema: ProductClassSchema,
      system: PRODUCT_SYSTEM,
      effort: "low",
      content: [{ type: "text", text: `Classify each listing. Return every id.
${JSON.stringify(items)}` }]
    });
  }
};
function mapError(err) {
  if (err instanceof Anthropic.AuthenticationError || err instanceof Anthropic.PermissionDeniedError) {
    return new AIError("misconfigured", "The AI provider rejected the configured credentials");
  }
  if (err instanceof Anthropic.RateLimitError) return new AIError("rate_limited", "The AI provider is rate limiting requests", true);
  if (err instanceof Anthropic.APIConnectionTimeoutError) return new AIError("timeout", "The AI provider timed out", true);
  if (err instanceof Anthropic.BadRequestError) return new AIError("invalid_output", `The AI provider rejected the request: ${err.message}`);
  if (err instanceof Anthropic.APIError) return new AIError("unavailable", `AI provider error ${err.status ?? ""}`.trim(), true);
  return new AIError("unavailable", "The AI provider could not be reached", true);
}

// server/services/ai/fixture.ts
import sharp from "sharp";
var usage = { model: "fixture", inputTokens: 0, outputTokens: 0, cacheReadTokens: 0 };
var PALETTE = [
  ["black", [20, 20, 20]],
  ["white", [240, 240, 236]],
  ["grey", [150, 150, 150]],
  ["beige", [215, 196, 160]],
  ["navy", [30, 42, 70]],
  ["blue", [60, 115, 200]],
  ["red", [190, 50, 40]],
  ["green", [60, 125, 85]],
  ["brown", [120, 80, 50]]
];
var FixtureProvider = class {
  name = "fixture";
  async recognizeGarments(jpeg) {
    const { width = 1, height = 1 } = await sharp(jpeg).metadata();
    const { channels } = await sharp(jpeg).stats();
    const rgb = channels.slice(0, 3).map((c) => c.mean);
    const [family] = PALETTE.reduce((best, cur) => dist(cur[1], rgb) < dist(best[1], rgb) ? cur : best);
    const ratio = height / width;
    const category = ratio > 1.3 ? "bottom" : ratio < 0.77 ? "shoes" : "top";
    const sub = { bottom: "trousers", shoes: "sneakers", top: "t-shirt" }[category];
    return {
      usage,
      result: {
        contains_clothing: true,
        garments: [
          {
            name: `${family} ${sub}`,
            category,
            subcategory: sub,
            colors: [{ family, name: family }],
            pattern: "solid",
            material_estimate: null,
            styles: ["minimal"],
            occasions: ["everyday", "weekend"],
            seasons: ["spring", "autumn"],
            formality: 2,
            warmth: 2,
            details: [],
            box: { x: 0, y: 0, w: 1, h: 1 },
            confidence: 0.9
          }
        ]
      }
    };
  }
  async pickOutfits(_brief, candidates, count3) {
    return {
      usage,
      result: {
        picks: candidates.slice(0, count3).map((c) => ({
          candidate: c.index,
          remove_item_ids: [],
          title: "Easy neutrals",
          explanation: `Pairs the ${c.items.map((i) => i.name).join(", ")} for a balanced look.`
        }))
      }
    };
  }
  async classifyProducts(items) {
    return { usage, result: { products: items.map((i) => ({ id: i.id, category: "other", subcategory: "", colors: [], pattern: "solid", formality: 2, styles: [] })) } };
  }
};
function dist(a, b) {
  return a.reduce((s, v, i) => s + (v - b[i]) ** 2, 0);
}

// server/services/ai/index.ts
var provider;
function getAI() {
  if (provider !== void 0) return provider;
  if (!integrations.ai()) provider = null;
  else provider = config.AI_PROVIDER === "fixture" ? new FixtureProvider() : new AnthropicProvider();
  return provider ?? null;
}
var PRICES = {
  "claude-opus-5-5": [4, 20],
  "claude-opus-5": [5, 25],
  "claude-opus-4-8": [5, 25],
  "claude-sonnet-5-5": [2, 10],
  "claude-sonnet-5": [2, 10],
  "claude-haiku-4-5": [1, 5]
};
function estimateCost(u) {
  const [i, o] = PRICES[u.model] ?? PRICES[config.AI_MODEL] ?? [0, 0];
  return (u.inputTokens * i + u.outputTokens * o + u.cacheReadTokens * i * 0.1) / 1e6;
}
async function runAI(operation, userId, fn) {
  const ai = getAI();
  if (!ai) throw new AIError("unavailable", "AI is not configured");
  if (userId) {
    const since = new Date(Date.now() - 24 * 3600 * 1e3);
    const [{ n }] = await db.select({ n: count() }).from(schema_exports.aiUsage).where(and(eq3(schema_exports.aiUsage.userId, userId), gte2(schema_exports.aiUsage.createdAt, since)));
    if (n >= config.AI_DAILY_USER_LIMIT) throw new AIError("quota_exceeded", "Daily AI limit reached");
  }
  const started = Date.now();
  try {
    const { result, usage: usage2 } = await fn(ai);
    await db.insert(schema_exports.aiUsage).values({
      userId,
      operation,
      model: usage2.model,
      inputTokens: usage2.inputTokens,
      outputTokens: usage2.outputTokens,
      cacheReadTokens: usage2.cacheReadTokens,
      costUsd: estimateCost(usage2).toFixed(5),
      success: true,
      latencyMs: Date.now() - started
    });
    await markIntegration("ai", true);
    return result;
  } catch (err) {
    const e = err instanceof AIError ? err : new AIError("unavailable", "Unexpected AI failure", true);
    await db.insert(schema_exports.aiUsage).values({ userId, operation, model: config.AI_MODEL, success: false, latencyMs: Date.now() - started });
    if (e.code !== "quota_exceeded" && e.code !== "refused") await markIntegration("ai", false, `${e.code}: ${e.message}`);
    logger.warn({ operation, code: e.code, msg: e.message }, "ai operation failed");
    throw e;
  }
}

// server/services/products/types.ts
var ProviderError = class extends Error {
  constructor(provider2, message, retryable = true) {
    super(message);
    this.provider = provider2;
    this.retryable = retryable;
  }
  provider;
  retryable;
};

// server/services/products/urlSafety.ts
import net from "node:net";
function safeExternalUrl(raw, allowedHostSuffixes) {
  if (!raw) return null;
  let url;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" || url.username || url.password) return null;
  if (url.port && url.port !== "443") return null;
  const host = url.hostname.toLowerCase();
  if (net.isIP(host.replace(/^\[|\]$/g, ""))) return null;
  if (!allowedHostSuffixes.some((s) => host === s || host.endsWith(`.${s}`))) return null;
  return url.toString();
}

// server/services/products/ebay.ts
var EBAY_LINK_HOSTS = ["ebay.com", "ebay.co.uk", "ebay.de", "ebay.fr", "ebay.it", "ebay.es", "ebay.ca", "ebay.com.au", "ebay.ie", "ebay.at", "ebay.ch", "ebay.nl", "ebay.be", "ebay.pl"];
var EBAY_IMAGE_HOSTS = ["ebayimg.com"];
var CLOTHING_SHOES_ACCESSORIES = "11450";
var EbayProvider = class {
  name = "ebay";
  token = null;
  host = config.EBAY_ENVIRONMENT === "sandbox" ? "https://api.sandbox.ebay.com" : "https://api.ebay.com";
  async accessToken() {
    if (this.token && this.token.expiresAt > Date.now() + 6e4) return this.token.value;
    const basic = Buffer.from(`${config.EBAY_CLIENT_ID}:${config.EBAY_CLIENT_SECRET}`).toString("base64");
    const res = await fetch(`${this.host}/identity/v1/oauth2/token`, {
      method: "POST",
      headers: { authorization: `Basic ${basic}`, "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ grant_type: "client_credentials", scope: "https://api.ebay.com/oauth/api_scope" }),
      signal: AbortSignal.timeout(1e4)
    });
    if (res.status === 401 || res.status === 400) throw new ProviderError("ebay", "eBay rejected the configured credentials", false);
    if (!res.ok) throw new ProviderError("ebay", `eBay token request failed (${res.status})`);
    const j = await res.json();
    this.token = { value: j.access_token, expiresAt: Date.now() + j.expires_in * 1e3 };
    return j.access_token;
  }
  async search(q) {
    const token = await this.accessToken();
    const filters = ["buyingOptions:{FIXED_PRICE}", "conditions:{NEW}"];
    if (q.priceMin != null || q.priceMax != null) {
      filters.push(`price:[${q.priceMin ?? ""}..${q.priceMax ?? ""}]`, `priceCurrency:${q.currency}`);
    }
    const url = new URL(`${this.host}/buy/browse/v1/item_summary/search`);
    url.search = new URLSearchParams({
      q: q.text.slice(0, 100),
      category_ids: CLOTHING_SHOES_ACCESSORIES,
      limit: String(Math.min(50, q.limit)),
      filter: filters.join(",")
    }).toString();
    const headers = { authorization: `Bearer ${token}`, "x-ebay-c-marketplace-id": config.EBAY_MARKETPLACE_ID };
    if (config.EBAY_AFFILIATE_CAMPAIGN_ID) headers["x-ebay-c-enduserctx"] = `affiliateCampaignId=${config.EBAY_AFFILIATE_CAMPAIGN_ID}`;
    const res = await fetch(url, { headers, signal: AbortSignal.timeout(12e3) });
    if (res.status === 429) throw new ProviderError("ebay", "eBay rate limit reached");
    if (res.status === 401 || res.status === 403) {
      this.token = null;
      throw new ProviderError("ebay", "eBay rejected the request credentials", false);
    }
    if (!res.ok) throw new ProviderError("ebay", `eBay search failed (${res.status})`);
    const j = await res.json();
    const out = [];
    for (const s of j.itemSummaries ?? []) {
      const productUrl = safeExternalUrl(s.itemAffiliateWebUrl ?? s.itemWebUrl, EBAY_LINK_HOSTS);
      if (!productUrl) continue;
      const amount = s.price ? Number(s.price.value) : NaN;
      out.push({
        provider: "ebay",
        externalId: s.itemId,
        title: s.title.slice(0, 300),
        brand: null,
        retailer: s.seller?.username ? `${s.seller.username} on eBay` : "eBay",
        imageUrl: safeExternalUrl(s.image?.imageUrl ?? s.thumbnailImages?.[0]?.imageUrl, EBAY_IMAGE_HOSTS),
        productUrl,
        price: Number.isFinite(amount) && s.price ? { amount, currency: s.price.currency } : null,
        condition: s.condition ?? null,
        availability: "listed",
        sizes: [],
        colorHint: null,
        categoryHint: s.categories?.map((c) => c.categoryName).join(" ") ?? null,
        attribution: "Listing from eBay"
      });
    }
    return out;
  }
};

// server/services/products/feed.ts
var MAX_FEED_BYTES = 80 * 1024 * 1024;

// server/services/products/fixture.ts
var CATALOGUE = [
  { externalId: "fx-1", title: "Camel wool trench coat", retailer: "Test Retailer", imageUrl: null, productUrl: "https://shop.example.com/p/fx-1", price: { amount: 180, currency: "USD" } },
  { externalId: "fx-2", title: "White leather sneakers", retailer: "Test Retailer", imageUrl: null, productUrl: "https://shop.example.com/p/fx-2", price: { amount: 95, currency: "USD" } },
  { externalId: "fx-3", title: "Black leather ankle boots", retailer: "Test Retailer", imageUrl: null, productUrl: "https://shop.example.com/p/fx-3", price: { amount: 140, currency: "USD" } },
  { externalId: "fx-4", title: "Navy cable knit sweater", retailer: "Test Retailer", imageUrl: null, productUrl: "https://shop.example.com/p/fx-4", price: { amount: 70, currency: "USD" } },
  { externalId: "fx-5", title: "Tan leather crossbody bag", retailer: "Test Retailer", imageUrl: null, productUrl: "https://shop.example.com/p/fx-5", price: { amount: 120, currency: "USD" } }
];
var FixtureProductProvider = class {
  name = "fixture";
  async search(q) {
    const words = q.text.toLowerCase().split(/\s+/).filter((w) => w.length > 3 && !["women's", "men's"].includes(w));
    return CATALOGUE.filter((p) => words.some((w) => p.title.toLowerCase().includes(w))).map((p) => ({
      ...p,
      provider: "fixture",
      brand: null,
      condition: "New",
      availability: "in_stock",
      sizes: [],
      colorHint: null,
      categoryHint: null,
      attribution: "Test catalogue"
    }));
  }
};

// server/services/wardrobe.ts
import { and as and2, eq as eq4, inArray, ne } from "drizzle-orm";
function toStyleItem(i) {
  if (!i.category) return null;
  return {
    id: i.id,
    category: i.category,
    colors: i.colors,
    pattern: i.pattern,
    formality: i.formality,
    warmth: i.warmth,
    seasons: i.seasons,
    occasions: i.occasions,
    styles: i.styles
  };
}
async function serializeItem(i, opts = {}) {
  const [thumbUrl, imageUrl] = await Promise.all([
    i.thumbKey ? storage.signedUrl(i.thumbKey) : null,
    opts.full && i.imageKey ? storage.signedUrl(i.imageKey) : null
  ]);
  return {
    id: i.id,
    status: i.status,
    name: i.name,
    category: i.category,
    subcategory: i.subcategory,
    colors: i.colors,
    colorNames: i.colorNames,
    pattern: i.pattern,
    materialEstimate: i.materialEstimate,
    styles: i.styles,
    occasions: i.occasions,
    seasons: i.seasons,
    formality: i.formality,
    warmth: i.warmth,
    details: i.details,
    brand: i.brand,
    notes: i.notes,
    tags: i.tags,
    favorite: i.favorite,
    excludeFromStyling: i.excludeFromStyling,
    aiTagged: !!i.aiAttributes,
    aiConfidence: i.aiConfidence,
    userEditedFields: i.userEditedFields,
    imageAssetId: i.imageAssetId,
    thumbUrl,
    imageUrl,
    createdAt: i.createdAt,
    updatedAt: i.updatedAt
  };
}
async function activeItems(userId) {
  return db.select().from(schema_exports.wardrobeItems).where(and2(eq4(schema_exports.wardrobeItems.userId, userId), eq4(schema_exports.wardrobeItems.status, "active")));
}
async function ownedItems(userId, ids) {
  if (!ids.length) return [];
  return db.select().from(schema_exports.wardrobeItems).where(and2(eq4(schema_exports.wardrobeItems.userId, userId), inArray(schema_exports.wardrobeItems.id, ids)));
}
function compatibleWith(item, others) {
  return others.filter((o) => pairCompatibility(item, o).compatible);
}
async function deleteItem(userId, itemId) {
  const [item] = await db.select().from(schema_exports.wardrobeItems).where(and2(eq4(schema_exports.wardrobeItems.id, itemId), eq4(schema_exports.wardrobeItems.userId, userId)));
  if (!item) return false;
  const keys = [];
  let assetToDelete = null;
  if (item.imageAssetId) {
    const [asset] = await db.select().from(schema_exports.imageAssets).where(eq4(schema_exports.imageAssets.id, item.imageAssetId));
    const siblings = await db.select({ id: schema_exports.wardrobeItems.id }).from(schema_exports.wardrobeItems).where(and2(eq4(schema_exports.wardrobeItems.imageAssetId, item.imageAssetId), ne(schema_exports.wardrobeItems.id, item.id)));
    if (asset && siblings.length === 0) {
      assetToDelete = asset;
      keys.push(...[asset.displayKey, asset.thumbKey].filter((k) => !!k));
    }
    if (asset) {
      for (const k of [item.imageKey, item.thumbKey]) if (k && k !== asset.displayKey && k !== asset.thumbKey) keys.push(k);
    }
  } else {
    keys.push(...[item.imageKey, item.thumbKey].filter((k) => !!k));
  }
  await db.transaction(async (tx) => {
    await tx.delete(schema_exports.wardrobeItems).where(eq4(schema_exports.wardrobeItems.id, item.id));
    if (assetToDelete) await tx.delete(schema_exports.imageAssets).where(eq4(schema_exports.imageAssets.id, assetToDelete.id));
  });
  await storage.deleteMany([...new Set(keys)]);
  return true;
}

// server/services/discovery.ts
var searchProviders = null;
function getSearchProviders() {
  if (searchProviders) return searchProviders;
  searchProviders = [];
  if (integrations.ebay()) searchProviders.push(new EbayProvider());
  if (config.APP_ENV === "test" && config.PRODUCT_PROVIDERS.includes("fixture")) searchProviders.push(new FixtureProductProvider());
  return searchProviders;
}
var discoveryAvailable = () => getSearchProviders().length > 0 || integrations.feed();
async function createRun(userId, trigger) {
  const [run] = await db.insert(schema_exports.discoveryRuns).values({ userId, trigger }).returning();
  return run;
}

// server/routes/discovery.ts
var discoveryRoutes = new Hono3();
discoveryRoutes.use("*", requireUser);
var R = schema_exports.productRecommendations;
var P = schema_exports.products;
async function serialize(userId, rows, pairLimit = 4) {
  const ids = [...new Set(rows.flatMap((r) => r.rec.pairsWith.slice(0, pairLimit)))];
  const items = await ownedItems(userId, ids);
  const active = new Map(items.filter((i) => i.status === "active").map((i) => [i.id, i]));
  const serialized = new Map(await Promise.all([...active.values()].map(async (i) => [i.id, await serializeItem(i)])));
  return rows.map(({ rec, product }) => ({
    id: rec.id,
    status: rec.status,
    score: Math.round(rec.score * 100) / 100,
    reasons: rec.reasons,
    pairCount: rec.pairCount,
    gapCategory: rec.gapCategory,
    savedAt: rec.savedAt,
    createdAt: rec.createdAt,
    pairsWith: rec.pairsWith.slice(0, pairLimit).map((id) => serialized.get(id)).filter(Boolean),
    product: {
      id: product.id,
      title: product.title,
      brand: product.brand,
      retailer: product.retailer,
      imageUrl: product.imageUrl,
      productUrl: product.productUrl,
      price: product.priceAmount != null ? { amount: Number(product.priceAmount), currency: product.currency } : null,
      category: product.category,
      colors: product.colors,
      condition: product.condition,
      availability: product.availability,
      sizes: product.sizes,
      provider: product.provider,
      attribution: product.attribution,
      lastVerifiedAt: product.lastVerifiedAt
    }
  }));
}
discoveryRoutes.get("/", async (c) => {
  const u = c.get("user");
  const q = parseQuery(
    c,
    z5.object({
      status: z5.enum(["new", "saved", "dismissed"]).default("new"),
      category: z5.enum(CATEGORIES).optional(),
      sort: z5.enum(["match", "price_asc", "price_desc", "newest"]).default("match"),
      limit: z5.coerce.number().int().min(1).max(60).default(30),
      offset: z5.coerce.number().int().min(0).default(0)
    })
  );
  const where = [eq6(R.userId, u.id), eq6(R.status, q.status)];
  if (q.category) where.push(eq6(P.category, q.category));
  const order = q.sort === "price_asc" ? [sql5`${P.priceAmount} asc nulls last`] : q.sort === "price_desc" ? [sql5`${P.priceAmount} desc nulls last`] : q.sort === "newest" ? [desc3(R.createdAt)] : q.status === "saved" ? [desc3(R.savedAt)] : [desc3(R.score)];
  const rows = await db.select({ rec: R, product: P }).from(R).innerJoin(P, eq6(P.id, R.productId)).where(and4(...where)).orderBy(...order, asc(R.id)).limit(q.limit).offset(q.offset);
  const [latest] = await db.select().from(schema_exports.discoveryRuns).where(eq6(schema_exports.discoveryRuns.userId, u.id)).orderBy(desc3(schema_exports.discoveryRuns.createdAt)).limit(1);
  return c.json({
    available: discoveryAvailable(),
    recommendations: await serialize(u.id, rows),
    latestRun: latest ? { id: latest.id, status: latest.status, errorCode: latest.errorCode, finishedAt: latest.finishedAt, createdAt: latest.createdAt, recommendationsCreated: latest.recommendationsCreated } : null
  });
});
discoveryRoutes.post("/refresh", async (c) => {
  const u = c.get("user");
  if (!discoveryAvailable()) throw new AppError(503, "discovery_unavailable", "New finds aren\u2019t available right now. Please check back later.");
  const [running] = await db.select().from(schema_exports.discoveryRuns).where(and4(eq6(schema_exports.discoveryRuns.userId, u.id), inArray3(schema_exports.discoveryRuns.status, ["queued", "running"]), sql5`${schema_exports.discoveryRuns.createdAt} > now() - interval '15 minutes'`)).limit(1);
  if (running) return c.json({ run: { id: running.id, status: running.status } });
  await rateLimit(`discovery:${u.id}`, 8, 24 * 3600);
  const run = await createRun(u.id, "manual");
  await enqueue(QUEUES.discovery, { userId: u.id, runId: run.id }, { singletonKey: `discovery:${u.id}` });
  const [fresh] = await db.select().from(schema_exports.discoveryRuns).where(eq6(schema_exports.discoveryRuns.id, run.id));
  return c.json({ run: { id: fresh.id, status: fresh.status, errorCode: fresh.errorCode } }, 202);
});
discoveryRoutes.get("/runs/:id", async (c) => {
  const u = c.get("user");
  const id = c.req.param("id");
  if (!z5.uuid().safeParse(id).success) throw notFound();
  const [run] = await db.select().from(schema_exports.discoveryRuns).where(and4(eq6(schema_exports.discoveryRuns.id, id), eq6(schema_exports.discoveryRuns.userId, u.id)));
  if (!run) throw notFound();
  return c.json({ run: { id: run.id, status: run.status, errorCode: run.errorCode, recommendationsCreated: run.recommendationsCreated, finishedAt: run.finishedAt } });
});
async function loadRec(userId, id) {
  if (!z5.uuid().safeParse(id).success) throw notFound("That find is no longer available.");
  const [row] = await db.select({ rec: R, product: P }).from(R).innerJoin(P, eq6(P.id, R.productId)).where(and4(eq6(R.id, id), eq6(R.userId, userId)));
  if (!row) throw notFound("That find is no longer available.");
  return row;
}
discoveryRoutes.get("/:id", async (c) => {
  const u = c.get("user");
  const row = await loadRec(u.id, c.req.param("id"));
  const [rec] = await serialize(u.id, [row], 12);
  return c.json({ recommendation: rec });
});
async function setStatus(userId, id, status) {
  await loadRec(userId, id);
  await db.update(R).set({ status, savedAt: status === "saved" ? /* @__PURE__ */ new Date() : null }).where(and4(eq6(R.id, id), eq6(R.userId, userId)));
}
discoveryRoutes.post("/:id/save", async (c) => {
  await setStatus(c.get("user").id, c.req.param("id"), "saved");
  return c.json({ status: "saved" });
});
discoveryRoutes.delete("/:id/save", async (c) => {
  await setStatus(c.get("user").id, c.req.param("id"), "new");
  return c.json({ status: "new" });
});
discoveryRoutes.post("/:id/dismiss", async (c) => {
  await setStatus(c.get("user").id, c.req.param("id"), "dismissed");
  return c.json({ status: "dismissed" });
});
discoveryRoutes.post("/:id/restore", async (c) => {
  await setStatus(c.get("user").id, c.req.param("id"), "new");
  return c.json({ status: "new" });
});

// server/routes/health.ts
import { sql as sql6 } from "drizzle-orm";
import { Hono as Hono4 } from "hono";
var healthRoutes = new Hono4();
healthRoutes.get("/", (c) => c.json({ status: "ok" }));
healthRoutes.get("/ready", async (c) => {
  const checks = {};
  try {
    await db.execute(sql6`select 1`);
    checks.database = true;
  } catch {
    checks.database = false;
  }
  checks.storage = await storage.ready();
  const ok = Object.values(checks).every(Boolean);
  return c.json({ status: ok ? "ready" : "degraded", checks }, ok ? 200 : 503);
});

// server/routes/insights.ts
import { and as and5, eq as eq7, gte as gte3, sql as sql7 } from "drizzle-orm";
import { Hono as Hono5 } from "hono";
var insightsRoutes = new Hono5();
insightsRoutes.use("*", requireUser);
insightsRoutes.get("/", async (c) => {
  const u = c.get("user");
  const rows = await activeItems(u.id);
  const styled = rows.map((r) => ({ row: r, s: toStyleItem(r) })).filter((x) => !!x.s);
  const since = new Date(Date.now() - 60 * 24 * 3600 * 1e3).toISOString().slice(0, 10);
  const [savedUse, wornUse, totals] = await Promise.all([
    db.select({ itemId: schema_exports.outfitItems.itemId, n: sql7`count(*)::int` }).from(schema_exports.outfitItems).innerJoin(schema_exports.outfits, eq7(schema_exports.outfits.id, schema_exports.outfitItems.outfitId)).where(and5(eq7(schema_exports.outfits.userId, u.id), eq7(schema_exports.outfits.saved, true))).groupBy(schema_exports.outfitItems.itemId),
    db.select({ itemId: schema_exports.outfitItems.itemId, n: sql7`count(*)::int` }).from(schema_exports.outfitPlans).innerJoin(schema_exports.outfitItems, eq7(schema_exports.outfitItems.outfitId, schema_exports.outfitPlans.outfitId)).where(and5(eq7(schema_exports.outfitPlans.userId, u.id), eq7(schema_exports.outfitPlans.worn, true), gte3(schema_exports.outfitPlans.date, since))).groupBy(schema_exports.outfitItems.itemId),
    db.execute(sql7`
      SELECT
        (SELECT count(*)::int FROM outfits WHERE user_id = ${u.id} AND saved) AS saved,
        (SELECT count(*)::int FROM outfit_plans WHERE user_id = ${u.id} AND date >= current_date) AS planned,
        (SELECT count(*)::int FROM outfit_plans WHERE user_id = ${u.id} AND worn AND date >= ${since}) AS worn`)
  ]);
  const saved = new Map(savedUse.map((r) => [r.itemId, Number(r.n)]));
  const worn = new Map(wornUse.map((r) => [r.itemId, Number(r.n)]));
  const categories = Object.fromEntries(CATEGORIES.map((cat) => [cat, styled.filter((x) => x.s.category === cat).length]));
  const colors = {};
  styled.forEach((x) => x.s.colors[0] && (colors[x.s.colors[0]] = (colors[x.s.colors[0]] ?? 0) + 1));
  const pairCounts = styled.map((x) => ({ x, n: styled.filter((y) => pairCompatibility(x.s, y.s).compatible).length }));
  const versatile = [...pairCounts].sort((a, b) => b.n - a.n).slice(0, 6);
  const tops = styled.filter((x) => x.s.category === "top");
  const bottoms = styled.filter((x) => x.s.category === "bottom");
  let baseOutfits = styled.filter((x) => x.s.category === "dress").length;
  for (const t of tops) for (const b of bottoms) if (pairCompatibility(t.s, b.s).compatible) baseOutfits++;
  const fortnight = Date.now() - 14 * 24 * 3600 * 1e3;
  const underused = styled.filter((x) => !saved.get(x.row.id) && !worn.get(x.row.id) && x.row.createdAt.getTime() < fortnight).slice(0, 8);
  const mostWorn = styled.filter((x) => worn.get(x.row.id)).sort((a, b) => (worn.get(b.row.id) ?? 0) - (worn.get(a.row.id) ?? 0)).slice(0, 6);
  const suggestions = [];
  if (!categories.shoes) suggestions.push({ text: "Add your shoes so every outfit can be complete.", category: "shoes" });
  if (!categories.outerwear) suggestions.push({ text: "Add a coat or jacket to unlock layered looks for cooler days.", category: "outerwear" });
  if (categories.top && categories.bottom && baseOutfits < categories.top) {
    suggestions.push({ text: "Several tops don\u2019t pair with your current bottoms. A neutral bottom (black, navy or denim) would connect them.", category: "bottom" });
  }
  if (underused.length >= 3) suggestions.push({ text: `${underused.length} pieces haven\u2019t appeared in a saved or worn look yet. Try asking your stylist to build around one.` });
  const ser = (r) => serializeItem(r);
  return c.json({
    measured: {
      savedLooks: Number(totals.rows[0]?.saved ?? 0),
      upcomingPlans: Number(totals.rows[0]?.planned ?? 0),
      wornLast60Days: Number(totals.rows[0]?.worn ?? 0),
      mostWorn: await Promise.all(mostWorn.map(async (x) => ({ item: await ser(x.row), count: worn.get(x.row.id) }))),
      underused: await Promise.all(underused.map((x) => ser(x.row)))
    },
    calculated: {
      totalItems: styled.length,
      categories,
      colors,
      baseOutfits,
      mostVersatile: await Promise.all(versatile.filter((v) => v.n > 0).map(async (v) => ({ item: await ser(v.x.row), pairsWith: v.n })))
    },
    suggestions
  });
});

// server/routes/outfits.ts
import { and as and7, eq as eq9 } from "drizzle-orm";
import { Hono as Hono6 } from "hono";
import { z as z6 } from "zod";

// server/services/styling.ts
import { createHash } from "node:crypto";
import { and as and6, desc as desc4, eq as eq8, gte as gte4, inArray as inArray4, max } from "drizzle-orm";
var OPTIONAL = /* @__PURE__ */ new Set(["outerwear", "bag", "accessory"]);
var CACHE_MINUTES = 10;
var sumPair = (a, bs) => bs.reduce((s, b) => s + pairCompatibility(a, b).score, 0);
function bestAddition(pool2, with_) {
  let best = null;
  let bestScore = -1;
  for (const p of pool2) {
    const s = sumPair(p, with_) / Math.max(1, with_.length);
    if (s > bestScore) {
      best = p;
      bestScore = s;
    }
  }
  return { item: best, score: bestScore };
}
function buildCandidates(items, ctx, opts) {
  const by = (c) => items.filter((i) => i.category === c);
  const band = ctx.occasion ? OCCASION_FORMALITY[ctx.occasion] : [1, 5];
  const target = opts.formalityTarget;
  const fits = (i) => target ? Math.abs(i.formality - target) <= 1 : i.formality >= band[0] - 1 && i.formality <= band[1] + 1;
  const ranked = (list2) => list2.filter(fits).map((i) => ({ i, s: (ctx.occasion && i.occasions.includes(ctx.occasion) ? 1.2 : 1) * (opts.weights.favorites.has(i.id) ? 1.05 : 1) })).sort((a, b) => b.s - a.s).slice(0, 40).map((x) => x.i);
  const includeIds = new Set(opts.include.map((i) => i.id));
  const tops = ranked(by("top"));
  const bottoms = ranked(by("bottom"));
  const dresses = ranked(by("dress"));
  const outer = by("outerwear").filter(fits);
  const shoes = by("shoes").filter(fits);
  const bags = by("bag");
  const accessories = by("accessory");
  const bases = [];
  for (const t of tops) for (const b of bottoms) if (pairCompatibility(t, b).compatible || (includeIds.has(t.id) || includeIds.has(b.id))) bases.push([{ item: t, role: "top" }, { item: b, role: "bottom" }]);
  for (const d of dresses) bases.push([{ item: d, role: "dress" }]);
  const candidates = [];
  for (const base of bases) {
    const coreKey = base.map((p) => p.item.id).sort().join("+");
    if (opts.excludedCores.has(coreKey)) continue;
    const pieces = base.map((p) => ({ ...p, optional: false }));
    const pick = (pool2, role, optional) => {
      const forced = opts.include.find((i) => i.category === role);
      const chosen2 = forced ?? bestAddition(pool2, pieces.map((p) => p.item)).item;
      if (chosen2) pieces.push({ item: chosen2, role, optional: optional && !forced });
    };
    pick(shoes, "shoes", false);
    const cold = ctx.temperatureC != null && ctx.temperatureC < 16;
    const warm = ctx.temperatureC != null && ctx.temperatureC > 22;
    if (opts.include.some((i) => i.category === "outerwear") || cold || !warm && outer.length && ["work", "evening", "formal", "travel"].includes(ctx.occasion ?? "")) {
      pick(outer, "outerwear", true);
    }
    if (bags.length) pick(bags, "bag", true);
    if (accessories.length && opts.include.some((i) => i.category === "accessory")) pick(accessories, "accessory", true);
    if ([...includeIds].some((id) => !pieces.some((p) => p.item.id === id))) continue;
    const evaluation = evaluateOutfit(pieces.map((p) => p.item), ctx);
    let score = evaluation.score;
    for (const p of pieces) {
      score *= Math.pow(0.95, opts.weights.recent.get(p.item.id) ?? 0);
      if (opts.weights.favorites.has(p.item.id)) score *= 1.02;
    }
    const ids = pieces.map((p) => p.item.id);
    for (let i = 0; i < ids.length; i++)
      for (let j = i + 1; j < ids.length; j++) {
        const k = [ids[i], ids[j]].sort().join("+");
        if (opts.weights.disliked.has(k)) score *= 0.8;
        if (opts.weights.liked.has(k)) score *= 1.06;
      }
    candidates.push({ pieces, score, factors: evaluation.factors });
  }
  candidates.sort((a, b) => b.score - a.score);
  const chosen = [];
  const use = /* @__PURE__ */ new Map();
  for (const c of candidates) {
    const core = c.pieces.filter((p) => !p.optional && p.role !== "shoes");
    if (chosen.some((o) => core.every((p) => o.pieces.some((q) => q.item.id === p.item.id)))) continue;
    if (core.some((p) => (use.get(p.item.id) ?? 0) >= 3)) continue;
    chosen.push(c);
    core.forEach((p) => use.set(p.item.id, (use.get(p.item.id) ?? 0) + 1));
    if (chosen.length >= 12) break;
  }
  return chosen;
}
function missingForOutfits(items) {
  const has = (c) => items.some((i) => i.category === c);
  const missing = [];
  if (!has("dress") && !(has("top") && has("bottom"))) {
    if (!has("top")) missing.push("top");
    if (!has("bottom")) missing.push("bottom");
  }
  return missing;
}
function ruleTitle(c, names, occasion) {
  const occ = occasion ? OCCASION_LABELS[occasion] : "Everyday";
  const lead = c.pieces.find((p) => p.role === "outerwear") ?? c.pieces.find((p) => p.role === "dress") ?? c.pieces.find((p) => p.role === "top");
  const chromatic = c.pieces.map((p) => p.item.colors[0]).filter((x) => !!x && !NEUTRALS.has(x));
  const leadName = lead ? names.get(lead.item.id)?.toLowerCase() : null;
  if (leadName && leadName.length <= 28) return `${occ}, ${leadName}`;
  return chromatic.length ? `${occ} in ${chromatic[0]}` : `${occ} neutrals`;
}
function ruleExplanation(c, names) {
  const lead = c.pieces.filter((p) => !p.optional).map((p) => names.get(p.item.id)?.toLowerCase()).filter(Boolean);
  const positives = c.factors.filter((f) => f.kind === "positive").slice(0, 2).map((f) => f.detail);
  return [`Built around your ${lead.slice(0, 2).join(" and ")}.`, ...positives].join(" ");
}
async function loadWeights(userId) {
  const since = new Date(Date.now() - 3 * 24 * 3600 * 1e3);
  const recentRows = await db.select({ itemId: schema_exports.outfitItems.itemId }).from(schema_exports.outfitItems).innerJoin(schema_exports.outfits, eq8(schema_exports.outfits.id, schema_exports.outfitItems.outfitId)).where(and6(eq8(schema_exports.outfits.userId, userId), gte4(schema_exports.outfits.createdAt, since)));
  const recent = /* @__PURE__ */ new Map();
  recentRows.forEach((r) => recent.set(r.itemId, (recent.get(r.itemId) ?? 0) + 1));
  const fbRows = await db.select({ outfitId: schema_exports.outfits.id, feedback: schema_exports.outfits.feedback, saved: schema_exports.outfits.saved, itemId: schema_exports.outfitItems.itemId }).from(schema_exports.outfits).innerJoin(schema_exports.outfitItems, eq8(schema_exports.outfitItems.outfitId, schema_exports.outfits.id)).where(and6(eq8(schema_exports.outfits.userId, userId), inArray4(schema_exports.outfits.feedback, [-1, 1])));
  const groups = /* @__PURE__ */ new Map();
  fbRows.forEach((r) => {
    const g = groups.get(r.outfitId) ?? { fb: r.feedback, items: [] };
    g.items.push(r.itemId);
    groups.set(r.outfitId, g);
  });
  const liked = /* @__PURE__ */ new Set();
  const disliked = /* @__PURE__ */ new Set();
  for (const g of groups.values())
    for (let i = 0; i < g.items.length; i++)
      for (let j = i + 1; j < g.items.length; j++) (g.fb > 0 ? liked : disliked).add([g.items[i], g.items[j]].sort().join("+"));
  return { recent, liked, disliked, favorites: /* @__PURE__ */ new Set() };
}
async function generateOutfits(userId, req) {
  const profile = await getOrCreateProfile(userId);
  const rows = (await activeItems(userId)).filter((r) => !r.excludeFromStyling && !req.avoidItemIds.includes(r.id));
  const styleItems = rows.map(toStyleItem).filter((s) => !!s);
  const byId = new Map(rows.map((r) => [r.id, r]));
  let weather = null;
  if (req.useWeather && profile.latitude != null && profile.longitude != null) {
    const forecast = await getForecast(profile.latitude, profile.longitude, profile.locationName ?? "your area");
    const date2 = req.date ?? (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
    const day = forecast?.days.find((d) => d.date === date2);
    if (forecast && day) weather = { summary: describeDay(day), temperatureC: day.maxC * 0.6 + day.minC * 0.4, locationName: forecast.locationName, date: date2 };
  }
  const [{ version }] = await db.select({ version: max(schema_exports.wardrobeItems.updatedAt) }).from(schema_exports.wardrobeItems).where(eq8(schema_exports.wardrobeItems.userId, userId));
  const { excludeOutfitIds, ...cacheable } = req;
  const paramsHash = createHash("sha256").update(JSON.stringify({ cacheable, version: version?.toISOString() ?? "", weather: weather?.summary ?? null })).digest("hex");
  const missing = missingForOutfits(styleItems);
  if (missing.length) {
    const [r] = await db.insert(schema_exports.stylingRequests).values({ userId, params: req, paramsHash, status: "insufficient", message: missing.join(",") }).returning({ id: schema_exports.stylingRequests.id });
    return {
      status: "insufficient",
      requestId: r.id,
      missing,
      message: `Add ${missing.map((m) => m === "top" ? "a top" : "a bottom").join(" and ")} (or a dress) so your stylist can build complete outfits.`
    };
  }
  if (!excludeOutfitIds.length) {
    const since = new Date(Date.now() - CACHE_MINUTES * 60 * 1e3);
    const [prev] = await db.select().from(schema_exports.stylingRequests).where(and6(eq8(schema_exports.stylingRequests.userId, userId), eq8(schema_exports.stylingRequests.paramsHash, paramsHash), eq8(schema_exports.stylingRequests.status, "complete"), gte4(schema_exports.stylingRequests.createdAt, since))).orderBy(desc4(schema_exports.stylingRequests.createdAt)).limit(1);
    if (prev) {
      const outfits3 = await loadOutfits(userId, { requestId: prev.id });
      if (outfits3.length) return { status: "complete", requestId: prev.id, outfits: outfits3, weather, source: prev.aiUsed ? "ai" : "rules", cached: true };
    }
  }
  const excludedCores = /* @__PURE__ */ new Set();
  if (excludeOutfitIds.length) {
    const ex = await db.select({ outfitId: schema_exports.outfitItems.outfitId, itemId: schema_exports.outfitItems.itemId, role: schema_exports.outfitItems.role }).from(schema_exports.outfitItems).innerJoin(schema_exports.outfits, eq8(schema_exports.outfits.id, schema_exports.outfitItems.outfitId)).where(and6(eq8(schema_exports.outfits.userId, userId), inArray4(schema_exports.outfitItems.outfitId, excludeOutfitIds)));
    const grouped = /* @__PURE__ */ new Map();
    ex.filter((e) => ["top", "bottom", "dress"].includes(e.role)).forEach((e) => grouped.set(e.outfitId, [...grouped.get(e.outfitId) ?? [], e.itemId]));
    grouped.forEach((ids2) => excludedCores.add(ids2.sort().join("+")));
  }
  const weights = await loadWeights(userId);
  rows.filter((r) => r.favorite).forEach((r) => weights.favorites.add(r.id));
  const ctx = {
    occasion: req.occasion,
    temperatureC: weather?.temperatureC ?? null,
    preferredStyles: req.style ? [req.style] : profile.preferredStyles,
    preferredColors: req.preferredColors.length ? req.preferredColors : profile.favoriteColors,
    avoidColors: profile.avoidColors
  };
  const include = styleItems.filter((s) => req.includeItemIds.includes(s.id));
  const candidates = buildCandidates(styleItems, ctx, { include, excludedCores, weights, formalityTarget: req.formality });
  if (!candidates.length) {
    const [r] = await db.insert(schema_exports.stylingRequests).values({ userId, params: req, paramsHash, status: "insufficient", message: "no_candidates" }).returning({ id: schema_exports.stylingRequests.id });
    return {
      status: "insufficient",
      requestId: r.id,
      missing: [],
      message: excludeOutfitIds.length ? "You\u2019ve seen every combination that fits this brief. Try a different occasion, or add more pieces to your wardrobe." : "None of your pieces fit this brief together yet. Try a different occasion or formality, or add a few more items."
    };
  }
  const names = new Map(rows.map((r) => [r.id, r.name || r.subcategory || "piece"]));
  let picks = [];
  let aiUsed = false;
  if (getAI()) {
    try {
      const forAI = candidates.map((c, index2) => ({
        index: index2,
        ruleScore: Math.round(c.score * 100) / 100,
        items: c.pieces.map((p) => {
          const r = byId.get(p.item.id);
          return { id: r.id, role: p.role, optional: p.optional, name: names.get(r.id), color: r.colorNames[0] ?? r.colors[0] ?? "unknown", pattern: r.pattern, formality: r.formality, details: r.details.slice(0, 3) };
        })
      }));
      const result = await runAI(
        "style_outfits",
        userId,
        (ai) => ai.pickOutfits(
          {
            occasion: OCCASION_LABELS[req.occasion],
            style: req.style,
            formality: req.formality,
            weather: weather ? `${weather.summary} in ${weather.locationName}` : null,
            notes: req.notes,
            preferredStyles: profile.preferredStyles,
            avoidColors: profile.avoidColors
          },
          forAI,
          Math.min(req.count, candidates.length)
        )
      );
      const seen = /* @__PURE__ */ new Set();
      for (const p of result.picks) {
        const cand = candidates[p.candidate];
        if (!cand || seen.has(p.candidate)) continue;
        seen.add(p.candidate);
        const removable = new Set(cand.pieces.filter((x) => x.optional).map((x) => x.item.id));
        const remove = new Set(p.remove_item_ids.filter((id) => removable.has(id)));
        const pieces = cand.pieces.filter((x) => !remove.has(x.item.id));
        const title = p.title.trim().slice(0, 60);
        const explanation = p.explanation.trim().slice(0, 700);
        if (!title || !explanation) continue;
        picks.push({ candidate: { ...cand, pieces }, title, explanation, source: "ai" });
      }
      aiUsed = picks.length > 0;
    } catch (err) {
      if (!(err instanceof AIError)) throw err;
      picks = [];
    }
  }
  if (!picks.length) {
    picks = candidates.slice(0, req.count).map((c) => ({ candidate: c, title: ruleTitle(c, names, req.occasion), explanation: ruleExplanation(c, names), source: "rules" }));
  }
  const ids = await db.transaction(async (tx) => {
    const [request] = await tx.insert(schema_exports.stylingRequests).values({ userId, params: req, paramsHash, weather, status: "complete", candidateCount: candidates.length, aiUsed }).returning({ id: schema_exports.stylingRequests.id });
    for (const p of picks) {
      if (!p.candidate.pieces.every((x) => byId.has(x.item.id))) continue;
      const evaluation = evaluateOutfit(p.candidate.pieces.map((x) => x.item), ctx);
      const [o] = await tx.insert(schema_exports.outfits).values({
        userId,
        requestId: request.id,
        title: p.title,
        occasion: req.occasion,
        style: req.style ?? null,
        explanation: p.explanation,
        factors: evaluation.factors,
        explanationSource: p.source,
        score: p.candidate.score
      }).returning({ id: schema_exports.outfits.id });
      await tx.insert(schema_exports.outfitItems).values(p.candidate.pieces.map((x, i) => ({ outfitId: o.id, itemId: x.item.id, role: x.role, position: i })));
    }
    return request.id;
  });
  const outfits2 = await loadOutfits(userId, { requestId: ids });
  return { status: "complete", requestId: ids, outfits: outfits2, weather, source: aiUsed ? "ai" : "rules", cached: false };
}
var ROLE_ORDER = ["outerwear", "top", "dress", "bottom", "shoes", "bag", "accessory"];
async function loadOutfits(userId, where) {
  const conds = [eq8(schema_exports.outfits.userId, userId)];
  if (where.requestId) conds.push(eq8(schema_exports.outfits.requestId, where.requestId));
  if (where.ids) {
    if (!where.ids.length) return [];
    conds.push(inArray4(schema_exports.outfits.id, where.ids));
  }
  if (where.saved !== void 0) conds.push(eq8(schema_exports.outfits.saved, where.saved));
  const outfitRows = await db.select().from(schema_exports.outfits).where(and6(...conds)).orderBy(where.saved ? desc4(schema_exports.outfits.savedAt) : desc4(schema_exports.outfits.score)).limit(where.limit ?? 100).offset(where.offset ?? 0);
  if (!outfitRows.length) return [];
  const links = await db.select({ link: schema_exports.outfitItems, item: schema_exports.wardrobeItems }).from(schema_exports.outfitItems).innerJoin(schema_exports.wardrobeItems, eq8(schema_exports.wardrobeItems.id, schema_exports.outfitItems.itemId)).where(and6(inArray4(schema_exports.outfitItems.outfitId, outfitRows.map((o) => o.id)), eq8(schema_exports.wardrobeItems.userId, userId)));
  const serialized = /* @__PURE__ */ new Map();
  await Promise.all(
    [...new Map(links.map((l) => [l.item.id, l.item])).values()].map(async (it) => serialized.set(it.id, await serializeItem(it, { full: true })))
  );
  return outfitRows.map((o) => ({
    id: o.id,
    title: o.title,
    occasion: o.occasion,
    style: o.style,
    explanation: o.explanation,
    explanationSource: o.explanationSource,
    factors: o.factors,
    saved: o.saved,
    savedAt: o.savedAt,
    feedback: o.feedback,
    createdAt: o.createdAt,
    items: links.filter((l) => l.link.outfitId === o.id).sort((a, b) => ROLE_ORDER.indexOf(a.link.role) - ROLE_ORDER.indexOf(b.link.role)).map((l) => ({ role: l.link.role, item: serialized.get(l.item.id) }))
  }));
}
async function alternativesFor(userId, outfitId, itemId) {
  const [outfit] = await loadOutfits(userId, { ids: [outfitId] });
  if (!outfit) return null;
  const target = outfit.items.find((i) => i.item.id === itemId);
  if (!target) return null;
  const rows = (await activeItems(userId)).filter((r) => !r.excludeFromStyling);
  const all = rows.map(toStyleItem).filter((s) => !!s);
  const rest = all.filter((s) => outfit.items.some((i) => i.item.id === s.id && i.item.id !== itemId));
  const ctx = { occasion: outfit.occasion ?? void 0 };
  const options = all.filter((s) => s.category === target.item.category && s.id !== itemId && !rest.some((r) => r.id === s.id)).map((s) => ({ s, score: evaluateOutfit([...rest, s], ctx).score })).sort((a, b) => b.score - a.score).slice(0, 8);
  const byId = new Map(rows.map((r) => [r.id, r]));
  return Promise.all(options.map(async (o) => ({ item: await serializeItem(byId.get(o.s.id)), score: Math.round(o.score * 100) / 100 })));
}
async function replaceItem(userId, outfitId, itemId, withItemId) {
  const [outfit] = await loadOutfits(userId, { ids: [outfitId] });
  if (!outfit) return null;
  const current = outfit.items.find((i) => i.item.id === itemId);
  if (!current) return null;
  const rows = await activeItems(userId);
  const replacement = rows.find((r) => r.id === withItemId);
  if (!replacement || replacement.category !== current.item.category || outfit.items.some((i) => i.item.id === withItemId)) return null;
  const byId = new Map(rows.map((r) => [r.id, r]));
  const newIds = outfit.items.map((i) => i.item.id === itemId ? withItemId : i.item.id);
  const styleItems = newIds.map((id) => byId.get(id)).filter((r) => !!r).map(toStyleItem).filter((s) => !!s);
  const evaluation = evaluateOutfit(styleItems, { occasion: outfit.occasion ?? void 0 });
  const names = new Map(rows.map((r) => [r.id, r.name || r.subcategory || "piece"]));
  const cand = {
    pieces: outfit.items.map((i) => ({ item: styleItems.find((s) => s.id === (i.item.id === itemId ? withItemId : i.item.id)), role: i.role, optional: OPTIONAL.has(i.role) })).filter((p) => p.item),
    score: evaluation.score,
    factors: evaluation.factors
  };
  await db.transaction(async (tx) => {
    await tx.update(schema_exports.outfitItems).set({ itemId: withItemId }).where(and6(eq8(schema_exports.outfitItems.outfitId, outfitId), eq8(schema_exports.outfitItems.itemId, itemId)));
    await tx.update(schema_exports.outfits).set({ factors: evaluation.factors, score: evaluation.score, explanation: ruleExplanation(cand, names), explanationSource: "rules" }).where(eq8(schema_exports.outfits.id, outfitId));
  });
  return (await loadOutfits(userId, { ids: [outfitId] }))[0];
}

// server/routes/outfits.ts
var outfitRoutes = new Hono6();
outfitRoutes.use("*", requireUser);
var idParam = (id) => {
  if (!z6.uuid().safeParse(id).success) throw notFound("That look no longer exists.");
  return id;
};
outfitRoutes.get("/", async (c) => {
  const u = c.get("user");
  const q = parseQuery(c, z6.object({ saved: z6.enum(["true"]).optional(), limit: z6.coerce.number().int().min(1).max(100).default(60), offset: z6.coerce.number().int().min(0).default(0) }));
  const outfits2 = await loadOutfits(u.id, { saved: true, limit: q.limit, offset: q.offset });
  return c.json({ outfits: outfits2 });
});
outfitRoutes.get("/:id", async (c) => {
  const u = c.get("user");
  const [outfit] = await loadOutfits(u.id, { ids: [idParam(c.req.param("id"))] });
  if (!outfit) throw notFound("That look no longer exists.");
  const plans = await db.select({ id: schema_exports.outfitPlans.id, date: schema_exports.outfitPlans.date, worn: schema_exports.outfitPlans.worn }).from(schema_exports.outfitPlans).where(and7(eq9(schema_exports.outfitPlans.outfitId, outfit.id), eq9(schema_exports.outfitPlans.userId, u.id)));
  return c.json({ outfit, plans });
});
async function setSaved(userId, id, saved) {
  const [row] = await db.update(schema_exports.outfits).set({ saved, savedAt: saved ? /* @__PURE__ */ new Date() : null }).where(and7(eq9(schema_exports.outfits.id, idParam(id)), eq9(schema_exports.outfits.userId, userId))).returning({ id: schema_exports.outfits.id });
  if (!row) throw notFound("That look no longer exists.");
}
outfitRoutes.post("/:id/save", async (c) => {
  await setSaved(c.get("user").id, c.req.param("id"), true);
  return c.json({ saved: true });
});
outfitRoutes.delete("/:id/save", async (c) => {
  await setSaved(c.get("user").id, c.req.param("id"), false);
  return c.json({ saved: false });
});
outfitRoutes.post("/:id/feedback", async (c) => {
  const u = c.get("user");
  const { value } = await parseJson(c, z6.object({ value: z6.union([z6.literal(-1), z6.literal(0), z6.literal(1)]) }));
  const [row] = await db.update(schema_exports.outfits).set({ feedback: value }).where(and7(eq9(schema_exports.outfits.id, idParam(c.req.param("id"))), eq9(schema_exports.outfits.userId, u.id))).returning({ id: schema_exports.outfits.id });
  if (!row) throw notFound("That look no longer exists.");
  return c.json({ feedback: value });
});
outfitRoutes.get("/:id/alternatives", async (c) => {
  const u = c.get("user");
  const { itemId } = parseQuery(c, z6.object({ itemId: z6.uuid() }));
  const options = await alternativesFor(u.id, idParam(c.req.param("id")), itemId);
  if (!options) throw notFound("That look or piece no longer exists.");
  return c.json({ alternatives: options });
});
outfitRoutes.post("/:id/replace", async (c) => {
  const u = c.get("user");
  const body = await parseJson(c, z6.object({ itemId: z6.uuid(), withItemId: z6.uuid() }));
  const outfit = await replaceItem(u.id, idParam(c.req.param("id")), body.itemId, body.withItemId);
  if (!outfit) throw new AppError(422, "invalid_replacement", "That piece can\u2019t be swapped in here. Choose another item of the same type.");
  return c.json({ outfit });
});
outfitRoutes.delete("/:id", async (c) => {
  const u = c.get("user");
  const [row] = await db.delete(schema_exports.outfits).where(and7(eq9(schema_exports.outfits.id, idParam(c.req.param("id"))), eq9(schema_exports.outfits.userId, u.id))).returning({ id: schema_exports.outfits.id });
  if (!row) throw notFound("That look no longer exists.");
  return c.json({ ok: true });
});

// server/routes/plans.ts
import { and as and8, asc as asc2, eq as eq10, gte as gte5, lte } from "drizzle-orm";
import { Hono as Hono7 } from "hono";
import { z as z7 } from "zod";
var planRoutes = new Hono7();
planRoutes.use("*", requireUser);
planRoutes.get("/", async (c) => {
  const u = c.get("user");
  const q = parseQuery(c, z7.object({ from: z7.iso.date(), to: z7.iso.date() }));
  const rows = await db.select().from(schema_exports.outfitPlans).where(and8(eq10(schema_exports.outfitPlans.userId, u.id), gte5(schema_exports.outfitPlans.date, q.from), lte(schema_exports.outfitPlans.date, q.to))).orderBy(asc2(schema_exports.outfitPlans.date), asc2(schema_exports.outfitPlans.createdAt));
  const outfits2 = await loadOutfits(u.id, { ids: [...new Set(rows.map((r) => r.outfitId))] });
  const byId = new Map(outfits2.map((o) => [o.id, o]));
  const profile = await getOrCreateProfile(u.id);
  const forecast = profile.latitude != null && profile.longitude != null ? await getForecast(profile.latitude, profile.longitude, profile.locationName ?? "") : null;
  return c.json({
    plans: rows.filter((r) => byId.has(r.outfitId)).map((r) => ({ id: r.id, date: r.date, occasion: r.occasion, note: r.note, worn: r.worn, outfit: byId.get(r.outfitId) })),
    forecast: forecast?.days.filter((d) => d.date >= q.from && d.date <= q.to) ?? []
  });
});
planRoutes.post("/", async (c) => {
  const u = c.get("user");
  const body = await parseJson(c, planCreateSchema);
  const [outfit] = await db.select({ id: schema_exports.outfits.id }).from(schema_exports.outfits).where(and8(eq10(schema_exports.outfits.id, body.outfitId), eq10(schema_exports.outfits.userId, u.id)));
  if (!outfit) throw notFound("That look no longer exists.");
  await db.update(schema_exports.outfits).set({ saved: true, savedAt: /* @__PURE__ */ new Date() }).where(and8(eq10(schema_exports.outfits.id, outfit.id), eq10(schema_exports.outfits.saved, false)));
  const [plan] = await db.insert(schema_exports.outfitPlans).values({ userId: u.id, outfitId: outfit.id, date: body.date, occasion: body.occasion ?? null, note: body.note ?? null }).returning();
  return c.json({ plan }, 201);
});
planRoutes.patch("/:id", async (c) => {
  const u = c.get("user");
  const body = await parseJson(c, z7.object({ worn: z7.boolean().optional(), date: z7.iso.date().optional(), note: z7.string().trim().max(200).nullable().optional() }));
  const id = c.req.param("id");
  if (!z7.uuid().safeParse(id).success) throw notFound();
  const [plan] = await db.update(schema_exports.outfitPlans).set(body).where(and8(eq10(schema_exports.outfitPlans.id, id), eq10(schema_exports.outfitPlans.userId, u.id))).returning();
  if (!plan) throw notFound("That plan no longer exists.");
  return c.json({ plan });
});
planRoutes.delete("/:id", async (c) => {
  const u = c.get("user");
  const id = c.req.param("id");
  if (!z7.uuid().safeParse(id).success) throw notFound();
  const [row] = await db.delete(schema_exports.outfitPlans).where(and8(eq10(schema_exports.outfitPlans.id, id), eq10(schema_exports.outfitPlans.userId, u.id))).returning({ id: schema_exports.outfitPlans.id });
  if (!row) throw notFound("That plan no longer exists.");
  return c.json({ ok: true });
});

// server/routes/styling.ts
import { Hono as Hono8 } from "hono";
var stylingRoutes = new Hono8();
stylingRoutes.use("*", requireUser);
stylingRoutes.post("/", async (c) => {
  const u = c.get("user");
  const body = await parseJson(c, styleRequestSchema);
  await rateLimit(`style:${u.id}`, 40, 3600);
  return c.json(await generateOutfits(u.id, body));
});

// server/routes/uploads.ts
import { and as and9, desc as desc5, eq as eq11, inArray as inArray5, or, sql as sql8 } from "drizzle-orm";
import { Hono as Hono9 } from "hono";

// server/services/images.ts
import { createHash as createHash2 } from "node:crypto";
import sharp2 from "sharp";
var MAX_UPLOAD_BYTES = 15 * 1024 * 1024;
var MAX_PIXELS = 6e7;
var ACCEPTED = /* @__PURE__ */ new Set(["jpeg", "png", "webp", "avif", "heif"]);
sharp2.cache(false);
sharp2.concurrency(2);
async function processUpload(input) {
  if (input.byteLength === 0) throw new AppError(422, "empty_file", "That file is empty.");
  if (input.byteLength > MAX_UPLOAD_BYTES) throw new AppError(413, "file_too_large", "Photos must be 15 MB or smaller.");
  let meta;
  try {
    meta = await sharp2(input, { limitInputPixels: MAX_PIXELS, failOn: "error" }).metadata();
  } catch {
    throw new AppError(415, "unsupported_image", "We couldn\u2019t read that file as a photo. Try a JPEG, PNG, WebP or AVIF image.");
  }
  if (!meta.format || !ACCEPTED.has(meta.format)) {
    throw new AppError(415, "unsupported_image", "We couldn\u2019t read that file as a photo. Try a JPEG, PNG, WebP or AVIF image.");
  }
  if ((meta.width ?? 0) < 200 || (meta.height ?? 0) < 200) {
    throw new AppError(422, "image_too_small", "That photo is too small. Use an image at least 200 pixels on each side.");
  }
  const sha256 = createHash2("sha256").update(input).digest("hex");
  const base = () => sharp2(input, { limitInputPixels: MAX_PIXELS }).rotate();
  try {
    const { data: display, info } = await base().resize(1600, 1600, { fit: "inside", withoutEnlargement: true }).webp({ quality: 82 }).toBuffer({ resolveWithObject: true });
    const thumb = await base().resize(480, 480, { fit: "inside", withoutEnlargement: true }).webp({ quality: 78 }).toBuffer();
    return { sha256, display, thumb, width: info.width, height: info.height };
  } catch {
    throw new AppError(415, "unsupported_image", "We couldn\u2019t process that photo. Try exporting it as a JPEG and uploading again.");
  }
}
async function forVision(display) {
  return sharp2(display).resize(1024, 1024, { fit: "inside", withoutEnlargement: true }).jpeg({ quality: 82 }).toBuffer();
}

// server/routes/uploads.ts
var uploadRoutes = new Hono9();
uploadRoutes.use("*", requireUser);
async function serializeAsset(a, itemCounts) {
  return {
    id: a.id,
    status: a.status,
    recognitionStatus: a.recognitionStatus,
    errorCode: a.errorCode,
    originalName: a.originalName,
    thumbUrl: a.thumbKey ? await storage.signedUrl(a.thumbKey) : null,
    createdAt: a.createdAt,
    reviewCount: itemCounts?.review ?? 0,
    activeCount: itemCounts?.active ?? 0
  };
}
uploadRoutes.post("/", async (c) => {
  const u = c.get("user");
  const profile = await getOrCreateProfile(u.id);
  if (!profile.imageConsentAt) {
    throw new AppError(403, "consent_required", "Please review how we use your photos and give consent before uploading.");
  }
  const form = await c.req.parseBody({ all: true }).catch(() => {
    throw new AppError(400, "invalid_upload", "We couldn\u2019t read that upload. Please try again.");
  });
  const raw = form["file"];
  const files = (Array.isArray(raw) ? raw : raw ? [raw] : []).filter((f) => f instanceof File);
  if (!files.length) throw new AppError(422, "no_file", "Choose at least one photo to upload.");
  if (files.length > 10) throw new AppError(422, "too_many_files", "Upload up to 10 photos at a time.");
  await rateLimit(`upload:${u.id}`, 120, 3600);
  const results = [];
  for (const file of files) {
    const name = file.name.slice(0, 120);
    try {
      const processed = await processUpload(Buffer.from(await file.arrayBuffer()));
      const [existing] = await db.select().from(schema_exports.imageAssets).where(and9(eq11(schema_exports.imageAssets.userId, u.id), eq11(schema_exports.imageAssets.sha256, processed.sha256)));
      if (existing) {
        results.push({ name, ok: true, duplicate: true, asset: await serializeAsset(existing) });
        continue;
      }
      const id = crypto.randomUUID();
      const displayKey = `users/${u.id}/assets/${id}/display.webp`;
      const thumbKey = `users/${u.id}/assets/${id}/thumb.webp`;
      await storage.put(displayKey, processed.display, "image/webp");
      await storage.put(thumbKey, processed.thumb, "image/webp");
      const [asset] = await db.insert(schema_exports.imageAssets).values({
        id,
        userId: u.id,
        originalName: name,
        displayKey,
        thumbKey,
        width: processed.width,
        height: processed.height,
        byteSize: processed.display.byteLength,
        sha256: processed.sha256,
        status: "processed",
        recognitionStatus: "pending"
      }).returning();
      await enqueue(QUEUES.recognize, { assetId: id }, { singletonKey: id });
      const [fresh] = await db.select().from(schema_exports.imageAssets).where(eq11(schema_exports.imageAssets.id, id));
      results.push({ name, ok: true, duplicate: false, asset: await serializeAsset(fresh ?? asset) });
    } catch (err) {
      if (err instanceof AppError) results.push({ name, ok: false, error: { code: err.code, message: err.message } });
      else throw err;
    }
  }
  const status = results.every((r) => !r.ok) ? 422 : 200;
  return c.json({ results }, status);
});
uploadRoutes.get("/", async (c) => {
  const u = c.get("user");
  const counts = db.select({
    assetId: schema_exports.wardrobeItems.imageAssetId,
    review: sql8`count(*) filter (where ${schema_exports.wardrobeItems.status} = 'review')`.as("review"),
    active: sql8`count(*) filter (where ${schema_exports.wardrobeItems.status} <> 'review')`.as("active")
  }).from(schema_exports.wardrobeItems).where(eq11(schema_exports.wardrobeItems.userId, u.id)).groupBy(schema_exports.wardrobeItems.imageAssetId).as("counts");
  const rows = await db.select({ asset: schema_exports.imageAssets, review: counts.review, active: counts.active }).from(schema_exports.imageAssets).leftJoin(counts, eq11(counts.assetId, schema_exports.imageAssets.id)).where(
    and9(
      eq11(schema_exports.imageAssets.userId, u.id),
      or(inArray5(schema_exports.imageAssets.recognitionStatus, ["pending", "running", "failed"]), sql8`coalesce(${counts.review}, 0) > 0`)
    )
  ).orderBy(desc5(schema_exports.imageAssets.createdAt)).limit(100);
  return c.json({
    uploads: await Promise.all(rows.map((r) => serializeAsset(r.asset, { review: Number(r.review ?? 0), active: Number(r.active ?? 0) })))
  });
});
uploadRoutes.post("/:id/retry", async (c) => {
  const u = c.get("user");
  const [asset] = await db.select().from(schema_exports.imageAssets).where(and9(eq11(schema_exports.imageAssets.id, c.req.param("id")), eq11(schema_exports.imageAssets.userId, u.id)));
  if (!asset) throw notFound("That upload no longer exists.");
  if (asset.recognitionStatus !== "failed") throw new AppError(409, "not_failed", "This photo is not waiting for a retry.");
  await rateLimit(`retry:${u.id}`, 30, 3600);
  await db.update(schema_exports.imageAssets).set({ recognitionStatus: "pending", recognitionAttempts: 0, errorCode: null }).where(eq11(schema_exports.imageAssets.id, asset.id));
  await enqueue(QUEUES.recognize, { assetId: asset.id }, { singletonKey: asset.id });
  return c.json({ ok: true });
});
uploadRoutes.post("/:id/describe", async (c) => {
  const u = c.get("user");
  const [asset] = await db.select().from(schema_exports.imageAssets).where(and9(eq11(schema_exports.imageAssets.id, c.req.param("id")), eq11(schema_exports.imageAssets.userId, u.id)));
  if (!asset) throw notFound("That upload no longer exists.");
  const [item] = await db.transaction(async (tx) => {
    await tx.update(schema_exports.imageAssets).set({ recognitionStatus: "unavailable" }).where(eq11(schema_exports.imageAssets.id, asset.id));
    return tx.insert(schema_exports.wardrobeItems).values({ userId: u.id, imageAssetId: asset.id, imageKey: asset.displayKey, thumbKey: asset.thumbKey, status: "review" }).returning({ id: schema_exports.wardrobeItems.id });
  });
  return c.json({ itemId: item.id });
});
uploadRoutes.delete("/:id", async (c) => {
  const u = c.get("user");
  const [asset] = await db.select().from(schema_exports.imageAssets).where(and9(eq11(schema_exports.imageAssets.id, c.req.param("id")), eq11(schema_exports.imageAssets.userId, u.id)));
  if (!asset) throw notFound("That upload no longer exists.");
  const items = await db.select().from(schema_exports.wardrobeItems).where(eq11(schema_exports.wardrobeItems.imageAssetId, asset.id));
  const review = items.filter((i) => i.status === "review");
  const kept = items.filter((i) => i.status !== "review");
  const keys = review.flatMap((i) => [i.imageKey, i.thumbKey]).filter((k) => !!k && k !== asset.displayKey && k !== asset.thumbKey);
  if (!kept.length) keys.push(...[asset.displayKey, asset.thumbKey].filter((k) => !!k));
  await db.transaction(async (tx) => {
    if (review.length) await tx.delete(schema_exports.wardrobeItems).where(inArray5(schema_exports.wardrobeItems.id, review.map((i) => i.id)));
    if (!kept.length) await tx.delete(schema_exports.imageAssets).where(eq11(schema_exports.imageAssets.id, asset.id));
  });
  await storage.deleteMany(keys);
  return c.json({ ok: true, removedItems: review.length });
});

// server/routes/wardrobe.ts
import { and as and11, arrayContains, asc as asc3, count as count2, desc as desc6, eq as eq13, ilike as ilike2, inArray as inArray6, or as or2, sql as sql9 } from "drizzle-orm";
import { Hono as Hono10 } from "hono";
import { z as z8 } from "zod";

// server/services/garments.ts
import { and as and10, eq as eq12 } from "drizzle-orm";
var clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, Math.round(Number.isFinite(n) ? n : lo)));
var only = (allowed, values) => [...new Set(values.filter((v) => allowed.includes(v)))];
var text2 = (s, max2) => (s ?? "").replace(/\s+/g, " ").trim().slice(0, max2);
function sanitizeGarment(g) {
  const colors = g.colors.filter((c) => COLOR_FAMILIES.includes(c.family)).slice(0, 3);
  return {
    name: text2(g.name, 80) || text2(g.subcategory, 80),
    category: CATEGORIES.includes(g.category) ? g.category : null,
    subcategory: text2(g.subcategory, 60) || null,
    colors: [...new Set(colors.map((c) => c.family))],
    colorNames: colors.map((c) => text2(c.name, 30)).filter(Boolean),
    pattern: PATTERNS.includes(g.pattern) ? g.pattern : "solid",
    materialEstimate: text2(g.material_estimate, 80) || null,
    styles: only(STYLES, g.styles),
    occasions: only(OCCASIONS, g.occasions),
    seasons: only(SEASONS, g.seasons),
    formality: clamp(g.formality, 1, 5),
    warmth: clamp(g.warmth, 1, 5),
    details: g.details.map((d) => text2(d, 60)).filter(Boolean).slice(0, 5),
    confidence: Math.min(1, Math.max(0, Number(g.confidence) || 0))
  };
}

// server/routes/wardrobe.ts
var wardrobeRoutes = new Hono10();
wardrobeRoutes.use("*", requireUser);
var listQuery = z8.object({
  status: z8.enum(["active", "review", "archived"]).default("active"),
  category: z8.enum(CATEGORIES).optional(),
  color: z8.enum(COLOR_FAMILIES).optional(),
  season: z8.enum(SEASONS).optional(),
  occasion: z8.enum(OCCASIONS).optional(),
  favorite: z8.enum(["true"]).optional(),
  q: z8.string().trim().max(80).optional(),
  sort: z8.enum(["recent", "name", "oldest"]).default("recent"),
  limit: z8.coerce.number().int().min(1).max(120).default(60),
  offset: z8.coerce.number().int().min(0).default(0),
  full: z8.enum(["true"]).optional()
});
var W = schema_exports.wardrobeItems;
wardrobeRoutes.get("/", async (c) => {
  const u = c.get("user");
  const q = parseQuery(c, listQuery);
  const where = [eq13(W.userId, u.id), eq13(W.status, q.status)];
  if (q.category) where.push(eq13(W.category, q.category));
  if (q.color) where.push(arrayContains(W.colors, [q.color]));
  if (q.season) where.push(arrayContains(W.seasons, [q.season]));
  if (q.occasion) where.push(arrayContains(W.occasions, [q.occasion]));
  if (q.favorite) where.push(eq13(W.favorite, true));
  if (q.q) {
    const term = `%${q.q.replace(/[%_\\]/g, (m) => `\\${m}`)}%`;
    where.push(
      or2(
        ilike2(W.name, term),
        ilike2(W.subcategory, term),
        ilike2(W.brand, term),
        ilike2(W.notes, term),
        sql9`array_to_string(${W.tags}, ' ') ilike ${term}`,
        sql9`array_to_string(${W.colorNames}, ' ') ilike ${term}`
      )
    );
  }
  const order = q.sort === "name" ? [asc3(W.name)] : q.sort === "oldest" ? [asc3(W.createdAt)] : [desc6(W.createdAt)];
  const [rows, [{ total }]] = await Promise.all([
    db.select().from(W).where(and11(...where)).orderBy(...order, asc3(W.id)).limit(q.limit).offset(q.offset),
    db.select({ total: count2() }).from(W).where(and11(...where))
  ]);
  return c.json({ items: await Promise.all(rows.map((r) => serializeItem(r, { full: !!q.full }))), total, offset: q.offset, limit: q.limit });
});
wardrobeRoutes.get("/facets", async (c) => {
  const u = c.get("user");
  const base = and11(eq13(W.userId, u.id), eq13(W.status, "active"));
  const [cats, colors, seasons, occasions, statuses] = await Promise.all([
    db.select({ key: W.category, n: count2() }).from(W).where(base).groupBy(W.category),
    db.execute(sql9`select unnest(colors) as key, count(*)::int as n from wardrobe_items where user_id = ${u.id} and status = 'active' group by 1`),
    db.execute(sql9`select unnest(seasons) as key, count(*)::int as n from wardrobe_items where user_id = ${u.id} and status = 'active' group by 1`),
    db.execute(sql9`select unnest(occasions) as key, count(*)::int as n from wardrobe_items where user_id = ${u.id} and status = 'active' group by 1`),
    db.select({ key: W.status, n: count2() }).from(W).where(eq13(W.userId, u.id)).groupBy(W.status)
  ]);
  const obj = (rows) => Object.fromEntries(rows.filter((r) => r.key).map((r) => [r.key, Number(r.n)]));
  return c.json({
    categories: obj(cats),
    colors: obj(colors.rows),
    seasons: obj(seasons.rows),
    occasions: obj(occasions.rows),
    statuses: obj(statuses)
  });
});
async function loadOwned(userId, id) {
  if (!z8.uuid().safeParse(id).success) throw notFound("That item no longer exists.");
  const [item] = await db.select().from(W).where(and11(eq13(W.id, id), eq13(W.userId, userId)));
  if (!item) throw notFound("That item no longer exists.");
  return item;
}
wardrobeRoutes.get("/:id", async (c) => {
  const u = c.get("user");
  const item = await loadOwned(u.id, c.req.param("id"));
  const style = toStyleItem(item);
  const others = (await activeItems(u.id)).filter((o) => o.id !== item.id);
  const compatible = style ? compatibleWith(style, others.map(toStyleItem).filter((s) => !!s)) : [];
  const compatibleRows = others.filter((o) => compatible.some((s) => s.id === o.id)).slice(0, 12);
  const [{ looks }] = await db.select({ looks: count2() }).from(schema_exports.outfitItems).innerJoin(schema_exports.outfits, eq13(schema_exports.outfits.id, schema_exports.outfitItems.outfitId)).where(and11(eq13(schema_exports.outfitItems.itemId, item.id), eq13(schema_exports.outfits.saved, true)));
  return c.json({
    item: await serializeItem(item, { full: true }),
    pairsWithCount: compatible.length,
    pairsWith: await Promise.all(compatibleRows.map((r) => serializeItem(r))),
    savedLookCount: looks
  });
});
wardrobeRoutes.patch("/:id", async (c) => {
  const u = c.get("user");
  const item = await loadOwned(u.id, c.req.param("id"));
  const body = await parseJson(c, itemUpdateSchema);
  if (body.status === "active" && !(body.category ?? item.category)) {
    throw new AppError(422, "category_required", "Choose a category before adding this item to your wardrobe.");
  }
  const attributeFields = ["name", "category", "subcategory", "colors", "pattern", "materialEstimate", "styles", "occasions", "seasons", "formality", "warmth"];
  const edited = new Set(item.userEditedFields);
  for (const k of Object.keys(body)) if (attributeFields.includes(k)) edited.add(k);
  const patch = { ...body, userEditedFields: [...edited] };
  if (body.status === "active" && item.status === "review") patch.confirmedAt = /* @__PURE__ */ new Date();
  if (body.colors) patch.colorNames = body.colors;
  const [updated] = await db.update(W).set(patch).where(eq13(W.id, item.id)).returning();
  return c.json({ item: await serializeItem(updated, { full: true }) });
});
wardrobeRoutes.post("/confirm", async (c) => {
  const u = c.get("user");
  const { ids } = await parseJson(c, z8.object({ ids: z8.array(z8.uuid()).min(1).max(100) }));
  const rows = await db.select().from(W).where(and11(eq13(W.userId, u.id), inArray6(W.id, ids), eq13(W.status, "review")));
  const missing = rows.filter((r) => !r.category);
  if (missing.length) {
    throw new AppError(422, "category_required", "Some items still need a category.", { itemIds: missing.map((m) => m.id) });
  }
  if (rows.length) await db.update(W).set({ status: "active", confirmedAt: /* @__PURE__ */ new Date() }).where(inArray6(W.id, rows.map((r) => r.id)));
  return c.json({ confirmed: rows.length });
});
wardrobeRoutes.delete("/:id", async (c) => {
  const u = c.get("user");
  await loadOwned(u.id, c.req.param("id"));
  await deleteItem(u.id, c.req.param("id"));
  return c.json({ ok: true });
});
wardrobeRoutes.put("/:id/image", async (c) => {
  const u = c.get("user");
  const item = await loadOwned(u.id, c.req.param("id"));
  await rateLimit(`upload:${u.id}`, 120, 3600);
  const form = await c.req.parseBody();
  const file = form["file"];
  if (!(file instanceof File)) throw new AppError(422, "no_file", "Choose a photo to upload.");
  const processed = await processUpload(Buffer.from(await file.arrayBuffer()));
  const version = Date.now().toString(36);
  const imageKey = `users/${u.id}/items/${item.id}/image-${version}.webp`;
  const thumbKey = `users/${u.id}/items/${item.id}/thumb-${version}.webp`;
  await storage.put(imageKey, processed.display, "image/webp");
  await storage.put(thumbKey, processed.thumb, "image/webp");
  const previous = [item.imageKey, item.thumbKey].filter((k) => !!k && k.includes(`/items/${item.id}/`));
  const [updated] = await db.update(W).set({ imageKey, thumbKey, crop: null }).where(eq13(W.id, item.id)).returning();
  await storage.deleteMany(previous);
  return c.json({ item: await serializeItem(updated, { full: true }) });
});
wardrobeRoutes.post("/:id/reanalyze", async (c) => {
  const u = c.get("user");
  const item = await loadOwned(u.id, c.req.param("id"));
  if (!getAI() || !item.imageKey) throw new AppError(503, "tagging_unavailable", "Automatic tagging isn\u2019t available right now. You can edit the details yourself.");
  await rateLimit(`reanalyze:${u.id}`, 20, 3600);
  let recognition;
  try {
    const image = await storage.get(item.imageKey);
    recognition = await runAI("reanalyze_item", u.id, async (ai) => ai.recognizeGarments(await forVision(image)));
  } catch (err) {
    if (err instanceof AIError) {
      throw new AppError(err.code === "quota_exceeded" ? 429 : 503, "tagging_failed", err.code === "quota_exceeded" ? "You\u2019ve reached today\u2019s limit for automatic tagging. Try again tomorrow." : "We couldn\u2019t analyse this photo just now. Please try again in a moment.");
    }
    throw err;
  }
  const g = recognition.garments.sort((a, b) => b.box.w * b.box.h - a.box.w * a.box.h)[0];
  if (!g) throw new AppError(422, "no_clothing_detected", "We couldn\u2019t find a garment in this photo.");
  const clean = sanitizeGarment(g);
  const { confidence, ...attrs } = clean;
  const patch = { aiAttributes: g, aiConfidence: confidence };
  for (const [k, v] of Object.entries(attrs)) if (!item.userEditedFields.includes(k === "colorNames" ? "colors" : k)) patch[k] = v;
  const [updated] = await db.update(W).set(patch).where(eq13(W.id, item.id)).returning();
  return c.json({ item: await serializeItem(updated, { full: true }) });
});

// server/app.ts
var appOrigin = new URL(config.APP_URL).origin;
var CLIENT_IP_HEADER = "x-armoire-client-ip";
function clientIp(c) {
  if (config.TRUST_PROXY) {
    const fwd = c.req.header("x-forwarded-for")?.split(",")[0]?.trim();
    if (fwd) return fwd;
  }
  try {
    return getConnInfo(c).remote.address ?? "unknown";
  } catch {
    return "unknown";
  }
}
function createApp() {
  const app = new Hono11();
  app.use("*", async (c, next) => {
    const id = c.req.header("x-request-id") ?? crypto.randomUUID();
    c.set("requestId", id);
    const started = Date.now();
    await next();
    c.header("x-request-id", id);
    if (!c.req.path.startsWith("/api/health")) {
      logger.info({ id, method: c.req.method, path: c.req.path, status: c.res.status, ms: Date.now() - started }, "request");
    }
  });
  app.use(
    "*",
    secureHeaders({
      contentSecurityPolicy: {
        defaultSrc: ["'self'"],
        imgSrc: ["'self'", "data:", "blob:", "https:", ...config.S3_ENDPOINT ? [new URL(config.S3_ENDPOINT).origin] : []],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        scriptSrc: ["'self'"],
        connectSrc: ["'self'"],
        frameAncestors: ["'none'"],
        formAction: ["'self'"],
        baseUri: ["'self'"],
        objectSrc: ["'none'"]
      },
      referrerPolicy: "strict-origin-when-cross-origin",
      crossOriginResourcePolicy: "same-site"
    })
  );
  app.use("/api/*", async (c, next) => {
    if (!["GET", "HEAD", "OPTIONS"].includes(c.req.method) && !c.req.path.startsWith("/api/auth/")) {
      const origin = c.req.header("origin") ?? (c.req.header("referer") ? new URL(c.req.header("referer")).origin : null);
      if (origin !== appOrigin) throw new AppError(403, "bad_origin", "This request was blocked for your security. Reload the page and try again.");
    }
    await next();
  });
  app.on(["GET", "POST"], "/api/auth/*", (c) => {
    const headers = new Headers(c.req.raw.headers);
    headers.set(CLIENT_IP_HEADER, clientIp(c));
    return auth.handler(new Request(c.req.raw, { headers }));
  });
  app.use("/api/uploads", bodyLimit({ maxSize: MAX_UPLOAD_BYTES * 10 + 1024 * 1024, onError: () => {
    throw new AppError(413, "payload_too_large", "That upload is too large. Add up to 10 photos of 15 MB each at a time.");
  } }));
  app.use("/api/*", async (c, next) => {
    if (c.req.path.startsWith("/api/uploads") || c.req.path.match(/^\/api\/wardrobe\/[^/]+\/image$/)) return next();
    return bodyLimit({ maxSize: 256 * 1024, onError: () => {
      throw new AppError(413, "payload_too_large", "That request is too large.");
    } })(c, next);
  });
  app.route("/api/health", healthRoutes);
  app.route("/api/me", meRoutes);
  app.route("/api/uploads", uploadRoutes);
  app.route("/api/wardrobe", wardrobeRoutes);
  app.route("/api/styling", stylingRoutes);
  app.route("/api/outfits", outfitRoutes);
  app.route("/api/plans", planRoutes);
  app.route("/api/discovery", discoveryRoutes);
  app.route("/api/insights", insightsRoutes);
  app.route("/api/admin", adminRoutes);
  app.all("/api/*", () => {
    throw new AppError(404, "not_found", "Not found");
  });
  app.onError((err, c) => {
    if (err instanceof AppError) {
      return c.json({ error: { code: err.code, message: err.message, ...err.extra } }, err.status);
    }
    reportError(err, { path: c.req.path, method: c.req.method, requestId: c.get("requestId") });
    return c.json({ error: { code: "internal_error", message: "Something went wrong on our side. Please try again." } }, 500);
  });
  return app;
}

// server/vercel-entry.ts
await initStorage();
var vercel_entry_default = handle(createApp());
export {
  vercel_entry_default as default
};
