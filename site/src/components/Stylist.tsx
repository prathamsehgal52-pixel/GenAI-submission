import { useEffect, useRef, useState } from 'react'
import { looks } from '../data/looks'
import { useMediaQuery } from '../hooks/useMediaQuery'
import { gsap, prefersReducedMotion, ScrollTrigger } from '../lib/motion'
import { GlyphText } from './GlyphText'
import { GhostRow } from './Marquee'
import { Photo } from './Photo'
import { Chevron, Eyebrow, Sparkle } from './ui'

const pad = (n: number) => String(n).padStart(2, '0')

function LookCard({ index }: { index: number }) {
  const layers = useRef<(HTMLDivElement | null)[]>([])
  const prev = useRef(index)
  const look = looks[index]

  useEffect(() => {
    const from = prev.current
    prev.current = index
    layers.current.forEach((el, i) => {
      if (!el) return
      el.style.zIndex = i === index ? '2' : i === from ? '1' : '0'
      el.style.opacity = i === index || i === from ? '1' : '0'
    })
    const el = layers.current[index]
    if (!el || from === index || prefersReducedMotion()) return
    const tween = gsap.fromTo(el, { '--blind': 0 }, { '--blind': 1, duration: 0.9, ease: 'power3.inOut' })
    return () => {
      tween.progress(1).kill()
    }
  }, [index])

  return (
    <div className="relative aspect-[4/5.3] w-full overflow-hidden rounded-[24px] bg-[linear-gradient(180deg,#3b3c3e_0%,#7b7e82_60%,#c9cbce_100%)] text-white lg:rounded-[28px]">
      {looks.map((l, i) => (
        <div
          key={l.id}
          ref={(el) => {
            layers.current[i] = el
          }}
          className="blinds absolute inset-0"
          style={{ opacity: i === index ? 1 : 0, zIndex: i === index ? 2 : 0 }}
          aria-hidden={i !== index}
        >
          <Photo src={l.image} alt={i === index ? `${l.title}: ${l.pieces.map((p) => p.name).join(', ')}` : ''} crop={l.crop} className="h-full w-full" />
        </div>
      ))}
      <div className="pointer-events-none absolute inset-0 z-[3] bg-[linear-gradient(180deg,rgba(0,0,0,0.45)_0%,rgba(0,0,0,0)_30%,rgba(0,0,0,0)_62%,rgba(0,0,0,0.55)_100%)]" />

      <div key={look.id} className="pointer-events-none absolute inset-0 z-[4] flex flex-col justify-between p-5 text-[11px] uppercase leading-[1.15] lg:p-6 lg:text-[12px]" style={{ animation: 'fade-up 500ms both' }}>
        <div className="flex justify-between gap-4">
          <p className="whitespace-pre-line">{look.metaTop[0]}</p>
          <p className="whitespace-pre-line text-right">{look.metaTop[1]}</p>
        </div>
        <div className="flex items-end justify-between gap-4">
          <p className="whitespace-pre-line">{look.metaBottom[0]}</p>
          <p className="flex gap-1.5 whitespace-pre-line text-right">
            <span className="mt-[3px] h-1.5 w-1.5 shrink-0 rounded-full bg-white" aria-hidden="true" />
            {look.metaBottom[1]}
          </p>
        </div>
      </div>
    </div>
  )
}

function OccasionTabs({ index, onSelect, vertical }: { index: number; onSelect: (i: number) => void; vertical?: boolean }) {
  return (
    <div
      role="group"
      aria-label="Choose an occasion"
      className={vertical ? 'flex flex-col' : 'no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4'}
    >
      {looks.map((l, i) => {
        const active = i === index
        return vertical ? (
          <button
            key={l.id}
            type="button"
            aria-pressed={active}
            onClick={() => onSelect(i)}
            className={`group flex items-baseline gap-4 border-t border-line py-3 text-left transition-colors last:border-b ${active ? 'text-ink' : 'text-mute hover:text-ink'}`}
          >
            <span className="font-alt text-[12px] font-light">{pad(i + 1)}</span>
            <span className="flex-1">
              <span className="block text-[15px] uppercase">{l.occasion}</span>
              <span className={`block overflow-hidden text-[12px] text-ink-soft transition-all duration-300 ${active ? 'max-h-6 opacity-100' : 'max-h-0 opacity-0'}`}>
                {l.title}
              </span>
            </span>
            <span className={`h-1.5 w-1.5 rounded-full bg-ink transition-transform ${active ? 'scale-100' : 'scale-0'}`} aria-hidden="true" />
          </button>
        ) : (
          <button
            key={l.id}
            type="button"
            aria-pressed={active}
            onClick={() => onSelect(i)}
            className={`h-10 shrink-0 rounded-full border px-4 text-[13px] transition-colors ${active ? 'border-ink bg-ink text-white' : 'border-line bg-white/50 hover:border-ink/40'}`}
          >
            {l.occasion}
          </button>
        )
      })}
    </div>
  )
}

