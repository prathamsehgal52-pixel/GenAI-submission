import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { CATEGORIES, CATEGORY_LABELS, COLOR_FAMILIES, OCCASION_LABELS, OCCASIONS, SEASONS } from '../../../shared/taxonomy'
import { api, errorMessage } from '../../lib/api'
import type { Item, Upload } from '../../lib/types'
import { journey, useMe, usePageTitle } from '../hooks'
import { ItemCard } from '../parts/ItemCard'
import { PageHeader } from '../parts/PageHeader'
import { UploadDialog } from '../parts/UploadDialog'
import { Button, Chip, EmptyState, ErrorState, Img, Input, Notice, Select, Skeleton, Spinner, Swatch, cap } from '../ui'
import { useToast } from '../ui/toast'

type Facets = { categories: Record<string, number>; colors: Record<string, number>; seasons: Record<string, number>; occasions: Record<string, number>; statuses: Record<string, number> }
const PAGE = 60

function useDebounced<T>(v: T, ms = 300) {
  const [d, setD] = useState(v)
  useEffect(() => {
    const t = setTimeout(() => setD(v), ms)
    return () => clearTimeout(t)
  }, [v, ms])
  return d
}

/** Photos still being tagged, or whose tagging failed. Polls while active. */
function ProcessingTray() {
  const qc = useQueryClient()
  const toast = useToast()
  const uploads = useQuery({
    queryKey: ['uploads'],
    queryFn: () => api<{ uploads: Upload[] }>('/uploads'),
    refetchInterval: (q) => (q.state.data?.uploads.some((u) => u.recognitionStatus === 'pending' || u.recognitionStatus === 'running') ? 2500 : false),
  })
  const pending = uploads.data?.uploads.filter((u) => u.recognitionStatus === 'pending' || u.recognitionStatus === 'running') ?? []
  const failed = uploads.data?.uploads.filter((u) => u.recognitionStatus === 'failed') ?? []
  // When tagging finishes, new review items exist: refresh counts.
  const prev = useRef(pending.length)
  useEffect(() => {
    if (pending.length < prev.current) qc.invalidateQueries({ queryKey: ['facets'] })
    prev.current = pending.length
  }, [pending.length, qc])
  const retry = useMutation({
    mutationFn: (id: string) => api(`/uploads/${id}/retry`, { method: 'POST' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['uploads'] }),
    onError: (e) => toast(errorMessage(e), { tone: 'error' }),
  })
  const describe = useMutation({
    mutationFn: (id: string) => api<{ itemId: string }>(`/uploads/${id}/describe`, { method: 'POST' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['uploads'] })
      qc.invalidateQueries({ queryKey: ['facets'] })
    },
    onError: (e) => toast(errorMessage(e), { tone: 'error' }),
  })
  const discard = useMutation({
    mutationFn: (id: string) => api(`/uploads/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['uploads'] }),
    onError: (e) => toast(errorMessage(e), { tone: 'error' }),
  })
  if (!pending.length && !failed.length) return null
  return (
    <section aria-label="Photos in progress" className="mb-8 rounded-[24px] bg-white/70 p-4 sm:p-5">
      {pending.length > 0 && (
        <div className="flex items-center gap-4">
          <div className="flex -space-x-3">
            {pending.slice(0, 5).map((u) => (
              <Img key={u.id} src={u.thumbUrl} alt="" className="h-11 w-11 rounded-full ring-2 ring-white" />
            ))}
          </div>
          <p className="flex items-center gap-2 text-[14px]" aria-live="polite">
            <Spinner className="h-4 w-4" /> Tagging {pending.length} {pending.length === 1 ? 'photo' : 'photos'}…
          </p>
        </div>
      )}
      {failed.length > 0 && (
        <ul className={`space-y-2 ${pending.length ? 'mt-4 border-t border-line pt-4' : ''}`}>
          {failed.map((u) => (
            <li key={u.id} className="flex flex-wrap items-center gap-3">
              <Img src={u.thumbUrl} alt="" className="h-11 w-11 rounded-[12px]" />
              <p className="min-w-[180px] flex-1 text-[13px] text-ink-soft">
                {u.errorCode === 'quota_exceeded' ? 'Automatic tagging limit reached for today.' : 'We couldn’t tag this photo automatically.'}
              </p>
              <div className="flex gap-1.5">
                {u.errorCode !== 'quota_exceeded' && (
                  <Button size="sm" variant="light" onClick={() => retry.mutate(u.id)} loading={retry.isPending && retry.variables === u.id}>
                    Retry
                  </Button>
                )}
                <Button size="sm" variant="light" onClick={() => describe.mutate(u.id)}>
                  Describe it myself
                </Button>
                <Button size="sm" variant="ghost" onClick={() => discard.mutate(u.id)}>
                  Discard
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

export default function Wardrobe() {
  usePageTitle('Wardrobe')
  const [params, setParams] = useSearchParams()
  const me = useMe()
  const [uploadOpen, setUploadOpen] = useState(params.get('upload') === '1')
  const status = (params.get('status') as 'active' | 'archived') ?? 'active'
  const category = params.get('category')
  const color = params.get('color')
  const season = params.get('season')
  const occasion = params.get('occasion')
  const favorite = params.get('favorite') === 'true'
  const sort = params.get('sort') ?? 'recent'
  const [search, setSearch] = useState(params.get('q') ?? '')
  const q = useDebounced(search)
  const [limit, setLimit] = useState(PAGE)

  const set = (k: string, v: string | null) => setMany({ [k]: v })
  const setMany = (changes: Record<string, string | null>) => {
    const next = new URLSearchParams(params)
    for (const [k, v] of Object.entries(changes)) {
      if (v) next.set(k, v)
      else next.delete(k)
    }
    next.delete('upload')
    next.delete('welcome')
    setParams(next, { replace: true })
    setLimit(PAGE)
  }
  useEffect(() => {
    if (q !== (params.get('q') ?? '')) set('q', q || null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q])

  const facets = useQuery({ queryKey: ['facets'], queryFn: () => api<Facets>('/wardrobe/facets') })
  const qs = new URLSearchParams({ status, sort, limit: String(limit) })
  if (category) qs.set('category', category)
  if (color) qs.set('color', color)
  if (season) qs.set('season', season)
  if (occasion) qs.set('occasion', occasion)
  if (favorite) qs.set('favorite', 'true')
  if (q) qs.set('q', q)
  const items = useQuery({ queryKey: ['wardrobe', qs.toString()], queryFn: () => api<{ items: Item[]; total: number }>(`/wardrobe?${qs}`), placeholderData: keepPreviousData })

  const reviewCount = facets.data?.statuses.review ?? 0
  const activeCount = facets.data?.statuses.active ?? 0
  const archivedCount = facets.data?.statuses.archived ?? 0
  const filtered = !!(category || color || season || occasion || favorite || q)
  const welcome = params.get('welcome') === '1'
  useEffect(() => {
    journey.justOnboarded = false
  }, [])

  return (
    <div>
      <PageHeader eyebrow={`${activeCount} ${activeCount === 1 ? 'piece' : 'pieces'}`} lines={['My', 'wardrobe']} alt={['wardrobe']}>
        <Button onClick={() => setUploadOpen(true)}>Add clothes</Button>
      </PageHeader>

      {welcome && activeCount === 0 && (
        <div className="mb-6">
          <Notice>Start with 10–15 pieces you wear often: a few tops, bottoms, shoes and a jacket. That’s enough for your first outfits.</Notice>
        </div>
      )}
      {!me.data?.capabilities.autoTagging && (
        <div className="mb-6">
          <Notice>Automatic tagging is unavailable right now, so new photos will need a few details from you. Everything else works as usual.</Notice>
        </div>
      )}

      <ProcessingTray />

      {reviewCount > 0 && (
        <Link to="/app/wardrobe/review" className="mb-8 flex items-center justify-between gap-4 rounded-[24px] bg-ink px-5 py-4 text-white transition-colors hover:bg-[#2a2a2c]">
          <span className="text-[15px]">
            {reviewCount} {reviewCount === 1 ? 'piece is' : 'pieces are'} ready to review
          </span>
          <span className="text-[12px] uppercase">Review →</span>
        </Link>
      )}

      {/* Filters */}
      <div className="space-y-3">
        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <div className="relative md:w-[320px]">
            <Input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, colour, brand, tag" aria-label="Search your wardrobe" className="!h-11 pl-11" />
            <svg viewBox="0 0 24 24" aria-hidden="true" className="pointer-events-none absolute left-4 top-3 h-5 w-5 text-mute">
              <path d="M11 4a7 7 0 1 0 4.4 12.4L20 21" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </div>
          <div className="grid flex-1 grid-cols-2 gap-2 sm:grid-cols-4">
            <Select aria-label="Colour" value={color ?? ''} onChange={(e) => set('color', e.target.value || null)} className="!h-11 text-[13px]">
              <option value="">Any colour</option>
              {COLOR_FAMILIES.filter((c) => facets.data?.colors[c]).map((c) => (
                <option key={c} value={c}>
                  {cap(c)} ({facets.data?.colors[c]})
                </option>
              ))}
            </Select>
            <Select aria-label="Season" value={season ?? ''} onChange={(e) => set('season', e.target.value || null)} className="!h-11 text-[13px]">
              <option value="">Any season</option>
              {SEASONS.map((s) => (
                <option key={s} value={s}>
                  {cap(s)}
                </option>
              ))}
            </Select>
            <Select aria-label="Occasion" value={occasion ?? ''} onChange={(e) => set('occasion', e.target.value || null)} className="!h-11 text-[13px]">
              <option value="">Any occasion</option>
              {OCCASIONS.map((o) => (
                <option key={o} value={o}>
                  {OCCASION_LABELS[o]}
                </option>
              ))}
            </Select>
            <Select aria-label="Sort" value={sort} onChange={(e) => set('sort', e.target.value === 'recent' ? null : e.target.value)} className="!h-11 text-[13px]">
              <option value="recent">Newest first</option>
              <option value="oldest">Oldest first</option>
              <option value="name">Name A–Z</option>
            </Select>
          </div>
        </div>
        <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
          <Chip selected={!category && !favorite} onClick={() => setMany({ category: null, favorite: null })} count={activeCount}>
            All
          </Chip>
          {CATEGORIES.map((c) => (
            <Chip key={c} selected={category === c} onClick={() => setMany({ category: category === c ? null : c, favorite: null })} count={facets.data?.categories[c] ?? 0}>
              {CATEGORY_LABELS[c]}
            </Chip>
          ))}
          <Chip selected={favorite} onClick={() => set('favorite', favorite ? null : 'true')}>
            Favourites
          </Chip>
          {archivedCount > 0 && (
            <Chip selected={status === 'archived'} onClick={() => set('status', status === 'archived' ? null : 'archived')} count={archivedCount}>
              Archived
            </Chip>
          )}
          {color && (
            <button type="button" onClick={() => set('color', null)} className="flex h-9 shrink-0 items-center gap-2 rounded-full bg-white px-3 text-[13px]" aria-label={`Remove colour filter ${color}`}>
              <Swatch color={color} /> {cap(color)} ×
            </button>
          )}
        </div>
      </div>

      {/* Grid */}
      <div className="mt-6">
        {items.isLoading ? (
          <div className="grid grid-cols-2 gap-2.5 sm:gap-3.5 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {Array.from({ length: 10 }).map((_, i) => (
              <Skeleton key={i} className="aspect-[3/4]" />
            ))}
          </div>
        ) : items.isError ? (
          <ErrorState message={errorMessage(items.error)} onRetry={() => items.refetch()} />
        ) : items.data && items.data.items.length === 0 ? (
          filtered || status === 'archived' ? (
            <EmptyState title="Nothing here" body={status === 'archived' ? 'You haven’t archived anything.' : 'No pieces match these filters.'} action={<Button variant="light" onClick={() => setParams({}, { replace: true })}>Clear filters</Button>} />
          ) : (
            <EmptyState
              title="Your wardrobe starts here"
              body="Photograph the clothes you own: on a hanger, laid flat or worn. We’ll tag each piece so your stylist can start building outfits."
              action={<Button onClick={() => setUploadOpen(true)}>Add your first pieces</Button>}
            />
          )
        ) : (
          <>
            <p className="sr-only" aria-live="polite">
              Showing {items.data?.items.length} of {items.data?.total} pieces
            </p>
            <div className="grid grid-cols-2 gap-2.5 sm:gap-3.5 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {items.data?.items.map((i) => <ItemCard key={i.id} item={i} />)}
            </div>
            {items.data && items.data.total > items.data.items.length && (
              <div className="mt-8 flex justify-center">
                <Button variant="light" onClick={() => setLimit((l) => l + PAGE)} loading={items.isFetching}>
                  Show more ({items.data.total - items.data.items.length} more)
                </Button>
              </div>
            )}
          </>
        )}
      </div>

      <UploadDialog
        open={uploadOpen}
        onClose={() => {
          setUploadOpen(false)
          set('upload', null)
        }}
      />
    </div>
  )
}
