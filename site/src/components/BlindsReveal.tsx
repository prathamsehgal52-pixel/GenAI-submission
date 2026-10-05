import { useEffect, useRef, type ReactNode } from 'react'
import { gsap, prefersReducedMotion } from '../lib/motion'

type Props = {
  children: ReactNode
  className?: string
  trigger?: 'view' | 'load'
  delay?: number
  duration?: number
}

/** Reveals its content through horizontal venetian-blind stripes. */
export function BlindsReveal({ children, className = '', trigger = 'view', delay = 0, duration = 1.1 }: Props) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el || prefersReducedMotion()) return
    gsap.set(el, { '--blind': 0 })
    const play = () =>
      gsap.to(el, { '--blind': 1, duration, delay, ease: 'power3.inOut' })

    if (trigger === 'load') {
      const tween = play()
      return () => {
        tween.kill()
      }
    }

    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          play()
          io.disconnect()
        }
      },
      { threshold: 0.25 },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [trigger, delay, duration])

  return (
    <div ref={ref} className={`blinds ${className}`}>
      {children}
    </div>
  )
}
