import type { ReactNode } from 'react'
import { GlyphText } from '../../components/GlyphText'

export function PageHeader({ eyebrow, lines, alt, children, sub }: { eyebrow?: ReactNode; lines: string[]; alt?: string[]; children?: ReactNode; sub?: ReactNode }) {
  return (
    <div className="mb-8 flex flex-col gap-5 lg:mb-10 lg:flex-row lg:items-end lg:justify-between">
      <div>
        {eyebrow && <p className="mb-3 text-[12px] uppercase text-mute">{eyebrow}</p>}
        <GlyphText as="h1" trigger="load" lines={lines} altWords={alt} className="display text-[clamp(36px,4.4vw,64px)]" />
        {sub && <p className="mt-3 max-w-[56ch] text-[14px] leading-[1.5] text-ink-soft">{sub}</p>}
      </div>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  )
}
