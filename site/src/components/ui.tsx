import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { scrollToHash } from '../lib/motion'

type PillProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'dark' | 'light' | 'ghost'
  children: ReactNode
}

const pillBase =
  'inline-flex items-center justify-center gap-2 rounded-full px-6 h-11 text-[13px] font-medium uppercase tracking-[0.01em] transition-[background-color,color,transform,box-shadow] duration-200 active:scale-[0.97] disabled:opacity-40 disabled:pointer-events-none'

const pillVariants = {
  dark: 'bg-ink text-white hover:bg-[#2e2f31] shadow-[0_1px_0_rgba(255,255,255,0.08)_inset]',
  light: 'bg-white text-ink hover:bg-[#f4f5f6] shadow-[0_1px_2px_rgba(0,0,0,0.06)]',
  ghost: 'border border-current/30 text-current hover:bg-current/5',
}

export function Pill({ variant = 'dark', className = '', children, ...rest }: PillProps) {
  return (
    <button type="button" className={`${pillBase} ${pillVariants[variant]} ${className}`} {...rest}>
      {children}
    </button>
  )
}

/** Anchor that scrolls smoothly to an in-page section. */
export function AnchorLink({
  href,
  className = '',
  children,
  onNavigate,
}: {
  href: string
  className?: string
  children: ReactNode
  onNavigate?: () => void
}) {
  return (
    <a
      href={href}
      className={className}
      onClick={(e) => {
        e.preventDefault()
        onNavigate?.()
        scrollToHash(href)
      }}
    >
      {children}
    </a>
  )
}

export function Eyebrow({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <p className={`text-[12px] uppercase tracking-[0.02em] text-ink-soft ${className}`}>{children}</p>
}

export function Arrow({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" className={`h-3.5 w-3.5 ${className}`}>
      <path d="M3 8h10M9 4l4 4-4 4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function Chevron({ className = '', dir = 'right' }: { className?: string; dir?: 'right' | 'left' }) {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" className={`h-3.5 w-3.5 ${dir === 'left' ? 'rotate-180' : ''} ${className}`}>
      <path d="M6 3.5 10.5 8 6 12.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function Heart({ filled, className = '' }: { filled?: boolean; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={`h-4 w-4 ${className}`}>
      <path
        d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10Z"
        fill={filled ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function Sparkle({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" className={`h-3.5 w-3.5 ${className}`}>
      <path d="M8 1.5c.4 3.3 1.9 4.8 5.2 5.2v.6C9.9 7.7 8.4 9.2 8 12.5h-.6C7 9.2 5.5 7.7 2.2 7.3v-.6C5.5 6.3 7 4.8 7.4 1.5H8Z" fill="currentColor" />
    </svg>
  )
}
