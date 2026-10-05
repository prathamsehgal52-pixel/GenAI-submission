import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { CATEGORIES, CATEGORY_LABELS } from '../../../shared/taxonomy'
import { api, errorMessage } from '../../lib/api'
import type { Recommendation } from '../../lib/types'
import { usePageTitle } from '../hooks'
import { itemLabel } from '../parts/ItemCard'
import { PageHeader } from '../parts/PageHeader'
import { Button, Chip, EmptyState, ErrorState, Heart, Img, Select, Skeleton, Sparkle, formatPrice, timeAgo } from '../ui'
import { useToast } from '../ui/toast'

type Feed = {
  available: boolean
  recommendations: Recommendation[]
  latestRun: { id: string; status: string; errorCode: string | null; finishedAt: string | null; createdAt: string; recommendationsCreated: number } | null
}

const availabilityText: Record<string, string | null> = {
  in_stock: 'In stock',
  out_of_stock: 'Out of stock',
  listed: 'Listed',
  unknown: null,
}

function ProductCard({ rec, onStatus }: { rec: Recommendation; onStatus: (status: 'saved' | 'new' | 'dismissed') => void }) {
  const p = rec.product
  const price = formatPrice(p.price)
  const saved = rec.status === 'saved'
  const avail = availabilityText[p.availability]
  return (
    <article className="flex flex-col overflow-hidden rounded-[24px] bg-white/70" style={{ animation: 'fade-up 400ms both' }}>
      <div className="relative bg-white">
        <Img src={p.imageUrl} alt={p.title} fit="contain" className="aspect-[4/5] w-full" />
        <button
          type="button"
          onClick={() => onStatus(saved ? 'new' : 'saved')}
          aria-pressed={saved}
          aria-label={saved ? 'Remove from saved' : 'Save'}
          className={`absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-full shadow-sm transition-colors ${saved ? 'bg-ink text-white' : 'bg-white text-ink hover:bg-ink hover:text-white'}`}
        >
          <Heart filled={saved} />
        </button>
        {rec.pairCount > 0 && (
          <span className="absolute bottom-3 left-3 flex items-center gap-1.5 rounded-full bg-ink/85 px-3 py-1.5 text-[11px] text-white backdrop-blur">
            <Sparkle className="h-3 w-3" /> Pairs with {rec.pairCount} of your pieces
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col p-4">
        <p className="text-[11px] uppercase text-mute">{p.attribution}</p>
        <h3 className="mt-1 line-clamp-2 text-[15px] leading-snug">{p.title}</h3>
        <div className="mt-2 flex flex-wrap items-baseline gap-x-2 text-[13px]">
          {price ? <span className="font-medium">{price}</span> : <span className="text-ink-soft">Price on retailer site</span>}
          {p.condition && <span className="text-ink-soft">· {p.condition}</span>}
          {avail && <span className="text-ink-soft">· {avail}</span>}
        </div>
        <p className="mt-0.5 text-[11px] text-mute">Checked {timeAgo(p.lastVerifiedAt)}</p>

        <ul className="mt-3 space-y-1.5 text-[13px] leading-snug text-ink-soft">
          {rec.reasons.slice(0, 3).map((r, i) => (
            <li key={i} className="flex gap-2">
              <span aria-hidden="true" className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-ink" />
              {r.text}
            </li>
          ))}
        </ul>

        {rec.pairsWith.length > 0 && (
          <div className="mt-3 flex items-center gap-1.5" aria-label="Works with these pieces you own">
            {rec.pairsWith.map((i) => (
              <Link key={i.id} to={`/app/wardrobe/${i.id}`} title={itemLabel(i)}>
                <Img src={i.thumbUrl} alt={itemLabel(i)} className="h-12 w-10 rounded-[10px]" />
              </Link>
            ))}
          </div>
        )}

        <div className="mt-auto flex items-center gap-2 pt-4">
          <a
            href={p.productUrl}
            target="_blank"
            rel="noopener noreferrer sponsored"
            className="inline-flex h-10 flex-1 items-center justify-center rounded-full bg-ink px-4 text-[12px] uppercase text-white transition-colors hover:bg-[#2e2f31]"
          >
            View at {p.retailer && p.provider !== 'ebay' ? p.retailer : p.provider === 'ebay' ? 'eBay' : 'retailer'}
            <span className="sr-only"> (opens in a new tab)</span>
          </a>
          {rec.status !== 'dismissed' ? (
            <button type="button" onClick={() => onStatus('dismissed')} className="h-10 rounded-full px-4 text-[12px] uppercase text-ink-soft transition-colors hover:bg-white hover:text-ink">
              Not for me
            </button>
          ) : (
            <button type="button" onClick={() => onStatus('new')} className="h-10 rounded-full px-4 text-[12px] uppercase text-ink-soft transition-colors hover:bg-white hover:text-ink">
              Restore
            </button>
          )}
        </div>
      </div>
    </article>
  )
}

export default function Discover() {
  usePageTitle('Discover')
  const qc = useQueryClient()
  const toast = useToast()
  const [tab, setTab] = useState<'new' | 'saved' | 'dismissed'>('new')
  const [category, setCategory] = useState<string | null>(null)
  const [sort, setSort] = useState('match')
  const [runId, setRunId] = useState<string | null>(null)

  const feed = useQuery({
    queryKey: ['discover', tab, category, sort],
    queryFn: () => api<Feed>(`/discovery?status=${tab}&sort=${sort}${category ? `&category=${category}` : ''}`),
  })
  const run = useQuery({
    queryKey: ['discover-run', runId],
    queryFn: () => api<{ run: { id: string; status: string; errorCode: string | null; recommendationsCreated: number } }>(`/discovery/runs/${runId}`),
    enabled: !!runId,
    refetchInterval: (q) => (q.state.data && !['queued', 'running'].includes(q.state.data.run.status) ? false : 2000),
  })
  useEffect(() => {
    const r = run.data?.run
    if (!r || ['queued', 'running'].includes(r.status)) return
    setRunId(null)
    qc.invalidateQueries({ queryKey: ['discover'] })
    if (r.status === 'failed') toast('We couldn’t reach our product sources just now. Please try again later.', { tone: 'error' })
    else if (r.errorCode === 'wardrobe_too_small') toast('Add at least three pieces to your wardrobe first.')
    else toast(r.recommendationsCreated ? `${r.recommendationsCreated} new ${r.recommendationsCreated === 1 ? 'find' : 'finds'} for you.` : 'Up to date. Nothing new right now.')
  }, [run.data, qc, toast])

  const refresh = useMutation({
    mutationFn: () => api<{ run: { id: string; status: string } }>('/discovery/refresh', { method: 'POST' }),
    onSuccess: (r) => setRunId(r.run.id),
    onError: (e) => toast(errorMessage(e), { tone: 'error' }),
  })
  const status = useMutation({
    mutationFn: ({ rec, to }: { rec: Recommendation; to: 'saved' | 'new' | 'dismissed' }) => {
      if (to === 'saved') return api(`/discovery/${rec.id}/save`, { method: 'POST' })
      if (to === 'dismissed') return api(`/discovery/${rec.id}/dismiss`, { method: 'POST' })
      return rec.status === 'saved' ? api(`/discovery/${rec.id}/save`, { method: 'DELETE' }) : api(`/discovery/${rec.id}/restore`, { method: 'POST' })
    },
    onMutate: ({ rec, to }) => {
      const key = ['discover', tab, category, sort]
      const prev = qc.getQueryData<Feed>(key)
      // "For you" keeps saved items visible (with a filled heart); other moves leave the current tab.
      const stays = tab === 'new' && (to === 'saved' || to === 'new')
      qc.setQueryData<Feed>(key, (d) =>
        d ? { ...d, recommendations: stays ? d.recommendations.map((r) => (r.id === rec.id ? { ...r, status: to } : r)) : d.recommendations.filter((r) => r.id !== rec.id) } : d,
      )
      return { prev, key }
    },
    onSuccess: (_d, { to }) => {
      if (to === 'dismissed') toast('Hidden. We won’t suggest it again.')
      if (to === 'saved') toast('Saved.')
      qc.invalidateQueries({ queryKey: ['discover'], predicate: (q) => q.queryKey[1] !== tab })
    },
    onError: (e, _v, ctx) => {
      if (ctx) qc.setQueryData(ctx.key, ctx.prev)
      toast(errorMessage(e), { tone: 'error' })
    },
  })

  const busy = refresh.isPending || !!runId
  const d = feed.data
  const recs = tab === 'new' ? d?.recommendations.filter((r) => r.status !== 'dismissed') : d?.recommendations

  return (
    <div>
      <PageHeader
        eyebrow="New releases, matched to your wardrobe"
        lines={['Find what', 'completes you.']}
        alt={['completes']}
        sub="Real products from our retail partners, ranked by how well they work with the clothes you already own."
      >
        {d?.available && (
          <Button onClick={() => refresh.mutate()} loading={busy}>
            {busy ? 'Finding…' : 'Refresh finds'}
          </Button>
        )}
      </PageHeader>

      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex gap-2" role="tablist" aria-label="Finds">
          {(['new', 'saved', 'dismissed'] as const).map((t) => (
            <button key={t} type="button" role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className={`h-10 rounded-full px-4 text-[13px] uppercase transition-colors ${tab === t ? 'bg-ink text-white' : 'bg-white/60 hover:bg-white'}`}>
              {t === 'new' ? 'For you' : t === 'saved' ? 'Saved' : 'Hidden'}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <Select aria-label="Sort" value={sort} onChange={(e) => setSort(e.target.value)} className="!h-10 text-[13px]">
            <option value="match">Best match</option>
            <option value="price_asc">Price: low to high</option>
            <option value="price_desc">Price: high to low</option>
            <option value="newest">Newest</option>
          </Select>
        </div>
      </div>
      <div className="no-scrollbar -mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
        <Chip selected={!category} onClick={() => setCategory(null)}>
          All
        </Chip>
        {CATEGORIES.map((c) => (
          <Chip key={c} selected={category === c} onClick={() => setCategory(c)}>
            {CATEGORY_LABELS[c]}
          </Chip>
        ))}
      </div>

      <div className="mt-6">
        {feed.isLoading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="aspect-[3/5]" />
            ))}
          </div>
        ) : feed.isError ? (
          <ErrorState message={errorMessage(feed.error)} onRetry={() => feed.refetch()} />
        ) : !d!.available && tab === 'new' && !recs?.length ? (
          <EmptyState title="New finds are on their way" body="Product suggestions aren’t available at the moment. Your wardrobe, stylist and saved looks all work as usual. Check back soon." />
        ) : !recs?.length ? (
          tab === 'new' ? (
            <EmptyState
              title={busy ? 'Looking for pieces…' : 'Nothing here yet'}
              body={
                d!.latestRun?.errorCode === 'wardrobe_too_small'
                  ? 'Add at least three pieces to your wardrobe so we can match new products to what you own.'
                  : d!.latestRun?.status === 'failed'
                    ? 'Our product sources didn’t respond last time. Try refreshing again in a little while.'
                    : 'Refresh to search new releases that work with your wardrobe.'
              }
              action={
                d!.latestRun?.errorCode === 'wardrobe_too_small' ? (
                  <Link to="/app/wardrobe?upload=1" className="inline-flex h-11 items-center rounded-full bg-ink px-6 text-[13px] uppercase text-white">
                    Add clothes
                  </Link>
                ) : (
                  <Button onClick={() => refresh.mutate()} loading={busy}>
                    Refresh finds
                  </Button>
                )
              }
            />
          ) : (
            <EmptyState title={tab === 'saved' ? 'Nothing saved yet' : 'Nothing hidden'} body={tab === 'saved' ? 'Tap the heart on a find to keep it here for later.' : 'Pieces you mark “Not for me” appear here, in case you change your mind.'} />
          )
        ) : (
          <>
            {d!.latestRun?.finishedAt && tab === 'new' && <p className="mb-4 text-[12px] text-mute">Last refreshed {timeAgo(d!.latestRun.finishedAt)}</p>}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {recs.map((r) => (
                <ProductCard key={r.id} rec={r} onStatus={(to) => status.mutate({ rec: r, to })} />
              ))}
            </div>
            <p className="mt-8 text-center text-[11px] text-mute">Prices and availability are as last checked and can change. Purchases are made on the retailer’s site. We may earn a commission from some links.</p>
          </>
        )}
      </div>
    </div>
  )
}
