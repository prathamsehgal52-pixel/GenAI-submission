import { useEffect, useRef } from 'react'
import { gsap, prefersReducedMotion } from '../lib/motion'
import { BlindsReveal } from './BlindsReveal'
import { Photo } from './Photo'

const word = 'WARDROBE'

/**
 * Giant thin wordmark that splits apart as you scroll, with three photos
 * layered over it (the reference's "WORKOUT" composition).
 */
export function WardrobeSplit() {
  const ref = useRef<HTMLElement>(null)

  useEffect(() => {
    const root = ref.current
    if (!root || prefersReducedMotion()) return
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({
        scrollTrigger: { trigger: root, start: 'top 85%', end: 'bottom 30%', scrub: 0.6 },
      })
      tl.fromTo('[data-half="l"]', { xPercent: 18 }, { xPercent: -14, ease: 'none' }, 0)
        .fromTo('[data-half="r"]', { xPercent: -18 }, { xPercent: 14, ease: 'none' }, 0)
        .fromTo('[data-par="up"]', { yPercent: 18 }, { yPercent: -18, ease: 'none' }, 0)
        .fromTo('[data-par="down"]', { yPercent: -10 }, { yPercent: 14, ease: 'none' }, 0)
        .fromTo('[data-par="center"]', { scale: 0.9 }, { scale: 1, ease: 'none' }, 0)
    }, root)
    return () => ctx.revert()
  }, [])

  const half = Math.ceil(word.length / 2)

  return (
    <section id="wardrobe" ref={ref} aria-labelledby="wardrobe-title" className="relative overflow-hidden px-4 py-20 sm:px-8 lg:min-h-[100svh] lg:px-[86px] lg:py-[14vh]">
      <h2 id="wardrobe-title" className="sr-only">
        Your digital wardrobe
      </h2>

      <div className="relative mx-auto grid max-w-[1440px] grid-cols-12 items-center gap-y-8">
        {/* Giant ghost word */}
        <div aria-hidden="true" className="ghost-type pointer-events-none absolute inset-x-0 top-1/2 z-0 flex -translate-y-1/2 justify-center whitespace-nowrap text-[18.5vw] text-ghost lg:text-[17vw]">
          <span data-half="l" className="inline-block">
            {word.slice(0, half)}
          </span>
          <span data-half="r" className="inline-block">
            {word.slice(half)}
          </span>
        </div>

        {/* Left small photo + copy */}
        <div className="relative z-10 col-span-4 flex flex-col justify-between self-stretch lg:col-span-3">
          <div data-par="up" className="w-full max-w-[210px]">
            <Photo src="/images/knit-sweater.jpg" alt="Chevron knit sweater, shot on location" crop={{ position: '58% 30%' }} className="aspect-[3/4] rounded-[18px] lg:rounded-[22px]" />
          </div>
          <p className="mt-10 hidden max-w-[230px] text-[14px] leading-[1.4] text-ink-soft lg:block">
            Photograph each piece once. Armoire tags it by colour, category, fabric and season.
          </p>
        </div>

        {/* Center large photo */}
        <div className="relative z-10 col-span-4 lg:col-span-4 lg:col-start-5">
          <div data-par="center" className="origin-center">
            <BlindsReveal className="overflow-hidden rounded-[20px] lg:rounded-[28px]">
              <Photo
                src="/images/leather-man.jpg"
                alt="Man in a tan leather jacket and sunglasses"
                crop={{ position: '50% 25%' }}
                className="aspect-[3/4.1] bg-gradient-to-b from-[#3d3d3f] to-[#a9abae]"
              />
            </BlindsReveal>
          </div>
        </div>

        {/* Right copy + small photo */}
        <div className="relative z-10 col-span-4 flex flex-col items-end justify-between self-stretch lg:col-span-3 lg:col-start-10">
          <p className="hidden max-w-[240px] text-[14px] leading-[1.4] text-ink-soft lg:block">
            No more forgotten favourites. See your whole closet in one place, wherever you are.
          </p>
          <div data-par="down" className="mt-auto w-full max-w-[210px]">
            <Photo src="/images/camel-bomber.jpg" alt="Cognac satin bomber on a hanger" crop={{ position: '45% 50%' }} className="aspect-[3/4] rounded-[18px] lg:rounded-[22px]" />
          </div>
        </div>
      </div>

      <div className="relative z-10 mt-10 grid gap-4 text-[14px] leading-[1.4] text-ink-soft sm:grid-cols-2 lg:hidden">
        <p>Photograph each piece once. Armoire tags it by colour, category, fabric and season.</p>
        <p>No more forgotten favourites. See your whole closet in one place, wherever you are.</p>
      </div>
    </section>
  )
}
