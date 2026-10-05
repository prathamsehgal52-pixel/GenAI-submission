import { useEffect, useId, useRef, useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react'
import { COLOR_SWATCH, type ColorFamily } from '../../../shared/taxonomy'

export { Arrow, Chevron, Heart, Sparkle } from '../../components/ui'

/* ───────── Buttons ───────── */

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'dark' | 'light' | 'ghost' | 'danger'; size?: 'sm' | 'md'; loading?: boolean }

const variants = {
  dark: 'bg-ink text-white hover:bg-[#2e2f31]',
  light: 'bg-white text-ink hover:bg-[#f4f5f6] shadow-[0_1px_2px_rgba(0,0,0,0.06)]',
  ghost: 'border border-line bg-transparent text-ink hover:bg-white/70',
  danger: 'bg-[#8f2a20] text-white hover:bg-[#7a231b]',
}

export function Button({ variant = 'dark', size = 'md', loading, className = '', children, disabled, ...rest }: BtnProps) {
  return (
    <button
      type="button"
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={`inline-flex shrink-0 items-center justify-center gap-2 rounded-full font-medium uppercase tracking-[0.01em] transition-[background-color,color,transform] duration-200 active:scale-[0.97] disabled:pointer-events-none disabled:opacity-45 ${
        size === 'sm' ? 'h-9 px-4 text-[11px]' : 'h-11 px-6 text-[13px]'
      } ${variants[variant]} ${className}`}
      {...rest}
    >
      {loading && <Spinner className="h-3.5 w-3.5" />}
      {children}
    </button>
  )
}

export function IconButton({ label, className = '', children, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button type="button" aria-label={label} title={label} className={`grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white text-ink transition-colors hover:bg-ink hover:text-white disabled:opacity-40 ${className}`} {...rest}>
      {children}
    </button>
  )
}

export function Spinner({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={`animate-spin ${className}`} aria-hidden="true">
      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeOpacity="0.2" strokeWidth="2.5" />
      <path d="M21 12a9 9 0 0 0-9-9" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  )
}

/* ───────── Chips ───────── */

export function Chip({ selected, onClick, children, count, className = '' }: { selected?: boolean; onClick?: () => void; children: ReactNode; count?: number; className?: string }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={`flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-[13px] transition-colors ${
        selected ? 'border-ink bg-ink text-white' : 'border-line bg-white/60 text-ink hover:border-ink/40 hover:bg-white'
      } ${className}`}
    >
      {children}
      {count !== undefined && <span className={`text-[11px] ${selected ? 'text-white/60' : 'text-mute'}`}>{count}</span>}
    </button>
  )
}

export function MultiChips<T extends string>({ options, value, onChange, labels, label, max }: { options: readonly T[]; value: T[]; onChange: (v: T[]) => void; labels?: Partial<Record<T, string>>; label: string; max?: number }) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-2">
      {options.map((o) => (
        <Chip
          key={o}
          selected={value.includes(o)}
          onClick={() => onChange(value.includes(o) ? value.filter((x) => x !== o) : max && value.length >= max ? value : [...value, o])}
        >
          {labels?.[o] ?? cap(o)}
        </Chip>
      ))}
    </div>
  )
}

export function Swatch({ color, className = 'h-4 w-4' }: { color: string; className?: string }) {
  const bg = COLOR_SWATCH[color as ColorFamily] ?? '#ccc'
  return <span aria-hidden="true" className={`inline-block shrink-0 rounded-full ring-1 ring-black/10 ${className}`} style={{ background: bg }} />
}

export function ColorChips({ value, onChange, label, options }: { value: string[]; onChange: (v: string[]) => void; label: string; options: readonly string[] }) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-2">
      {options.map((c) => {
        const on = value.includes(c)
        return (
          <button
            key={c}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(on ? value.filter((x) => x !== c) : [...value, c])}
            className={`flex h-9 items-center gap-2 rounded-full border pl-2 pr-3.5 text-[13px] transition-colors ${on ? 'border-ink bg-ink text-white' : 'border-line bg-white/60 hover:border-ink/40'}`}
          >
            <Swatch color={c} />
            {cap(c)}
          </button>
        )
      })}
    </div>
  )
}

/* ───────── Form fields ───────── */

