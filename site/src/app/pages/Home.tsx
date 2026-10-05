import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router'
import { GlyphText } from '../../components/GlyphText'
import { Photo } from '../../components/Photo'
import { api } from '../../lib/api'
import type { DayForecast, Outfit, Recommendation } from '../../lib/types'
import { useMe, usePageTitle } from '../hooks'
import { OutfitCollage } from '../parts/Outfit'
import { Img, Skeleton, formatPrice, formatTemp } from '../ui'

type Facets = { statuses: Record<string, number>; categories: Record<string, number> }
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

function greeting() {
  const h = new Date().getHours()
  return h < 12 ? 'Good morning,' : h < 18 ? 'Good afternoon,' : 'Good evening,'
}

export default function Home() {
  usePageTitle('Home')
  const me = useMe()
  const today = iso(new Date())
  const week = iso(new Date(Date.now() + 6 * 86400000))
  const facets = useQuery({ queryKey: ['facets'], queryFn: () => api<Facets>('/wardrobe/facets') })
  const plans = useQuery({ queryKey: ['plans', 'home', today], queryFn: () => api<{ plans: { id: string; date: string; outfit: Outfit }[]; forecast: DayForecast[] }>(`/plans?from=${today}&to=${week}`) })
  const looks = useQuery({ queryKey: ['looks'], queryFn: () => api<{ outfits: Outfit[] }>('/outfits?saved=true') })
  const finds = useQuery({ queryKey: ['discover', 'new', null, 'match'], queryFn: () => api<{ available: boolean; recommendations: Recommendation[] }>('/discovery?status=new&sort=match'), enabled: !!me.data?.capabilities.discovery })

  const first = me.data?.user.name.split(' ')[0] ?? ''
  const active = facets.data?.statuses.active ?? 0
  const review = facets.data?.statuses.review ?? 0
  const todayForecast = plans.data?.forecast.find((f) => f.date === today)
  const todayPlan = plans.data?.plans.find((p) => p.date === today)
  const unit = me.data?.profile.temperatureUnit ?? 'C'
  const newUser = facets.data && active === 0

  return (
    <div className="space-y-6">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-[28px] bg-[linear-gradient(180deg,#bfd2d8_0%,#d3e0e3_45%,#eceeef_100%)] p-6 sm:p-10">
        <div className="relative z-10 max-w-[560px]">
          <p className="text-[12px] uppercase text-ink-soft">{new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</p>
          <GlyphText as="h1" trigger="load" lines={[greeting(), `${first}.`]} altWords={[`${first}.`]} className="display mt-3 text-[clamp(40px,5.4vw,80px)]" />
          {todayForecast && (
            <p className="mt-4 text-[15px] text-ink-soft">
              {me.data?.profile.locationName?.split(',')[0]}: {formatTemp(todayForecast.minC, unit)}–{formatTemp(todayForecast.maxC, unit)}
              {todayForecast.precipitationChance != null && todayForecast.precipitationChance >= 40 ? `, ${todayForecast.precipitationChance}% chance of rain` : ''}
            </p>
          )}
          <div className="mt-6 flex flex-wrap gap-2">
            {newUser ? (
              <Link to="/app/wardrobe?upload=1" className="inline-flex h-11 items-center rounded-full bg-ink px-6 text-[13px] uppercase text-white">
                Add your first pieces
              </Link>
            ) : (
              <Link to="/app/style?auto=1" className="inline-flex h-11 items-center rounded-full bg-ink px-6 text-[13px] uppercase text-white">
                Style me for today
              </Link>
            )}
            <Link to="/app/wardrobe" className="inline-flex h-11 items-center rounded-full bg-white px-6 text-[13px] uppercase">
              My wardrobe
            </Link>
          </div>
        </div>
        <div className="pointer-events-none absolute -bottom-6 right-6 hidden w-[230px] rotate-[4deg] lg:block">
          {todayPlan ? (
            <div className="rounded-[24px] bg-white/80 p-2 shadow-xl">
              <OutfitCollage outfit={todayPlan.outfit} />
              <p className="px-1.5 py-2 text-[12px]">Today: {todayPlan.outfit.title}</p>
            </div>
          ) : (
            <Photo src="/images/look-weekend.jpg" alt="" crop={{ position: '50% 25%' }} className="aspect-[3/4] rounded-[24px] shadow-xl" />
          )}
        </div>
      </section>

      {/* Status */}
      {review > 0 && (
        <Link to="/app/wardrobe/review" className="flex items-center justify-between rounded-[24px] bg-ink px-5 py-4 text-white">
          <span className="text-[15px]">
            {review} new {review === 1 ? 'piece' : 'pieces'} to review
          </span>
          <span className="text-[12px] uppercase">Review →</span>
        </Link>
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        {[
          { label: 'Pieces in your wardrobe', n: active, to: '/app/wardrobe' },
          { label: 'Saved looks', n: looks.data?.outfits.length, to: '/app/looks' },
          { label: 'Planned this week', n: plans.data?.plans.length, to: '/app/plan' },
        ].map((s) => (
          <Link key={s.label} to={s.to} className="rounded-[24px] bg-white/70 p-5 transition-colors hover:bg-white sm:p-6">
            {s.n === undefined ? <Skeleton className="h-12 w-16" /> : <p className="display text-[44px]">{s.n}</p>}
            <p className="mt-1 text-[13px] text-ink-soft">{s.label}</p>
          </Link>
        ))}
      </div>

      {newUser && (
        <section className="rounded-[28px] bg-white/70 p-6 sm:p-8">
          <h2 className="display text-[28px]">Getting started</h2>
          <ol className="mt-5 grid gap-4 sm:grid-cols-3">
            {[
              ['01', 'Add 10–15 pieces', 'Photograph the clothes you wear most. We tag them for you.', '/app/wardrobe?upload=1'],
              ['02', 'Get styled', 'Choose an occasion and see complete looks from your wardrobe.', '/app/style'],
              ['03', 'Shop smarter', 'See new pieces that would work with what you own.', '/app/discover'],
            ].map(([n, t, b, to]) => (
              <li key={n}>
                <Link to={to} className="block rounded-[20px] bg-white p-5 transition-colors hover:bg-page">
                  <span className="ghost-type text-[28px] text-ink/25">{n}</span>
                  <p className="mt-2 text-[15px] font-medium uppercase">{t}</p>
                  <p className="mt-1 text-[13px] leading-snug text-ink-soft">{b}</p>
                </Link>
              </li>
            ))}
          </ol>
        </section>
      )}

      {/* This week */}
      {plans.data && plans.data.plans.length > 0 && (
        <section>
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="text-[12px] uppercase text-mute">Coming up</h2>
            <Link to="/app/plan" className="text-[12px] uppercase underline-offset-4 hover:underline">
              Plan
            </Link>
          </div>
          <ul className="no-scrollbar -mx-4 flex gap-3 overflow-x-auto px-4 sm:mx-0 sm:px-0">
            {plans.data.plans.map((p) => (
              <li key={p.id} className="w-[180px] shrink-0">
                <Link to={`/app/looks/${p.outfit.id}`} className="block rounded-[22px] bg-white/70 p-2 hover:bg-white">
                  <OutfitCollage outfit={p.outfit} />
                  <p className="px-1 pt-2 text-[11px] uppercase text-mute">{new Date(`${p.date}T12:00:00`).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric' })}</p>
                  <p className="truncate px-1 pb-1 text-[13px]">{p.outfit.title}</p>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Finds */}
      {finds.data && finds.data.recommendations.length > 0 && (
        <section>
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="text-[12px] uppercase text-mute">New finds for your wardrobe</h2>
            <Link to="/app/discover" className="text-[12px] uppercase underline-offset-4 hover:underline">
              Discover
            </Link>
          </div>
          <ul className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {finds.data.recommendations.slice(0, 4).map((r) => (
              <li key={r.id}>
                <Link to="/app/discover" className="block rounded-[22px] bg-white/70 p-2 hover:bg-white">
                  <Img src={r.product.imageUrl} alt={r.product.title} fit="contain" className="aspect-square w-full rounded-[16px] bg-white" />
                  <p className="mt-2 line-clamp-2 px-1 text-[13px] leading-snug">{r.product.title}</p>
                  <p className="px-1 pb-1 text-[12px] text-ink-soft">
                    {formatPrice(r.product.price) ?? ''} {r.pairCount > 0 && `· pairs with ${r.pairCount}`}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
