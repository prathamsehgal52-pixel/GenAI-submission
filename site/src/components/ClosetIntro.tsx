import { useEffect, useRef } from 'react'
import { gsap, prefersReducedMotion } from '../lib/motion'
import { GlyphText } from './GlyphText'
import { Logo } from './Hero'
import { GhostRow } from './Marquee'
import { Photo } from './Photo'

/**
 * Pinned interlude: a poster card rises through two rows of oversized type
 * that drift in opposite directions (the reference's "LEVEL UP" card).
 */
export function ClosetIntro() {
  const ref = useRef<HTMLElement>(null)

  useEffect(() => {
    const root = ref.current
    if (!root || prefersReducedMotion()) return
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({
        scrollTrigger: { trigger: root, start: 'top bottom', end: 'bottom top', scrub: 0.5 },
      })
      tl.fromTo('[data-row="a"]', { xPercent: -8 }, { xPercent: -38, ease: 'none' }, 0)
        .fromTo('[data-row="b"]', { xPercent: -40 }, { xPercent: -10, ease: 'none' }, 0)
        .fromTo('[data-card]', { y: '22vh' }, { y: '-26vh', ease: 'none' }, 0)
        .fromTo('[data-fan="l"]', { rotate: -2, x: 20 }, { rotate: -10, x: -10, ease: 'none' }, 0)
        .fromTo('[data-fan="r"]', { rotate: 2, x: -20 }, { rotate: 10, x: 10, ease: 'none' }, 0)
    }, root)
    return () => ctx.revert()
  }, [])

  return (
    <section ref={ref} aria-labelledby="closet-intro-title" className="relative h-[170svh] lg:h-[200svh]">
      <div className="sticky top-0 flex h-[100svh] items-center justify-center overflow-hidden">
        <div className="absolute inset-x-0 top-[17%] z-20 lg:top-[19%]">
          <GhostRow data="a" text="Everything you own" className="text-[22vw] text-[rgba(196,200,205,0.62)] lg:text-[11.5vw]" />
        </div>
        <div className="absolute inset-x-0 bottom-[16%] z-20 lg:bottom-[13%]">
          <GhostRow data="b" text="In one place" className="text-[22vw] text-[rgba(196,200,205,0.62)] lg:text-[11.5vw]" />
        </div>

        <div
          data-card
          className="relative z-10 flex aspect-[500/680] w-[min(78vw,360px)] flex-col items-center overflow-hidden rounded-[24px] bg-[linear-gradient(180deg,#1f1f21_0%,#55565a_62%,#9fa2a6_100%)] px-6 pt-6 text-center text-white sm:w-[min(60vw,440px)] lg:w-[min(35vw,500px)] lg:rounded-[28px] lg:pt-8"
        >
          <div aria-hidden="true" className="absolute left-1/2 top-[14%] aspect-square w-[92%] -translate-x-1/2 rounded-full border-[28px] border-white/[0.05]" />
          <Logo className="relative !text-[18px] text-white/85 lg:!text-[22px]" />
          <p className="relative mt-4 text-[11px] uppercase text-white/70 lg:mt-6">Your closet</p>
          <GlyphText
            id="closet-intro-title"
            lines={['Every piece,', 'finally in view']}
            altWords={['finally']}
            className="display relative mt-1.5 text-[clamp(24px,3vw,42px)]"
          />

          <div className="absolute inset-x-0 bottom-0 h-[62%]">
            <div data-fan="l" className="absolute bottom-[-6%] left-[4%] w-[44%] origin-bottom">
              <Photo src="/images/denim-jacket.jpg" alt="Denim trucker jacket on a hanger" crop={{ position: '50% 45%' }} className="aspect-[3/4] rounded-[16px] shadow-2xl" />
            </div>
            <div data-fan="r" className="absolute bottom-[-6%] right-[4%] w-[44%] origin-bottom">
              <Photo src="/images/sweatshirt.jpg" alt="Chalk crew sweatshirt" crop={{ position: '50% 45%' }} className="aspect-[3/4] rounded-[16px] shadow-2xl" />
            </div>
            <div className="absolute bottom-[-4%] left-1/2 w-[50%] -translate-x-1/2">
              <Photo src="/images/rack-whites.jpg" alt="Rail of white and brown shirts" crop={{ position: '40% 50%' }} className="aspect-[3/4] rounded-[16px] shadow-2xl" />
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