export function Field({ label, hint, error, children, htmlFor }: { label: string; hint?: ReactNode; error?: string | null; children: ReactNode; htmlFor?: string }) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-2 block text-[12px] uppercase text-ink-soft">
        {label}
      </label>
      {children}
      {hint && !error && <p className="mt-1.5 text-[12px] text-mute">{hint}</p>}
      {error && (
        <p role="alert" className="mt-1.5 text-[12px] text-[#a1352a]">
          {error}
        </p>
      )}
    </div>
  )
}

const inputCls = 'h-12 w-full rounded-full border border-line bg-white px-5 text-[15px] outline-none transition-colors placeholder:text-mute focus:border-ink disabled:opacity-60'

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${inputCls} ${props.className ?? ''}`} />
}

export function Select({ className = '', children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className="relative">
      <select {...props} className={`${inputCls} appearance-none pr-10 ${className}`}>
        {children}
      </select>
      <svg viewBox="0 0 16 16" aria-hidden="true" className="pointer-events-none absolute right-4 top-1/2 h-3 w-3 -translate-y-1/2">
        <path d="M3.5 6 8 10.5 12.5 6" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    </div>
  )
}

export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={`w-full rounded-[20px] border border-line bg-white px-5 py-3.5 text-[15px] outline-none transition-colors placeholder:text-mute focus:border-ink ${props.className ?? ''}`} />
}

export function Scale({ value, onChange, label, low, high }: { value: number; onChange: (n: number) => void; label: string; low: string; high: string }) {
  return (
    <div>
      <div role="radiogroup" aria-label={label} className="flex gap-1.5">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={value === n}
            aria-label={`${label} ${n} of 5`}
            onClick={() => onChange(n)}
            className={`h-9 flex-1 rounded-full border text-[13px] transition-colors ${value === n ? 'border-ink bg-ink text-white' : n < value ? 'border-ink/20 bg-ink/10' : 'border-line bg-white/60 hover:border-ink/40'}`}
          >
            {n}
          </button>
        ))}
      </div>
      <div className="mt-1.5 flex justify-between text-[11px] text-mute">
        <span>{low}</span>
        <span>{high}</span>
      </div>
    </div>
  )
}

export function Toggle({ checked, onChange, label, description, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; description?: ReactNode; disabled?: boolean }) {
  const id = useId()
  return (
    <div className="flex items-start justify-between gap-6">
      <div>
        <label htmlFor={id} className="text-[15px]">
          {label}
        </label>
        {description && <p className="mt-1 text-[13px] text-ink-soft">{description}</p>}
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative mt-0.5 h-7 w-12 shrink-0 rounded-full transition-colors disabled:opacity-40 ${checked ? 'bg-ink' : 'bg-line'}`}
      >
        <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-6' : 'translate-x-1'}`} />
      </button>
    </div>
  )
}

/* ───────── Surfaces & states ───────── */

export function Card({ className = '', children }: { className?: string; children: ReactNode }) {
  return <div className={`rounded-[24px] bg-white/70 p-5 sm:p-7 ${className}`}>{children}</div>
}

