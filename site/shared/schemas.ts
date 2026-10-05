import { z } from 'zod'
import { CATEGORIES, COLOR_FAMILIES, DEPARTMENTS, FITS, OCCASIONS, PATTERNS, SEASONS, STYLES } from './taxonomy'

/** Request schemas shared by the API (validation) and the web app (types). */

export const CONSENT_VERSION = '2026-10'

const tagList = (max: number, len = 40) => z.array(z.string().trim().min(1).max(len)).max(max)

export const profileUpdateSchema = z
  .object({
    department: z.enum(DEPARTMENTS),
    preferredStyles: z.array(z.enum(STYLES)).max(10),
    favoriteColors: z.array(z.enum(COLOR_FAMILIES)).max(18),
    avoidColors: z.array(z.enum(COLOR_FAMILIES)).max(18),
    occasions: z.array(z.enum(OCCASIONS)).max(9),
    fits: z.array(z.enum(FITS)).max(4),
    budgetMin: z.number().int().min(0).max(100000).nullable(),
    budgetMax: z.number().int().min(0).max(100000).nullable(),
    currency: z.enum(['USD', 'GBP', 'EUR', 'CAD', 'AUD']),
    preferredBrands: tagList(20, 60),
    locationName: z.string().trim().max(120).nullable(),
    latitude: z.number().min(-90).max(90).nullable(),
    longitude: z.number().min(-180).max(180).nullable(),
    temperatureUnit: z.enum(['C', 'F']),
    notifyDiscoveriesEmail: z.boolean(),
  })
  .partial()
  .refine((p) => p.budgetMin == null || p.budgetMax == null || p.budgetMin <= p.budgetMax, { message: 'Minimum budget must be below maximum', path: ['budgetMin'] })

export type ProfileUpdate = z.infer<typeof profileUpdateSchema>

export const onboardingSchema = z.object({
  imageConsent: z.literal(true, { message: 'Consent is required to upload photos' }),
  profile: profileUpdateSchema,
})

export const itemUpdateSchema = z
  .object({
    name: z.string().trim().max(80),
    category: z.enum(CATEGORIES),
    subcategory: z.string().trim().max(60).nullable(),
    colors: z.array(z.enum(COLOR_FAMILIES)).max(3),
    pattern: z.enum(PATTERNS),
    materialEstimate: z.string().trim().max(80).nullable(),
    styles: z.array(z.enum(STYLES)).max(10),
    occasions: z.array(z.enum(OCCASIONS)).max(9),
    seasons: z.array(z.enum(SEASONS)).max(4),
    formality: z.number().int().min(1).max(5),
    warmth: z.number().int().min(1).max(5),
    brand: z.string().trim().max(60).nullable(),
    notes: z.string().trim().max(1000).nullable(),
    tags: tagList(20, 30),
    favorite: z.boolean(),
    excludeFromStyling: z.boolean(),
    status: z.enum(['active', 'archived']),
  })
  .partial()

export type ItemUpdate = z.infer<typeof itemUpdateSchema>

export const styleRequestSchema = z.object({
  occasion: z.enum(OCCASIONS),
  style: z.enum(STYLES).optional(),
  formality: z.number().int().min(1).max(5).optional(),
  date: z.iso.date().optional(),
  useWeather: z.boolean().default(true),
  preferredColors: z.array(z.enum(COLOR_FAMILIES)).max(6).default([]),
  includeItemIds: z.array(z.uuid()).max(3).default([]),
  avoidItemIds: z.array(z.uuid()).max(50).default([]),
  notes: z.string().trim().max(240).optional(),
  count: z.number().int().min(1).max(3).default(3),
  /** Outfit ids already shown, so regenerate produces something different. */
  excludeOutfitIds: z.array(z.uuid()).max(30).default([]),
})
export type StyleRequest = z.infer<typeof styleRequestSchema>

export const planCreateSchema = z.object({
  outfitId: z.uuid(),
  date: z.iso.date(),
  occasion: z.enum(OCCASIONS).nullable().optional(),
  note: z.string().trim().max(200).nullable().optional(),
})
