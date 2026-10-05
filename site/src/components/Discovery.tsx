import { useEffect, useRef, useState } from 'react'
import { discovery } from '../data/discovery'
import type { DiscoveryItem, WardrobeItem } from '../data/types'
import { wardrobeById } from '../data/wardrobe'
import { gsap, prefersReducedMotion } from '../lib/motion'
import { GlyphText } from './GlyphText'
import { Photo } from './Photo'
import { Eyebrow, Heart, Pill, Sparkle } from './ui'
import { useStartJourney } from './useStartJourney'

function OwnedTile({ item, side, i }: { item: WardrobeItem; side: 'l' | 'r'; i: number }) {
  return (
    <li className={`flex items-center ${side === 'r' ? 'flex-row-reverse' : ''}`} style={{ animation: `fade-up 500ms ${i * 70}ms both` }}>
      <figure className="w-[112px] shrink-0 xl:w-[128px]">
        <Photo src={item.image} alt={item.name} crop={item.crop} className="aspect-[4/5] rounded-[14px]" />
        <figcaption className={`mt-1.5 text-[11px] leading-tight text-ink-soft ${side === 'r' ? 'text-right' : ''}`}>{item.name}</figcaption>
      </figure>
      <span aria-hidden="true" className={`relative mb-5 h-px flex-1 border-t border-dashed border-ink/25 ${side === 'l' ? 'ml-3' : 'mr-3'}`}>
        <span className={`absolute -top-[3.5px] h-1.5 w-1.5 rounded-full bg-ink ${side === 'l' ? 'right-0' : 'left-0'}`} />
      </span>
    </li>
  )
}

function formulas(item: DiscoveryItem) {
  const p = item.pairs.map((id) => wardrobeById[id]).filter(Boolean)
  return [
    [p[0], p[1]],
    [p[2], p[3] ?? p[0]],
    [p[4] ?? p[1], p[2]],
  ]
}

