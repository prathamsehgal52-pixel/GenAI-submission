import { pillars } from '../data/site'
import { BlindsReveal } from './BlindsReveal'
import { GlyphText } from './GlyphText'
import { Photo } from './Photo'
import { AnchorLink, Eyebrow } from './ui'

/** Two tall editorial cards introducing the wardrobe and stylist pillars. */
export function Pillars() {
  return (
    <section aria-labelledby="pillars-title" className="px-4 pb-24 sm:px-8 lg:px-[78px] lg:pb-32">
      <div className="mx-auto max-w-[1440px]">
        <Eyebrow className="mb-6 text-mute">What Armoire does</Eyebrow>
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <GlyphText
            id="pillars-title"
            lines={['Dress better with', 'what you own.']}
            altWords={['what']}
            className="display text-[clamp(34px,4.4vw,64px)]"
          />
          <p className="max-w-[300px] text-[13px] leading-[1.45] text-ink-soft lg:mb-1.5">
            Three things in one place: your closet, a stylist who knows it, and a smarter way to shop for what's missing.
          </p>
        </div>

        <div className="mt-10 grid gap-4 md:grid-cols-2 lg:mt-14 lg:gap-9">
          {pillars.map((p) => (
            <article
              key={p.index}
              className="group relative aspect-[4/5] overflow-hidden rounded-[24px] bg-[linear-gradient(180deg,#1e1e20_0%,#5d5e61_70%,#a9abaf_100%)] text-white sm:aspect-[6/7] lg:rounded-[28px]"
            >
              <BlindsReveal className="absolute inset-0">
                <Photo src={p.image} alt="" crop={{ position: p.crop }} className="h-full w-full !bg-transparent transition-transform duration-[1.2s] ease-out group-hover:scale-[1.03]" />
              </BlindsReveal>
              <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(18,18,18,0.55)_0%,rgba(18,18,18,0.05)_45%,rgba(18,18,18,0.6)_100%)]" />

              <p className="ghost-type absolute right-6 top-6 text-right text-[15px] text-white/45 lg:right-9 lg:top-9 lg:text-[17px]">
                {p.index.split('/')[0]}/{p.index.split('/')[1]}
                <br />_2026
              </p>

              <GlyphText
                as="h3"
                lines={p.title}
                altWords={p.altWords}
                className={`display absolute left-6 text-[clamp(32px,4vw,58px)] leading-[0.95] lg:left-10 ${
                  p.alignBottom ? 'bottom-24 lg:bottom-32' : 'top-[18%]'
                }`}
              />

              <AnchorLink
                href={p.href}
                className="absolute bottom-6 left-6 inline-flex h-10 items-center gap-2.5 rounded-full border border-white/35 px-4 text-[12px] uppercase text-white/85 backdrop-blur-sm transition-colors hover:bg-white hover:text-ink lg:bottom-10 lg:left-10"
              >
                <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />
                {p.chip}
              </AnchorLink>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}
