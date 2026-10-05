import { useMemo, useState } from 'react'
import { categories, wardrobe } from '../data/wardrobe'
import type { WardrobeItem } from '../data/types'
import { GlyphText } from './GlyphText'
import { Photo } from './Photo'
import { AnchorLink, Chevron, Eyebrow, Heart, Pill } from './ui'

type Sort = 'most' | 'least' | 'pairs'
const sortLabels: Record<Sort, string> = { most: 'Most worn', least: 'Underworn', pairs: 'Most versatile' }

function ItemCard({ item, saved, onSave }: { item: WardrobeItem; saved: boolean; onSave: () => void }) {
  const [open, setOpen] = useState(false)
  const detailId = `detail-${item.id}`

  return (
    <article className="group relative aspect-[3/4.2] overflow-hidden rounded-[18px] bg-card lg:rounded-[22px]" style={{ animation: 'fade-up 500ms both' }}>
      <Photo src={item.image} alt={item.name} crop={item.crop} className="absolute inset-0 transition-transform duration-700 ease-out group-hover:scale-[1.04]" />
      <div className="absolute inset-0 bg-gradient-to-b from-black/25 via-transparent to-black/35" />

      <div className="absolute right-2.5 top-2.5 flex items-center gap-1 lg:right-3.5 lg:top-3.5">
        <span className="hidden h-7 items-center rounded-full bg-white/85 px-3 text-[11px] backdrop-blur sm:inline-flex">{item.category}</span>
        <button
          type="button"
          onClick={onSave}
          aria-pressed={saved}
          aria-label={saved ? `Remove ${item.name} from favourites` : `Add ${item.name} to favourites`}
          className={`grid h-7 w-7 place-items-center rounded-full backdrop-blur transition-colors ${saved ? 'bg-ink text-white' : 'bg-white/85 text-ink hover:bg-white'}`}
        >
          <Heart filled={saved} className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Styling details */}
      <div
        id={detailId}
        className={`absolute inset-x-2.5 bottom-[66px] rounded-[14px] bg-[#121212]/72 p-3.5 text-white backdrop-blur-md transition-all duration-300 lg:inset-x-3.5 lg:bottom-[74px] ${
          open ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-2 opacity-0'
        }`}
        inert={!open}
      >
        <dl className="grid grid-cols-2 gap-2 text-[11px]">
          <div>
            <dt className="uppercase text-white/50">Colour</dt>
            <dd className="mt-0.5">{item.colour}</dd>
          </div>
          <div>
            <dt className="uppercase text-white/50">Worn</dt>
            <dd className="mt-0.5">{item.wornCount}× this year</dd>
          </div>
        </dl>
        <p className="mt-2.5 text-[12px] leading-snug text-white/85">{item.tip}</p>
        <AnchorLink href="#stylist" className="mt-2.5 inline-flex items-center gap-1 text-[11px] uppercase text-white underline-offset-4 hover:underline" >
          Style it <Chevron className="h-3 w-3" />
        </AnchorLink>
      </div>

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={detailId}
        className="absolute inset-x-2.5 bottom-2.5 flex items-center justify-between gap-2 rounded-[14px] bg-[#ededee]/90 px-3 py-2.5 text-left text-ink backdrop-blur transition-colors hover:bg-white lg:inset-x-3.5 lg:bottom-3.5 lg:px-3.5 lg:py-3"
      >
        <span className="min-w-0">
          <span className="block truncate text-[12px] lg:text-[13px]">{item.name}</span>
          <span className="block text-[11px] text-ink-soft lg:text-[12px]">Pairs with {item.pairsWith} items</span>
        </span>
        <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full transition-transform ${open ? 'rotate-90 bg-ink text-white' : ''}`}>
          <Chevron />
        </span>
      </button>
    </article>
  )
}

/** Filterable wardrobe showcase (the reference's product grid). */
export function ClosetGrid() {
  const [cat, setCat] = useState<(typeof categories)[number]>('All')
  const [sort, setSort] = useState<Sort>('most')
  const [expanded, setExpanded] = useState(false)
  const [saved, setSaved] = useState<string[]>(['white-tee', 'black-bag'])

  const items = useMemo(() => {
    const list = wardrobe.filter((w) => cat === 'All' || w.category === cat)
    const by = {
      most: (a: WardrobeItem, b: WardrobeItem) => b.wornCount - a.wornCount,
      least: (a: WardrobeItem, b: WardrobeItem) => a.wornCount - b.wornCount,
      pairs: (a: WardrobeItem, b: WardrobeItem) => b.pairsWith - a.pairsWith,
    }[sort]
    return [...list].sort(by)
  }, [cat, sort])

  const visible = expanded ? items : items.slice(0, 8)
  const counts = useMemo(
    () => Object.fromEntries(categories.map((c) => [c, c === 'All' ? wardrobe.length : wardrobe.filter((w) => w.category === c).length])),
    [],
  )

  return (
    <section id="closet" aria-labelledby="closet-title" className="px-4 pb-24 pt-6 sm:px-8 lg:px-[60px] lg:pb-32">
      <div className="mx-auto max-w-[1440px]">
        <div className="grid items-start gap-4 lg:grid-cols-[1fr_auto_1fr]">
          <Eyebrow className="order-2 lg:order-none lg:pt-2">Your wardrobe, organised</Eyebrow>
          <GlyphText
            id="closet-title"
            lines={['Everything you own,', 'in one place.']}
            altWords={['own,', 'one']}
            className="display order-1 text-[clamp(34px,4.4vw,64px)] lg:order-none lg:text-center"
          />
          <div className="order-3 flex items-center gap-2 lg:order-none lg:justify-end lg:pt-1">
            <label htmlFor="closet-sort" className="text-[12px] uppercase text-ink-soft">
              Sort
            </label>
            <div className="relative">
              <select
                id="closet-sort"
                value={sort}
                onChange={(e) => setSort(e.target.value as Sort)}
                className="h-9 appearance-none rounded-full border border-line bg-white/60 pl-3.5 pr-8 text-[12px] uppercase outline-none transition-colors hover:border-ink/40 focus-visible:border-ink"
              >
                {(Object.keys(sortLabels) as Sort[]).map((s) => (
                  <option key={s} value={s}>
                    {sortLabels[s]}
                  </option>
                ))}
              </select>
              <Chevron className="pointer-events-none absolute right-3 top-1/2 h-3 w-3 -translate-y-1/2 rotate-90" />
            </div>
          </div>
        </div>

        <div role="group" aria-label="Filter by category" className="no-scrollbar -mx-4 mt-8 flex gap-2 overflow-x-auto px-4 lg:mx-0 lg:mt-12 lg:justify-center lg:px-0">
          {categories.map((c) => (
            <button
              key={c}
              type="button"
              aria-pressed={cat === c}
              onClick={() => {
                setCat(c)
                setExpanded(false)
              }}
              className={`flex h-10 shrink-0 items-center gap-2 rounded-full border px-4 text-[13px] transition-colors ${
                cat === c ? 'border-ink bg-ink text-white' : 'border-line bg-white/50 text-ink hover:border-ink/40 hover:bg-white'
              }`}
            >
              {c}
              <span className={`text-[11px] ${cat === c ? 'text-white/60' : 'text-mute'}`}>{counts[c]}</span>
            </button>
          ))}
        </div>

        <p className="sr-only" aria-live="polite">
          Showing {visible.length} of {items.length} {cat === 'All' ? 'items' : cat.toLowerCase()}
        </p>

        <div key={`${cat}-${sort}`} className="mt-8 grid grid-cols-2 gap-2.5 sm:gap-3.5 md:grid-cols-3 lg:mt-10 lg:grid-cols-4 lg:gap-4">
          {visible.map((item) => (
            <ItemCard
              key={item.id}
              item={item}
              saved={saved.includes(item.id)}
              onSave={() => setSaved((s) => (s.includes(item.id) ? s.filter((x) => x !== item.id) : [...s, item.id]))}
            />
          ))}
        </div>

        <div className="mt-8 flex flex-col items-center gap-3 lg:mt-10">
          {items.length > 8 && (
            <Pill onClick={() => setExpanded((v) => !v)} aria-expanded={expanded} className="!h-9 !px-5 !text-[11px]">
              {expanded ? 'Show fewer' : `See all ${items.length} items`}
            </Pill>
          )}
        </div>
      </div>
    </section>
  )
}
