import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router'
import { CATEGORIES, CATEGORY_LABELS } from '../../../shared/taxonomy'
import { api, errorMessage } from '../../lib/api'
import type { Item } from '../../lib/types'
import { usePageTitle } from '../hooks'
import { itemLabel } from '../parts/ItemCard'
import { PageHeader } from '../parts/PageHeader'
import { Card, EmptyState, ErrorState, Img, PageLoader, Swatch, cap } from '../ui'

type Insights = {
  measured: { savedLooks: number; upcomingPlans: number; wornLast60Days: number; mostWorn: { item: Item; count: number }[]; underused: Item[] }
  calculated: { totalItems: number; categories: Record<string, number>; colors: Record<string, number>; baseOutfits: number; mostVersatile: { item: Item; pairsWith: number }[] }
  suggestions: { text: string; category?: string }[]
}

function Tiles({ items, caption }: { items: { item: Item; note?: string }[]; caption: (i: { item: Item; note?: string }) => string }) {
  return (
    <ul className="mt-4 grid grid-cols-3 gap-2.5 sm:grid-cols-6">
      {items.map((x) => (
        <li key={x.item.id}>
          <Link to={`/app/wardrobe/${x.item.id}`} className="block">
            <Img src={x.item.thumbUrl} alt={itemLabel(x.item)} className="aspect-[3/4] w-full rounded-[14px]" />
            <p className="mt-1.5 truncate text-[11px] text-ink-soft">{caption(x)}</p>
          </Link>
        </li>
      ))}
    </ul>
  )
}

export default function InsightsPage() {
  usePageTitle('Insights')
  const q = useQuery({ queryKey: ['insights'], queryFn: () => api<Insights>('/insights') })
  if (q.isLoading) return <PageLoader />
  if (q.isError || !q.data) return <ErrorState message={errorMessage(q.error)} onRetry={() => q.refetch()} />
  const { measured, calculated, suggestions } = q.data
  if (!calculated.totalItems)
    return (
      <div>
        <PageHeader lines={['Wardrobe', 'insights']} alt={['insights']} />
        <EmptyState title="Insights grow with your wardrobe" body="Add a few pieces and start saving looks. We’ll show what you reach for, what you don’t, and where one new piece would go furthest." action={<Link to="/app/wardrobe?upload=1" className="inline-flex h-11 items-center rounded-full bg-ink px-6 text-[13px] uppercase text-white">Add clothes</Link>} />
      </div>
    )
  const maxCat = Math.max(1, ...Object.values(calculated.categories))
  const colors = Object.entries(calculated.colors).sort((a, b) => b[1] - a[1])
  return (
    <div>
      <PageHeader lines={['Wardrobe', 'insights']} alt={['insights']} sub="What you wear is from your saved and worn looks. What your wardrobe can do is calculated from each piece’s details." />

      <section aria-labelledby="measured">
        <h2 id="measured" className="text-[12px] uppercase text-mute">What you wear</h2>
        <div className="mt-3 grid grid-cols-3 gap-3">
          {[
            ['Saved looks', measured.savedLooks],
            ['Planned ahead', measured.upcomingPlans],
            ['Worn, last 60 days', measured.wornLast60Days],
          ].map(([l, n]) => (
            <Card key={l as string} className="!p-4 sm:!p-6">
              <p className="display text-[34px] sm:text-[48px]">{n}</p>
              <p className="mt-1 text-[12px] text-ink-soft">{l}</p>
            </Card>
          ))}
        </div>
        {measured.mostWorn.length > 0 && (
          <Card className="mt-3">
            <h3 className="text-[15px]">Most worn</h3>
            <Tiles items={measured.mostWorn.map((m) => ({ item: m.item, note: String(m.count) }))} caption={(x) => `${x.note}× · ${itemLabel(x.item)}`} />
          </Card>
        )}
        {measured.underused.length > 0 && (
          <Card className="mt-3">
            <h3 className="text-[15px]">Not in any saved or worn look yet</h3>
            <p className="mt-1 text-[13px] text-ink-soft">Pieces you’ve had for at least two weeks that haven’t made it into a look.</p>
            <Tiles items={measured.underused.map((item) => ({ item }))} caption={(x) => itemLabel(x.item)} />
          </Card>
        )}
      </section>

      <section aria-labelledby="calculated" className="mt-10">
        <h2 id="calculated" className="text-[12px] uppercase text-mute">What your wardrobe can do</h2>
        <div className="mt-3 grid gap-3 lg:grid-cols-2">
          <Card>
            <p className="display text-[48px]">{calculated.baseOutfits}</p>
            <p className="mt-1 text-[13px] text-ink-soft">top-and-bottom pairings and dresses that work together, from {calculated.totalItems} pieces</p>
            <ul className="mt-6 space-y-2.5">
              {CATEGORIES.map((c) => (
                <li key={c} className="grid grid-cols-[96px_1fr_28px] items-center gap-3 text-[13px]">
                  <span>{CATEGORY_LABELS[c]}</span>
                  <span className="h-2 overflow-hidden rounded-full bg-line">
                    <span className="block h-full rounded-full bg-ink" style={{ width: `${(calculated.categories[c] / maxCat) * 100}%` }} />
                  </span>
                  <span className="text-right text-ink-soft">{calculated.categories[c]}</span>
                </li>
              ))}
            </ul>
          </Card>
          <Card>
            <h3 className="text-[15px]">Your palette</h3>
            <ul className="mt-4 flex flex-wrap gap-2">
              {colors.map(([c, n]) => (
                <li key={c} className="flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-[13px]">
                  <Swatch color={c} /> {cap(c)} <span className="text-mute">{n}</span>
                </li>
              ))}
            </ul>
            {calculated.mostVersatile.length > 0 && (
              <>
                <h3 className="mt-6 text-[15px]">Most versatile</h3>
                <Tiles items={calculated.mostVersatile.map((v) => ({ item: v.item, note: String(v.pairsWith) }))} caption={(x) => `Pairs with ${x.note}`} />
              </>
            )}
          </Card>
        </div>
      </section>

      {suggestions.length > 0 && (
        <section aria-labelledby="suggestions" className="mt-10">
          <h2 id="suggestions" className="text-[12px] uppercase text-mute">Suggestions</h2>
          <ul className="mt-3 space-y-2">
            {suggestions.map((s, i) => (
              <li key={i} className="flex flex-col gap-2 rounded-[20px] bg-white/70 px-5 py-4 text-[14px] sm:flex-row sm:items-center sm:justify-between">
                <span>{s.text}</span>
                {s.category ? (
                  <Link to={`/app/discover`} className="shrink-0 text-[12px] uppercase underline underline-offset-4">
                    See matching finds
                  </Link>
                ) : (
                  <Link to="/app/style" className="shrink-0 text-[12px] uppercase underline underline-offset-4">
                    Style me
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
