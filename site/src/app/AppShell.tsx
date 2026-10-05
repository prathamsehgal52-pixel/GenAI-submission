import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router'
import { Logo } from '../components/Hero'
import { authClient } from '../lib/auth'
import { useMe } from './hooks'
import { useToast } from './ui/toast'

const primary = [
  { to: '/app', label: 'Home', end: true, icon: 'M3 10.5 12 4l9 6.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1v-9.5Z' },
  { to: '/app/wardrobe', label: 'Wardrobe', icon: 'M12 5.5a1.75 1.75 0 1 1 1.75 1.75c-.97 0-1.75.78-1.75 1.75v.5m0 0L3.5 15.6c-.9.6-.47 2 .6 2h15.8c1.07 0 1.5-1.4.6-2L12 9.5Z' },
  { to: '/app/style', label: 'Style me', icon: 'M12 3.5c.5 4 2.3 5.8 6.5 6.3v.9c-4.2.5-6 2.3-6.5 6.3h-.9c-.5-4-2.3-5.8-6.5-6.3v-.9c4.2-.5 6-2.3 6.5-6.3h.9Z' },
  { to: '/app/discover', label: 'Discover', icon: 'M11 4a7 7 0 1 0 4.4 12.4L20 21M11 4a7 7 0 0 1 4.4 12.4' },
  { to: '/app/looks', label: 'Looks', icon: 'M7 4h10a1 1 0 0 1 1 1v15l-6-3.5L6 20V5a1 1 0 0 1 1-1Z' },
]
const secondary = [
  { to: '/app/plan', label: 'Plan' },
  { to: '/app/insights', label: 'Insights' },
  { to: '/app/settings', label: 'Settings' },
]

function Icon({ d }: { d: string }) {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
      <path d={d} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function AccountMenu() {
  const me = useMe()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()
  const qc = useQueryClient()
  const toast = useToast()
  const loc = useLocation()
  useEffect(() => {
    setOpen(false)
  }, [loc.pathname])
  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false)
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])
  const name = me.data?.user.name ?? ''
  const initials = name.split(/\s+/).map((p) => p[0]).slice(0, 2).join('').toUpperCase() || '·'
  const signOut = async () => {
    await authClient.signOut()
    qc.clear()
    toast('You’re signed out.')
    navigate('/', { replace: true })
  }
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="Account menu"
        className="grid h-10 w-10 place-items-center rounded-full bg-ink text-[12px] font-medium text-white ring-offset-2 ring-offset-page transition hover:ring-2 hover:ring-ink/30"
      >
        {initials}
      </button>
      {open && (
        <div role="menu" className="absolute right-0 top-12 z-50 w-60 overflow-hidden rounded-[22px] bg-white p-2 shadow-[0_20px_60px_rgba(0,0,0,0.18)]" style={{ animation: 'fade-up 180ms ease-out' }}>
          <div className="px-3 pb-2 pt-2">
            <p className="truncate text-[14px] font-medium">{name}</p>
            <p className="truncate text-[12px] text-ink-soft">{me.data?.user.email}</p>
          </div>
          <div className="my-1 h-px bg-line" />
          {[...secondary, ...(me.data?.isAdmin ? [{ to: '/app/admin', label: 'Operations' }] : [])].map((l) => (
            <Link key={l.to} role="menuitem" to={l.to} className="block rounded-[14px] px-3 py-2.5 text-[14px] hover:bg-page">
              {l.label}
            </Link>
          ))}
          <div className="my-1 h-px bg-line" />
          <button type="button" role="menuitem" onClick={signOut} className="block w-full rounded-[14px] px-3 py-2.5 text-left text-[14px] hover:bg-page">
            Sign out
          </button>
        </div>
      )}
    </div>
  )
}

/** Authenticated application frame: brand bar, primary navigation, content. */
export function AppShell() {
  const loc = useLocation()
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [loc.pathname])
  return (
    <div className="min-h-screen pb-28 lg:pb-12">
      <a href="#app-main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-ink focus:px-4 focus:py-2 focus:text-white">
        Skip to content
      </a>
      <header className="sticky top-0 z-40 bg-page/85 backdrop-blur-md">
        <div className="mx-auto flex h-[72px] max-w-[1440px] items-center justify-between gap-4 px-4 sm:px-8 lg:px-10">
          <Link to="/app" aria-label="Armoire home">
            <Logo className="!text-[22px]" />
          </Link>
          <nav aria-label="Primary" className="hidden rounded-full bg-white/70 p-1 lg:flex">
            {[...primary, secondary[0]].map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                end={(l as { end?: boolean }).end ?? false}
                className={({ isActive }) => `rounded-full px-4 py-2 text-[13px] uppercase transition-colors ${isActive ? 'bg-ink text-white' : 'text-ink hover:bg-white'}`}
              >
                {l.label}
              </NavLink>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <Link to="/app/wardrobe?upload=1" className="hidden h-10 items-center gap-2 rounded-full bg-white px-4 text-[12px] uppercase transition-colors hover:bg-ink hover:text-white sm:inline-flex">
              <span aria-hidden="true" className="text-[16px] leading-none">+</span> Add clothes
            </Link>
            <AccountMenu />
          </div>
        </div>
      </header>

      <main id="app-main" className="mx-auto max-w-[1440px] px-4 pt-4 sm:px-8 lg:px-10 lg:pt-8">
        <Outlet />
      </main>

      {/* Mobile tab bar */}
      <nav aria-label="Primary" className="fixed inset-x-3 bottom-3 z-40 rounded-[26px] bg-ink/95 p-1.5 text-white shadow-[0_16px_48px_rgba(0,0,0,0.3)] backdrop-blur lg:hidden">
        <ul className="grid grid-cols-5">
          {primary.map((l) => (
            <li key={l.to}>
              <NavLink
                to={l.to}
                end={(l as { end?: boolean }).end ?? false}
                className={({ isActive }) => `flex flex-col items-center gap-0.5 rounded-[20px] py-2 text-[10px] uppercase transition-colors ${isActive ? 'bg-white text-ink' : 'text-white/70'}`}
              >
                <Icon d={l.icon} />
                {l.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  )
}