export function EmptyState({ title, body, action, visual }: { title: string; body: ReactNode; action?: ReactNode; visual?: ReactNode }) {
  return (
    <div className="flex flex-col items-center rounded-[28px] border border-dashed border-line px-6 py-14 text-center sm:py-20">
      {visual}
      <h2 className="display text-[28px] sm:text-[34px]">{title}</h2>
      <p className="mx-auto mt-3 max-w-[46ch] text-[14px] leading-[1.5] text-ink-soft">{body}</p>
      {action && <div className="mt-6 flex flex-wrap justify-center gap-2">{action}</div>}
    </div>
  )
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex flex-col items-center rounded-[28px] bg-white/60 px-6 py-12 text-center">
      <p className="display text-[24px]">Something didn’t load</p>
      <p className="mt-2 max-w-[44ch] text-[14px] text-ink-soft">{message}</p>
      {onRetry && (
        <Button className="mt-5" variant="light" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  )
}

export function Skeleton({ className = '' }: { className?: string }) {
  return <div aria-hidden="true" className={`animate-pulse rounded-[18px] bg-[#dfe2e5] ${className}`} />
}

export function PageLoader() {
  return (
    <div className="grid min-h-[50vh] place-items-center text-ink-soft" role="status" aria-label="Loading">
      <Spinner className="h-6 w-6" />
    </div>
  )
}

export function Notice({ tone = 'neutral', children, action }: { tone?: 'neutral' | 'warn'; children: ReactNode; action?: ReactNode }) {
  return (
    <div className={`flex flex-col gap-3 rounded-[20px] px-5 py-4 text-[14px] sm:flex-row sm:items-center sm:justify-between ${tone === 'warn' ? 'bg-[#f3e7d8] text-[#5c4321]' : 'bg-white/70 text-ink-soft'}`}>
      <div>{children}</div>
      {action}
    </div>
  )
}

/* ───────── Images ───────── */

export function Img({ src, alt, className = '', fit = 'cover' }: { src: string | null | undefined; alt: string; className?: string; fit?: 'cover' | 'contain' }) {
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    setFailed(false)
  }, [src])
  if (!src || failed) {
    return (
      <div role="img" aria-label={alt} className={`grid place-items-center bg-gradient-to-b from-[#d9dde0] to-[#c9cdd1] text-[11px] uppercase text-ink-soft/70 ${className}`}>
        <svg viewBox="0 0 24 24" className="h-6 w-6 opacity-50" aria-hidden="true">
          <path d="M8 4 5 6v4h2v10h10V10h2V6l-3-2c-.5 1.5-2 2.5-4 2.5S8.5 5.5 8 4Z" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
        </svg>
      </div>
    )
  }
  return <img src={src} alt={alt} loading="lazy" decoding="async" onError={() => setFailed(true)} className={`${fit === 'cover' ? 'object-cover' : 'object-contain'} ${className}`} />
}

/* ───────── Dialog ───────── */

export function Dialog({ open, onClose, title, children, wide, footer }: { open: boolean; onClose: () => void; title: string; children: ReactNode; wide?: boolean; footer?: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (open && !d.open) d.showModal()
    if (!open && d.open) d.close()
  }, [open])
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      aria-labelledby={titleId}
      className={`m-auto max-h-[min(88vh,900px)] w-[calc(100vw-24px)] overflow-hidden rounded-[28px] bg-page p-0 text-ink shadow-[0_40px_120px_rgba(0,0,0,0.35)] backdrop:bg-[#121212]/55 backdrop:backdrop-blur-sm ${wide ? 'max-w-[920px]' : 'max-w-[560px]'}`}
    >
      {open && (
        <div className="flex max-h-[min(88vh,900px)] flex-col">
          <div className="flex items-center justify-between gap-4 px-6 pb-2 pt-6 sm:px-8">
            <h2 id={titleId} className="display text-[26px] sm:text-[30px]">
              {title}
            </h2>
            <IconButton label="Close" onClick={onClose}>
              <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" aria-hidden="true">
                <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </IconButton>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-6 pt-2 sm:px-8">{children}</div>
          {footer && <div className="flex flex-wrap justify-end gap-2 border-t border-line px-6 py-4 sm:px-8">{footer}</div>}
        </div>
      )}
    </dialog>
  )
}

export function ConfirmDialog({ open, onClose, onConfirm, title, body, confirmLabel, danger, loading }: { open: boolean; onClose: () => void; onConfirm: () => void; title: string; body: ReactNode; confirmLabel: string; danger?: boolean; loading?: boolean }) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant={danger ? 'danger' : 'dark'} onClick={onConfirm} loading={loading}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="text-[14px] leading-[1.5] text-ink-soft">{body}</div>
    </Dialog>
  )
}

/* ───────── Helpers ───────── */

export const cap = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, ' ') : s)

export function timeAgo(iso: string | Date) {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000)
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.floor(s / 60)} min ago`
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`
  const d = Math.floor(s / 86400)
  return d === 1 ? 'yesterday' : `${d} days ago`
}

export function formatPrice(p: { amount: number; currency: string | null } | null) {
  if (!p) return null
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency: p.currency ?? 'USD', maximumFractionDigits: p.amount % 1 ? 2 : 0 }).format(p.amount)
  } catch {
    return `${p.amount} ${p.currency ?? ''}`.trim()
  }
}

export function formatTemp(c: number, unit: 'C' | 'F') {
  return unit === 'F' ? `${Math.round((c * 9) / 5 + 32)}°F` : `${Math.round(c)}°C`
}