/** New releases ranked by how well they connect to the wardrobe. */
export function Discovery() {
  const [active, setActive] = useState(0)
  const [wish, setWish] = useState<string[]>([])
  const [showWays, setShowWays] = useState(false)
  const start = useStartJourney()
  const stage = useRef<HTMLDivElement>(null)
  const item = discovery[active]
  const owned = item.pairs.map((id) => wardrobeById[id]).filter(Boolean)
  const left = owned.slice(0, Math.ceil(owned.length / 2))
  const right = owned.slice(Math.ceil(owned.length / 2))
  const wished = wish.includes(item.id)

  useEffect(() => {
    const el = stage.current
    if (!el || prefersReducedMotion()) return
    const tween = gsap.fromTo(el, { '--blind': 0 }, { '--blind': 1, duration: 0.9, ease: 'power3.inOut' })
    return () => {
      tween.progress(1).kill()
    }
  }, [active])

  const choose = (i: number) => {
    setActive(i)
    setShowWays(false)
  }

  return (
    <section id="discover" aria-labelledby="discover-title" className="px-4 py-24 sm:px-8 lg:px-[60px] lg:py-32">
      <div className="mx-auto max-w-[1440px]">
        <div className="grid items-start gap-4 lg:grid-cols-[1fr_auto_1fr]">
          <Eyebrow className="order-2 lg:order-none lg:pt-2">Personalised discovery</Eyebrow>
          <GlyphText
            id="discover-title"
            lines={['Find the pieces', 'that complete you.']}
            altWords={['pieces', 'complete']}
            className="display order-1 text-[clamp(34px,4.4vw,64px)] lg:order-none lg:text-center"
          />
          <p className="order-3 max-w-[260px] text-[13px] leading-[1.45] text-ink-soft lg:order-none lg:justify-self-end lg:pt-1 lg:text-right">
            New releases ranked by how many outfits they'd add to your closet, not by what's trending.
          </p>
        </div>

        {/* Stage */}
        <div className="mx-auto mt-12 grid max-w-[1240px] grid-cols-1 items-center gap-6 lg:mt-16 lg:grid-cols-[1fr_minmax(0,380px)_1fr] lg:gap-0">
          <ul key={`l-${item.id}`} className="hidden flex-col gap-5 lg:flex" aria-label="Pairs with, from your wardrobe">
            {left.map((w, i) => (
              <OwnedTile key={w.id} item={w} side="l" i={i} />
            ))}
          </ul>

          <div className="relative mx-auto w-full max-w-[380px]">
            <div className="relative aspect-[3/4] overflow-hidden rounded-[24px] bg-[linear-gradient(180deg,#2c2c2e_0%,#8a8d91_100%)] lg:rounded-[28px]">
              <div ref={stage} className="blinds absolute inset-0">
                <Photo key={item.id} src={item.image} alt={item.name} crop={item.crop} className="h-full w-full" />
              </div>
              <div className="absolute inset-0 bg-gradient-to-b from-black/35 via-transparent to-black/60" />
              <div className="absolute inset-x-4 top-4 flex items-center justify-between">
                <span className="rounded-full bg-white/85 px-3 py-1 text-[11px] uppercase backdrop-blur">{item.tag}</span>
                <button
                  type="button"
                  onClick={() => setWish((w) => (wished ? w.filter((x) => x !== item.id) : [...w, item.id]))}
                  aria-pressed={wished}
                  aria-label={wished ? 'Remove from wishlist' : 'Save to wishlist'}
                  className={`grid h-8 w-8 place-items-center rounded-full backdrop-blur transition-colors ${wished ? 'bg-ink text-white' : 'bg-white/85 text-ink hover:bg-white'}`}
                >
                  <Heart filled={wished} />
                </button>
              </div>
              <div key={`m-${item.id}`} className="absolute inset-x-5 bottom-5 text-white" style={{ animation: 'fade-up 500ms 200ms both' }}>
                <p className="flex items-center gap-1.5 text-[12px] text-white/80">
                  <Sparkle /> {item.headline}
                </p>
                <p className="display mt-2 text-[26px] leading-[0.95]">{item.name}</p>
              </div>
            </div>
          </div>

          <ul key={`r-${item.id}`} className="hidden flex-col gap-5 lg:flex" aria-label="More pairings from your wardrobe">
            {right.map((w, i) => (
              <OwnedTile key={w.id} item={w} side="r" i={i} />
            ))}
          </ul>

          {/* Mobile pairings */}
          <div className="min-w-0 lg:hidden">
            <p className="text-[11px] uppercase text-mute">Pairs with, from your wardrobe</p>
            <ul key={`m-${item.id}`} className="no-scrollbar -mx-4 mt-3 flex gap-2.5 overflow-x-auto px-4">
              {owned.map((w) => (
                <li key={w.id} className="w-[96px] shrink-0">
                  <Photo src={w.image} alt={w.name} crop={w.crop} className="aspect-[4/5] rounded-[12px]" />
                  <p className="mt-1.5 text-[11px] leading-tight text-ink-soft">{w.name}</p>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Product info */}
        <div key={`i-${item.id}`} className="mx-auto mt-8 max-w-[620px] text-center lg:mt-10" style={{ animation: 'fade-up 500ms both' }}>
          <p className="text-[12px] uppercase text-ink-soft">
            {item.kind} · {item.tag}
          </p>
          <p className="mx-auto mt-3 max-w-[52ch] text-[15px] leading-[1.5] text-ink">{item.why}</p>
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            <Pill onClick={() => setShowWays((v) => !v)} aria-expanded={showWays} aria-controls="ways">
              {showWays ? 'Hide outfits' : '3 ways to wear it'}
            </Pill>
            <Pill variant="light" onClick={start}>
              <Heart className="h-3.5 w-3.5" />
              Find pieces for my wardrobe
            </Pill>
          </div>
          {showWays && (
            <ol id="ways" className="mt-6 grid gap-2.5 text-left sm:grid-cols-3" style={{ animation: 'fade-up 400ms both' }}>
              {formulas(item).map((pair, i) => (
                <li key={i} className="rounded-[18px] bg-white/70 p-3">
                  <p className="font-alt text-[11px] font-light text-mute">{String(i + 1).padStart(2, '0')}</p>
                  <div className="mt-2 flex gap-1.5">
                    <Photo src={item.image} alt="" crop={item.crop} className="aspect-square w-1/3 rounded-[10px]" />
                    {pair.map((w) => (
                      <Photo key={w.id} src={w.image} alt="" crop={w.crop} className="aspect-square w-1/3 rounded-[10px]" />
                    ))}
                  </div>
                  <p className="mt-2 text-[12px] leading-snug text-ink-soft">
                    With your {pair.map((w) => w.name.toLowerCase()).join(' and ')}
                  </p>
                </li>
              ))}
            </ol>
          )}
        </div>

        {/* Selector */}
        <div className="mt-14 lg:mt-20">
          <div className="mb-4 flex items-baseline justify-between">
            <p className="text-[12px] uppercase text-ink-soft">New this week, picked for your closet</p>
            <p className="text-[11px] text-mute">{discovery.length} picks</p>
          </div>
          <ul className="no-scrollbar -mx-4 flex gap-3 overflow-x-auto px-4 pb-1 sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 lg:grid-cols-4 lg:gap-4">
            {discovery.map((d, i) => {
              const on = i === active
              return (
                <li key={d.id} className="w-[72vw] shrink-0 sm:w-auto">
                  <button
                    type="button"
                    onClick={() => choose(i)}
                    aria-pressed={on}
                    className={`group relative block aspect-[4/3] w-full overflow-hidden rounded-[20px] text-left text-white outline-offset-4 transition-shadow ${on ? 'ring-2 ring-ink ring-offset-4 ring-offset-page' : ''}`}
                  >
                    <Photo src={d.image} alt="" crop={d.crop} className="absolute inset-0 transition-transform duration-700 group-hover:scale-105" />
                    <span className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent transition-colors duration-300 group-hover:bg-black/45 group-focus-visible:bg-black/45" />
                    <span className="absolute inset-x-4 bottom-3.5 transition-transform duration-300 group-hover:-translate-y-9 group-focus-visible:-translate-y-9">
                      <span className="block text-[13px]">{d.name}</span>
                      <span className="block text-[11px] text-white/70">
                        {d.kind}
                      </span>
                    </span>
                    <span className="absolute inset-x-4 bottom-3.5 flex translate-y-3 items-center gap-1.5 text-[11px] text-white opacity-0 transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100 group-focus-visible:translate-y-0 group-focus-visible:opacity-100">
                      <Sparkle className="h-3 w-3" /> {d.headline}
                    </span>
                    {on && <span className="absolute right-3 top-3 rounded-full bg-white px-2.5 py-1 text-[10px] uppercase text-ink">Viewing</span>}
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      </div>
    </section>
  )
}
