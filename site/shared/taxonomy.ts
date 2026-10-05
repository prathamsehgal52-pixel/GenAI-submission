/**
 * Garment taxonomy shared by the API, the AI prompts and the UI. Keeping one
 * vocabulary means AI output, user edits, filters and the styling rules all
 * speak the same language.
 */

export const CATEGORIES = ['top', 'bottom', 'dress', 'outerwear', 'shoes', 'bag', 'accessory'] as const
export type Category = (typeof CATEGORIES)[number]

export const CATEGORY_LABELS: Record<Category, string> = {
  top: 'Tops',
  bottom: 'Bottoms',
  dress: 'Dresses',
  outerwear: 'Outerwear',
  shoes: 'Shoes',
  bag: 'Bags',
  accessory: 'Accessories',
}

export const CATEGORY_SINGULAR: Record<Category, string> = {
  top: 'Top',
  bottom: 'Bottom',
  dress: 'Dress',
  outerwear: 'Outerwear',
  shoes: 'Shoes',
  bag: 'Bag',
  accessory: 'Accessory',
}

export const COLOR_FAMILIES = [
  'black',
  'white',
  'grey',
  'beige',
  'brown',
  'navy',
  'denim',
  'blue',
  'green',
  'olive',
  'red',
  'burgundy',
  'pink',
  'purple',
  'yellow',
  'orange',
  'metallic',
  'multi',
] as const
export type ColorFamily = (typeof COLOR_FAMILIES)[number]

/** Swatches used in filters and preference pickers. */
export const COLOR_SWATCH: Record<ColorFamily, string> = {
  black: '#151515',
  white: '#f6f5f1',
  grey: '#9a9da1',
  beige: '#d9c7a7',
  brown: '#7a5236',
  navy: '#1f2a44',
  denim: '#5a7ca3',
  blue: '#3f76c9',
  green: '#3e7d55',
  olive: '#6f6b3b',
  red: '#c0392b',
  burgundy: '#6e1f2f',
  pink: '#e8a9b8',
  purple: '#7a5a9e',
  yellow: '#e9c94b',
  orange: '#e07b33',
  metallic: '#c9b37e',
  multi: 'conic-gradient(#e07b33,#e9c94b,#3e7d55,#3f76c9,#7a5a9e,#e07b33)',
}

/** Neutrals pair with anything. Denim behaves as a neutral in styling. */
export const NEUTRALS: ReadonlySet<ColorFamily> = new Set(['black', 'white', 'grey', 'beige', 'brown', 'navy', 'denim', 'metallic'])

/** Approximate hue angle per chromatic family, for harmony checks. */
export const FAMILY_HUE: Partial<Record<ColorFamily, number>> = {
  red: 0,
  burgundy: 345,
  pink: 340,
  orange: 28,
  yellow: 52,
  olive: 65,
  green: 130,
  blue: 215,
  purple: 275,
}

export const PATTERNS = ['solid', 'stripe', 'check', 'floral', 'print', 'graphic', 'dot', 'animal', 'texture'] as const
export type Pattern = (typeof PATTERNS)[number]

export const OCCASIONS = ['everyday', 'work', 'weekend', 'evening', 'date', 'formal', 'travel', 'active', 'lounge'] as const
export type Occasion = (typeof OCCASIONS)[number]

export const OCCASION_LABELS: Record<Occasion, string> = {
  everyday: 'Everyday',
  work: 'Work',
  weekend: 'Weekend',
  evening: 'Evening out',
  date: 'Date',
  formal: 'Formal event',
  travel: 'Travel',
  active: 'Active',
  lounge: 'At home',
}

/** Target formality band (1 = very casual, 5 = black tie) for each occasion. */
export const OCCASION_FORMALITY: Record<Occasion, [number, number]> = {
  everyday: [1, 3],
  work: [3, 4],
  weekend: [1, 2],
  evening: [3, 5],
  date: [2, 4],
  formal: [4, 5],
  travel: [1, 3],
  active: [1, 1],
  lounge: [1, 1],
}

export const SEASONS = ['spring', 'summer', 'autumn', 'winter'] as const
export type Season = (typeof SEASONS)[number]

export const STYLES = ['minimal', 'classic', 'relaxed', 'romantic', 'street', 'tailored', 'bohemian', 'sporty', 'edgy', 'preppy'] as const
export type Style = (typeof STYLES)[number]

export const FITS = ['fitted', 'regular', 'relaxed', 'oversized'] as const
export type Fit = (typeof FITS)[number]

export const DEPARTMENTS = ['womens', 'mens', 'any'] as const
export type Department = (typeof DEPARTMENTS)[number]

export const DEPARTMENT_LABELS: Record<Department, string> = {
  womens: 'Womenswear',
  mens: 'Menswear',
  any: 'Both',
}

export const titleCase = (s: string) => s.replace(/(^|[\s-])(\w)/g, (_, a, b) => a + b.toUpperCase())
