import { z } from 'zod'

/**
 * Validated runtime configuration. The process refuses to start with an
 * invalid configuration. Optional integrations (AI, product sources, email)
 * may be absent; features that depend on them report themselves unavailable.
 */

const bool = z
  .enum(['true', 'false', '1', '0', ''])
  .optional()
  .transform((v) => v === 'true' || v === '1')

const list = z
  .string()
  .optional()
  .transform((v) => (v ? v.split(',').map((s) => s.trim()).filter(Boolean) : []))

const schema = z.object({
  APP_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().default(8787),
  APP_URL: z.url().default('http://localhost:5173'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),

  DATABASE_URL: z.string().min(1),
  DATABASE_POOL_MAX: z.coerce.number().int().default(10),

  AUTH_SECRET: z.string().min(32, 'AUTH_SECRET must be at least 32 characters'),
  ADMIN_EMAILS: list,

  STORAGE_DRIVER: z.enum(['s3', 'memory']).default('s3'),
  S3_ENDPOINT: z.string().optional(),
  S3_REGION: z.string().default('us-east-1'),
  S3_BUCKET: z.string().default('armoire-media'),
  S3_ACCESS_KEY_ID: z.string().optional(),
  S3_SECRET_ACCESS_KEY: z.string().optional(),
  S3_FORCE_PATH_STYLE: bool,
  S3_AUTO_CREATE_BUCKET: bool,
  SIGNED_URL_TTL_SECONDS: z.coerce.number().int().min(60).max(86400).default(3600),

  AI_PROVIDER: z.enum(['anthropic', 'none', 'fixture']).default('anthropic'),
  ANTHROPIC_API_KEY: z.string().optional(),
  AI_MODEL: z.string().default('claude-opus-5-5'),
  AI_TIMEOUT_MS: z.coerce.number().int().default(60_000),
  AI_DAILY_USER_LIMIT: z.coerce.number().int().default(200),

  PRODUCT_PROVIDERS: list,
  EBAY_CLIENT_ID: z.string().optional(),
  EBAY_CLIENT_SECRET: z.string().optional(),
  EBAY_MARKETPLACE_ID: z.string().default('EBAY_US'),
  EBAY_AFFILIATE_CAMPAIGN_ID: z.string().optional(),
  EBAY_ENVIRONMENT: z.enum(['production', 'sandbox']).default('production'),
  PRODUCT_FEED_URLS: list,
  PRODUCT_FEED_FORMAT: z.enum(['awin_csv', 'json']).default('awin_csv'),
  PRODUCT_FEED_ALLOWED_LINK_HOSTS: list,
  DISCOVERY_CRON: z.string().default('0 6 * * *'),
  DISCOVERY_MAX_QUERIES_PER_USER: z.coerce.number().int().min(1).max(20).default(6),

  WEATHER_ENABLED: bool.default(true),

  EMAIL_DRIVER: z.enum(['smtp', 'memory', 'none']).default('none'),
  SMTP_URL: z.string().optional(),
  EMAIL_FROM: z.string().default('Armoire <hello@armoire.app>'),

  SENTRY_DSN: z.string().optional(),
  TRUST_PROXY: bool,
})

export type Config = z.infer<typeof schema>

function load(): Config {
  const parsed = schema.safeParse(process.env)
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n')
    throw new Error(`Invalid configuration:\n${issues}`)
  }
  const c = parsed.data
  const problems: string[] = []
  const prod = c.APP_ENV === 'production'

  // Test-only adapters can never run outside the automated test environment.
  if (c.APP_ENV !== 'test') {
    if (c.STORAGE_DRIVER === 'memory') problems.push('STORAGE_DRIVER=memory is only allowed when APP_ENV=test')
    if (c.AI_PROVIDER === 'fixture') problems.push('AI_PROVIDER=fixture is only allowed when APP_ENV=test')
    if (c.PRODUCT_PROVIDERS.includes('fixture')) problems.push('PRODUCT_PROVIDERS=fixture is only allowed when APP_ENV=test')
    if (c.EMAIL_DRIVER === 'memory') problems.push('EMAIL_DRIVER=memory is only allowed when APP_ENV=test')
  }
  if (c.STORAGE_DRIVER === 's3' && (!c.S3_ACCESS_KEY_ID || !c.S3_SECRET_ACCESS_KEY)) {
    problems.push('S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY are required when STORAGE_DRIVER=s3')
  }
  if (c.EMAIL_DRIVER === 'smtp' && !c.SMTP_URL) problems.push('SMTP_URL is required when EMAIL_DRIVER=smtp')
  if (prod && !c.APP_URL.startsWith('https://')) problems.push('APP_URL must use https in production')
  if (problems.length) throw new Error(`Invalid configuration:\n${problems.map((p) => `  - ${p}`).join('\n')}`)
  return c
}

export const config = load()

export const integrations = {
  ai: () => config.AI_PROVIDER === 'fixture' || (config.AI_PROVIDER === 'anthropic' && !!config.ANTHROPIC_API_KEY),
  ebay: () => config.PRODUCT_PROVIDERS.includes('ebay') && !!config.EBAY_CLIENT_ID && !!config.EBAY_CLIENT_SECRET,
  feed: () => config.PRODUCT_PROVIDERS.includes('feed') && config.PRODUCT_FEED_URLS.length > 0,
  email: () => config.EMAIL_DRIVER !== 'none',
}