function LookDetails({ index }: { index: number }) {
  const look = looks[index]
  return (
    <div key={look.id} style={{ animation: 'fade-up 450ms both' }}>
      <div className="flex items-baseline justify-between">
        <Eyebrow>Look {pad(index + 1)}/{pad(looks.length)}</Eyebrow>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-white/70 px-2.5 py-1 text-[11px] text-ink-soft">
          <Sparkle className="h-3 w-3" /> Styled from your closet
        </span>
      </div>
      <h3 className="display mt-3 text-[28px] lg:text-[32px]">{look.title}</h3>

      <p className="mt-6 text-[11px] uppercase text-mute">Pieces from your closet</p>
      <ul className="mt-2.5 grid grid-cols-4 gap-2">
        {look.pieces.map((p) => (
          <li key={p.name}>
            <Photo src={look.image} alt="" crop={p.crop} className="aspect-square rounded-[12px]" />
            <p className="mt-1.5 text-[11px] leading-tight text-ink-soft">{p.name}</p>
          </li>
        ))}
      </ul>

      <p className="mt-7 text-[11px] uppercase text-mute">Why it works</p>
      <ul className="mt-2 divide-y divide-line border-y border-line">
        {look.reasons.map((r) => (
          <li key={r.label} className="grid grid-cols-[92px_1fr] gap-3 py-3 text-[13px] leading-snug">
            <span className="uppercase">{r.label}</span>
            <span className="text-ink-soft">{r.body}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

/**
 * AI stylist showcase. On desktop the stage pins and scrolling steps through
 * looks; on smaller screens the occasion chips switch looks directly.
 */
export function Stylist() {
  const ref = useRef<HTMLElement>(null)
  const [index, setIndex] = useState(0)
  const desktop = useMediaQuery('(min-width: 1200px) and (min-height: 680px)')
  const pinned = desktop && !prefersReducedMotion()
  const triggerRef = useRef<ScrollTrigger | null>(null)

  useEffect(() => {
    const root = ref.current
    if (!root || !pinned) return
    const ctx = gsap.context(() => {
      triggerRef.current = ScrollTrigger.create({
        trigger: root,
        start: 'top top',
        end: 'bottom bottom',
        onUpdate: (self) => setIndex(Math.min(looks.length - 1, Math.floor(self.progress * looks.length))),
      })
      gsap
        .timeline({ scrollTrigger: { trigger: root, start: 'top bottom', end: 'bottom top', scrub: 0.5 } })
        .fromTo('[data-row="s1"]', { xPercent: -5 }, { xPercent: -40, ease: 'none' }, 0)
        .fromTo('[data-row="s2"]', { xPercent: -42 }, { xPercent: -8, ease: 'none' }, 0)
    }, root)
    return () => {
      ctx.revert()
      triggerRef.current = null
    }
  }, [pinned])

  const select = (i: number) => {
    const st = triggerRef.current
    if (!pinned || !st) {
      setIndex(i)
      return
    }
    const y = st.start + ((i + 0.5) / looks.length) * (st.end - st.start)
    window.scrollTo({ top: y, behavior: 'smooth' })
  }
  const step = (d: number) => select((index + d + looks.length) % looks.length)

  const controls = (
    <div className="mt-4 flex items-center justify-between">
      <div className="flex gap-1.5" aria-hidden="true">
        {looks.map((l, i) => (
          <span key={l.id} className={`h-1 rounded-full transition-all duration-300 ${i === index ? 'w-6 bg-ink' : 'w-2 bg-ink/20'}`} />
        ))}
      </div>
      <div className="flex gap-1.5">
        <button type="button" onClick={() => step(-1)} aria-label="Previous look" className="grid h-10 w-10 place-items-center rounded-full bg-white transition-colors hover:bg-ink hover:text-white">
          <Chevron dir="left" />
        </button>
        <button type="button" onClick={() => step(1)} aria-label="Next look" className="grid h-10 w-10 place-items-center rounded-full bg-ink text-white transition-colors hover:bg-[#2e2f31]">
          <Chevron />
        </button>
      </div>
    </div>
  )

  return (
    <section id="stylist" ref={ref} aria-labelledby="stylist-title" className={pinned ? 'relative h-[420svh]' : 'relative px-4 py-20 sm:px-8'}>
      <div className={pinned ? 'sticky top-0 h-[100svh] overflow-hidden' : ''}>
        {pinned && (
          <>
            <div className="absolute inset-x-0 top-[12%] z-[1]">
              <GhostRow data="s1" text="Outfits for every" className="text-[11.5vw] text-ghost" />
            </div>
            <div className="absolute inset-x-0 bottom-[6%] z-[1]">
              <GhostRow data="s2" text="moment you dress for" className="text-[11.5vw] text-ghost" />
            </div>
          </>
        )}

        <div className={pinned ? 'relative z-[2] mx-auto grid h-full max-w-[1440px] grid-cols-[1fr_min(400px,52vh)_1fr] items-center gap-12 px-[60px] xl:gap-16' : 'mx-auto max-w-[560px]'}>
          {/* Left: heading + occasions */}
          <div className={pinned ? 'self-center' : ''}>
            <Eyebrow className="mb-4 text-mute">AI personal stylist</Eyebrow>
            <GlyphText
              id="stylist-title"
              lines={['Outfits for', 'every moment.']}
              altWords={['every']}
              className="display text-[clamp(34px,3.6vw,54px)]"
            />
            <p className="mt-4 max-w-[340px] text-[14px] leading-[1.45] text-ink-soft">
              Pick an occasion. Your stylist puts together a complete look from pieces you already own and tells you why it works.
            </p>
            <div className="mt-7">
              <OccasionTabs index={index} onSelect={select} vertical={pinned} />
            </div>
          </div>

          {/* Center: look card */}
          <div className={pinned ? '' : 'mt-8'}>
            <LookCard index={index} />
            {controls}
          </div>

          {/* Right: details */}
          <div className={pinned ? 'self-center' : 'mt-10'}>
            <LookDetails index={index} />
          </div>
        </div>
      </div>
    </section>
  )
}
