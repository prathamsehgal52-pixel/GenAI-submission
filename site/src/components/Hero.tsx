import { useState } from 'react'
import { brand, navLeft, navRight } from '../data/site'
import { wardrobe } from '../data/wardrobe'
import { BlindsReveal } from './BlindsReveal'
import { GlyphText } from './GlyphText'
import { Link } from 'react-router'
import { useSignedIn, useStartJourney } from './useStartJourney'
import { Photo } from './Photo'
import { AnchorLink, Arrow, Pill } from './ui'
import { scrollToHash } from '../lib/motion'

/** The page-coloured tab cut into the top of the hero panel that holds the logo. */
function Notch() {
  return (
    <svg
      viewBox="0 0 460 60"
      preserveAspectRatio="none"
      aria-hidden="true"
      className="absolute left-1/2 top-0 h-[46px] w-[230px] -translate-x-1/2 fill-page sm:h-[60px] sm:w-[460px]"
    >
      <path d="M0 0H460C440 0 431 4 423 12L389 47C381 55 373 60 360 60H100C87 60 79 55 71 47L37 12C29 4 20 0 0 0Z" />
    </svg>
  )
}

function Rays() {
  const lines = [
    [50, 62, -5, 30],
    [50, 62, 8, 60],
    [50, 62, 20, 108],
    [50, 62, 105, 30],
    [50, 62, 92, 60],
    [50, 62, 80, 108],
  ]
  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true" className="pointer-events-none absolute inset-0 h-full w-full">
      {lines.map(([x1, y1, x2, y2], i) => (
        <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="white" strokeOpacity="0.55" strokeWidth="0.12" vectorEffect="non-scaling-stroke" />
      ))}
    </svg>
  )
}

export function Logo({ className = '' }: { className?: string }) {
  return (
    <span className={`font-alt text-[22px] font-light uppercase tracking-[-0.04em] sm:text-[28px] ${className}`}>{brand}</span>
  )
}

