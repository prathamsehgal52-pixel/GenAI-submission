import { useEffect, useRef, type ElementType } from 'react'
import { prefersReducedMotion } from '../lib/motion'

type Props = {
  /** Lines of text; each renders on its own line. */
  lines: string[]
  /** Words (matched case-insensitively) that settle in the thin alternate face. */
  altWords?: string[]
  as?: ElementType
  className?: string
  /** 'view' plays when scrolled into view, 'load' plays on mount. */
  trigger?: 'view' | 'load'
  delay?: number
  id?: string
}

/**
 * Headline whose characters flicker between the bold grotesk and a thin,
 * wide alternate face before settling, as in the reference. Some
 * words stay in the alternate face.
 */
export function GlyphText({ lines, altWords = [], as: Tag = 'h2', className = '', trigger = 'view', delay = 0, id }: Props) {
  const ref = useRef<HTMLElement>(null)
  const alt = altWords.map((w) => w.toLowerCase())

  useEffect(() => {
    const root = ref.current
    if (!root) return
    const chars = Array.from(root.querySelectorAll<HTMLSpanElement>('.glyph'))
    const settle = () =>
      chars.forEach((c) => {
        c.classList.remove('is-hidden')
        c.classList.toggle('is-alt', c.dataset.alt === '1')
      })

    if (prefersReducedMotion()) {
      settle()
      return
    }

    chars.forEach((c) => c.classList.add('is-hidden'))
    let timer: number | undefined
    let interval: number | undefined
    const stop = () => {
      clearTimeout(timer)
      clearInterval(interval)
    }

    const play = () => {
      const duration = 1100
      timer = window.setTimeout(() => {
        const start = performance.now()
        // ~20fps so the flicker reads as deliberate glyph swaps, not noise
        interval = window.setInterval(() => {
          const t = (performance.now() - start) / duration
          if (t >= 1.05) {
            clearInterval(interval)
            settle()
            return
          }
          chars.forEach((c, i) => {
            const local = t - (i / chars.length) * 0.55
            if (local < 0) return
            c.classList.remove('is-hidden')
            c.classList.toggle('is-alt', local < 0.45 ? Math.random() > 0.5 : c.dataset.alt === '1')
          })
        }, 50)
      }, delay)
    }

    if (trigger === 'load') {
      play()
      return stop
    }

    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          play()
          io.disconnect()
        }
      },
      { threshold: 0.4 },
    )
    io.observe(root)
    return () => {
      io.disconnect()
      stop()
    }
  }, [delay, trigger])

  return (
    <Tag ref={ref} id={id} className={className} aria-label={lines.join(' ')}>
      {lines.map((line, li) => (
        <span key={li} className="block" aria-hidden="true">
          {line.split(' ').map((word, wi, arr) => {
            const isAlt = alt.includes(word.toLowerCase())
            return (
              <span key={wi} className="inline-block whitespace-nowrap">
                {Array.from(word).map((ch, ci) => (
                  <span key={ci} className="glyph" data-alt={isAlt ? '1' : '0'}>
                    {ch}
                  </span>
                ))}
                {wi < arr.length - 1 ? <span className="glyph"> </span> : null}
              </span>
            )
          })}
        </span>
      ))}
    </Tag>
  )
}
