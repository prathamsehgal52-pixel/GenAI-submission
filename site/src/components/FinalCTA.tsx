import { brand, navLeft, navRight } from '../data/site'
import { scrollToHash } from '../lib/motion'
import { BlindsReveal } from './BlindsReveal'
import { GlyphText } from './GlyphText'
import { Logo } from './Hero'
import { Link } from 'react-router'
import { useStartJourney } from './useStartJourney'
import { Photo } from './Photo'
import { AnchorLink, Pill } from './ui'

export function FinalCTA() {
  const openOnboarding = useStartJourney()
  return (
    <section aria-labelledby="cta-title" className="p-2 sm:p-3 lg:p-[14px]">
      <div className="relative isolate overflow-hidden rounded-[22px] bg-[linear-gradient(180deg,#bfd2d8_0%,#d3e0e3_50%,#eceeef_100%)] px-4 pt-16 sm:rounded-[28px] sm:px-8 lg:pt-24">
        <div className="relative z-10 text-center">
          <p className="text-[12px] uppercase text-ink-soft">Ready when you are</p>
          <GlyphText
            id="cta-title"
            lines={['Start with', 'what you own.']}
            altWords={['what']}
            className="display mt-4 text-[clamp(44px,7.2vw,112px)]"
          />
          <p className="mx-auto mt-5 max-w-[42ch] text-[15px] leading-[1.45] text-ink-soft">
            Upload your first pieces, get dressed with less effort, and buy only what earns a place in your closet.
          </p>
          <div className="mt-7 flex flex-wrap justify-center gap-2">
            <Pill onClick={openOnboarding}>Build my wardrobe</Pill>
            <Pill variant="light" onClick={() => scrollToHash('#closet')}>
              Explore the closet
            </Pill>
          </div>
        </div>

        <div className="relative mx-auto mt-14 grid max-w-[980px] grid-cols-3 items-end gap-3 lg:mt-20 lg:gap-5">
          <BlindsReveal className="translate-y-8">
            <Photo src="/images/look-city.jpg" alt="Blush coat and printed scarf" crop={{ position: '50% 25%' }} className="aspect-[3/4] rounded-t-[18px] lg:rounded-t-[24px]" />
          </BlindsReveal>
          <BlindsReveal delay={0.12}>
            <Photo src="/images/hero.jpg" alt="White tee and straight-leg jeans" crop={{ position: '40% 10%' }} className="aspect-[3/4.4] rounded-t-[18px] lg:rounded-t-[24px]" />
          </BlindsReveal>
          <BlindsReveal delay={0.24} className="translate-y-8">
            <Photo src="/images/look-denim.jpg" alt="Denim jacket over a grey hoodie" crop={{ position: '50% 30%' }} className="aspect-[3/4] rounded-t-[18px] lg:rounded-t-[24px]" />
          </BlindsReveal>
        </div>
      </div>
    </section>
  )
}

export function Footer() {
  return (
    <footer className="px-4 pb-10 pt-12 sm:px-8 lg:px-[78px]">
      <div className="mx-auto flex max-w-[1440px] flex-col gap-8 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <Logo />
          <p className="mt-3 max-w-[34ch] text-[13px] leading-[1.45] text-ink-soft">Your digital wardrobe, personal stylist and shopping edit, all in one place.</p>
        </div>
        <nav aria-label="Footer">
          <ul className="grid grid-cols-2 gap-x-10 gap-y-2.5 text-[13px] uppercase sm:grid-cols-3">
            {[...navLeft, ...navRight].map((l) => (
              <li key={l.href}>
                <AnchorLink href={l.href} className="text-ink-soft transition-colors hover:text-ink">
                  {l.label}
                </AnchorLink>
              </li>
            ))}
            <li>
              <AnchorLink href="#top" className="text-ink-soft transition-colors hover:text-ink">
                Back to top
              </AnchorLink>
            </li>
          </ul>
        </nav>
      </div>
      <div className="mx-auto mt-12 flex max-w-[1440px] flex-col gap-2 border-t border-line pt-5 text-[11px] text-mute sm:flex-row sm:justify-between">
        <p>© 2026 {brand}</p>
        <p className="flex gap-4">
          <Link to="/privacy" className="hover:text-ink">
            Privacy
          </Link>
          <Link to="/signin" className="hover:text-ink">
            Sign in
          </Link>
          <span>Photography via Unsplash</span>
        </p>
      </div>
    </footer>
  )
}
