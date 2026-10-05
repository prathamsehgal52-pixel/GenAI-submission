import { steps } from '../data/site'
import { GlyphText } from './GlyphText'
import { Photo } from './Photo'
import { Eyebrow } from './ui'

const stepImages = [
  { src: '/images/hangers.jpg', crop: { position: '50% 40%' }, alt: 'Shirts on wooden hangers' },
  { src: '/images/look-weekend.jpg', crop: { position: '50% 22%' }, alt: 'Model in a marigold knit and jeans' },
  { src: '/images/knit-poncho.jpg', crop: { position: '50% 45%' }, alt: 'Cream fringed knit on a hanger' },
]

export function HowItWorks() {
  return (
    <section id="how" aria-labelledby="how-title" className="px-4 pb-24 sm:px-8 lg:px-[78px] lg:pb-32">
      <div className="mx-auto max-w-[1440px] border-t border-line pt-14 lg:pt-20">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <Eyebrow className="mb-6 text-mute">How it works</Eyebrow>
            <GlyphText id="how-title" lines={['Three steps to', 'a smarter closet.']} altWords={['smarter']} className="display text-[clamp(34px,4.4vw,64px)]" />
          </div>
          <p className="max-w-[300px] text-[13px] leading-[1.45] text-ink-soft lg:mb-1.5">
            Five minutes of photos is enough to start. The more you add, the sharper your stylist gets.
          </p>
        </div>

        <ol className="mt-12 grid gap-8 md:grid-cols-3 md:gap-5 lg:mt-16 lg:gap-9">
          {steps.map((s, i) => (
            <li key={s.n} className="group">
              <Photo src={stepImages[i].src} alt={stepImages[i].alt} crop={stepImages[i].crop} className="aspect-[16/11] rounded-[20px] lg:rounded-[24px]" imgClassName="transition-transform duration-700 group-hover:scale-[1.04]" />
              <div className="mt-5 flex gap-5">
                <span className="ghost-type pt-0.5 text-[28px] text-ink/25">{s.n}</span>
                <div>
                  <h3 className="text-[16px] font-medium uppercase tracking-[-0.01em]">{s.title}</h3>
                  <p className="mt-2 max-w-[36ch] text-[14px] leading-[1.45] text-ink-soft">{s.body}</p>
                </div>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}