export function Hero() {
  const openOnboarding = useStartJourney()
  const signedIn = useSignedIn()
  const [menuOpen, setMenuOpen] = useState(false)
  const thumbs = [wardrobe[0], wardrobe[9], wardrobe[5]]

  return (
    <header id="top" className="p-2 sm:p-3 lg:p-[14px]">
      <div className="relative isolate overflow-hidden rounded-[22px] bg-[linear-gradient(180deg,#bfd2d8_0%,#d3e0e3_45%,#eceeef_100%)] sm:rounded-[28px]">
        <Notch />
        <a
          href="#top"
          className="absolute left-1/2 top-[7px] z-20 -translate-x-1/2 sm:top-[10px]"
          aria-label={`${brand} home`}
          onClick={(e) => {
            e.preventDefault()
            window.scrollTo({ top: 0, behavior: 'smooth' })
          }}
        >
          <Logo />
        </a>

        {/* Nav */}
        <nav aria-label="Primary" className="relative z-20 flex items-center justify-between px-4 pt-4 sm:px-8 sm:pt-6 lg:px-10">
          <ul className="hidden items-center gap-7 text-[13px] uppercase lg:flex">
            {navLeft.map((l) => (
              <li key={l.href}>
                <AnchorLink href={l.href} className="relative py-1 after:absolute after:inset-x-0 after:-bottom-0.5 after:h-px after:origin-left after:scale-x-0 after:bg-ink after:transition-transform hover:after:scale-x-100">
                  {l.label}
                </AnchorLink>
              </li>
            ))}
          </ul>
          <button
            type="button"
            className="grid h-10 w-10 place-items-center rounded-full bg-white/70 backdrop-blur lg:hidden"
            aria-expanded={menuOpen}
            aria-controls="mobile-menu"
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            onClick={() => setMenuOpen((v) => !v)}
          >
            <svg viewBox="0 0 16 16" className="h-4 w-4" aria-hidden="true">
              {menuOpen ? (
                <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              ) : (
                <path d="M2.5 5.5h11M2.5 10.5h11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              )}
            </svg>
          </button>
          <div className="flex items-center gap-7">
            <ul className="hidden items-center gap-7 text-[13px] uppercase lg:flex">
              {navRight.map((l) => (
                <li key={l.href}>
                  <AnchorLink href={l.href} className="relative py-1 after:absolute after:inset-x-0 after:-bottom-0.5 after:h-px after:origin-left after:scale-x-0 after:bg-ink after:transition-transform hover:after:scale-x-100">
                    {l.label}
                  </AnchorLink>
                </li>
              ))}
            </ul>
            <div className="flex items-center">
              {!signedIn && (
                <Link to="/signin" className="mr-4 hidden text-[13px] uppercase underline-offset-4 hover:underline md:inline">
                  Sign in
                </Link>
              )}
              <span className="hidden sm:block">
                <Pill onClick={openOnboarding} className="!h-11">
                  {signedIn ? 'Open my wardrobe' : 'Get started'}
                </Pill>
              </span>
              <button
                type="button"
                onClick={openOnboarding}
                className="grid h-10 w-10 place-items-center rounded-full bg-ink text-white transition-transform hover:-rotate-45 sm:h-11 sm:w-11"
                aria-label={signedIn ? 'Open my wardrobe' : 'Get started'}
              >
                <Arrow />
              </button>
            </div>
          </div>
        </nav>

        {menuOpen && (
          <div id="mobile-menu" className="absolute inset-x-3 top-16 z-30 rounded-3xl bg-page p-3 shadow-xl lg:hidden" style={{ animation: 'fade-up 240ms ease-out' }}>
            <ul className="divide-y divide-line">
              {[...navLeft, ...navRight].map((l) => (
                <li key={l.href}>
                  <AnchorLink href={l.href} onNavigate={() => setMenuOpen(false)} className="flex items-center justify-between px-3 py-3.5 text-[15px] uppercase">
                    {l.label}
                    <Arrow className="text-mute" />
                  </AnchorLink>
                </li>
              ))}
              {!signedIn && (
                <li>
                  <Link to="/signin" className="flex items-center justify-between px-3 py-3.5 text-[15px] uppercase">
                    Sign in
                    <Arrow className="text-mute" />
                  </Link>
                </li>
              )}
            </ul>
          </div>
        )}

        {/* Stage */}
        <div className="relative flex min-h-[calc(100svh-72px)] flex-col items-center sm:min-h-[calc(100svh-94px)] lg:min-h-[calc(100svh-110px)]">
          <Rays />
          <div className="relative z-10 mt-14 px-4 text-center sm:mt-16 lg:mt-[clamp(48px,6vh,88px)]">
            <GlyphText
              as="h1"
              trigger="load"
              delay={250}
              lines={['Your wardrobe.', 'Reimagined.']}
              altWords={['Reimagined.']}
              className="display text-[clamp(44px,7.2vw,112px)]"
            />
            <p className="mx-auto mt-4 max-w-[34ch] text-[15px] leading-snug text-ink-soft md:hidden">
              Turn the clothes you own into outfits you'll love.
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-2" style={{ animation: 'fade-up 700ms 500ms both' }}>
              <Pill onClick={openOnboarding}>Build my wardrobe</Pill>
              <Pill variant="light" onClick={() => scrollToHash('#how')}>
                How it works
              </Pill>
            </div>
          </div>

          {/* Figure */}
          <div className="relative z-0 mt-auto w-[min(92vw,420px)] sm:w-[min(62vw,520px)] lg:w-[min(40vw,600px,calc(100svh-430px))]">
            <BlindsReveal trigger="load" delay={0.15} duration={1.3}>
              <div className="hero-fade aspect-[4/4.3] sm:aspect-[4/4]">
                <Photo
                  src="/images/hero.jpg"
                  alt="Model in a white muscle tee and straight-leg jeans"
                  crop={{ position: '35% 4%' }}
                  eager
                  className="h-full w-full !bg-transparent"
                />
              </div>
            </BlindsReveal>

            <button
              type="button"
              onClick={() => scrollToHash('#closet')}
              className="group absolute left-0 top-[42%] flex items-center gap-2 rounded-full bg-white/85 py-1.5 pl-1.5 pr-3.5 text-left text-[11px] shadow-sm backdrop-blur transition-transform hover:-translate-y-0.5 sm:left-[-14%]"
              style={{ animation: 'fade-up 600ms 1300ms both' }}
            >
              <span className="h-2 w-2 translate-x-1 rounded-full bg-ink" aria-hidden="true" />
              <span className="ml-1">
                <span className="block font-medium uppercase">Muscle tee</span>
                <span className="block text-ink-soft">Pairs with 9 items</span>
              </span>
            </button>
            <button
              type="button"
              onClick={() => scrollToHash('#stylist')}
              className="group absolute right-[-4%] top-[74%] flex items-center gap-2 rounded-full bg-white/85 py-1.5 pl-1.5 pr-3.5 text-left text-[11px] shadow-sm backdrop-blur transition-transform hover:-translate-y-0.5 sm:right-[-10%]"
              style={{ animation: 'fade-up 600ms 1500ms both' }}
            >
              <span className="h-2 w-2 translate-x-1 rounded-full bg-ink" aria-hidden="true" />
              <span className="ml-1">
                <span className="block font-medium uppercase">Straight denim</span>
                <span className="block text-ink-soft">12 outfits in your closet</span>
              </span>
            </button>
          </div>

          {/* Left copy */}
          <div className="absolute bottom-10 left-8 z-10 hidden w-[250px] md:block lg:left-10 lg:w-[280px]" style={{ animation: 'fade-up 700ms 900ms both' }}>
            <div className="flex items-center">
              {thumbs.map((t, i) => (
                <Photo
                  key={t.id}
                  src={t.image}
                  alt=""
                  crop={t.crop}
                  className={`h-10 w-10 rounded-full ring-2 ring-[#dbe5e7] ${i ? '-ml-2.5' : ''}`}
                />
              ))}
              <span className="ml-3 text-[12px] uppercase text-ink-soft">Your closet, styled daily</span>
            </div>
            <p className="mt-8 text-[14px] leading-[1.4] text-ink-soft [text-indent:3.2em]">
              Turn the clothes you own into outfits you'll love. Discover your style and find the pieces that complete it.
            </p>
          </div>

          {/* Right: today's look card */}
          <button
            type="button"
            onClick={() => scrollToHash('#stylist')}
            className="group absolute bottom-10 right-8 z-10 hidden h-[170px] w-[260px] overflow-hidden rounded-[22px] bg-card text-left md:block lg:right-10 lg:h-[180px] lg:w-[280px]"
            style={{ animation: 'fade-up 700ms 1100ms both' }}
            aria-label="See today's look in the stylist"
          >
            <Photo src="/images/look-weekend.jpg" alt="" crop={{ position: '50% 30%' }} className="absolute inset-0 transition-transform duration-700 group-hover:scale-105" />
            <span className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-black/20" />
            <span className="absolute left-1/2 top-[42%] grid h-12 w-12 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-black/60 text-white ring-1 ring-white/20 backdrop-blur transition-transform group-hover:scale-110">
              <svg viewBox="0 0 16 16" className="ml-0.5 h-4 w-4" aria-hidden="true">
                <path d="M4.5 2.8v10.4L13 8 4.5 2.8Z" fill="currentColor" />
              </svg>
            </span>
            <span className="absolute inset-x-4 bottom-3.5 flex items-end justify-between text-white">
              <span>
                <span className="block text-[10px] uppercase text-white/60">Today's look</span>
                <span className="block text-[13px]">3 new ways to style it</span>
              </span>
              <Arrow className="mb-0.5 transition-transform group-hover:translate-x-0.5" />
            </span>
          </button>
        </div>
      </div>
    </header>
  )
}
