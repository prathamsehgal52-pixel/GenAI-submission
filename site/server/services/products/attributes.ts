import type { Category, ColorFamily, Pattern } from '../../../shared/taxonomy'

/**
 * Rule-based attribute extraction from listing text. Transparent and cheap;
 * optionally refined by the AI classifier for listings it can't place.
 */

const CATEGORY_WORDS: [Category, RegExp][] = [
  ['dress', /\b(dress|gown|jumpsuit|playsuit|romper)\b/i],
  ['outerwear', /\b(coat|jacket|trench|parka|blazer|puffer|gilet|vest|anorak|overcoat|peacoat|bomber|cardigan coat)\b/i],
  ['shoes', /\b(shoes?|sneakers?|trainers?|boots?|loafers?|heels?|pumps?|sandals?|mules?|flats|oxfords?|derbys?|espadrilles?|slides)\b/i],
  ['bag', /\b(bag|tote|clutch|crossbody|backpack|satchel|handbag|purse|shopper)\b/i],
  ['bottom', /\b(jeans|trousers|pants|chinos|skirt|shorts|leggings|culottes|joggers)\b/i],
  ['accessory', /\b(belt|scarf|hat|cap|beanie|gloves|sunglasses|tie|necklace|earrings|bracelet|watch)\b/i],
  ['top', /\b(shirt|t-shirt|tee|blouse|sweater|jumper|knit|cardigan|hoodie|sweatshirt|polo|tank|camisole|top|turtleneck|roll-neck|bodysuit)\b/i],
]

const COLOR_WORDS: [ColorFamily, RegExp][] = [
  ['black', /\b(black|jet|onyx)\b/i],
  ['white', /\b(white|ivory|cream|off-white|ecru|optic)\b/i],
  ['grey', /\b(grey|gray|charcoal|heather|slate|silver grey)\b/i],
  ['beige', /\b(beige|camel|sand|stone|taupe|oatmeal|khaki|tan|nude|biscuit)\b/i],
  ['brown', /\b(brown|chocolate|cognac|espresso|mocha|rust|tobacco)\b/i],
  ['navy', /\b(navy|midnight)\b/i],
  ['denim', /\b(denim|indigo|chambray)\b/i],
  ['blue', /\b(blue|cobalt|sky|azure|teal|turquoise)\b/i],
  ['green', /\b(green|emerald|sage|mint|forest)\b/i],
  ['olive', /\b(olive|army|moss)\b/i],
  ['red', /\b(red|scarlet|crimson|cherry)\b/i],
  ['burgundy', /\b(burgundy|wine|maroon|oxblood|bordeaux)\b/i],
  ['pink', /\b(pink|blush|rose|fuchsia|magenta|coral)\b/i],
  ['purple', /\b(purple|lilac|lavender|violet|plum|mauve)\b/i],
  ['yellow', /\b(yellow|mustard|lemon|butter)\b/i],
  ['orange', /\b(orange|tangerine|terracotta|apricot)\b/i],
  ['metallic', /\b(gold|metallic|silver)\b/i],
  ['multi', /\b(multi|multicolou?r|rainbow)\b/i],
]

const PATTERN_WORDS: [Pattern, RegExp][] = [
  ['stripe', /\b(stripe[sd]?|striped|pinstripe|breton)\b/i],
  ['check', /\b(check(ed)?|plaid|tartan|gingham|houndstooth)\b/i],
  ['floral', /\b(floral|flower)\b/i],
  ['dot', /\b(polka|dot(s|ted)?|spot(s|ted)?)\b/i],
  ['animal', /\b(leopard|zebra|snake|animal print|croc)\b/i],
  ['graphic', /\b(graphic|logo|slogan)\b/i],
  ['print', /\b(print(ed)?|paisley|abstract)\b/i],
  ['texture', /\b(cable|ribbed|boucl[eé]|quilted|textured|waffle)\b/i],
]

const FORMAL = /\b(tailored|wool|silk|satin|blazer|suit|oxford|loafer|pump|heel|leather|cashmere|pleated)\b/i
const CASUAL = /\b(hoodie|sweatshirt|jogger|sneaker|trainer|graphic|denim|jersey|tee|t-shirt|shorts|slides)\b/i

const STYLE_WORDS: [string, RegExp][] = [
  ['minimal', /\b(minimal|clean|essential|basic|simple)\b/i],
  ['classic', /\b(classic|timeless|trench|oxford|loafer|cashmere|tailored)\b/i],
  ['relaxed', /\b(relaxed|oversized|loose|slouchy|wide leg|easy)\b/i],
  ['romantic', /\b(lace|ruffle|floral|puff sleeve|silk|satin|bow)\b/i],
  ['street', /\b(cargo|graphic|hoodie|sneaker|bomber|oversized)\b/i],
  ['tailored', /\b(tailored|blazer|pleated|trouser|suit)\b/i],
  ['bohemian', /\b(boho|crochet|fringe|peasant|embroidered|maxi)\b/i],
  ['sporty', /\b(track|athletic|jogger|running|sport|performance)\b/i],
  ['edgy', /\b(leather|biker|moto|studded|combat)\b/i],
  ['preppy', /\b(polo|cable|blazer|pleated skirt|loafer|argyle)\b/i],
]

export function extractAttributes(title: string, hints: { color?: string | null; category?: string | null } = {}) {
  const text = `${title} ${hints.category ?? ''}`
  const category = CATEGORY_WORDS.find(([, r]) => r.test(text))?.[0] ?? null
  const colorText = `${hints.color ?? ''} ${title}`
  const colors = COLOR_WORDS.filter(([, r]) => r.test(colorText)).map(([c]) => c).slice(0, 2)
  const pattern = PATTERN_WORDS.find(([, r]) => r.test(title))?.[0] ?? 'solid'
  const formal = FORMAL.test(title)
  const casual = CASUAL.test(title)
  const formality = formal && !casual ? 4 : casual && !formal ? 2 : 3
  const styles = STYLE_WORDS.filter(([, r]) => r.test(title)).map(([s]) => s)
  return { category, colors, pattern, formality, styles }
}
